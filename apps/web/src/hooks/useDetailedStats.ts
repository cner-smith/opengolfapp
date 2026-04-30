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
