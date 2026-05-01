import type { OgaSupabaseClient } from '../client'
import type { Database } from '../types'

type ShotInsert = Database['public']['Tables']['shots']['Insert']
type ShotUpdate = Database['public']['Tables']['shots']['Update']

export function getShotsForRound(
  client: OgaSupabaseClient,
  roundId: string,
  userId: string,
) {
  return client
    .from('shots')
    .select('*, hole_scores!inner(round_id, holes(number, par))')
    .eq('hole_scores.round_id', roundId)
    .eq('user_id', userId)
    .order('shot_number')
}

export function getShotsByClub(
  client: OgaSupabaseClient,
  userId: string,
  club: string,
  limit = 200,
) {
  return client
    .from('shots')
    .select('*')
    .eq('user_id', userId)
    .eq('club', club)
    .not('aim_lat', 'is', null)
    .not('end_lat', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)
}

export function createShot(client: OgaSupabaseClient, shot: ShotInsert) {
  return client.from('shots').insert(shot).select().single()
}

export function updateShot(
  client: OgaSupabaseClient,
  shotId: string,
  updates: ShotUpdate,
  userId: string,
) {
  return client
    .from('shots')
    .update(updates)
    .eq('id', shotId)
    .eq('user_id', userId)
    .select()
    .single()
}

export function deleteShot(
  client: OgaSupabaseClient,
  shotId: string,
  userId: string,
) {
  return client.from('shots').delete().eq('id', shotId).eq('user_id', userId)
}
