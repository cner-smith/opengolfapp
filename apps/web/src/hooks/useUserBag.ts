import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteUserClub,
  getAllUserClubs,
  getUserBag,
  seedDefaultBag,
  updateClubOrder,
  upsertUserClub,
} from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { DEFAULT_BAG } from '@oga/core'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export type UserClub = Database['public']['Tables']['user_clubs']['Row']
type UserClubInsert = Database['public']['Tables']['user_clubs']['Insert']

const BAG_KEY = (uid: string | undefined) => ['user-bag', uid] as const
const ALL_KEY = (uid: string | undefined) => ['user-clubs', uid] as const

function invalidateBag(qc: ReturnType<typeof useQueryClient>, uid: string | undefined) {
  qc.invalidateQueries({ queryKey: BAG_KEY(uid) })
  qc.invalidateQueries({ queryKey: ALL_KEY(uid) })
}

export function useUserBag() {
  const { user, loading } = useAuth()
  return useQuery({
    queryKey: BAG_KEY(user?.id),
    enabled: !loading && !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await getUserBag(supabase, user!.id)
      if (error) throw error
      return (data ?? []) as UserClub[]
    },
  })
}

export function useAllUserClubs() {
  const { user, loading } = useAuth()
  return useQuery({
    queryKey: ALL_KEY(user?.id),
    enabled: !loading && !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await getAllUserClubs(supabase, user!.id)
      if (error) throw error
      return (data ?? []) as UserClub[]
    },
  })
}

export function useUpsertClub() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (club: Omit<UserClubInsert, 'user_id'>) => {
      const { data, error } = await upsertUserClub(supabase, {
        ...club,
        user_id: user!.id,
      })
      if (error) throw error
      return data as UserClub
    },
    onSuccess: () => invalidateBag(qc, user?.id),
  })
}

export function useUpdateClubOrder() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await updateClubOrder(supabase, user!.id, orderedIds)
    },
    onSuccess: () => invalidateBag(qc, user?.id),
  })
}

export function useDeleteClub() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (clubId: string) => {
      const { error } = await deleteUserClub(supabase, clubId, user!.id)
      if (error) throw error
    },
    onSuccess: () => invalidateBag(qc, user?.id),
  })
}

export function useResetBag() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async () => {
      const { error: delError } = await supabase
        .from('user_clubs')
        .delete()
        .eq('user_id', user!.id)
      if (delError) throw delError
      return seedDefaultBag(supabase, user!.id, DEFAULT_BAG)
    },
    onSuccess: () => invalidateBag(qc, user?.id),
  })
}

export function useSeedBagIfEmpty() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async () => {
      return seedDefaultBag(supabase, user!.id, DEFAULT_BAG)
    },
    onSuccess: () => invalidateBag(qc, user?.id),
  })
}
