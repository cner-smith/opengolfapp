import { uuid } from 'expo-modules-core'
import type { User } from '@supabase/supabase-js'
import {
  inferHoleStats,
  reviewedRowToShotFields,
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
// recreating them: each reviewed row is paired back to its live shot by the
// shot's id (shot_number only for a row without one) so the shot's client id
// (and its live-captured aim) carry
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
      aim_lat: aimLat,
      aim_lng: aimLng,
      // The reviewed row is authoritative for OB (reviewedRowToShotFields
      // takes no stored `ob`). Safe because the row genuinely arrives
      // carrying the flag: useHoleData's remoteShotObs/previousShotObs read
      // the fetched `shots.ob` (so it survives a mid-hole reload) →
      // useShotActions' `shotObs` (obOverride wins over a lagging refetch) →
      // LiveRoundSession's `summaryRows` stamps `shotResult: 'ob'` →
      // HoleReviewSheet hydrates `rows` from those `initialRows` → back here.
      // If that seed path is ever broken, every OB flag is silently dropped —
      // keep the two in step (#839). Nothing seeds `row.penalty`, so the
      // stored flag is passed as the fallback.
      ...reviewedRowToShotFields(row, existing?.penalty),
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
