import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  adjustedScore,
  calculateDifferential,
  calculateHandicapIndex,
} from '@oga/core'
import {
  getCourseTees,
  getHoleScoresForRound,
  getHolesForCourse,
  getShotsForRound,
  updateProfile,
  updateRound,
} from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { supabase } from '../lib/supabase'
import { computeRoundSG } from '../lib/sgCalc'
import type { RoundSGResult } from '../lib/sgCalc'

type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']
type ShotRow = Database['public']['Tables']['shots']['Row']
type HoleRow = Database['public']['Tables']['holes']['Row']
type CourseTeeRow = Database['public']['Tables']['course_tees']['Row']

interface CompleteRoundArgs {
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

export function useCompleteRound() {
  const qc = useQueryClient()
  return useMutation<RoundSGResult, Error, CompleteRoundArgs>({
    mutationFn: async ({
      roundId,
      courseId,
      handicap,
      courseTeeId,
      teeColor,
      userId,
    }) => {
      const [holesRes, holeScoresRes, shotsRes, teesRes] = await Promise.all([
        getHolesForCourse(supabase, courseId),
        getHoleScoresForRound(supabase, roundId),
        getShotsForRound(supabase, roundId, userId),
        getCourseTees(supabase, courseId),
      ])
      if (holesRes.error) throw holesRes.error
      if (holeScoresRes.error) throw holeScoresRes.error
      if (shotsRes.error) throw shotsRes.error

      const holes = (holesRes.data ?? []) as HoleRow[]
      const holeScoreRows = (holeScoresRes.data ?? []) as Array<
        HoleScoreRow & { holes?: HoleRow | null }
      >
      const holeScores: HoleScoreRow[] = holeScoreRows.map((row) => {
        const { holes: _holes, ...rest } = row
        return rest
      })
      const shots = (shotsRes.data ?? []) as ShotRow[]
      const tees = (teesRes.data ?? []) as CourseTeeRow[]

      const result = computeRoundSG({ holes, holeScores, shots, handicap })

      // Single batch upsert beats N sequential UPDATEs. Carry round_id /
      // hole_id / score forward unchanged so the underlying INSERT path of
      // upsert can satisfy the NOT NULL columns; the conflict on `id` then
      // updates the SG fields only.
      const holeScoresById = new Map(holeScores.map((hs) => [hs.id, hs]))
      const sgRows = Object.entries(result.perHoleScore)
        .map(([holeScoreId, sg]) => {
          const existing = holeScoresById.get(holeScoreId)
          if (!existing) return null
          return {
            id: holeScoreId,
            round_id: existing.round_id,
            hole_id: existing.hole_id,
            score: existing.score,
            sg_off_tee: round2(sg.offTee),
            sg_approach: round2(sg.approach),
            sg_around_green: round2(sg.aroundGreen),
            sg_putting: round2(sg.putting),
          }
        })
        .filter((r): r is NonNullable<typeof r> => r != null)
      if (sgRows.length > 0) {
        const { error: sgError } = await supabase
          .from('hole_scores')
          .upsert(sgRows, { onConflict: 'id' })
        if (sgError) throw sgError
      }

      // ---- Handicap differential ------------------------------------------
      const tee =
        (courseTeeId ? tees.find((t) => t.id === courseTeeId) : null) ??
        (teeColor
          ? tees.find((t) => t.tee_color === teeColor.toLowerCase())
          : null) ??
        null
      let differential: number | null = null
      if (
        tee &&
        tee.course_rating != null &&
        tee.slope_rating != null &&
        tee.slope_rating > 0
      ) {
        const holesById = new Map(holes.map((h) => [h.id, h]))
        const holeRows = holeScores
          .map((hs) => {
            const h = holesById.get(hs.hole_id)
            if (!h) return null
            return { score: hs.score, par: h.par }
          })
          .filter((x): x is { score: number; par: number } => !!x)
        if (holeRows.length > 0) {
          const adjusted = adjustedScore(holeRows, handicap)
          differential = round2(
            calculateDifferential(adjusted, tee.course_rating, tee.slope_rating),
          )
        }
      }

      const { error: roundError } = await updateRound(
        supabase,
        roundId,
        {
        sg_off_tee: round2(result.round.offTee),
        sg_approach: round2(result.round.approach),
        sg_around_green: round2(result.round.aroundGreen),
        sg_putting: round2(result.round.putting),
        sg_total: round2(result.round.total),
        total_score: result.totals.totalScore || null,
        total_putts: result.totals.totalPutts || null,
        fairways_hit: result.totals.fairwaysTotal > 0 ? result.totals.fairwaysHit : null,
        fairways_total: result.totals.fairwaysTotal || null,
        gir: result.totals.gir,
        // Stamp the resolved tee onto the round so future reads have a
        // direct link without re-running the fallback.
        course_tee_id: tee?.id ?? courseTeeId ?? null,
        score_differential: differential,
        },
        userId,
      )
      if (roundError) throw roundError

      // ---- Handicap index recompute --------------------------------------
      if (differential != null) {
        const { data: recentDiffs } = await supabase
          .from('rounds')
          .select('score_differential')
          .eq('user_id', userId)
          .not('score_differential', 'is', null)
          .order('played_at', { ascending: false })
          .limit(20)
        const diffs = (recentDiffs ?? [])
          .map((r) => r.score_differential)
          .filter((d): d is number => d != null)
        const newIndex = calculateHandicapIndex(diffs)
        if (newIndex != null) {
          await updateProfile(supabase, userId, { handicap_index: newIndex })
        }
      }

      return result
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['round', variables.roundId] })
      qc.invalidateQueries({ queryKey: ['rounds'] })
      qc.invalidateQueries({ queryKey: ['hole-scores', variables.roundId] })
      qc.invalidateQueries({ queryKey: ['profile', variables.userId] })
    },
  })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
