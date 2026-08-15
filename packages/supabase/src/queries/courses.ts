import type { PostgrestError } from '@supabase/supabase-js'
import type { OgaSupabaseClient } from '../client'
import type { Database } from '../types'

type CourseTeeRow = Database['public']['Tables']['course_tees']['Row']

type CourseInsert = Database['public']['Tables']['courses']['Insert']
type CourseUpdate = Database['public']['Tables']['courses']['Update']
type HoleInsert = Database['public']['Tables']['holes']['Insert']
type HoleUpdate = Database['public']['Tables']['holes']['Update']
type FacilityInsert = Database['public']['Tables']['facilities']['Insert']
type FacilityUpdate = Database['public']['Tables']['facilities']['Update']

// Cards / pickers only ever render name + city/state and need lat/lng for
// the hole-map fallback; external_id keeps the OpenGolfAPI link reachable.
const COURSE_COLUMNS =
  'id, name, city, state, lat, lng, external_id, facility_id, unit_name, unit_order'

const FACILITY_COLUMNS = 'id, name, city, state, lat, lng'

export function searchCourses(
  client: OgaSupabaseClient,
  query: string,
  limit = 10,
  signal?: AbortSignal,
) {
  const trimmed = query.trim()
  if (!trimmed) {
    const builder = client
      .from('courses')
      .select(COURSE_COLUMNS)
      .order('name')
      .limit(limit)
    return signal ? builder.abortSignal(signal) : builder
  }
  // search_courses RPC ranks by pg_trgm similarity (typo-tolerant) then
  // falls back to ILIKE substring. Migration 0018; trigram index from 0015.
  const builder = client.rpc('search_courses', {
    search_query: trimmed,
    result_limit: limit,
  })
  // Threading an AbortSignal makes the underlying fetch actually
  // cancellable — postgrest-js v3+ honors it via PostgrestTransformBuilder
  // (PostgrestBuilder.ts:317-324). Without this, the request runs to
  // completion regardless of cancellation, retaining response buffers
  // until the JS .then chain settles. Issue #291.
  return signal ? builder.abortSignal(signal) : builder
}

// Facility-first picker: match facilities by name (ilike; facilities are few, no
// trgm index needed yet). Empty query browses alphabetically.
export function searchFacilities(
  client: OgaSupabaseClient,
  query: string,
  limit = 10,
  signal?: AbortSignal,
) {
  const trimmed = query.trim()
  const builder = trimmed
    ? client.from('facilities').select(FACILITY_COLUMNS).ilike('name', `%${trimmed}%`).order('name').limit(limit)
    : client.from('facilities').select(FACILITY_COLUMNS).order('name').limit(limit)
  return signal ? builder.abortSignal(signal) : builder
}

// The units (course rows) that make up a facility, in display order.
export function getFacilityUnits(client: OgaSupabaseClient, facilityId: string) {
  return client
    .from('courses')
    .select(COURSE_COLUMNS)
    .eq('facility_id', facilityId)
    .order('unit_order', { ascending: true, nullsFirst: false })
    .order('name')
}

// Re-anchor matched units to their facility: fetch the facilities for a set of
// facility_ids pulled off unit course rows in the search results.
export function getFacilitiesByIds(client: OgaSupabaseClient, ids: string[]) {
  return client.from('facilities').select(FACILITY_COLUMNS).in('id', ids)
}

export function getFullFacilityById(client: OgaSupabaseClient, facilityId: string) {
  return client.from('facilities').select('*').eq('id', facilityId).maybeSingle()
}

export function createFacility(client: OgaSupabaseClient, facility: FacilityInsert) {
  return client.from('facilities').insert(facility).select().single()
}

export function updateFacility(client: OgaSupabaseClient, id: string, patch: FacilityUpdate) {
  return client.from('facilities').update(patch).eq('id', id).select().single()
}

export function getCourseById(client: OgaSupabaseClient, courseId: string) {
  return client
    .from('courses')
    .select(COURSE_COLUMNS)
    .eq('id', courseId)
    .maybeSingle()
}

export function getHolesForCourse(client: OgaSupabaseClient, courseId: string) {
  return client
    .from('holes')
    .select('*')
    .eq('course_id', courseId)
    .order('number')
}

export function createCourse(client: OgaSupabaseClient, course: CourseInsert) {
  return client.from('courses').insert(course).select().single()
}

// Full-row read for the dev-only Course Editor — unlike COURSE_COLUMNS above
// (a narrow projection for search/picker UI), the editor needs every field,
// including website/address.
export function getFullCourseById(client: OgaSupabaseClient, courseId: string) {
  return client.from('courses').select('*').eq('id', courseId).maybeSingle()
}

export function updateCourse(client: OgaSupabaseClient, id: string, patch: CourseUpdate) {
  return client.from('courses').update(patch).eq('id', id).select().single()
}

export function createHoles(client: OgaSupabaseClient, holes: HoleInsert[]) {
  return client.from('holes').insert(holes).select()
}

export function updateHole(client: OgaSupabaseClient, id: string, patch: HoleUpdate) {
  return client.from('holes').update(patch).eq('id', id).select().single()
}

// Upsert on (course_id, number) so the Course Editor can freely add/edit
// hole rows — including regenerating a default template — without first
// checking which numbers already exist.
export function upsertHoles(client: OgaSupabaseClient, holes: HoleInsert[]) {
  if (holes.length === 0) {
    return Promise.resolve({ data: [] as unknown[], error: null })
  }
  return client.from('holes').upsert(holes, { onConflict: 'course_id,number' }).select()
}

export function deleteHole(client: OgaSupabaseClient, id: string) {
  return client.from('holes').delete().eq('id', id)
}

const DEFAULT_PAR_72: Array<{ number: number; par: number }> = [
  { number: 1, par: 4 },
  { number: 2, par: 4 },
  { number: 3, par: 3 },
  { number: 4, par: 5 },
  { number: 5, par: 4 },
  { number: 6, par: 4 },
  { number: 7, par: 3 },
  { number: 8, par: 4 },
  { number: 9, par: 5 },
  { number: 10, par: 4 },
  { number: 11, par: 4 },
  { number: 12, par: 3 },
  { number: 13, par: 5 },
  { number: 14, par: 4 },
  { number: 15, par: 4 },
  { number: 16, par: 3 },
  { number: 17, par: 4 },
  { number: 18, par: 5 },
]

export function defaultHolesForCourse(courseId: string): HoleInsert[] {
  return DEFAULT_PAR_72.map((h, idx) => ({
    course_id: courseId,
    number: h.number,
    par: h.par,
    stroke_index: idx + 1,
  }))
}

export function getCourseByExternalId(
  client: OgaSupabaseClient,
  externalId: string,
) {
  return client
    .from('courses')
    .select(COURSE_COLUMNS)
    .eq('external_id', externalId)
    .maybeSingle()
}

type CourseTeeInsert = Database['public']['Tables']['course_tees']['Insert']

export function getCourseTees(client: OgaSupabaseClient, courseId: string) {
  return client
    .from('course_tees')
    .select('*')
    .eq('course_id', courseId)
    .order('total_yards', { ascending: false })
}

export function upsertCourseTees(
  client: OgaSupabaseClient,
  rows: CourseTeeInsert[],
) {
  if (rows.length === 0) {
    return Promise.resolve({ data: [] as unknown[], error: null })
  }
  return client
    .from('course_tees')
    .upsert(rows, { onConflict: 'course_id,tee_color' })
    .select()
}

export function deleteCourseTee(client: OgaSupabaseClient, id: string) {
  return client.from('course_tees').delete().eq('id', id)
}

type CourseTeeUpdate = Database['public']['Tables']['course_tees']['Update']

export function updateCourseTee(client: OgaSupabaseClient, id: string, patch: CourseTeeUpdate) {
  return client.from('course_tees').update(patch).eq('id', id).select().single()
}

// Designates `teeId` as the course's primary tee (the one whose data IS
// the base `holes` row in the Course Editor) and un-sets any previous
// primary. Two sequential updates, not a single transaction — the unique
// partial index (course_tees_one_primary_per_course) never sees more than
// one true per course at either statement boundary: clearing first drops
// to zero (allowed), then setting the target goes to exactly one.
export async function setPrimaryCourseTee(
  client: OgaSupabaseClient,
  courseId: string,
  teeId: string,
): Promise<{ data: CourseTeeRow | null; error: PostgrestError | null }> {
  const { error: clearError } = await client
    .from('course_tees')
    .update({ is_primary: false })
    .eq('course_id', courseId)
  if (clearError) return { data: null, error: clearError }
  return client.from('course_tees').update({ is_primary: true }).eq('id', teeId).select().single()
}

// Promotes `teeId` to primary ONLY if the course has no primary tee yet —
// used right after creating a course's first tee, so it becomes primary
// automatically. Deliberately re-checks against the database rather than
// trusting the caller's belief that "this is the first tee": a client-side
// `tees.length === 0` check trusts a fetched array that can be stale (e.g.
// mid-refetch after an earlier tee was set primary), and a stale check here
// would silently steal primary status from an existing tee. Checking the
// DB directly makes this call idempotent and race-safe regardless of what
// the caller's local state thinks.
export async function setPrimaryIfNone(
  client: OgaSupabaseClient,
  courseId: string,
  teeId: string,
): Promise<{ data: CourseTeeRow | null; error: PostgrestError | null }> {
  const { data: existing, error: checkError } = await client
    .from('course_tees')
    .select('id')
    .eq('course_id', courseId)
    .eq('is_primary', true)
    .maybeSingle()
  if (checkError) return { data: null, error: checkError }
  if (existing) return { data: null, error: null }
  return client.from('course_tees').update({ is_primary: true }).eq('id', teeId).select().single()
}

type HoleTeeInsert = Database['public']['Tables']['hole_tees']['Insert']

// hole_tees has no course_id column — join through holes to scope by course.
export function getHoleTeesForCourse(client: OgaSupabaseClient, courseId: string) {
  return client
    .from('hole_tees')
    .select('*, holes!inner(course_id)')
    .eq('holes.course_id', courseId)
}

// Upsert on (hole_id, course_tee_id) — sparse by design, only rows the
// Course Editor actually wrote as a tee-specific override exist here.
export function upsertHoleTees(client: OgaSupabaseClient, rows: HoleTeeInsert[]) {
  if (rows.length === 0) {
    return Promise.resolve({ data: [] as unknown[], error: null })
  }
  return client.from('hole_tees').upsert(rows, { onConflict: 'hole_id,course_tee_id' }).select()
}

export function deleteHoleTee(client: OgaSupabaseClient, id: string) {
  return client.from('hole_tees').delete().eq('id', id)
}
