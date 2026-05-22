import type { OgaSupabaseClient } from '../client'
import type { Database } from '../types'

type CourseInsert = Database['public']['Tables']['courses']['Insert']
type HoleInsert = Database['public']['Tables']['holes']['Insert']

// Cards / pickers only ever render name + city/state and need lat/lng for
// the hole-map fallback; external_id keeps the OpenGolfAPI link reachable.
const COURSE_COLUMNS = 'id, name, city, state, lat, lng, external_id'

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

export function createHoles(client: OgaSupabaseClient, holes: HoleInsert[]) {
  return client.from('holes').insert(holes).select()
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
