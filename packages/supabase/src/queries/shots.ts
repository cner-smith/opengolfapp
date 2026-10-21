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
export const SHOT_COLUMNS = 'id, hole_score_id, user_id, shot_number, start_lat, start_lng, end_lat, end_lng, aim_lat, aim_lng, distance_to_target, club, lie_type, lie_slope, lie_slope_forward, lie_slope_side, shot_result, contact, shape, start_line, penalty, ob, aim_offset_yards, break_direction, putt_result, putt_distance_result, putt_direction_result, putt_distance_ft, putt_slope_pct, green_speed, notes' as const

// Pattern/dispersion screens read far fewer columns than the full row. These
// narrowed projections trim the per-row payload on the largest shot queries.
// Both web and mobile consumers were verified to read only these columns — TS
// catches any over-drop because the `as const` literal types the response shape.

// getShotsByClub consumers (web useShotPatterns + mobile patterns): coords,
// distance, club, lie + slope axes, result flags. Drops the 9 putt-only /
// aim_offset / break / notes columns that no pattern view reads.
export const PATTERN_SHOT_COLUMNS = 'id, hole_score_id, user_id, shot_number, start_lat, start_lng, end_lat, end_lng, aim_lat, aim_lng, distance_to_target, club, lie_type, lie_slope, lie_slope_forward, lie_slope_side, shot_result, contact, shape, start_line, penalty, ob' as const

// getShotsForUser consumers (web + mobile useClubDispersion): only coords +
// club are read for the aim-relative dispersion math.
export const DISPERSION_SHOT_COLUMNS = 'id, hole_score_id, user_id, shot_number, start_lat, start_lng, end_lat, end_lng, aim_lat, aim_lng, club' as const

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
    // The round's date drives the recent-vs-all rings; round id, course and hole feed the shot readout.
    .select(`${PATTERN_SHOT_COLUMNS}, hole_scores!inner(round_id, rounds(played_at, courses(name)), holes(number))`)
    .eq('user_id', userId)
    .eq('club', club)
    .not('aim_lat', 'is', null)
    .not('end_lat', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)
}

// Every one of a user's shots with aim+end coords, newest first. Feeds the
// live-round overlay, My Bag and the Patterns club ladder, which build
// per-club counts, dispersion and median distance in ONE query
// (getShotsByClub is per-club), so it pages past PostgREST's 1000-row cap
// instead of silently truncating. `start_lat` may be null — the aim-relative
// math skips those rows, so we don't filter on it here.
const SHOTS_PAGE = 1000

export async function getShotsForUser(client: OgaSupabaseClient, userId: string) {
  const page = (from: number) =>
    client
      .from('shots')
      .select(DISPERSION_SHOT_COLUMNS)
      .eq('user_id', userId)
      .not('aim_lat', 'is', null)
      .not('end_lat', 'is', null)
      .not('club', 'is', null)
      .order('created_at', { ascending: false })
      // A unique tiebreak, so no row repeats or drops between pages.
      .order('id')
      .range(from, from + SHOTS_PAGE - 1)
  const rows: NonNullable<Awaited<ReturnType<typeof page>>['data']> = []
  for (let from = 0; ; from += SHOTS_PAGE) {
    const { data, error } = await page(from)
    if (error) return { data: null, error }
    rows.push(...data)
    if (data.length < SHOTS_PAGE) return { data: rows, error: null }
  }
}

export function createShot(client: OgaSupabaseClient, shot: ShotInsert) {
  return client.from('shots').insert(shot).select().single()
}

// Several rows in one statement: Postgres stores all of them or none.
export function createShots(client: OgaSupabaseClient, shots: ShotInsert[]) {
  return client.from('shots').insert(shots)
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
