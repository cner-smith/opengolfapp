import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ShotCategory } from '@oga/core'
import {
  getDrills,
  getDrillsByIds,
  getLatestPracticePlan,
  saveFeedback,
  updatePlanProgress,
} from '@oga/supabase'
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

type PracticePlan = NonNullable<
  Awaited<ReturnType<typeof getLatestPracticePlan>>['data']
>

export function useUpdatePlanProgress() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation<
    unknown,
    Error,
    { planId: string; completedDrillIds: string[] }
  >({
    mutationFn: async ({ planId, completedDrillIds }) => {
      const { data, error } = await updatePlanProgress(supabase, planId, completedDrillIds)
      if (error) throw error
      return data
    },
    onMutate: async ({ completedDrillIds }) => {
      const key = ['practice-plan', user?.id]
      await qc.cancelQueries({ queryKey: key })
      const snapshot = qc.getQueryData<PracticePlan>(key)
      qc.setQueryData<PracticePlan>(key, (prev) => {
        if (!prev) return prev
        return { ...prev, completed_drill_ids: completedDrillIds }
      })
      return { snapshot }
    },
    onError: (_err, _vars, context) => {
      const ctx = context as { snapshot?: PracticePlan } | undefined
      if (ctx?.snapshot !== undefined) {
        qc.setQueryData(['practice-plan', user?.id], ctx.snapshot)
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['practice-plan', user?.id] })
    },
  })
}

export function useSaveFeedback() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation<unknown, Error, { planId: string; feedback: string }>({
    mutationFn: async ({ planId, feedback }) => {
      const { data, error } = await saveFeedback(supabase, planId, feedback)
      if (error) throw error
      return data
    },
    onSuccess: (_data, { feedback }) => {
      qc.setQueryData<PracticePlan>(['practice-plan', user?.id], (prev) => {
        if (!prev) return prev
        return { ...prev, feedback }
      })
      qc.invalidateQueries({ queryKey: ['practice-plan', user?.id] })
    },
  })
}
