import type { Database } from '@oga/supabase'
import { inferHoleStats } from './holeInference'
import { reviewedRowToShotFields, type ReviewedShotRow } from './round'

type ShotInsert = Database['public']['Tables']['shots']['Insert']

// The mobile end-of-hole save (#1454). Lives in its own file because round.ts
// is close to the 1000-line cap.

// The review sheet's rows carry the id of the shot each was built from, so the
// save can pair by id after a delete renumbers them.
export type ReviewedRowWithId = ReviewedShotRow & { _shotId?: string }

/** A `shots` row as the save reads it from the server. */
export interface RemoteShotForPairing {
  id: string
  shot_number: number
  aim_lat: number | null
  aim_lng: number | null
  penalty: boolean
}

const UNREACHABLE_SHOTS_MESSAGE =
  "Couldn't reach this hole's shots — check your connection and save again."

/**
 * Pairs each reviewed row back to the live shot it was built from and returns
 * the payload to re-queue for it, or an Error when a row can't be paired
 * safely (nothing should be written then).
 *
 * Pairs by the shot's id (`_shotId`), by shot_number only for a row without
 * one. Not by number alone: a delete in the sheet renumbers its rows (and
 * delete_shot renumbers the server), so row N would pair to the shot that USED
 * to be N and the upsert would collide on unique(hole_score_id, shot_number)
 * and get quarantined. The local queue (pending + synced payloads, as JSON) is
 * the primary source for the id and the live aim; the remote rows are the
 * fallback for a shot whose local row was purged after an earlier session's
 * sync.
 *
 * Never mint a colliding id: a row that pairs to nothing is an abort, unless
 * both reads answered (`localOk`, `remoteOk`) and neither has its shot_number.
 * Then the shot is gone (quarantined by the sync queue, #994), a fresh id
 * can't collide, and it is re-created from the row with `newId()`. A fresh id
 * is not arbitrated by the sync upsert's onConflict:'id', so minting one for a
 * shot that still exists would 23505 and be silently quarantined.
 */
export function pairReviewedRows(input: {
  rows: readonly ReviewedRowWithId[]
  /** The local queue's payloads (JSON), pending and synced. */
  local: readonly string[]
  remote: readonly RemoteShotForPairing[]
  localOk: boolean
  remoteOk: boolean
  holeScoreId: string
  userId: string
  newId: () => string
}): ShotInsert[] | Error {
  const localByNum = new Map<number, ShotInsert>()
  const localById = new Map<string, ShotInsert>()
  for (const raw of input.local) {
    try {
      const p = JSON.parse(raw) as ShotInsert
      if (p.id) localById.set(p.id, p)
      if (p.id && p.shot_number != null) localByNum.set(p.shot_number, p)
    } catch {
      // skip malformed pending payload
    }
  }
  const remoteByNum = new Map<number, RemoteShotForPairing>()
  const remoteById = new Map<string, RemoteShotForPairing>()
  for (const s of input.remote) {
    remoteByNum.set(s.shot_number, s)
    remoteById.set(s.id, s)
  }

  const payloads: ShotInsert[] = []
  for (const row of input.rows) {
    const existing = row._shotId
      ? localById.get(row._shotId) ?? remoteById.get(row._shotId)
      : localByNum.get(row.shotNumber) ?? remoteByNum.get(row.shotNumber)
    const lost =
      !existing?.id && input.localOk && input.remoteOk &&
      !localByNum.has(row.shotNumber) && !remoteByNum.has(row.shotNumber)
    if (!existing?.id && !lost) return new Error(UNREACHABLE_SHOTS_MESSAGE)
    payloads.push({
      id: existing?.id ?? input.newId(),
      hole_score_id: input.holeScoreId,
      user_id: input.userId,
      // Keep the aim captured live (SET_AIM): the review sheet doesn't edit
      // non-putt aim, so the live value is authoritative.
      aim_lat: existing?.aim_lat ?? null,
      aim_lng: existing?.aim_lng ?? null,
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
    })
  }
  return payloads
}

export interface HoleTallyPatch {
  score: number
  putts: number
  penalties: number
  fairway_hit: boolean | null
  gir: boolean | null
}

/**
 * The hole_scores tallies the review writes. Fairway and GIR are inferred from
 * the reviewed lies; holedOut=true because this flow ends at the pin by
 * construction (as web's saveReviewedHole). A value already on the hole score
 * (a scorecard toggle) is never overwritten. `par` is the par being played:
 * the round's override, then the tee's, then the course hole's (#1454).
 */
export function holeTallyPatch(
  rows: ReadonlyArray<Pick<ReviewedShotRow, 'shotNumber' | 'lieType' | 'shotResult'>>,
  par: number,
  summary: { score: number; putts: number; penalties: number },
  current: { fairway_hit: boolean | null; gir: boolean | null },
): HoleTallyPatch {
  const inferred = inferHoleStats(
    rows.map((r) => ({
      shot_number: r.shotNumber,
      lie_type: r.lieType,
      // Required: shot_number is not the stroke number on an OB hole, so
      // inferGir needs the penalty strokes to size its thresholds (#839).
      shotResult: r.shotResult,
    })),
    par,
    true,
  )
  return {
    score: summary.score,
    putts: summary.putts,
    penalties: summary.penalties,
    fairway_hit: current.fairway_hit ?? inferred.fairway,
    gir: current.gir ?? inferred.gir,
  }
}
