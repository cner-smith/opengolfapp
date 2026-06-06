import { useCallback, useEffect, useState } from 'react'
import {
  getDrillsByIds,
  getLatestPracticePlan,
  saveFeedback,
  updatePlanProgress,
} from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export type PracticePlan = Database['public']['Tables']['practice_plans']['Row']

// Mirrors getDrillsByIds' select shape (the drill fields the plan view needs).
export type DrillCard = {
  id: string
  name: string
  description: string | null
  instructions: string | null
  facility: string[] | null
  duration_min: number | null
  drill_type: string
  category: string | null
  source: string | null
  source_url: string | null
}

// Mobile counterpart of web's useDrills.ts hooks (useLatestPracticePlan /
// useGeneratePlan / useDrillsByIds / useUpdatePlanProgress / useSaveFeedback).
// No react-query on mobile — manual fetch + optimistic local state, matching
// the round screen. The plan view computes the drill ids from the plan blocks
// and calls loadDrills(ids); generation invokes the Claude edge fn then
// refetches (the fn writes the plan before returning, like web's invalidate).
export function usePracticePlan() {
  const { user } = useAuth()
  const [plan, setPlan] = useState<PracticePlan | null>(null)
  const [drillsById, setDrillsById] = useState<Record<string, DrillCard>>({})
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    const { data, error: pErr } = await getLatestPracticePlan(supabase, user.id)
    if (pErr) {
      setError(pErr.message)
      setLoading(false)
      return
    }
    setPlan((data as PracticePlan | null) ?? null)
    setLoading(false)
  }, [user])

  useEffect(() => {
    reload()
  }, [reload])

  const loadDrills = useCallback(async (ids: string[]) => {
    if (ids.length === 0) {
      setDrillsById({})
      return
    }
    const { data, error: dErr } = await getDrillsByIds(supabase, ids)
    if (dErr) return
    const byId: Record<string, DrillCard> = {}
    for (const d of (data ?? []) as DrillCard[]) byId[d.id] = d
    setDrillsById(byId)
  }, [])

  const generate = useCallback(async () => {
    setGenerating(true)
    setError(null)
    const { error: gErr } = await supabase.functions.invoke('generate-practice-plan', {
      body: {},
    })
    if (gErr) {
      setError(gErr.message)
      setGenerating(false)
      return
    }
    await reload()
    setGenerating(false)
  }, [reload])

  // Completion keys off the block id (StoredBlock.id), not the drill id —
  // matches web's onToggleComplete(blockId) → completed_drill_ids.
  const toggleCompletion = useCallback(
    async (blockId: string) => {
      if (!plan) return
      const current = plan.completed_drill_ids ?? []
      const next = current.includes(blockId)
        ? current.filter((id) => id !== blockId)
        : [...current, blockId]
      // Optimistic — revert on failure (mirrors web's onMutate/onError).
      setPlan((prev) => (prev ? { ...prev, completed_drill_ids: next } : prev))
      const { error: uErr } = await updatePlanProgress(supabase, plan.id, next)
      if (uErr) {
        setPlan((prev) => (prev ? { ...prev, completed_drill_ids: current } : prev))
        setError(uErr.message)
      }
    },
    [plan],
  )

  const submitFeedback = useCallback(
    async (feedback: string) => {
      if (!plan) return
      const { error: fErr } = await saveFeedback(supabase, plan.id, feedback)
      if (fErr) {
        setError(fErr.message)
        return
      }
      setPlan((prev) => (prev ? { ...prev, feedback } : prev))
    },
    [plan],
  )

  return {
    plan,
    drillsById,
    loading,
    generating,
    error,
    reload,
    loadDrills,
    generate,
    toggleCompletion,
    submitFeedback,
  }
}
