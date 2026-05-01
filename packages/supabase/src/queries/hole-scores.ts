import type { OgaSupabaseClient } from '../client'
import type { Database } from '../types'

type HoleScoreInsert = Database['public']['Tables']['hole_scores']['Insert']
type HoleScoreUpdate = Database['public']['Tables']['hole_scores']['Update']

export function getHoleScoresForRound(client: OgaSupabaseClient, roundId: string) {
  return client
    .from('hole_scores')
    .select('*, holes(*)')
    .eq('round_id', roundId)
    .order('hole_id')
}

export function upsertHoleScore(client: OgaSupabaseClient, score: HoleScoreInsert) {
  return client
    .from('hole_scores')
    .upsert(score, { onConflict: 'round_id,hole_id' })
    .select()
    .single()
}

// hole_scores has no direct user_id column. Belt-and-suspenders is to
// constrain by round_id (caller knows it), so RLS's parent-table check
// can't be the only thing standing between a stray UUID and another
// user's row.
export function updateHoleScore(
  client: OgaSupabaseClient,
  id: string,
  updates: HoleScoreUpdate,
  roundId: string,
) {
  return client
    .from('hole_scores')
    .update(updates)
    .eq('id', id)
    .eq('round_id', roundId)
    .select()
    .single()
}
