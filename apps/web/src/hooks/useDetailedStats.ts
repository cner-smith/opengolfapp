import { useQuery } from '@tanstack/react-query'
import { getRoundsWithDetails } from '@oga/supabase'
import { supabase } from '../lib/supabase'
import {
  computeDetailedStats,
  type DetailedRound,
  type DetailedStats,
} from '../lib/statsCalculations'
import { useAuth } from './useAuth'
import { useProfile } from './useProfile'

export function useDetailedStats(limit: number): {
  data: DetailedStats | null
  isLoading: boolean
  error: Error | null
  rounds: DetailedRound[]
} {
  const { user } = useAuth()
  const profile = useProfile()
  const handicap = profile.data?.handicap_index ?? 15

  const query = useQuery({
    queryKey: ['detailed-stats', user?.id, limit],
    enabled: !!user,
    queryFn: async (): Promise<DetailedRound[]> => {
      const { data, error } = await getRoundsWithDetails(supabase, user!.id, limit)
      if (error) throw error
      // The Supabase types for nested joins (rounds → hole_scores → holes/shots)
      // come back as unknown — there's no public typegen path that resolves the
      // *, hole_scores(*, holes(*), shots(*)) shape. Cast is asserted here, not
      // runtime-checked; if the schema or query changes, statsCalculations will
      // throw a clear "cannot read property X of undefined" rather than a silent
      // type lie. Re-run `supabase gen types` and adjust DetailedRound when the
      // schema moves.
      return (data ?? []) as DetailedRound[]
    },
  })

  const rounds = query.data ?? []
  const data = rounds.length > 0 ? computeDetailedStats(rounds, handicap) : null

  return {
    data,
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
    rounds,
  }
}
