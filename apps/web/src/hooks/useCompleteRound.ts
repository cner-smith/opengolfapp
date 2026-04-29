import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getHoleScoresForRound,
  getHolesForCourse,
  getShotsForRound,
  updateHoleScore,
  updateRound,
} from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { supabase } from '../lib/supabase'
import { computeRoundSG } from '../lib/sgCalc'
import type { RoundSGResult } from '../lib/sgCalc'

type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']
type ShotRow = Database['public']['Tables']['shots']['Row']
type HoleRow = Database['public']['Tables']['holes']['Row']

interface CompleteRoundArgs {
  roundId: string
  courseId: string
  handicap: number
}

export function useCompleteRound() {
  const qc = useQueryClient()
  return useMutation<RoundSGResult, Error, CompleteRoundArgs>({
    mutationFn: async ({ roundId, courseId, handicap }) => {
      const [holesRes, holeScoresRes, shotsRes] = await Promise.all([
        getHolesForCourse(supabase, courseId),
        getHoleScoresForRound(supabase, roundId),
        getShotsForRound(supabase, roundId),
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

      const result = computeRoundSG({ holes, holeScores, shots, handicap })

      const sgUpdates = Object.entries(result.perHoleScore).map(([holeScoreId, sg]) =>
        updateHoleScore(supabase, holeScoreId, {
          sg_off_tee: round2(sg.offTee),
          sg_approach: round2(sg.approach),
          sg_around_green: round2(sg.aroundGreen),
          sg_putting: round2(sg.putting),
        }),
      )
      const sgResults = await Promise.all(sgUpdates)
      const sgError = sgResults.find((r) => r.error)
      if (sgError?.error) throw sgError.error

      const { error: roundError } = await updateRound(supabase, roundId, {
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
      })
      if (roundError) throw roundError

      return result
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['round', variables.roundId] })
      qc.invalidateQueries({ queryKey: ['rounds'] })
      qc.invalidateQueries({ queryKey: ['hole-scores', variables.roundId] })
    },
  })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
