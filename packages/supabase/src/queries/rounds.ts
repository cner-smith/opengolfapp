import type { OgaSupabaseClient } from '../client'
import type { Database } from '../types'

type RoundInsert = Database['public']['Tables']['rounds']['Insert']
type RoundUpdate = Database['public']['Tables']['rounds']['Update']

export function getRounds(client: OgaSupabaseClient, userId: string, limit = 20) {
  return client
    .from('rounds')
    .select('*, courses(name, city, state)')
    .eq('user_id', userId)
    .order('played_at', { ascending: false })
    .limit(limit)
}

// Belt-and-suspenders: every read/mutation on user-owned tables takes a
// userId and filters on it in addition to RLS, so a missing or misconfigured
// policy can't silently expose another user's data.
export function getRound(
  client: OgaSupabaseClient,
  roundId: string,
  userId: string,
) {
  return client
    .from('rounds')
    .select('*, courses(name, city, state), hole_scores(*, holes(*), shots(*))')
    .eq('id', roundId)
    .eq('user_id', userId)
    .single()
}

export function createRound(client: OgaSupabaseClient, round: RoundInsert) {
  return client.from('rounds').insert(round).select().single()
}

export function updateRound(
  client: OgaSupabaseClient,
  roundId: string,
  updates: RoundUpdate,
  userId: string,
) {
  return client
    .from('rounds')
    .update(updates)
    .eq('id', roundId)
    .eq('user_id', userId)
    .select()
    .single()
}

export function deleteRound(
  client: OgaSupabaseClient,
  roundId: string,
  userId: string,
) {
  return client.from('rounds').delete().eq('id', roundId).eq('user_id', userId)
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

// Rounds with full hole-score and shot detail nested. Used by the stats
// page to compute per-band, per-club, and per-lie aggregates client-side.
export function getRoundsWithDetails(
  client: OgaSupabaseClient,
  userId: string,
  limit = 20,
) {
  return client
    .from('rounds')
    .select(
      '*, courses(name), hole_scores(*, holes(*), shots(*))',
    )
    .eq('user_id', userId)
    .order('played_at', { ascending: false })
    .limit(limit)
}
