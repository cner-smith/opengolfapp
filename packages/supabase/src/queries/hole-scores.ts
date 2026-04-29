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

export function updateHoleScore(
  client: OgaSupabaseClient,
  id: string,
  updates: HoleScoreUpdate,
) {
  return client.from('hole_scores').update(updates).eq('id', id).select().single()
}

export function deleteHoleScore(client: OgaSupabaseClient, id: string) {
  return client.from('hole_scores').delete().eq('id', id)
}
