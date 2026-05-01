/**
 * Course database crawler. Populates courses + holes + course_tees from
 * OpenGolfAPI (community-maintained golf course DB) and from OSM Overpass
 * (golf course centroids).
 *
 * Resumable, idempotent. Tracks per-state progress in the crawl_state
 * table. Default behavior skips courses whose external_id already exists;
 * --force re-imports and updates them.
 *
 * Env (read from .env at repo root):
 *   SUPABASE_URL                  local or production Supabase
 *   SUPABASE_SERVICE_ROLE_KEY     admin key (bypasses RLS)
 *
 * CLI:
 *   tsx scripts/crawl-courses.ts --source opengolfapi
 *   tsx scripts/crawl-courses.ts --source opengolfapi --states TX,OK,CA
 *   tsx scripts/crawl-courses.ts --source osm --states OK
 *   tsx scripts/crawl-courses.ts --source opengolfapi --force
 *   tsx scripts/crawl-courses.ts --status
 *
 * OpenGolfAPI: ~1 req/sec (900/day soft cap). A full US crawl is ~5 hours.
 * OSM Overpass: ~1 req per 2 sec, single state-bbox query per state.
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Env / client
// ---------------------------------------------------------------------------

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required')
  process.exit(1)
}

const supabase = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const OPENGOLFAPI_BASE = 'https://api.opengolfapi.org/v1'
const OPENGOLFAPI_DELAY_MS = 1100 // ~1 req/sec with buffer
const OSM_DELAY_MS = 2100

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

// ---------------------------------------------------------------------------
// USPS state codes + approximate bounding boxes
// ---------------------------------------------------------------------------

const ALL_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
] as const

// [south, west, north, east] in degrees. Approximate state bounding boxes
// for OSM Overpass queries. Alaska + Hawaii skipped (no contiguous bbox /
// non-meaningful golf coverage). Add states here as needed.
const STATE_BBOX: Record<string, [number, number, number, number]> = {
  AL: [30.14, -88.47, 35.01, -84.89],
  AZ: [31.33, -114.82, 37.00, -109.04],
  AR: [33.00, -94.62, 36.50, -89.64],
  CA: [32.53, -124.41, 42.01, -114.13],
  CO: [36.99, -109.06, 41.00, -102.04],
  CT: [40.98, -73.73, 42.05, -71.79],
  DE: [38.45, -75.79, 39.84, -75.05],
  FL: [24.52, -87.63, 31.00, -80.03],
  GA: [30.36, -85.61, 35.00, -80.84],
  ID: [42.00, -117.24, 49.00, -111.04],
  IL: [36.97, -91.51, 42.51, -87.02],
  IN: [37.77, -88.10, 41.76, -84.78],
  IA: [40.38, -96.64, 43.50, -90.14],
  KS: [36.99, -102.05, 40.00, -94.59],
  KY: [36.50, -89.57, 39.15, -81.96],
  LA: [28.93, -94.04, 33.02, -88.82],
  ME: [43.06, -71.08, 47.46, -66.95],
  MD: [37.91, -79.49, 39.72, -75.05],
  MA: [41.24, -73.51, 42.89, -69.93],
  MI: [41.70, -90.42, 48.31, -82.41],
  MN: [43.50, -97.24, 49.38, -89.49],
  MS: [30.17, -91.66, 35.01, -88.10],
  MO: [35.99, -95.77, 40.61, -89.10],
  MT: [44.36, -116.05, 49.00, -104.04],
  NE: [40.00, -104.05, 43.00, -95.31],
  NV: [35.00, -120.01, 42.00, -114.04],
  NH: [42.70, -72.56, 45.31, -70.56],
  NJ: [38.93, -75.56, 41.36, -73.89],
  NM: [31.33, -109.05, 37.00, -103.00],
  NY: [40.50, -79.76, 45.02, -71.86],
  NC: [33.84, -84.32, 36.59, -75.46],
  ND: [45.94, -104.05, 49.00, -96.55],
  OH: [38.40, -84.82, 42.00, -80.52],
  OK: [33.62, -103.00, 37.00, -94.43],
  OR: [42.00, -124.57, 46.30, -116.46],
  PA: [39.72, -80.52, 42.27, -74.69],
  RI: [41.15, -71.91, 42.02, -71.12],
  SC: [32.03, -83.35, 35.22, -78.54],
  SD: [42.48, -104.06, 45.95, -96.44],
  TN: [34.98, -90.31, 36.68, -81.65],
  TX: [25.84, -106.65, 36.50, -93.51],
  UT: [37.00, -114.05, 42.00, -109.04],
  VT: [42.73, -73.44, 45.02, -71.46],
  VA: [36.54, -83.68, 39.47, -75.24],
  WA: [45.54, -124.85, 49.00, -116.92],
  WV: [37.20, -82.65, 40.64, -77.72],
  WI: [42.49, -92.89, 47.08, -86.25],
  WY: [40.99, -111.06, 45.01, -104.05],
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OgaListItem {
  id: string
  name: string
  city?: string
  state?: string
}

interface OgaTee {
  color: string
  name?: string
  rating?: number
  slope?: number
  totalYards?: number
  par?: number
}

interface OgaHole {
  number: number
  par: number
  yards?: number
}

interface OgaCourseDetail {
  id: string
  name: string
  city?: string
  state?: string
  holes: OgaHole[]
  tees: OgaTee[]
}

interface RawHole {
  number?: number
  hole?: number
  hole_number?: number
  par?: number | string
  yards?: number | string
  distance?: number | string
  yardage?: number | string
}

interface RawTee {
  color?: string
  name?: string
  tee_color?: string
  tee_name?: string
  rating?: number | string
  course_rating?: number | string
  slope?: number | string
  slope_rating?: number | string
  yards?: number | string
  total_yards?: number | string
  total_yardage?: number | string
  par?: number | string
}

interface RawCourse {
  id?: string | number
  course_id?: string | number
  name?: string
  course_name?: string
  city?: string
  state?: string
  region?: string
  par?: number | string
  total_par?: number | string
  holes?: RawHole[]
  scorecard?: RawHole[]
  tees?: RawTee[]
}

interface OsmCourseLite {
  wayId: number
  name: string
  lat: number
  lng: number
  state: string
}

type CrawlStatus = 'pending' | 'in_progress' | 'done' | 'error'

interface Args {
  source: 'opengolfapi' | 'osm' | null
  states: string[] | null // null = default (all for OpenGolfAPI / all w/ bbox for OSM)
  force: boolean
  status: boolean
  limit: number | null // optional cap on courses per state (for testing)
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): Args {
  let source: Args['source'] = null
  let states: string[] | null = null
  let force = false
  let status = false
  let limit: number | null = null
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = argv[i + 1]
    if (a === '--source' && next) {
      if (next !== 'opengolfapi' && next !== 'osm') {
        throw new Error(`--source must be opengolfapi or osm (got: ${next})`)
      }
      source = next
      i++
    } else if (a === '--states' && next) {
      states = next
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter((s) => s.length === 2)
      i++
    } else if (a === '--force') {
      force = true
    } else if (a === '--status') {
      status = true
    } else if (a === '--limit' && next) {
      const n = parseInt(next, 10)
      if (!Number.isFinite(n) || n <= 0) throw new Error('--limit must be > 0')
      limit = n
      i++
    }
  }
  return { source, states, force, status, limit }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function asInt(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v)
  if (typeof v === 'string') {
    const n = parseInt(v, 10)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = parseFloat(v)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

// ---------------------------------------------------------------------------
// OpenGolfAPI fetch + normalize
// ---------------------------------------------------------------------------

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${url}`)
  }
  return res.json()
}

function pickArray(payload: unknown): RawCourse[] {
  if (Array.isArray(payload)) return payload as RawCourse[]
  if (payload && typeof payload === 'object') {
    const obj = payload as { results?: unknown; data?: unknown; courses?: unknown }
    if (Array.isArray(obj.results)) return obj.results as RawCourse[]
    if (Array.isArray(obj.data)) return obj.data as RawCourse[]
    if (Array.isArray(obj.courses)) return obj.courses as RawCourse[]
  }
  return []
}

function normalizeListItem(raw: RawCourse): OgaListItem | null {
  const id = String(raw.id ?? raw.course_id ?? '')
  if (!id) return null
  const name = (raw.name ?? raw.course_name ?? '').trim()
  if (!name) return null
  return {
    id,
    name,
    city: raw.city ?? undefined,
    state: raw.state ?? raw.region ?? undefined,
  }
}

async function fetchStateCourseList(state: string): Promise<OgaListItem[]> {
  const payload = await fetchJson(
    `${OPENGOLFAPI_BASE}/courses/state/${encodeURIComponent(state)}`,
  )
  const raws = pickArray(payload)
  const out: OgaListItem[] = []
  for (const raw of raws) {
    const item = normalizeListItem(raw)
    if (item) out.push(item)
  }
  return out
}

function pickHoles(raw: RawCourse): RawHole[] {
  if (Array.isArray(raw.holes) && raw.holes.length) return raw.holes
  if (Array.isArray(raw.scorecard) && raw.scorecard.length) return raw.scorecard
  return []
}

function normalizeTees(raws: RawTee[] | undefined): OgaTee[] {
  if (!Array.isArray(raws)) return []
  const out: OgaTee[] = []
  for (const t of raws) {
    const color = (t.color ?? t.tee_color ?? t.name ?? t.tee_name ?? '').trim()
    if (!color) continue
    const tee: OgaTee = { color: color.toLowerCase() }
    const name = t.name ?? t.tee_name
    if (typeof name === 'string' && name.trim()) tee.name = name.trim()
    const rating = asNumber(t.rating ?? t.course_rating)
    if (rating != null) tee.rating = rating
    const slope = asInt(t.slope ?? t.slope_rating)
    if (slope != null) tee.slope = slope
    const yards = asInt(t.yards ?? t.total_yards ?? t.total_yardage)
    if (yards != null) tee.totalYards = yards
    const par = asInt(t.par)
    if (par != null) tee.par = par
    out.push(tee)
  }
  // Dedupe by color — first occurrence wins.
  const seen = new Set<string>()
  return out.filter((t) => (seen.has(t.color) ? false : (seen.add(t.color), true)))
}

function normalizeDetail(raw: RawCourse): OgaCourseDetail | null {
  const id = String(raw.id ?? raw.course_id ?? '')
  if (!id) return null
  const name = (raw.name ?? raw.course_name ?? '').trim() || '(unnamed course)'
  const holesRaw = pickHoles(raw)
  const holes: OgaHole[] = []
  for (const h of holesRaw) {
    const number = asInt(h.number ?? h.hole ?? h.hole_number)
    const par = asInt(h.par)
    if (number == null || par == null) continue
    if (number < 1 || number > 18) continue
    if (par < 3 || par > 6) continue
    const yards = asInt(h.yards ?? h.distance ?? h.yardage)
    holes.push(yards != null ? { number, par, yards } : { number, par })
  }
  holes.sort((a, b) => a.number - b.number)
  return {
    id,
    name,
    city: raw.city ?? undefined,
    state: raw.state ?? raw.region ?? undefined,
    holes,
    tees: normalizeTees(raw.tees),
  }
}

async function fetchOgaCourseDetail(id: string): Promise<OgaCourseDetail | null> {
  const payload = await fetchJson(
    `${OPENGOLFAPI_BASE}/courses/${encodeURIComponent(id)}`,
  )
  // Detail endpoint may return the course object directly or wrapped under
  // { course } / { data }.
  let raw: RawCourse | null = null
  if (Array.isArray(payload)) {
    raw = (payload[0] ?? null) as RawCourse | null
  } else if (payload && typeof payload === 'object') {
    const obj = payload as { course?: unknown; data?: unknown }
    if (obj.course && typeof obj.course === 'object') {
      raw = obj.course as RawCourse
    } else if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
      raw = obj.data as RawCourse
    } else {
      raw = payload as RawCourse
    }
  }
  if (!raw) return null
  return normalizeDetail(raw)
}

// ---------------------------------------------------------------------------
// OSM Overpass — state-level course discovery (centroid only)
// ---------------------------------------------------------------------------

interface OverpassNode {
  type: 'node'
  id: number
  lat: number
  lon: number
  tags?: Record<string, string>
}
interface OverpassWay {
  type: 'way'
  id: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}
interface OverpassResponse {
  elements: Array<OverpassNode | OverpassWay>
}

async function fetchOsmCoursesInState(state: string): Promise<OsmCourseLite[]> {
  const bbox = STATE_BBOX[state]
  if (!bbox) {
    throw new Error(
      `OSM bbox not configured for state "${state}". Add an entry to STATE_BBOX in scripts/crawl-courses.ts.`,
    )
  }
  const [s, w, n, e] = bbox
  const q = `
[out:json][timeout:90];
(
  way["leisure"="golf_course"](${s},${w},${n},${e});
  relation["leisure"="golf_course"](${s},${w},${n},${e});
);
out center tags;
`.trim()

  let lastErr: Error | null = null
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'oga-course-crawler/0.1 (https://github.com/cner-smith/opengolfapp)',
        },
        body: 'data=' + encodeURIComponent(q),
      })
      if (!res.ok) {
        lastErr = new Error(`${endpoint} ${res.status}`)
        continue
      }
      const data = (await res.json()) as OverpassResponse
      const out: OsmCourseLite[] = []
      for (const el of data.elements) {
        const tags = el.tags ?? {}
        const name = tags['name']
        if (!name) continue
        let lat: number | undefined
        let lng: number | undefined
        if (el.type === 'way' && el.center) {
          lat = el.center.lat
          lng = el.center.lon
        } else if (el.type === 'node') {
          lat = el.lat
          lng = el.lon
        }
        if (lat == null || lng == null) continue
        out.push({ wayId: el.id, name, lat, lng, state })
      }
      return out
    } catch (err) {
      lastErr = err as Error
    }
    await sleep(500)
  }
  throw lastErr ?? new Error('Overpass request failed')
}

// ---------------------------------------------------------------------------
// DB upserts
// ---------------------------------------------------------------------------

async function findCourseByExternalId(externalId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('courses')
    .select('id')
    .eq('external_id', externalId)
    .maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

async function insertOrUpdateCourse(args: {
  externalId: string
  name: string
  location: string | null
  force: boolean
}): Promise<{ id: string; isNew: boolean; skipped: boolean }> {
  const existing = await findCourseByExternalId(args.externalId)
  if (existing && !args.force) {
    return { id: existing, isNew: false, skipped: true }
  }
  if (existing) {
    const { error } = await supabase
      .from('courses')
      .update({ name: args.name, location: args.location })
      .eq('id', existing)
    if (error) throw error
    return { id: existing, isNew: false, skipped: false }
  }
  const { data, error } = await supabase
    .from('courses')
    .insert({
      name: args.name,
      location: args.location,
      external_id: args.externalId,
    })
    .select('id')
    .single()
  if (error || !data) throw error ?? new Error('course insert failed')
  return { id: data.id, isNew: true, skipped: false }
}

async function upsertHoles(courseId: string, holes: OgaHole[]): Promise<void> {
  if (holes.length === 0) return
  const rows = holes.map((h) => ({
    course_id: courseId,
    number: h.number,
    par: h.par,
    yards: h.yards ?? null,
  }))
  const { error } = await supabase
    .from('holes')
    .upsert(rows, { onConflict: 'course_id,number' })
  if (error) throw error
}

async function upsertTees(courseId: string, tees: OgaTee[]): Promise<void> {
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

// ---------------------------------------------------------------------------
// Crawl state
// ---------------------------------------------------------------------------

interface CrawlStateRow {
  id: string
  status: CrawlStatus
  items_processed: number
  last_crawled_at: string | null
  error_message: string | null
}

async function getCrawlState(id: string): Promise<CrawlStateRow | null> {
  const { data, error } = await supabase
    .from('crawl_state')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as CrawlStateRow | null) ?? null
}

async function setCrawlState(
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
  const { error } = await supabase
    .from('crawl_state')
    .upsert(row, { onConflict: 'id' })
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Crawl drivers
// ---------------------------------------------------------------------------

async function crawlOpenGolfApi(
  states: string[],
  force: boolean,
  limit: number | null,
): Promise<void> {
  let totalImported = 0
  let totalSkipped = 0
  let totalErrors = 0
  for (const state of states) {
    const crawlId = `opengolfapi:state:${state}`
    const prev = await getCrawlState(crawlId)
    if (prev?.status === 'done' && !force) {
      console.log(
        `[${state}] skip — already done (${prev.items_processed} courses, last ${prev.last_crawled_at})`,
      )
      continue
    }
    await setCrawlState(crawlId, { status: 'in_progress', errorMessage: null })

    let stateCount = 0
    let stateErrors = 0
    try {
      console.log(`[${state}] fetching course list…`)
      const list = await fetchStateCourseList(state)
      const targets = limit != null ? list.slice(0, limit) : list
      console.log(`[${state}] ${targets.length} courses to process`)
      await sleep(OPENGOLFAPI_DELAY_MS)

      for (let i = 0; i < targets.length; i++) {
        const item = targets[i]
        if (!item) continue
        const externalId = `opengolfapi_${item.id}`
        // Fast-path skip without spending an API call.
        if (!force) {
          const existing = await findCourseByExternalId(externalId)
          if (existing) {
            stateCount++
            totalSkipped++
            if (i % 100 === 0) {
              console.log(
                `[${state}] ${i + 1}/${targets.length} (skipped existing: ${item.name})`,
              )
            }
            continue
          }
        }
        try {
          const detail = await fetchOgaCourseDetail(item.id)
          if (!detail) {
            console.warn(`[${state}] ${item.id} (${item.name}): empty detail`)
            stateErrors++
            totalErrors++
            await sleep(OPENGOLFAPI_DELAY_MS)
            continue
          }
          const location = [detail.city ?? item.city, detail.state ?? item.state ?? state]
            .filter((s) => !!s && s.length > 0)
            .join(', ')
          const upsert = await insertOrUpdateCourse({
            externalId,
            name: detail.name,
            location: location || null,
            force,
          })
          if (!upsert.skipped) {
            await upsertHoles(upsert.id, detail.holes)
            await upsertTees(upsert.id, detail.tees)
            totalImported++
          } else {
            totalSkipped++
          }
          stateCount++

          if ((i + 1) % 100 === 0 || i === targets.length - 1) {
            console.log(
              `[${state}] ${i + 1}/${targets.length} — last: ${detail.name}`,
            )
            await setCrawlState(crawlId, { itemsProcessed: stateCount })
          }
        } catch (err) {
          stateErrors++
          totalErrors++
          console.warn(
            `[${state}] ${item.id} (${item.name}): ${(err as Error).message}`,
          )
        }
        await sleep(OPENGOLFAPI_DELAY_MS)
      }

      await setCrawlState(crawlId, {
        status: 'done',
        itemsProcessed: stateCount,
        errorMessage: null,
      })
      console.log(
        `[${state}] done — ${stateCount} processed, ${stateErrors} errors`,
      )
    } catch (err) {
      console.error(`[${state}] fatal: ${(err as Error).message}`)
      await setCrawlState(crawlId, {
        status: 'error',
        itemsProcessed: stateCount,
        errorMessage: (err as Error).message,
      })
    }
  }
  console.log(
    `\nCrawl complete: ${totalImported} imported, ${totalSkipped} skipped, ${totalErrors} errors`,
  )
}

async function crawlOsm(
  states: string[],
  force: boolean,
  limit: number | null,
): Promise<void> {
  let totalImported = 0
  let totalSkipped = 0
  let totalErrors = 0
  for (const state of states) {
    const crawlId = `osm:state:${state}`
    const prev = await getCrawlState(crawlId)
    if (prev?.status === 'done' && !force) {
      console.log(
        `[osm:${state}] skip — already done (${prev.items_processed} courses)`,
      )
      continue
    }
    await setCrawlState(crawlId, { status: 'in_progress', errorMessage: null })

    let stateCount = 0
    let stateErrors = 0
    try {
      console.log(`[osm:${state}] querying Overpass…`)
      const courses = await fetchOsmCoursesInState(state)
      const targets = limit != null ? courses.slice(0, limit) : courses
      console.log(`[osm:${state}] ${targets.length} courses found`)

      for (let i = 0; i < targets.length; i++) {
        const c = targets[i]
        if (!c) continue
        const externalId = `osm_way_${c.wayId}`
        try {
          const upsert = await insertOrUpdateCourse({
            externalId,
            name: c.name,
            location: c.state,
            force,
          })
          if (upsert.skipped) totalSkipped++
          else totalImported++
          stateCount++
          if ((i + 1) % 100 === 0 || i === targets.length - 1) {
            console.log(`[osm:${state}] ${i + 1}/${targets.length} — last: ${c.name}`)
            await setCrawlState(crawlId, { itemsProcessed: stateCount })
          }
        } catch (err) {
          stateErrors++
          totalErrors++
          console.warn(
            `[osm:${state}] way ${c.wayId} (${c.name}): ${(err as Error).message}`,
          )
        }
      }

      await setCrawlState(crawlId, {
        status: 'done',
        itemsProcessed: stateCount,
        errorMessage: null,
      })
      console.log(
        `[osm:${state}] done — ${stateCount} processed, ${stateErrors} errors`,
      )
    } catch (err) {
      console.error(`[osm:${state}] fatal: ${(err as Error).message}`)
      await setCrawlState(crawlId, {
        status: 'error',
        itemsProcessed: stateCount,
        errorMessage: (err as Error).message,
      })
    }
    // Always wait between states regardless of success — Overpass is shared
    // infrastructure and rate-limit-sensitive.
    await sleep(OSM_DELAY_MS)
  }
  console.log(
    `\nOSM crawl complete: ${totalImported} imported, ${totalSkipped} skipped, ${totalErrors} errors`,
  )
}

// ---------------------------------------------------------------------------
// Status display
// ---------------------------------------------------------------------------

async function showStatus(): Promise<void> {
  const { data, error } = await supabase
    .from('crawl_state')
    .select('id, status, items_processed, last_crawled_at, error_message')
    .order('id')
  if (error) throw error
  const rows = (data ?? []) as CrawlStateRow[]
  if (rows.length === 0) {
    console.log('No crawl state recorded yet.')
    return
  }
  let totalProcessed = 0
  for (const r of rows) {
    const last = r.last_crawled_at
      ? new Date(r.last_crawled_at).toISOString().slice(0, 19).replace('T', ' ')
      : '—'
    const err = r.error_message ? ` ! ${r.error_message}` : ''
    console.log(
      `${r.id.padEnd(28)}  ${r.status.padEnd(12)}  ${String(r.items_processed).padStart(6)}  ${last}${err}`,
    )
    totalProcessed += r.items_processed
  }
  const { count: courseCount, error: countErr } = await supabase
    .from('courses')
    .select('id', { count: 'exact', head: true })
  if (countErr) throw countErr
  console.log(
    `\nTotal recorded items processed: ${totalProcessed}. Courses table: ${courseCount ?? 0} rows.`,
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (args.status) {
    await showStatus()
    return
  }
  if (!args.source) {
    console.error(
      'Missing --source. Usage:\n' +
        '  tsx scripts/crawl-courses.ts --source opengolfapi [--states TX,OK] [--force] [--limit N]\n' +
        '  tsx scripts/crawl-courses.ts --source osm --states OK [--force]\n' +
        '  tsx scripts/crawl-courses.ts --status',
    )
    process.exit(1)
  }

  if (args.source === 'opengolfapi') {
    const states = args.states ?? [...ALL_STATES]
    console.log(
      `OpenGolfAPI crawl: ${states.length} state(s)${args.force ? ' (force)' : ''}`,
    )
    await crawlOpenGolfApi(states, args.force, args.limit)
  } else {
    const configured = Object.keys(STATE_BBOX)
    const states = args.states ?? configured
    const unsupported = states.filter((s) => !STATE_BBOX[s])
    if (unsupported.length) {
      throw new Error(
        `OSM bbox not configured for: ${unsupported.join(', ')}. Add to STATE_BBOX.`,
      )
    }
    console.log(`OSM crawl: ${states.length} state(s)${args.force ? ' (force)' : ''}`)
    await crawlOsm(states, args.force, args.limit)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
