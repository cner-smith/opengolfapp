import { uuid } from 'expo-modules-core'
import type { User } from '@supabase/supabase-js'
import {
  combinedBreakDirection,
  combinedPuttResult,
  inferHoleStats,
  isPuttEntry,
  type ReviewedShotRow,
} from '@oga/core'
import { supabase } from '../../../lib/supabase'
import {
  allShotsForHoleScore,
  enqueueHoleScorePatch,
  upsertReviewedShot,
  type ShotPayload,
} from '../../../lib/db'
import { syncPendingShots } from '../../../lib/sync'
import type { UseHoleDataResult } from './useHoleData'

// HoleReviewSheet's rows carry the id of the shot each was built from, so the
// save can pair by id after a delete renumbers them.
export type ReviewedRowWithId = ReviewedShotRow & { _shotId?: string }

// End-of-hole save. Mirrors the web review sheet's replace-all write, but
// attaches metadata to the shots the player already logged live rather than
// recreating them: each reviewed row is paired back to its live shot by
// shot_number so the shot's client id (and its live-captured aim) carry
// through, and the merged payload is re-queued via upsertReviewedShot →
// idempotent re-sync updates the same server row (no delete, no duplicates
// offline). Then the hole_scores tallies are written and the hole advances.
// Throws on failure; the caller (useShotActions.saveHoleSummary) owns the
// in-flight guard, the alert and the advance. Split out for #1015.
export async function writeHoleSummary(args: {
  user: User
  currentHoleScore: NonNullable<UseHoleDataResult['currentHoleScore']>
  currentHole: NonNullable<UseHoleDataResult['currentHole']>
  rows: ReviewedRowWithId[]
  summary: { score: number; putts: number; penalties: number }
  setHoleScores: UseHoleDataResult['setHoleScores']
}): Promise<void> {
  const { user, currentHoleScore, currentHole, rows, summary, setHoleScores } = args
  // Pair reviewed rows to the live shots by the shot's id (the sheet's
  // _shotId), falling back to shot_number only for a row without one.
  // Not by number alone: a delete in the sheet renumbers its rows (and
  // delete_shot renumbers the server), so row N would pair to the shot
  // that USED to be N, and the upsert would collide on
  // unique(hole_score_id, shot_number) and get quarantined. Local queue
  // (pending + synced) is the primary source for id + live aim; the
  // remote table is the fallback for a shot whose local row was purged
  // after a prior session's sync (restart mid-hole). BOTH reads get a
  // one-retry (mirrors useHoleData's SQLite/remote reads) — a transient
  // failure that empties either map must not silently strand a shot on
  // the abort path below.
  let localRows = await allShotsForHoleScore(currentHoleScore.id).catch(
    () => null,
  )
  if (localRows === null) {
    localRows = await allShotsForHoleScore(currentHoleScore.id).catch(() => null)
  }
  const localOk = localRows !== null
  localRows ??= []
  const localByNum = new Map<number, ShotPayload>()
  const localById = new Map<string, ShotPayload>()
  for (const r of localRows) {
    try {
      const p = JSON.parse(r.payload) as ShotPayload
      if (p.id) localById.set(p.id, p)
      if (p.id && p.shot_number != null) localByNum.set(p.shot_number, p)
    } catch {
      // skip malformed pending payload
    }
  }
  type RemoteShot = {
    id: string
    aim_lat: number | null
    aim_lng: number | null
    ob: boolean
    penalty: boolean
  }
  const remoteByNum = new Map<number, RemoteShot>()
  const remoteById = new Map<string, RemoteShot>()
  let remote = await supabase
    .from('shots')
    .select('id, shot_number, aim_lat, aim_lng, ob, penalty')
    .eq('hole_score_id', currentHoleScore.id)
  if (remote.error) {
    remote = await supabase
      .from('shots')
      .select('id, shot_number, aim_lat, aim_lng, ob, penalty')
      .eq('hole_score_id', currentHoleScore.id)
  }
  for (const s of remote.data ?? []) {
    const shot = {
      id: s.id,
      aim_lat: s.aim_lat,
      aim_lng: s.aim_lng,
      ob: s.ob,
      penalty: s.penalty,
    }
    remoteByNum.set(s.shot_number, shot)
    remoteById.set(s.id, shot)
  }

  for (const row of rows) {
    const isPuttRow = isPuttEntry(row.lieType, row.club)
    const existing = row._shotId
      ? localById.get(row._shotId) ?? remoteById.get(row._shotId)
      : localByNum.get(row.shotNumber) ?? remoteByNum.get(row.shotNumber)
    // The reviewed rows were built from these very shots, so each MUST
    // pair back to one. If both reads came up empty for this shot_number
    // (both transiently failed above), fabricating a fresh id would queue
    // a row that collides with the existing shot on unique(hole_score_id,
    // shot_number) — a novel id isn't arbitrated by the sync upsert's
    // onConflict:'id', so it 23505s and gets silently quarantined, losing
    // this shot's metadata. Abort loudly instead: the sheet stays open
    // with the player's edits intact (hydration is gated), so Save simply
    // retries once the read recovers. Never mint a colliding id.
    // Both reads answered and neither has this shot (by id or number): it's gone
    // (quarantined by the sync queue — #994), not unreachable. A fresh id
    // can't collide on unique(hole_score_id, shot_number) then, so re-create
    // it from the reviewed row instead of stranding the hole unsaveable.
    const lost =
      !existing?.id && localOk && !remote.error &&
      !localByNum.has(row.shotNumber) && !remoteByNum.has(row.shotNumber)
    if (!existing?.id && !lost) {
      throw new Error(
        "Couldn't reach this hole's shots — check your connection and save again.",
      )
    }
    const id = existing?.id ?? uuid.v4()
    // Keep the aim captured live (SET_AIM); the review sheet doesn't edit
    // non-putt aim, so the live value is authoritative. `existing` is a
    // queued payload or the remote row — both carry aim_lat/aim_lng.
    const aimLat = existing?.aim_lat ?? null
    const aimLng = existing?.aim_lng ?? null
    const payload: ShotPayload = {
      id,
      hole_score_id: currentHoleScore.id,
      user_id: user.id,
      shot_number: row.shotNumber,
      start_lat: row.startLat,
      start_lng: row.startLng,
      end_lat: row.endLat,
      end_lng: row.endLng,
      aim_lat: aimLat,
      aim_lng: aimLng,
      distance_to_target: isPuttRow ? null : Math.round(row.distanceToPin),
      club: row.club,
      lie_type: row.lieType,
      lie_slope: null,
      lie_slope_forward: isPuttRow ? null : row.lieSlopeForward ?? null,
      lie_slope_side: isPuttRow ? null : row.lieSlopeSide ?? null,
      shot_result: isPuttRow ? null : row.shotResult ?? null,
      contact: isPuttRow ? null : row.contact ?? null,
      shape: isPuttRow ? null : row.shape ?? null,
      start_line: isPuttRow ? null : row.startLine ?? null,
      // The reviewed ROW is authoritative for OB — no `existing.ob ||`
      // fallback. The sheet renders SHOT_RESULTS as a single-select
      // picker, so a fallback would let one tap ("it was a pull") write
      // shot_result='pull' while ob stayed true, leaving a row that SG
      // charges −2 and the map badges red but whose label says pull, with
      // no path from the sheet to clear it.
      //
      // Safe because the row genuinely arrives carrying the flag:
      // useHoleData's remoteShotObs/previousShotObs read the fetched
      // `shots.ob` (so it survives a mid-hole reload) → useShotActions'
      // `shotObs` (obOverride wins over a lagging refetch) →
      // LiveRoundSession's `summaryRows` stamps `shotResult: 'ob'` →
      // HoleReviewSheet hydrates `rows` from those `initialRows` →
      // back here as `rows`. saveHoleSummary has exactly one caller (that
      // sheet, for the live hole), so the seed always fires. If that seed
      // path is ever broken, this line silently drops every OB flag —
      // keep the two in step (#839).
      penalty: row.penalty ?? existing?.penalty ?? false,
      // A putt cannot be out of bounds. `shot_result` is already
      // putt-gated one line up, so without the same gate here a row
      // whose result was 'ob' and whose lie was THEN changed to green
      // persists ob=true with shot_result=null — and sg-calculator's
      // OB branch sits ahead of holedOut, so a made putt on that row
      // books -2 putting instead of ~+0.1 (#839).
      ob: isPuttRow ? false : row.shotResult === 'ob',
      // Putt tap-to-tap distance is in yards; * 3 = feet (US convention),
      // and putt_distance_ft is what the rest of the app reads.
      putt_distance_ft: isPuttRow && row.distanceYards * 3 <= 999.9 ? Math.round(row.distanceYards * 3) : null,
      putt_result: !isPuttRow
        ? null
        : combinedPuttResult({
            made: row.puttMade,
            distance: row.puttDistanceResult ?? null,
            direction: row.puttDirectionResult ?? null,
          }),
      putt_distance_result:
        !isPuttRow || row.puttMade ? null : row.puttDistanceResult ?? null,
      putt_direction_result:
        !isPuttRow || row.puttMade ? null : row.puttDirectionResult ?? null,
      putt_slope_pct: isPuttRow ? row.puttSlopePct ?? null : null,
      green_speed: isPuttRow ? row.greenSpeed ?? null : null,
      break_direction: isPuttRow
        ? combinedBreakDirection({
            vertical: row.breakDirectionVertical,
            horizontal: row.breakDirectionHorizontal,
          })
        : null,
      break_direction_vertical: isPuttRow
        ? row.breakDirectionVertical ?? null
        : null,
      break_direction_horizontal: isPuttRow
        ? row.breakDirectionHorizontal ?? null
        : null,
      aim_offset_yards:
        isPuttRow && row.aimOffsetInches != null
          ? Math.round((row.aimOffsetInches / 36) * 10) / 10
          : null,
      notes: row.notes ?? null,
    }
    await upsertReviewedShot(payload)
  }
  // Background sync — the re-queued rows carry their metadata now.
  syncPendingShots().catch(() => undefined)

  // Authoritative hole_scores tallies from the review. fairway/gir are
  // inferred from the placed lies; holedOut=true because this flow ends at
  // the pin by construction (matches web's saveReviewedHole). An explicit
  // scorecard toggle is never overwritten (?? guards).
  const inferred = inferHoleStats(
    rows.map((r) => ({
      shot_number: r.shotNumber,
      lie_type: r.lieType,
      // Required: shot_number is not the stroke number on an OB hole, so
      // inferGir needs the penalty strokes to size its thresholds (#839).
      shotResult: r.shotResult,
    })),
    currentHole.par,
    true,
  )
  setHoleScores((prev) =>
    prev.map((hs) =>
      hs.id === currentHoleScore.id
        ? {
            ...hs,
            score: summary.score,
            putts: summary.putts,
            penalties: summary.penalties,
          }
        : hs,
    ),
  )
  await enqueueHoleScorePatch(currentHoleScore, {
    score: summary.score,
    putts: summary.putts,
    penalties: summary.penalties,
    fairway_hit: currentHoleScore.fairway_hit ?? inferred.fairway,
    gir: currentHoleScore.gir ?? inferred.gir,
  })
  syncPendingShots().catch(() => undefined)
}
