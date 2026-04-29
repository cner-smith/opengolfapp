import type { OgaSupabaseClient } from '../client'
import type { Database } from '../types'

type RoundInsert = Database['public']['Tables']['rounds']['Insert']
type RoundUpdate = Database['public']['Tables']['rounds']['Update']

export function getRounds(client: OgaSupabaseClient, userId: string, limit = 20) {
  return client
    .from('rounds')
    .select('*, courses(name, location)')
    .eq('user_id', userId)
    .order('played_at', { ascending: false })
    .limit(limit)
}

export function getRound(client: OgaSupabaseClient, roundId: string) {
  return client
    .from('rounds')
    .select('*, courses(name, location), hole_scores(*, holes(*), shots(*))')
    .eq('id', roundId)
    .single()
}

export function createRound(client: OgaSupabaseClient, round: RoundInsert) {
  return client.from('rounds').insert(round).select().single()
}

export function updateRound(
  client: OgaSupabaseClient,
  roundId: string,
  updates: RoundUpdate,
) {
  return client.from('rounds').update(updates).eq('id', roundId).select().single()
}

export function deleteRound(client: OgaSupabaseClient, roundId: string) {
  return client.from('rounds').delete().eq('id', roundId)
}

export function getRecentSGData(client: OgaSupabaseClient, userId: string, limit = 10) {
  return client
    .from('rounds')
    .select(
      'id, played_at, sg_off_tee, sg_approach, sg_around_green, sg_putting, sg_total, total_score, courses(name)',
    )
    .eq('user_id', userId)
    .not('sg_total', 'is', null)
    .order('played_at', { ascending: false })
    .limit(limit)
}
