import { uuid } from 'expo-modules-core'
import type { User } from '@supabase/supabase-js'
import { holeTallyPatch, pairReviewedRows, type ReviewedRowWithId } from '@oga/core'
import { isNetworkTimeout, supabase } from '../../../lib/supabase'
import {
  allShotsForHoleScore,
  enqueueHoleScorePatch,
  upsertReviewedShot,
} from '../../../lib/db'
import { syncPendingShots } from '../../../lib/sync'
import type { UseHoleDataResult } from './useHoleData'

// End-of-hole save. Mirrors the web review sheet's replace-all write, but
// attaches metadata to the shots the player already logged live rather than
// recreating them: core pairReviewedRows pairs each reviewed row back to its
// live shot so the shot's client id (and its live-captured aim) carry
// through, and the merged payload is re-queued via upsertReviewedShot →
// idempotent re-sync updates the same server row (no delete, no duplicates
// offline). Then the hole_scores tallies are written and the hole advances.
// Throws on failure; the caller (useShotActions.saveHoleSummary) owns the
// in-flight guard, the alert and the advance. Split out for #1015.
export async function writeHoleSummary(args: {
  user: User
  currentHoleScore: NonNullable<UseHoleDataResult['currentHoleScore']>
  /** The par being played: round override, then tee, then course (#1454). */
  par: number
  rows: ReviewedRowWithId[]
  summary: { score: number; putts: number; penalties: number }
  setHoleScores: UseHoleDataResult['setHoleScores']
}): Promise<void> {
  const { user, currentHoleScore, par, rows, summary, setHoleScores } = args
  // BOTH reads get a one-retry (mirrors useHoleData's SQLite/remote reads) — a
  // transient failure that empties either must not silently strand a shot on
  // pairReviewedRows' abort path.
  let localRows = await allShotsForHoleScore(currentHoleScore.id).catch(
    () => null,
  )
  if (localRows === null) {
    localRows = await allShotsForHoleScore(currentHoleScore.id).catch(() => null)
  }
  let remote = await supabase
    .from('shots')
    .select('id, shot_number, aim_lat, aim_lng, penalty')
    .eq('hole_score_id', currentHoleScore.id)
  // No second try on a timeout: it would only add another 15 s (#1112).
  if (remote.error && !isNetworkTimeout(remote.error)) {
    remote = await supabase
      .from('shots')
      .select('id, shot_number, aim_lat, aim_lng, penalty')
      .eq('hole_score_id', currentHoleScore.id)
  }
  const payloads = pairReviewedRows({
    rows,
    local: (localRows ?? []).map((r) => r.payload),
    remote: remote.data ?? [],
    localOk: localRows !== null,
    remoteOk: !remote.error,
    holeScoreId: currentHoleScore.id,
    userId: user.id,
    newId: () => uuid.v4(),
  })
  // The sheet stays open with the player's edits intact (hydration is gated),
  // so Save simply retries once the read recovers.
  if (payloads instanceof Error) throw payloads
  for (const payload of payloads) await upsertReviewedShot(payload)
  // Background sync — the re-queued rows carry their metadata now.
  syncPendingShots().catch(() => undefined)

  const patch = holeTallyPatch(rows, par, summary, currentHoleScore)
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
  await enqueueHoleScorePatch(currentHoleScore, patch)
  syncPendingShots().catch(() => undefined)
}
