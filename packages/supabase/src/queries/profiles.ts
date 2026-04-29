import type { OgaSupabaseClient } from '../client'
import type { Database } from '../types'

type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export function getProfile(client: OgaSupabaseClient, userId: string) {
  return client.from('profiles').select('*').eq('id', userId).single()
}

export function updateProfile(
  client: OgaSupabaseClient,
  userId: string,
  updates: ProfileUpdate,
) {
  return client.from('profiles').update(updates).eq('id', userId).select().single()
}
