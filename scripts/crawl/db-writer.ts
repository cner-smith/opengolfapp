// All Supabase writes go through this module. Keeping the surface
// narrow makes it easier to audit when migrating to a different
// backend or wrapping in retries.
import { supabase } from './client'
import type {
  CrawlStateRow,
  CrawlStatus,
  CourseGeo,
  CourseRowMin,
  OgaHole,
  OgaHoleGeo,
  OgaTee,
} from './types'

export async function findCourseByExternalId(externalId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('courses')
    .select('id')
    .eq('external_id', externalId)
    .maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

// Select-then-update-or-insert keyed on external_id. The unique index
// from migration 0019 is a *partial* index (`WHERE external_id IS NOT
// NULL`), and PostgREST refuses to use a partial index as the conflict
// target on `.upsert(..., { onConflict })` — every call returned
// "there is no unique or exclusion constraint matching the ON CONFLICT
// specification" and the whole crawl row failed.
//
// We're single-process here (the crawler runs sequentially per state),
// so the lookup → write race that motivated the original `.upsert()`
// can't fire. Manual user-created courses (no external_id) NEVER come
// through here — they go through createCourse() in the web hooks and
// stay plain inserts.
export async function upsertCourse(args: {
  externalId: string
  name: string
  city: string | null
  state: string | null
  lat: number | null
  lng: number | null
}): Promise<{ id: string }> {
  const row = {
    external_id: args.externalId,
    name: args.name,
    city: args.city,
    state: args.state,
    lat: args.lat,
    lng: args.lng,
  }
  const existingId = await findCourseByExternalId(args.externalId)
  if (existingId) {
    const { data, error } = await supabase
      .from('courses')
      .update(row)
      .eq('id', existingId)
      .select('id')
      .single()
    if (error || !data) throw error ?? new Error('course update failed')
    return { id: data.id }
  }
  const { data, error } = await supabase.from('courses').insert(row).select('id').single()
  if (error || !data) throw error ?? new Error('course insert failed')
  return { id: data.id }
}

export async function upsertHoles(courseId: string, holes: OgaHole[]): Promise<void> {
  if (holes.length === 0) return
  const rows = holes.map((h) => ({
    course_id: courseId,
    number: h.number,
    par: h.par,
    yards: h.yards ?? null,
  }))
  const { error } = await supabase.from('holes').upsert(rows, { onConflict: 'course_id,number' })
  if (error) throw error
}

// Like upsertHoles but also writes per-hole tee/pin geometry. Used by the
// osm-holes pass. Same (course_id, number) conflict target.
export async function upsertHoleGeometry(courseId: string, holes: OgaHoleGeo[]): Promise<void> {
  if (holes.length === 0) return
  const rows = holes.map((h) => ({
    course_id: courseId,
    number: h.number,
    par: h.par,
    yards: h.yards ?? null,
    tee_lat: h.teeLat ?? null,
    tee_lng: h.teeLng ?? null,
    pin_lat: h.pinLat ?? null,
    pin_lng: h.pinLng ?? null,
  }))
  const { error } = await supabase.from('holes').upsert(rows, { onConflict: 'course_id,number' })
  if (error) throw error
}

// Courses in a state that have a centroid (lat/lng). The osm-holes pass
// assigns each OSM hole way to its nearest such course. Includes ALL coord
// courses (OSM, OpenGolfAPI-enriched, and manually added), not just osm_%.
export async function fetchCourseGeoForState(state: string): Promise<CourseGeo[]> {
  const PAGE_SIZE = 500
  const all: CourseGeo[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('courses')
      .select('id, lat, lng')
      .eq('state', state)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .range(from, from + PAGE_SIZE - 1)
    if (error) {
      throw new Error(
        `courses geo fetch failed (state=${state}, range=${from}-${from + PAGE_SIZE - 1}): ${error.message ?? JSON.stringify(error)}`,
      )
    }
    const rows = (data ?? []) as { id: string; lat: number | null; lng: number | null }[]
    for (const r of rows) {
      if (r.lat != null && r.lng != null) all.push({ id: r.id, lat: r.lat, lng: r.lng })
    }
    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return all
}

// Courses that have a centroid but no city. The geocode pass reverse-geocodes
// each one's coordinates (OSM Nominatim) to fill the city. Optional cap so a
// rate-limited run stays bounded.
export async function fetchCitylessCourses(
  limit: number | null,
): Promise<{ id: string; name: string; lat: number; lng: number }[]> {
  const PAGE_SIZE = 500
  const out: { id: string; name: string; lat: number; lng: number }[] = []
  let from = 0
  while (true) {
    const to = limit != null ? Math.min(from + PAGE_SIZE, limit) - 1 : from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('courses')
      .select('id, name, lat, lng')
      .is('city', null)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .range(from, to)
    if (error) {
      throw new Error(
        `cityless fetch failed (range=${from}-${to}): ${error.message ?? JSON.stringify(error)}`,
      )
    }
    const rows = (data ?? []) as {
      id: string
      name: string
      lat: number | null
      lng: number | null
    }[]
    for (const r of rows) {
      if (r.lat != null && r.lng != null)
        out.push({ id: r.id, name: r.name, lat: r.lat, lng: r.lng })
    }
    if (rows.length < PAGE_SIZE) break
    if (limit != null && out.length >= limit) break
    from += PAGE_SIZE
  }
  return limit != null ? out.slice(0, limit) : out
}

// Fill a course's city (and optionally rewrite its "Golf Course" fallback
// name). Used by the geocode pass only.
export async function updateCourseCity(id: string, city: string, name?: string): Promise<void> {
  const patch: { city: string; name?: string } = { city }
  if (name) patch.name = name
  const { error } = await supabase.from('courses').update(patch).eq('id', id)
  if (error) {
    throw new Error(`city update failed (course=${id}): ${error.message ?? JSON.stringify(error)}`)
  }
}

export interface CourseFull {
  id: string
  externalId: string | null
  name: string
  city: string | null
  lat: number
  lng: number
}

// All coord-bearing courses in a state with the fields the completion pass
// needs to reconcile them against OSM polygons (identity, name, city, centroid).
export async function fetchCoursesForState(state: string): Promise<CourseFull[]> {
  const PAGE_SIZE = 500
  const all: CourseFull[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('courses')
      .select('id, external_id, name, city, lat, lng')
      .eq('state', state)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .range(from, from + PAGE_SIZE - 1)
    if (error) {
      throw new Error(
        `courses fetch failed (state=${state}): ${error.message ?? JSON.stringify(error)}`,
      )
    }
    const rows = (data ?? []) as {
      id: string
      external_id: string | null
      name: string
      city: string | null
      lat: number | null
      lng: number | null
    }[]
    for (const r of rows) {
      if (r.lat != null && r.lng != null) {
        all.push({
          id: r.id,
          externalId: r.external_id,
          name: r.name,
          city: r.city,
          lat: r.lat,
          lng: r.lng,
        })
      }
    }
    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return all
}

// Fold a duplicate course (a non-OSM centroid inside a real OSM polygon,
// confirmed by a name match) into the real course. Order matters so a failure
// can never lose data: (1) move user rounds, (2) MOVE tee ratings — real
// enrichment, never deleted; the real course came from a bare OSM polygon and
// normally has no tees, so an onConflict(course_id,tee_color) collision is rare
// and surfaced if it hits — (3) delete the duplicate's holes (the real course
// now carries exact containment geometry), then the duplicate row.
export async function mergeAndDeletePhantom(phantomId: string, realId: string): Promise<void> {
  const rounds = await supabase
    .from('rounds')
    .update({ course_id: realId })
    .eq('course_id', phantomId)
  if (rounds.error) {
    throw new Error(`merge: move rounds ${phantomId}->${realId} failed: ${rounds.error.message}`)
  }
  // A tee_color the real course already carries can't be moved (unique
  // course_id,tee_color) — drop the duplicate's copy (real course wins), then
  // move the rest.
  const realTees = await supabase.from('course_tees').select('tee_color').eq('course_id', realId)
  if (realTees.error)
    throw new Error(`merge: read real tees ${realId} failed: ${realTees.error.message}`)
  const haveColors = (realTees.data ?? []).map((r) => r.tee_color as string)
  if (haveColors.length) {
    const dropDup = await supabase
      .from('course_tees')
      .delete()
      .eq('course_id', phantomId)
      .in('tee_color', haveColors)
    if (dropDup.error)
      throw new Error(`merge: drop dup tees ${phantomId} failed: ${dropDup.error.message}`)
  }
  const tees = await supabase
    .from('course_tees')
    .update({ course_id: realId })
    .eq('course_id', phantomId)
  if (tees.error)
    throw new Error(`merge: move tees ${phantomId}->${realId} failed: ${tees.error.message}`)
  const holes = await supabase.from('holes').delete().eq('course_id', phantomId)
  if (holes.error)
    throw new Error(`merge: delete dup holes ${phantomId} failed: ${holes.error.message}`)
  const course = await supabase.from('courses').delete().eq('id', phantomId)
  if (course.error)
    throw new Error(`merge: delete dup course ${phantomId} failed: ${course.error.message}`)
}

// Course ids that already have at least one hole carrying coordinates. The
// osm-holes pass skips these so it never clobbers hand-curated or previously
// imported geometry (idempotent + safe to re-run). Chunked like the tee lookup.
export async function fetchCoursesWithHoleGeometry(
  courseIds: string[],
  label: string,
): Promise<Set<string>> {
  const have = new Set<string>()
  if (courseIds.length === 0) return have
  const CHUNK = 200
  for (let i = 0; i < courseIds.length; i += CHUNK) {
    const chunk = courseIds.slice(i, i + CHUNK)
    const { data, error } = await supabase
      .from('holes')
      .select('course_id')
      .in('course_id', chunk)
      .not('tee_lat', 'is', null)
    if (error) {
      throw new Error(
        `[${label}] hole-geometry lookup failed (chunk ${i}-${i + chunk.length - 1}): ${error.message ?? JSON.stringify(error)}`,
      )
    }
    for (const row of data ?? []) {
      if (row.course_id) have.add(row.course_id)
    }
  }
  return have
}

export async function upsertTees(courseId: string, tees: OgaTee[]): Promise<void> {
  if (tees.length === 0) return
  const rows = tees.map((t) => ({
    course_id: courseId,
    tee_color: t.color,
    tee_name: t.name ?? null,
    course_rating: t.rating ?? null,
    slope_rating: t.slope ?? null,
    total_yards: t.totalYards ?? null,
    par: t.par ?? null,
  }))
  const { error } = await supabase
    .from('course_tees')
    .upsert(rows, { onConflict: 'course_id,tee_color' })
  if (error) throw error
}

export async function getCrawlState(id: string): Promise<CrawlStateRow | null> {
  const { data, error } = await supabase.from('crawl_state').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as CrawlStateRow | null) ?? null
}

export async function setCrawlState(
  id: string,
  fields: {
    status?: CrawlStatus
    itemsProcessed?: number
    errorMessage?: string | null
  },
): Promise<void> {
  const row: Record<string, unknown> = {
    id,
    last_crawled_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  if (fields.status != null) row.status = fields.status
  if (fields.itemsProcessed != null) row.items_processed = fields.itemsProcessed
  if (fields.errorMessage !== undefined) row.error_message = fields.errorMessage
  const { error } = await supabase.from('crawl_state').upsert(row, { onConflict: 'id' })
  if (error) throw error
}

// Paginated fetch of OSM-imported courses for a state. Supabase's default
// row cap is 1000 — paginating in 500-row chunks keeps us well under that
// even if one state grows past it (and so we can see the ceiling in logs
// instead of silently truncating).
export async function fetchOsmCoursesForState(state: string): Promise<CourseRowMin[]> {
  const PAGE_SIZE = 500
  const all: CourseRowMin[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('courses')
      .select('id, name, external_id')
      .eq('state', state)
      .like('external_id', 'osm_%')
      .range(from, from + PAGE_SIZE - 1)
    if (error) {
      throw new Error(
        `courses fetch failed (state=${state}, range=${from}-${from + PAGE_SIZE - 1}): ${error.message ?? JSON.stringify(error)}`,
      )
    }
    const rows = (data ?? []) as CourseRowMin[]
    all.push(...rows)
    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return all
}

// Bulk tee lookup, chunked to avoid PostgREST's URL-length limit. With ~868
// UUIDs the single `.in('course_id', courseIds)` call serialises into a URL
// long enough to trip a 400 — and the supabase client throws its raw
// PostgrestError, which has no `stack`, so the outer catch reports just
// "Bad Request" with no clue where it came from. 200 ids/chunk is well
// under any cap.
export async function fetchAlreadyTeedCourseIds(
  courseIds: string[],
  label: string,
): Promise<Set<string>> {
  const teedSet = new Set<string>()
  if (courseIds.length === 0) return teedSet
  const CHUNK = 200
  for (let i = 0; i < courseIds.length; i += CHUNK) {
    const chunk = courseIds.slice(i, i + CHUNK)
    const { data, error } = await supabase
      .from('course_tees')
      .select('course_id')
      .in('course_id', chunk)
    if (error) {
      throw new Error(
        `[${label}] course_tees lookup failed (chunk ${i}-${i + chunk.length - 1}, ${chunk.length} ids): ${error.message ?? JSON.stringify(error)}`,
      )
    }
    for (const row of data ?? []) {
      if (row.course_id) teedSet.add(row.course_id)
    }
  }
  return teedSet
}

// Update a course's external_id. Used by the enrichment pass to switch
// OSM-discovered courses to the OpenGolfAPI key once a fuzzy match
// confirms they're the same course.
export async function updateCourseExternalId(courseId: string, externalId: string): Promise<void> {
  const { error: updateErr } = await supabase
    .from('courses')
    .update({ external_id: externalId })
    .eq('id', courseId)
  if (updateErr) {
    throw new Error(
      `external_id update failed (course=${courseId}): ${updateErr.message ?? JSON.stringify(updateErr)}`,
    )
  }
}

export async function fetchAllCrawlState(): Promise<CrawlStateRow[]> {
  const { data, error } = await supabase
    .from('crawl_state')
    .select('id, status, items_processed, last_crawled_at, error_message')
    .order('id')
  if (error) throw error
  return (data ?? []) as CrawlStateRow[]
}

export async function countCourses(): Promise<number> {
  const { count, error } = await supabase
    .from('courses')
    .select('id', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}
