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

// upsert on (user_id, club_type) — paired with the table's UNIQUE
// constraint so re-adding a club_type the user already owns updates the
// existing row instead of throwing.
export function upsertUserClub(
  client: OgaSupabaseClient,
  club: UserClubInsert,
) {
  return client
    .from('user_clubs')
    .upsert(club, { onConflict: 'user_id,club_type' })
    .select(USER_CLUB_COLUMNS)
    .single()
}

// Bulk reorder by id list. The list's index becomes the row's sort_order.
// supabase-js doesn't expose a raw SQL path so we fan out one UPDATE per
// row. Errors from any row throw — caller is responsible for refetching
// to recover the canonical order. A future migration could move this to
// an Edge Function with a single transaction; for ≤30 clubs the round
// trips are cheap.
export async function updateClubOrder(
  client: OgaSupabaseClient,
  userId: string,
  orderedIds: string[],
): Promise<void> {
  const results = await Promise.all(
    orderedIds.map((id, idx) =>
      client
        .from('user_clubs')
        .update({ sort_order: idx })
        .eq('id', id)
        .eq('user_id', userId),
    ),
  )
  const firstError = results.find((r) => r.error)?.error
  if (firstError) throw firstError
}

export function deleteUserClub(client: OgaSupabaseClient, clubId: string, userId: string) {
  return client
    .from('user_clubs')
    .delete()
    .eq('id', clubId)
    .eq('user_id', userId)
}

// Seeds default clubs into a user's bag. `ignoreDuplicates` makes this
// safe to call concurrently — a second call (e.g. mobile auto-seed
// while the bag screen also auto-seeds) won't trip the
// (user_id, club_type) UNIQUE; existing rows stay untouched. The
// onboarding path passes a filtered subset (the user pre-trimmed the
// default bag); subsequent auto-seeds for that user are no-ops.
// Returns the post-seed bag in sort_order.
export async function seedDefaultBag(
  client: OgaSupabaseClient,
  userId: string,
  defaults: readonly { club_type: string; name: string; sort_order: number }[],
): Promise<UserClubRow[]> {
  const rows: UserClubInsert[] = defaults.map((d) => ({
    user_id: userId,
    club_type: d.club_type,
    name: d.name,
    sort_order: d.sort_order,
    in_bag: true,
  }))
  if (rows.length > 0) {
    const upserted = await client
      .from('user_clubs')
      .upsert(rows, {
        onConflict: 'user_id,club_type',
        ignoreDuplicates: true,
      })
    if (upserted.error) throw upserted.error
  }
  const all = await client
    .from('user_clubs')
    .select(USER_CLUB_COLUMNS)
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
  if (all.error) throw all.error
  return all.data ?? []
}
