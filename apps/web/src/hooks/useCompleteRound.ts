import { useMutation, useQueryClient } from '@tanstack/react-query'
import { calculateHandicapIndex, finishRoundPlan } from '@oga/core'
import {
  getCourseTees,
  getHoleScoresForRound,
  getHoleTeesForCourse,
  getHolesForCourse,
  getShotsForRound,
  updateProfile,
  updateRound,
} from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { supabase } from '../lib/supabase'

type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']
type ShotRow = Database['public']['Tables']['shots']['Row']
type HoleRow = Database['public']['Tables']['holes']['Row']

export interface CompleteRoundArgs {
  roundId: string
  courseId: string
  handicap: number
  /** Persisted on the round at creation; null when the user skipped tee
   *  selection. We fall back to matching by tee_color in that case. */
  courseTeeId?: string | null
  /** Tee colour string on the round — used as a fallback lookup when
   *  course_tee_id is null (legacy / mobile / pre-tees rounds). */
  teeColor?: string | null
  /** auth user id; passed in so the profile recalc can hit the right row. */
  userId: string
}

// Stamps SG, totals and completed_at; recomputes the handicap index. Callable outside the round
// page so the Golf Pad importer completes each round it writes (#1135). It refreshes no cached
// queries: useCompleteRound does that, other callers invalidate their own.
export async function completeRound({
  roundId,
  courseId,
  handicap,
  courseTeeId,
  teeColor,
  userId,
}: CompleteRoundArgs): Promise<void> {
  const [holesRes, holeScoresRes, shotsRes, teesRes, holeTeesRes, roundRes] = await Promise.all([
    getHolesForCourse(supabase, courseId),
    getHoleScoresForRound(supabase, roundId),
    getShotsForRound(supabase, roundId, userId),
    getCourseTees(supabase, courseId),
    getHoleTeesForCourse(supabase, courseId),
    supabase.from('rounds').select('hole_count').eq('id', roundId).eq('user_id', userId).single(),
  ])
  if (holesRes.error) throw holesRes.error
  if (roundRes.error) throw roundRes.error
  if (holeScoresRes.error) throw holeScoresRes.error
  if (shotsRes.error) throw shotsRes.error
  // The tee's pars feed every number below (#1456): fail (retryable) rather than finish on holes.par.
  if (holeTeesRes.error) throw holeTeesRes.error

  // The holeScoreRows annotation carries the nested holes() join shape the
  // typed select doesn't expose. `as unknown as ShotRow[]` because
  // getShotsForRound narrows the select to the columns the SG calc reads.
  const holeScoreRows = (holeScoresRes.data ?? []) as Array<
    HoleScoreRow & { holes?: HoleRow | null }
  >
  const plan = finishRoundPlan({
    holes: holesRes.data ?? [],
    holeScores: holeScoreRows.map(({ holes: _holes, ...rest }) => rest),
    shots: (shotsRes.data ?? []) as unknown as ShotRow[],
    tees: teesRes.data ?? [],
    holeTees: holeTeesRes.data ?? [],
    courseTeeId,
    teeColor,
    roundHoleCount: roundRes.data.hole_count,
    handicap,
  })

  // Single batch upserts beat N sequential UPDATEs.
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

  // ---- Handicap index recompute --------------------------------------
  // The round is finished above: a failure here only warns, so the page
  // doesn't report a failed finish and the caches still refresh (same rule as
  // mobile, #711). The next finished round recomputes over the same data.
  if (plan.differential != null) {
    const { data: recentDiffs, error: diffsError } = await supabase
      .from('rounds')
      .select('score_differential')
      .eq('user_id', userId)
      .not('score_differential', 'is', null)
      .order('played_at', { ascending: false })
      .limit(20)
    if (diffsError) {
      console.warn('[completeRound] differentials fetch failed', diffsError.message)
      return
    }
    const diffs = (recentDiffs ?? [])
      .map((r) => r.score_differential)
      .filter((d): d is number => d != null)
    const newIndex = calculateHandicapIndex(diffs)
    if (newIndex != null) {
      const { error: profileError } = await updateProfile(
        supabase,
        userId,
        { handicap_index: newIndex },
      )
      if (profileError) console.warn('[completeRound] handicap index update failed', profileError.message)
    }
  }
}

export function useCompleteRound() {
  const qc = useQueryClient()
  return useMutation<void, Error, CompleteRoundArgs>({
    mutationFn: completeRound,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['round', variables.roundId] })
      qc.invalidateQueries({ queryKey: ['rounds'] })
      qc.invalidateQueries({ queryKey: ['hole-scores', variables.roundId] })
      qc.invalidateQueries({ queryKey: ['shots', 'round', variables.roundId] })
      qc.invalidateQueries({ queryKey: ['detailed-stats'] })
      qc.invalidateQueries({ queryKey: ['profile', variables.userId] })
    },
  })
}
