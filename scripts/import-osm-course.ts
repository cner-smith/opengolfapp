/**
 * Import a golf course from OpenStreetMap into Supabase.
 *
 * Usage:
 *   tsx scripts/import-osm-course.ts --name "Lake Hefner North" \
 *     --lat 35.558 --lng -97.565 --radius 1500
 *
 * Queries Overpass for golf=hole|green|tee within a circle, parses
 * the way + node geometry, and upserts a course + 18 holes with
 * tee_lat/lng + pin_lat/lng. Re-running is safe: the course is
 * matched by name and holes are upserted on (course_id, number).
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (read from .env via
 * dotenv/config or the shell).
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required')
  process.exit(1)
}

const supabase = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

interface Args {
  name: string
  lat: number
  lng: number
  radius: number
}

function parseArgs(argv: string[]): Args {
  let name: string | undefined
  let lat: number | undefined
  let lng: number | undefined
  let radius: number | undefined
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = argv[i + 1]
    if (a === '--name' && next != null) {
      name = next
      i++
    } else if (a === '--lat' && next != null) {
      lat = Number(next)
      i++
    } else if (a === '--lng' && next != null) {
      lng = Number(next)
      i++
    } else if (a === '--radius' && next != null) {
      radius = Number(next)
      i++
    }
  }
  if (!name || lat == null || lng == null || radius == null) {
    throw new Error(
      'Usage: tsx scripts/import-osm-course.ts --name "<Course Name>" --lat <lat> --lng <lng> --radius <meters>',
    )
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius)) {
    throw new Error('--lat, --lng, --radius must be numeric')
  }
  return { name, lat, lng, radius }
}

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

async function fetchOverpass(args: Args): Promise<OverpassResponse> {
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

function centroid(nodes: LatLon[]): LatLon {
  const lat = nodes.reduce((s, n) => s + n.lat, 0) / nodes.length
  const lon = nodes.reduce((s, n) => s + n.lon, 0) / nodes.length
  return { lat, lon }
}

function haversineMeters(a: LatLon, b: LatLon): number {
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

function metersToYards(m: number): number {
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

function parseElements(resp: OverpassResponse): {
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

function matchHoles(
  parsed: ReturnType<typeof parseElements>,
  queryCenter: LatLon,
): MatchedHole[] {
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
  if (dropped.length > 0) {
    const uniq = [...new Set(dropped)].sort((a, b) => a - b)
    console.log(
      `  Dedup: ${parsed.holes.length} hole ways → ${byRef.size} unique refs (duplicates on ${uniq.join(', ')})`,
    )
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
  return out
}

// ---------------------------------------------------------------------------
// Supabase upsert
// ---------------------------------------------------------------------------

async function upsertCourse(name: string): Promise<{ id: string; created: boolean }> {
  const { data: existing, error: lookupErr } = await supabase
    .from('courses')
    .select('id')
    .eq('name', name)
    .maybeSingle()
  if (lookupErr) throw lookupErr
  if (existing) return { id: existing.id, created: false }

  const { data, error } = await supabase
    .from('courses')
    .insert({ name, mapbox_id: null })
    .select('id')
    .single()
  if (error || !data) throw error ?? new Error('course insert failed')
  return { id: data.id, created: true }
}

async function upsertHoles(courseId: string, holes: MatchedHole[]): Promise<void> {
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
  const { error } = await supabase
    .from('holes')
    .upsert(rows, { onConflict: 'course_id,number' })
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2))
  console.log(
    `Querying Overpass for "${args.name}" around ${args.lat},${args.lng} (r=${args.radius}m)…`,
  )
  const resp = await fetchOverpass(args)
  const parsed = parseElements(resp)
  console.log(
    `OSM: ${parsed.holes.length} hole ways, ${parsed.greens.length} green polygons, ${parsed.tees.length} tee polygons`,
  )
  const matched = matchHoles(parsed, { lat: args.lat, lon: args.lng })
  if (matched.length === 0) {
    throw new Error(
      'No hole ways found. Check the lat/lng/radius — Overpass returned 0 holes.',
    )
  }

  const { id, created } = await upsertCourse(args.name)
  await upsertHoles(id, matched)

  const greenHits = matched.filter((h) => h.hasGreenMatch).length
  const teeHits = matched.filter((h) => h.hasTeeMatch).length
  const missingGreen = matched
    .filter((h) => !h.hasGreenMatch)
    .map((h) => h.ref)
  const missingTee = matched.filter((h) => !h.hasTeeMatch).map((h) => h.ref)

  const refs = matched.map((h) => h.ref).sort((a, b) => a - b)
  const missingRefs: number[] = []
  for (let n = 1; n <= 18; n++) {
    if (!refs.includes(n)) missingRefs.push(n)
  }

  console.log(`${created ? '✓ Created course' : '✓ Updated course'}: ${args.name}`)
  console.log(
    `✓ Imported ${matched.length} holes (${greenHits} with green coords, ${teeHits} with tee coords)`,
  )
  console.log(`  Refs found: ${refs.join(', ')}`)
  if (missingRefs.length) {
    console.log(`  Refs missing from 1-18: ${missingRefs.join(', ')}`)
  }
  if (missingGreen.length) {
    console.log(
      `  Holes falling back to hole-way endpoint for pin: ${missingGreen.join(', ')}`,
    )
  }
  if (missingTee.length) {
    console.log(
      `  Holes falling back to hole-way endpoint for tee: ${missingTee.join(', ')}`,
    )
  }
  const missingPar = matched.filter((h) => !h.par || h.par < 3 || h.par > 6)
  if (missingPar.length) {
    console.log(
      `  Holes with no/invalid par (defaulted to 4): ${missingPar
        .map((h) => h.ref)
        .join(', ')}`,
    )
  }
  const missingYards = matched.filter((h) => !h.yards)
  if (missingYards.length) {
    console.log(
      `  Holes with no yardage (left null): ${missingYards
        .map((h) => h.ref)
        .join(', ')}`,
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
