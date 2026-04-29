import { useQuery } from '@tanstack/react-query'
import type { ShotCategory } from '@oga/core'
import { getDrills, getLatestPracticePlan } from '@oga/supabase'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useDrills(filters: { skillLevel?: string; category?: ShotCategory } = {}) {
  return useQuery({
    queryKey: ['drills', filters.skillLevel, filters.category],
    queryFn: async () => {
      const { data, error } = await getDrills(supabase, filters)
      if (error) throw error
      return data ?? []
    },
  })
}

export function useLatestPracticePlan() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['practice-plan', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await getLatestPracticePlan(supabase, user!.id)
      if (error) throw error
      return data
    },
  })
}
