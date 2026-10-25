import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRoundsWithDetails } from '@oga/supabase'
import { supabase } from '../lib/supabase'
import {
  computeDetailedStats,
  DEFAULT_HANDICAP,
  type DetailedRound,
  type DetailedStats,
} from '@oga/core'
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
  const handicap = profile.data?.handicap_index ?? DEFAULT_HANDICAP

  const query = useQuery({
    queryKey: ['detailed-stats', user?.id, limit],
    enabled: !!user,
    queryFn: async (): Promise<DetailedRound[]> => {
      const { data, error } = await getRoundsWithDetails(supabase, user!.id, limit)
      if (error) throw error
      // The Supabase types for nested joins (rounds → hole_scores → holes/shots)
      // come back as a narrow inferred shape (no created_at on shots, no notes
      // on the round) because the select uses ROUND_COLUMNS / SHOT_COLUMNS.
      // computeDetailedStats only reads the SG-relevant columns those lists
      // include; the via-`unknown` cast acknowledges the structural mismatch
      // without forcing the generated DetailedRound type to drop fields.
      return (data ?? []) as unknown as DetailedRound[]
    },
  })

  const rounds = useMemo(() => query.data ?? [], [query.data])
  // computeDetailedStats walks every shot in every round (O(N×shots)) — wrap
  // in useMemo so it doesn't re-run on parent renders unrelated to the data.
  // Returns null while loading and when there are zero rounds; consumers
  // MUST gate EmptyState on !isLoading first to avoid flashing the empty
  // state during fetch.
  // Wait for the profile too: until it lands the baseline would be the
  // default 15, and the numbers would jump once the real handicap arrives (#1197).
  const data = useMemo(
    () => (rounds.length > 0 && !profile.isLoading ? computeDetailedStats(rounds, handicap) : null),
    [rounds, handicap, profile.isLoading],
  )

  return {
    data,
    isLoading: query.isLoading || profile.isLoading,
    error: (query.error as Error | null) ?? null,
    rounds,
  }
}
