import type { OgaSupabaseClient } from '../client'
import type { Database } from '../types'

type UserClubRow = Database['public']['Tables']['user_clubs']['Row']
type UserClubInsert = Database['public']['Tables']['user_clubs']['Insert']

export const USER_CLUB_COLUMNS =
  'id, user_id, name, club_type, loft, typical_distance_yards, sort_order, in_bag, created_at' as const

// Belt-and-suspenders: every read/mutation filters on userId in addition
// to RLS so a missing/misconfigured policy can't silently expose other
// users' rows.
export function getUserBag(client: OgaSupabaseClient, userId: string) {
  return client
    .from('user_clubs')
    .select(USER_CLUB_COLUMNS)
    .eq('user_id', userId)
    .eq('in_bag', true)
    .order('sort_order', { ascending: true })
}

export function getAllUserClubs(client: OgaSupabaseClient, userId: string) {
  return client
    .from('user_clubs')
    .select(USER_CLUB_COLUMNS)
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
}

// Update by id when an existing row is being edited (id provided);
// fall back to upsert on (user_id, club_type, loft) for inserts so
// re-adding the same slot updates instead of throwing. The split is
// required because migration 0024 changed the unique key to include
// loft — a user editing an existing row's loft would otherwise miss
// the conflict target and trip the primary-key on `id` instead.
export async function upsertUserClub(
  client: OgaSupabaseClient,
  club: UserClubInsert,
) {
  if (club.id) {
    return client
      .from('user_clubs')
      .update(club)
      .eq('id', club.id)
      .eq('user_id', club.user_id)
      .select(USER_CLUB_COLUMNS)
      .single()
  }
  return client
    .from('user_clubs')
    .upsert(club, { onConflict: 'user_id,club_type,loft' })
    .select(USER_CLUB_COLUMNS)
    .single()
}

// Bulk reorder by id list — the list's index becomes the row's
// sort_order. Wrapped in a single SECURITY DEFINER RPC (migration 0024)
// so a network drop can't leave sort_order half-applied. The RPC checks
// auth.uid() inside and only touches rows owned by the caller.
export async function updateClubOrder(
  client: OgaSupabaseClient,
  userId: string,
  orderedIds: string[],
): Promise<void> {
  if (orderedIds.length === 0) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rpc = (client as any).rpc.bind(client) as (
    fn: 'update_club_order',
    args: { p_user_id: string; p_club_ids: string[]; p_orders: number[] },
  ) => Promise<{ error: { message: string } | null }>
  const { error } = await rpc('update_club_order', {
    p_user_id: userId,
    p_club_ids: orderedIds,
    p_orders: orderedIds.map((_, i) => i),
  })
  if (error) throw error
}

export function deleteUserClub(client: OgaSupabaseClient, clubId: string, userId: string) {
  return client
    .from('user_clubs')
    .delete()
    .eq('id', clubId)
    .eq('user_id', userId)
}

// Seeds default clubs into a user's bag. Pre-filters defaults against
// any club_type the user already owns (regardless of loft) — under the
// migration-0024 (user_id, club_type, loft) NULLS NOT DISTINCT index a
// NULL-loft default would not collide with a user-set 58° row of the
// same type, so unfiltered seeds would silently double-up the slot.
// Concurrent seed calls (e.g. mobile auto-seed racing the bag screen's
// auto-seed) settle to the same final state because each filters
// against the latest read; the unique index catches anything they
// both still try to insert.
// Returns the post-seed bag in sort_order.
export async function seedDefaultBag(
  client: OgaSupabaseClient,
  userId: string,
  defaults: readonly { club_type: string; name: string; sort_order: number }[],
): Promise<UserClubRow[]> {
  if (defaults.length > 0) {
    const existing = await client
      .from('user_clubs')
      .select('club_type')
      .eq('user_id', userId)
    if (existing.error) throw existing.error
    const owned = new Set((existing.data ?? []).map((r) => r.club_type))
    const filtered = defaults.filter((d) => !owned.has(d.club_type))
    if (filtered.length > 0) {
      const rows: UserClubInsert[] = filtered.map((d) => ({
        user_id: userId,
        club_type: d.club_type,
        name: d.name,
        sort_order: d.sort_order,
        in_bag: true,
      }))
      const upserted = await client
        .from('user_clubs')
        .upsert(rows, {
          onConflict: 'user_id,club_type,loft',
          ignoreDuplicates: true,
        })
      if (upserted.error) throw upserted.error
    }
  }
  const all = await client
    .from('user_clubs')
    .select(USER_CLUB_COLUMNS)
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
  if (all.error) throw all.error
  return all.data ?? []
}
