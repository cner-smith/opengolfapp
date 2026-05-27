import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ShotCategory } from '@oga/core'
import { getDrills, getDrillsByIds, getLatestPracticePlan } from '@oga/supabase'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useDrills(
  filters: { skillLevel?: string; category?: ShotCategory } = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ['drills', filters.skillLevel, filters.category],
    queryFn: async () => {
      const { data, error } = await getDrills(supabase, filters)
      if (error) throw error
      return data ?? []
    },
    enabled: options.enabled ?? true,
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

export function useGeneratePlan() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation<void, Error>({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('generate-practice-plan', { body: {} })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['practice-plan', user?.id] })
    },
  })
}

export function useDrillsByIds(ids: string[]) {
  const sortedIds = [...ids].sort()
  return useQuery({
    queryKey: ['drills-by-ids', sortedIds],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await getDrillsByIds(supabase, ids)
      if (error) throw error
      const drills = data ?? []
      const byId: Record<string, (typeof drills)[number]> = {}
      for (const d of drills) byId[d.id] = d
      return byId
    },
  })
}
