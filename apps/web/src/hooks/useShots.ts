import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createShot, createShots, getShotsForRound, updateShot } from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

type ShotInsert = Database['public']['Tables']['shots']['Insert']
type ShotUpdate = Database['public']['Tables']['shots']['Update']

// getShotsForRound's narrow column list matches every consumer of this
// hook (no one reads created_at). Cast the inferred narrow shape back to
// the canonical ShotRow so the call sites — ShotEntryModal's startEdit,
// the round map's categorizeShot — keep their existing types.
type ShotRow = Database['public']['Tables']['shots']['Row']

export function useShotsForRound(roundId: string | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['shots', 'round', roundId, user?.id],
    enabled: !!roundId && !!user,
    queryFn: async () => {
      const { data, error } = await getShotsForRound(supabase, roundId!, user!.id)
      if (error) throw error
      return (data ?? []) as unknown as ShotRow[]
    },
  })
}

// Shot mutations also bust the round summary + detailed stats so SG and
// per-shot derived numbers refresh after a save.
function invalidateShotMutationKeys(
  qc: ReturnType<typeof useQueryClient>,
  roundId: string | undefined,
) {
  qc.invalidateQueries({ queryKey: ['shots', 'round', roundId] })
  qc.invalidateQueries({ queryKey: ['round', roundId] })
  qc.invalidateQueries({ queryKey: ['detailed-stats'] })
}

export function useCreateShot(roundId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (shot: ShotInsert) => {
      const { data, error } = await createShot(supabase, shot)
      if (error) throw error
      return data
    },
    onSuccess: () => invalidateShotMutationKeys(qc, roundId),
  })
}

// A hole's reviewed shots in one request: Postgres writes every row or none,
// so a failure can't leave the hole half-saved (#1040).
export function useCreateShots(roundId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (shots: ShotInsert[]) => {
      const { error } = await createShots(supabase, shots)
      if (error) throw error
    },
    onSuccess: () => invalidateShotMutationKeys(qc, roundId),
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
    onSuccess: () => invalidateShotMutationKeys(qc, roundId),
  })
}

// The shot RPCs also re-tally hole_scores, which has its own key.
function invalidateRpcKeys(qc: ReturnType<typeof useQueryClient>, roundId: string | undefined) {
  invalidateShotMutationKeys(qc, roundId)
  qc.invalidateQueries({ queryKey: ['hole-scores', roundId] })
}

// delete_shot renumbers the later shots and re-tallies the hole score in one
// transaction, as mobile's Remove does.
export function useDeleteShot(roundId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_shot', { p_shot_id: id })
      if (error) throw error
    },
    onSuccess: () => invalidateRpcKeys(qc, roundId),
  })
}

// insert_shot puts a shot after another, renumbers the later ones and adds a
// stroke to the hole score.
export function useInsertShot(roundId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      id: string
      afterShotId: string
      start: { lat: number; lng: number }
      distanceToTarget: number | null
    }) => {
      const { error } = await supabase.rpc('insert_shot', {
        p_id: args.id,
        p_after_shot_id: args.afterShotId,
        p_start_lat: args.start.lat,
        p_start_lng: args.start.lng,
        p_distance_to_target: args.distanceToTarget,
      })
      if (error) throw error
    },
    onSuccess: () => invalidateRpcKeys(qc, roundId),
  })
}
