import type { OgaSupabaseClient } from '../client'
import type { Database } from '../types'

type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

// Explicit column list — `select('*')` over-fetches every audit / metadata
// column on every read. These seven are everything the apps actually
// consume from the profile.
const PROFILE_COLUMNS =
  'id, username, handicap_index, skill_level, goal, facilities, distance_unit'

export function getProfile(client: OgaSupabaseClient, userId: string) {
  return client.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).single()
}

export function updateProfile(
  client: OgaSupabaseClient,
  userId: string,
  updates: ProfileUpdate,
) {
  return client.from('profiles').update(updates).eq('id', userId).select().single()
}
