import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getProfile, updateProfile } from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export function useProfile() {
  const { user, loading } = useAuth()
  return useQuery({
    queryKey: ['profile', user?.id],
    enabled: !loading && !!user,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await getProfile(supabase, user!.id)
      if (error) throw error
      return data
    },
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (updates: ProfileUpdate) => {
      const { data, error } = await updateProfile(supabase, user!.id, updates)
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile', user?.id] }),
  })
}
