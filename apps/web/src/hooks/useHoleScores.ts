import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getHoleScoresForRound, upsertHoleScore } from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { supabase } from '../lib/supabase'

type HoleScoreInsert = Database['public']['Tables']['hole_scores']['Insert']

export function useHoleScores(roundId: string | undefined) {
  return useQuery({
    queryKey: ['hole-scores', roundId],
    enabled: !!roundId,
    queryFn: async () => {
      const { data, error } = await getHoleScoresForRound(supabase, roundId!)
      if (error) throw error
      return data ?? []
    },
  })
}

export function useUpsertHoleScore(roundId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (score: HoleScoreInsert) => {
      const { data, error } = await upsertHoleScore(supabase, score)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hole-scores', roundId] })
      qc.invalidateQueries({ queryKey: ['round', roundId] })
    },
  })
}
