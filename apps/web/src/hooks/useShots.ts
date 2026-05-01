import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createShot, deleteShot, getShotsForRound, updateShot } from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

type ShotInsert = Database['public']['Tables']['shots']['Insert']
type ShotUpdate = Database['public']['Tables']['shots']['Update']

export function useShotsForRound(roundId: string | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['shots', 'round', roundId, user?.id],
    enabled: !!roundId && !!user,
    queryFn: async () => {
      const { data, error } = await getShotsForRound(supabase, roundId!, user!.id)
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateShot(roundId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (shot: ShotInsert) => {
      const { data, error } = await createShot(supabase, shot)
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shots', 'round', roundId] }),
  })
}

export function useUpdateShot(roundId: string | undefined) {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: ShotUpdate }) => {
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await updateShot(supabase, id, updates, user.id)
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shots', 'round', roundId] }),
  })
}

export function useDeleteShot(roundId: string | undefined) {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await deleteShot(supabase, id, user.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shots', 'round', roundId] }),
  })
}
