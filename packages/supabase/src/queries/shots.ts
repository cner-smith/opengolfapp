import type { OgaSupabaseClient } from '../client'
import type { Database } from '../types'

type ShotInsert = Database['public']['Tables']['shots']['Insert']
type ShotUpdate = Database['public']['Tables']['shots']['Update']

// Explicit column list — `select('*')` was pulling created_at on every
// shot row across stats, patterns, and round detail. Listing the columns
// the apps actually read trims payload on every shot query (and on the
// nested shots(...) join inside rounds queries — see ROUND_COLUMNS).
// Kept as a single literal so supabase-js's PostgrestBuilder can parse
// it at the type level (concatenation/`+` widens to plain `string`,
// which collapses the response shape to GenericStringError).
export const SHOT_COLUMNS = 'id, hole_score_id, user_id, shot_number, start_lat, start_lng, end_lat, end_lng, aim_lat, aim_lng, distance_to_target, club, lie_type, lie_slope, lie_slope_forward, lie_slope_side, shot_result, penalty, ob, aim_offset_yards, break_direction, putt_result, putt_distance_result, putt_direction_result, putt_distance_ft, putt_slope_pct, green_speed, notes' as const

export function getShotsForRound(
  client: OgaSupabaseClient,
  roundId: string,
  userId: string,
) {
  return client
    .from('shots')
    .select(`${SHOT_COLUMNS}, hole_scores!inner(round_id, holes(number, par))`)
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
    .select(SHOT_COLUMNS)
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
