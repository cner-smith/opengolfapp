/**
 * Import golf course hole geometry from OpenStreetMap.
 *
 * Queries Overpass for golf=hole|green|tee within a circle, parses the way +
 * node geometry, and upserts a course + holes with tee_lat/lng + pin_lat/lng.
 * Re-running is safe: the course is matched by name and holes are upserted
 * on (course_id, number).
 *
 * Shared by scripts/import-osm-course.ts (CLI) and the dev-only Course
 * Editor's "re-fetch from OSM" button — both call runOsmImport with a
 * caller-supplied Supabase client so this module has no client/env state
 * of its own.
 */
import type { OgaSupabaseClient } from './client'

// ---------------------------------------------------------------------------
// Overpass
// ---------------------------------------------------------------------------

interface OverpassNode {
  type: 'node'
  id: number
  lat: number
  lon: number
}
interface OverpassWay {
  type: 'way'
  id: number
  nodes: number[]
  tags?: Record<string, string>
}
type OverpassElement = OverpassNode | OverpassWay
interface OverpassResponse {
  elements: OverpassElement[]
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface OverpassQuery {
  lat: number
  lng: number
  radius: number
}

export async function fetchOverpass(args: OverpassQuery): Promise<OverpassResponse> {
  const q = `
[out:json][timeout:25];
(
  way["golf"="hole"](around:${args.radius},${args.lat},${args.lng});
  way["golf"="green"](around:${args.radius},${args.lat},${args.lng});
  way["golf"="tee"](around:${args.radius},${args.lat},${args.lng});
);
out body;
>;
out skel qt;
`.trim()

  let lastError: Error | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'oga-osm-import/0.1 (https://github.com/cner-smith/opengolfapp)',
          },
          body: 'data=' + encodeURIComponent(q),
        })
        if (res.ok) {
          return (await res.json()) as OverpassResponse
        }
        lastError = new Error(
          `${endpoint} returned ${res.status}: ${(await res.text()).slice(0, 200)}`,
        )
      } catch (err) {
        lastError = err as Error
      }
      // Brief pause before trying the next mirror.
      await sleep(500)
    }
    // Backoff between full passes through the mirror list.
    if (attempt < 2) await sleep(2000 * (attempt + 1))
  }
  throw lastError ?? new Error('Overpass request failed (no response)')
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

interface LatLon {
  lat: number
  lon: number
}

export function centroid(nodes: LatLon[]): LatLon {
  const lat = nodes.reduce((s, n) => s + n.lat, 0) / nodes.length
  const lon = nodes.reduce((s, n) => s + n.lon, 0) / nodes.length
  return { lat, lon }
}

export function haversineMeters(a: LatLon, b: LatLon): number {
  const R = 6371000
  const φ1 = (a.lat * Math.PI) / 180
  const φ2 = (b.lat * Math.PI) / 180
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180
  const Δλ = ((b.lon - a.lon) * Math.PI) / 180
  const h =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export function metersToYards(m: number): number {
  return m * 1.09361
}

// ---------------------------------------------------------------------------
// Parsing OSM elements
// ---------------------------------------------------------------------------

interface ParsedHole {
  ref: number
  par: number
  yards: number | null
  teeFromHole: LatLon
  pinFromHole: LatLon
  pathYards: number
}

export function parseElements(resp: OverpassResponse, courseFilter?: string): {
  holes: ParsedHole[]
  greens: LatLon[]
  tees: LatLon[]
} {
  const nodes = new Map<number, LatLon>()
  const ways: OverpassWay[] = []
  for (const el of resp.elements) {
    if (el.type === 'node') {
      nodes.set(el.id, { lat: el.lat, lon: el.lon })
    } else {
      ways.push(el)
    }
  }

  const holes: ParsedHole[] = []
  const greens: LatLon[] = []
  const tees: LatLon[] = []

  for (const way of ways) {
    const tags = way.tags ?? {}
    const golf = tags.golf
    if (!golf) continue
    const points: LatLon[] = []
    for (const id of way.nodes) {
      const n = nodes.get(id)
      if (n) points.push(n)
    }
    if (points.length === 0) continue

    if (golf === 'hole') {
      if (courseFilter && !tags.name?.toLowerCase().includes(courseFilter.toLowerCase())) continue
      const refRaw = tags.ref ?? tags.name ?? ''
      const ref = parseInt(refRaw.replace(/\D/g, ''), 10)
      if (!Number.isFinite(ref) || ref < 1 || ref > 18) continue
      const par = parseInt(tags.par ?? '', 10)
      const yardsTag =
        parseInt(tags['par_yards'] ?? '', 10) ||
        parseInt(tags['distance'] ?? '', 10) ||
        null
      let pathMeters = 0
      for (let i = 1; i < points.length; i++) {
        pathMeters += haversineMeters(points[i - 1]!, points[i]!)
      }
      holes.push({
        ref,
        par: Number.isFinite(par) ? par : 4,
        yards: yardsTag,
        teeFromHole: points[0]!,
        pinFromHole: points[points.length - 1]!,
        pathYards: metersToYards(pathMeters),
      })
    } else if (golf === 'green') {
      greens.push(centroid(points))
    } else if (golf === 'tee') {
      tees.push(centroid(points))
    }
  }

  return { holes, greens, tees }
}

// ---------------------------------------------------------------------------
// Match greens + tees to each hole
// ---------------------------------------------------------------------------

interface MatchedHole {
  ref: number
  par: number
  yards: number | null
  tee: LatLon
  pin: LatLon
  hasGreenMatch: boolean
  hasTeeMatch: boolean
}

const MATCH_RADIUS_METERS = 60 // green/tee polygons close to the hole endpoints

function nearest(
  candidates: LatLon[],
  target: LatLon,
): { point: LatLon; dist: number } | null {
  let best: { point: LatLon; dist: number } | null = null
  for (const c of candidates) {
    const dist = haversineMeters(c, target)
    if (!best || dist < best.dist) best = { point: c, dist }
  }
  return best
}

export function matchHoles(
  parsed: ReturnType<typeof parseElements>,
  queryCenter: LatLon,
): { matched: MatchedHole[]; dedupedRefs: number[] } {
  // Dedupe by ref: when the same hole number appears twice (common around
  // multi-course properties where OSM tags overlap or duplicate), keep the
  // way whose midpoint is closest to the query center.
  const byRef = new Map<number, ParsedHole>()
  const dropped: number[] = []
  for (const hole of parsed.holes) {
    const mid = {
      lat: (hole.teeFromHole.lat + hole.pinFromHole.lat) / 2,
      lon: (hole.teeFromHole.lon + hole.pinFromHole.lon) / 2,
    }
    const dist = haversineMeters(mid, queryCenter)
    const prev = byRef.get(hole.ref)
    if (!prev) {
      byRef.set(hole.ref, hole)
      continue
    }
    const prevMid = {
      lat: (prev.teeFromHole.lat + prev.pinFromHole.lat) / 2,
      lon: (prev.teeFromHole.lon + prev.pinFromHole.lon) / 2,
    }
    const prevDist = haversineMeters(prevMid, queryCenter)
    if (dist < prevDist) {
      byRef.set(hole.ref, hole)
      dropped.push(hole.ref)
    } else {
      dropped.push(hole.ref)
    }
  }

  const out: MatchedHole[] = []
  for (const hole of byRef.values()) {
    const greenHit = nearest(parsed.greens, hole.pinFromHole)
    const teeHit = nearest(parsed.tees, hole.teeFromHole)
    const pin =
      greenHit && greenHit.dist <= MATCH_RADIUS_METERS
        ? greenHit.point
        : hole.pinFromHole
    const tee =
      teeHit && teeHit.dist <= MATCH_RADIUS_METERS
        ? teeHit.point
        : hole.teeFromHole
    out.push({
      ref: hole.ref,
      par: hole.par,
      yards: hole.yards ?? (Math.round(hole.pathYards) || null),
      tee,
      pin,
      hasGreenMatch: !!greenHit && greenHit.dist <= MATCH_RADIUS_METERS,
      hasTeeMatch: !!teeHit && teeHit.dist <= MATCH_RADIUS_METERS,
    })
  }
  out.sort((a, b) => a.ref - b.ref)
  return { matched: out, dedupedRefs: [...new Set(dropped)].sort((a, b) => a - b) }
}

// ---------------------------------------------------------------------------
// Supabase upsert
// ---------------------------------------------------------------------------

export async function upsertCourse(
  client: OgaSupabaseClient,
  name: string,
  centroidPoint: LatLon,
  updateExisting: boolean,
): Promise<{ id: string; created: boolean }> {
  const { data: existing, error: lookupErr } = await client
    .from('courses')
    .select('id')
    .eq('name', name)
    .maybeSingle()
  if (lookupErr) throw lookupErr
  if (existing) {
    const { error: updateErr } = await client
      .from('courses')
      .update({ lat: centroidPoint.lat, lng: centroidPoint.lon })
      .eq('id', existing.id)
    if (updateErr) throw updateErr
    return { id: existing.id, created: false }
  }
  // --update-existing means "operate on a known course only" — bail
  // out with a clear error rather than silently inserting a duplicate
  // row when the name match misses (e.g. punctuation drift between
  // the DB row and the OSM tag).
  if (updateExisting) {
    throw new Error(
      `updateExisting was set but no course matching "${name}" exists. ` +
        `Retry without it to create the course, or fix the name to match the existing row.`,
    )
  }

  const { data, error } = await client
    .from('courses')
    .insert({ name, lat: centroidPoint.lat, lng: centroidPoint.lon })
    .select('id')
    .single()
  if (error || !data) throw error ?? new Error('course insert failed')
  return { id: data.id, created: true }
}

export async function deleteHolesForCourse(
  client: OgaSupabaseClient,
  courseId: string,
): Promise<number> {
  // Count first so we can report what was wiped — Supabase delete()
  // doesn't return the affected row count without a `count: 'exact'`
  // header, and a separate count keeps the log line accurate.
  const { count, error: countErr } = await client
    .from('holes')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', courseId)
  if (countErr) throw countErr
  const { error } = await client.from('holes').delete().eq('course_id', courseId)
  if (error) throw error
  return count ?? 0
}

export async function upsertMatchedHoles(
  client: OgaSupabaseClient,
  courseId: string,
  holes: MatchedHole[],
): Promise<void> {
  const rows = holes.map((h) => ({
    course_id: courseId,
    number: h.ref,
    par: h.par,
    yards: h.yards,
    tee_lat: h.tee.lat,
    tee_lng: h.tee.lon,
    pin_lat: h.pin.lat,
    pin_lng: h.pin.lon,
  }))
  const { error } = await client.from('holes').upsert(rows, { onConflict: 'course_id,number' })
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export interface OsmImportArgs {
  name: string
  lat: number
  lng: number
  radius: number
  updateExisting: boolean
  courseFilter?: string
}

export interface OsmImportSummary {
  courseId: string
  created: boolean
  holesImported: number
  refsFound: number[]
  missingRefs: number[]
  greenMatches: number
  teeMatches: number
  missingGreenRefs: number[]
  missingTeeRefs: number[]
  missingParRefs: number[]
  missingYardsRefs: number[]
  dedupedRefs: number[]
  wipedHoles: number
}

export async function runOsmImport(
  client: OgaSupabaseClient,
  args: OsmImportArgs,
): Promise<OsmImportSummary> {
  const resp = await fetchOverpass(args)
  const parsed = parseElements(resp, args.courseFilter)
  const { matched, dedupedRefs } = matchHoles(parsed, { lat: args.lat, lon: args.lng })
  if (matched.length === 0) {
    throw new Error('No hole ways found. Check the lat/lng/radius — Overpass returned 0 holes.')
  }

  // Course centroid = mean of all matched tee + pin coordinates. More
  // robust than the query center the caller passed (which is often the
  // clubhouse, not the course).
  const courseCentroid = centroid(matched.flatMap((h) => [h.tee, h.pin]))
  const { id, created } = await upsertCourse(client, args.name, courseCentroid, args.updateExisting)

  // updateExisting wipes the existing holes before inserting fresh ones, so
  // a hole that's been removed from OSM upstream doesn't linger in the DB.
  // Default flow (upsert-only) keeps any holes not present in the new
  // import — desirable for a partial re-import, but a footgun when the goal
  // is "reset this course's layout".
  let wipedHoles = 0
  if (args.updateExisting && !created) {
    wipedHoles = await deleteHolesForCourse(client, id)
  }
  await upsertMatchedHoles(client, id, matched)

  const refs = matched.map((h) => h.ref).sort((a, b) => a - b)
  const missingRefs: number[] = []
  for (let n = 1; n <= 18; n++) {
    if (!refs.includes(n)) missingRefs.push(n)
  }

  return {
    courseId: id,
    created,
    holesImported: matched.length,
    refsFound: refs,
    missingRefs,
    greenMatches: matched.filter((h) => h.hasGreenMatch).length,
    teeMatches: matched.filter((h) => h.hasTeeMatch).length,
    missingGreenRefs: matched.filter((h) => !h.hasGreenMatch).map((h) => h.ref),
    missingTeeRefs: matched.filter((h) => !h.hasTeeMatch).map((h) => h.ref),
    missingParRefs: matched.filter((h) => !h.par || h.par < 3 || h.par > 6).map((h) => h.ref),
    missingYardsRefs: matched.filter((h) => !h.yards).map((h) => h.ref),
    dedupedRefs,
    wipedHoles,
  }
}
