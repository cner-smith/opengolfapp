import { DEFAULT_HANDICAP, calculateHandicapIndex, finishRoundPlan } from '@oga/core'
import {
  getCourseTees,
  getHoleScoresForRound,
  getHolesForCourse,
  getShotsForRound,
  updateProfile,
  updateRound,
} from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { supabase, timeoutError } from './supabase'
import { syncPendingShots } from './sync'
import { dropRoundCaches } from './offlineCache'
import { clearScreenCache } from './screenCache'

type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']
type ShotRow = Database['public']['Tables']['shots']['Row']
type HoleRow = Database['public']['Tables']['holes']['Row']

interface CompleteArgs {
  roundId: string
  courseId: string
  userId: string
  handicap: number | null
}

// Mobile twin of apps/web/src/hooks/useCompleteRound: drains the pending
// shot queue, reads the round, writes what core finishRoundPlan works out,
// stamps completed_at, and recomputes the handicap index. completed_at is what
// marks the round finalized — it removes it from the home-screen Resume
// banner and routes it to the read-only summary (total_score may be null
// when no scores were entered).
export async function completeRound({
  roundId,
  courseId,
  userId,
  handicap,
}: CompleteArgs): Promise<void> {
  // Drain the pending queue before reading shots. syncPendingShots joins
  // an in-flight background run (#651), so this genuinely waits for the
  // final hole's shots instead of no-oping while a save-triggered sync
  // holds the lock. The caller (handleEndRound) has already drained,
  // re-checked pendingCount, and made the player acknowledge any rows
  // that still can't reach the server — so a failed sync here proceeds by
  // design: finalizing over what synced is the acknowledged fallback. A
  // timeout is different (#1112): the network is stalled, so every read and
  // write below would time out too. Stop now with the retryable message.
  if ((await syncPendingShots().catch(() => undefined))?.timedOut) throw timeoutError()

  const [holesRes, holeScoresRes, shotsRes, teesRes, roundRes] = await Promise.all([
    getHolesForCourse(supabase, courseId),
    getHoleScoresForRound(supabase, roundId),
    getShotsForRound(supabase, roundId, userId),
    getCourseTees(supabase, courseId),
    supabase
      .from('rounds')
      .select('course_tee_id, tee_color, hole_count')
      .eq('id', roundId)
      .single(),
  ])
  if (holesRes.error) throw holesRes.error
  // Nothing is written yet, so a failed round read fails the finish (retryable)
  // rather than going on without the round's tee and stamping course_tee_id null.
  if (roundRes.error) throw roundRes.error
  if (holeScoresRes.error) throw holeScoresRes.error
  if (shotsRes.error) throw shotsRes.error

  const holeScoreRows = (holeScoresRes.data ?? []) as Array<
    HoleScoreRow & { holes?: HoleRow | null }
  >
  const roundTee = roundRes.data
  const plan = finishRoundPlan({
    holes: holesRes.data ?? [],
    holeScores: holeScoreRows.map(({ holes: _h, ...rest }) => rest),
    shots: (shotsRes.data ?? []) as unknown as ShotRow[],
    tees: teesRes.data ?? [],
    courseTeeId: roundTee.course_tee_id,
    teeColor: roundTee.tee_color,
    roundHoleCount: roundTee.hole_count,
    handicap: handicap ?? DEFAULT_HANDICAP,
  })

  if (plan.inferUpserts.length > 0) {
    const { error: inferError } = await supabase
      .from('hole_scores')
      .upsert(plan.inferUpserts, { onConflict: 'id' })
    if (inferError) throw inferError
  }
  if (plan.sgRows.length > 0) {
    const { error: sgError } = await supabase
      .from('hole_scores')
      .upsert(plan.sgRows, { onConflict: 'id' })
    if (sgError) throw sgError
  }

  const { error: roundError } = await updateRound(
    supabase,
    roundId,
    { ...plan.roundPatch, completed_at: new Date().toISOString() },
    userId,
  )
  if (roundError) throw roundError
  // The finalize rewrites totals/SG that home, list, and stats render —
  // drop every cached screen so none serves the pre-finalize version (#599).
  clearScreenCache()
  // A finalized round is no longer resumable offline (#993).
  void dropRoundCaches(userId, (id) => id === roundId)

  // ---- Handicap index recompute --------------------------------------
  // Once this round contributes a differential, re-derive the WHS index
  // from the most recent 20 and write it to the profile. Below 3 total
  // differentials calculateHandicapIndex returns null and the entered
  // value stands. Mirrors web; this is what makes a mobile player's index
  // become a calculated "WHS index" rather than staying "Provisional".
  if (plan.differential != null) {
    const { data: recentDiffs, error: diffsError } = await supabase
      .from('rounds')
      .select('score_differential')
      .eq('user_id', userId)
      .not('score_differential', 'is', null)
      .order('played_at', { ascending: false })
      .limit(20)
    // The round is already finalized above — a failure in the index
    // recompute must not surface as "End round failed" (#711 secondary
    // bug: a corrupt differential could push the index past the profiles
    // CHECK floor and throw here). Warn and move on; the next completed
    // round recomputes over the same data.
    if (diffsError) {
      if (__DEV__) console.warn('[completeRound] differentials fetch failed', diffsError)
      return
    }
    const diffs = (recentDiffs ?? [])
      .map((r) => r.score_differential)
      .filter((d): d is number => d != null)
    const newIndex = calculateHandicapIndex(diffs)
    if (newIndex != null) {
      const { error: profileError } = await updateProfile(supabase, userId, {
        handicap_index: newIndex,
      })
      if (profileError && __DEV__) {
        console.warn('[completeRound] handicap index update failed', profileError)
      }
    }
  }
}
