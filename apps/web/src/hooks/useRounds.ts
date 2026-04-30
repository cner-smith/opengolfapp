import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createRound,
  deleteRound,
  getRecentSGData,
  getRound,
  getRounds,
} from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

type RoundInsert = Database['public']['Tables']['rounds']['Insert']

export function useRounds(limit = 20) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['rounds', user?.id, limit],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await getRounds(supabase, user!.id, limit)
      if (error) throw error
      return data
    },
  })
}

export function useRound(roundId: string | undefined) {
  return useQuery({
    queryKey: ['round', roundId],
    enabled: !!roundId,
    queryFn: async () => {
      const { data, error } = await getRound(supabase, roundId!)
      if (error) throw error
      return data
    },
  })
}

export function useRecentSG(limit = 10) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['sg', user?.id, limit],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await getRecentSGData(supabase, user!.id, limit)
      if (error) throw error
      return data
    },
  })
}

export function useCreateRound() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (round: RoundInsert) => {
      const { data, error } = await createRound(supabase, round)
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rounds', user?.id] }),
  })
}

export function useDeleteRound() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (roundId: string) => {
      const { error } = await deleteRound(supabase, roundId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rounds', user?.id] })
      qc.invalidateQueries({ queryKey: ['sg', user?.id] })
      qc.invalidateQueries({ queryKey: ['detailed-stats', user?.id] })
    },
  })
}
