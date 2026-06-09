// Backfill course_tees.course_rating / slope_rating from GolfCourseAPI.
//
// Our crawler fills courses/holes from OSM but OSM carries no course rating
// or slope, so the WHS handicap engine is dormant (0 rated courses in prod).
// GolfCourseAPI's TeeBox schema DOES expose per-tee course_rating +
// slope_rating (verified against its OpenAPI spec), so this script matches
// our existing `courses` to GolfCourseAPI courses by name + location and
// upserts the rated tees into `course_tees`.
//
// SAFETY: dry-run by default. It prints + logs every proposed match to a
// JSONL audit file and writes NOTHING until you pass --write. A wrong match
// would stamp a wrong rating onto a course (→ wrong handicaps for everyone
// who plays it), so matching is deliberately conservative: a high
// name-similarity AND location agreement (same state, or within --max-km).
// Review the audit log, then re-run with --write.
//
// Usage:
//   GOLFCOURSEAPI_KEY=... pnpm tsx scripts/backfill-ratings.ts            # dry run, 200 courses
//   GOLFCOURSEAPI_KEY=... pnpm tsx scripts/backfill-ratings.ts --write --limit 5000
//   flags: --write  --limit N  --delay-ms N  --threshold 0.0-1  --max-km N
//          --has-state (only courses with a state set — likelier US/rated)
//          --out path.jsonl
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (via scripts/crawl/client),
//      GOLFCOURSEAPI_KEY.

import 'dotenv/config'
import { appendFileSync } from 'node:fs'
import { supabase } from './crawl/client'

const API_BASE = 'https://api.golfcourseapi.com/v1'
const API_KEY = process.env.GOLFCOURSEAPI_KEY
if (!API_KEY) {
  console.error('GOLFCOURSEAPI_KEY is required')
  process.exit(1)
}

// ---- flags -----------------------------------------------------------------
const argv = process.argv.slice(2)
function flag(name: string): boolean {
  return argv.includes(`--${name}`)
}
function opt(name: string, fallback: string): string {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : fallback
}
const WRITE = flag('write')
const LIMIT = parseInt(opt('limit', '200'), 10)
const DELAY_MS = parseInt(opt('delay-ms', '250'), 10)
const THRESHOLD = parseFloat(opt('threshold', '0.78'))
const MAX_KM = parseFloat(opt('max-km', '25'))
const HAS_STATE = flag('has-state')
const OUT = opt('out', 'backfill-ratings-matches.jsonl')

// ---- GolfCourseAPI shapes (subset of its OpenAPI TeeBox / Course) ----------
interface TeeBox {
  tee_name?: string | null
  course_rating?: number | null
  slope_rating?: number | null
  total_yards?: number | null
  par_total?: number | null
}
interface ApiCourse {
  id: number
  club_name?: string | null
  course_name?: string | null
  location?: {
    city?: string | null
    state?: string | null
    country?: string | null
    latitude?: number | null
    longitude?: number | null
  } | null
  tees?: { male?: TeeBox[] | null; female?: TeeBox[] | null } | null
}

interface CourseRow {
  id: string
  name: string
  city: string | null
  state: string | null
  lat: number | null
  lng: number | null
}

// ---- name matching (mirrors scripts/crawl/enricher.ts; kept local so the
//      backfill doesn't pull the whole crawl pipeline's module graph) -------
function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(
      /\b(golf and country club|golf country club|country club|golf club|golf course|golf links|the golf club|golf|gc|cc)\b/g,
      ' ',
    )
    .replace(/\bat\b/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  let curr = new Array<number>(n + 1).fill(0)
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1
      curr[j] = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[n]!
}
function nameSimilarity(a: string, b: string): number {
  const na = normalizeForMatch(a)
  const nb = normalizeForMatch(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  const maxLen = Math.max(na.length, nb.length)
  return maxLen === 0 ? 0 : 1 - levenshtein(na, nb) / maxLen
}
function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ---- GolfCourseAPI search (resilient: retry 429/5xx, abort on 401) ---------
async function searchApi(name: string): Promise<ApiCourse[]> {
  const url = `${API_BASE}/search?search_query=${encodeURIComponent(name)}`
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response
    try {
      res = await fetch(url, { headers: { Authorization: `Key ${API_KEY}` } })
    } catch {
      await sleep(1000 * (attempt + 1))
      continue
    }
    if (res.status === 401) {
      console.error('GolfCourseAPI returned 401 — bad/expired key. Aborting.')
      process.exit(1)
    }
    if (res.status === 429) {
      console.warn('  rate-limited (429) — backing off 60s')
      await sleep(60_000)
      continue
    }
    if (res.status === 404) return []
    if (!res.ok) {
      await sleep(1000 * (attempt + 1))
      continue
    }
    const body = (await res.json().catch(() => null)) as { courses?: ApiCourse[] } | null
    return body?.courses ?? []
  }
  return []
}

// ---- match scoring ---------------------------------------------------------
interface Match {
  api: ApiCourse
  score: number
  km: number | null
}
function bestMatch(ours: CourseRow, candidates: ApiCourse[]): Match | null {
  let best: Match | null = null
  for (const c of candidates) {
    const nameScore = Math.max(
      nameSimilarity(ours.name, c.course_name ?? ''),
      nameSimilarity(ours.name, c.club_name ?? ''),
    )
    if (nameScore < THRESHOLD) continue

    // Location agreement gate. Coordinates are authoritative: when both
    // sides have coords, require them within MAX_KM and ignore state — two
    // same-named courses in the same state can be 280km apart (caught in
    // dry-run: Bayou Bend Bastrop vs Crowley, LA). Only when coords are
    // missing do we fall back to a same-state requirement. Name alone is
    // never enough — too risky for handicap data.
    let km: number | null = null
    if (
      ours.lat != null &&
      ours.lng != null &&
      c.location?.latitude != null &&
      c.location?.longitude != null
    ) {
      km = haversineKm(ours.lat, ours.lng, c.location.latitude, c.location.longitude)
    }
    if (km != null) {
      if (km > MAX_KM) continue
    } else {
      const sameState =
        !!ours.state &&
        !!c.location?.state &&
        ours.state.toUpperCase() === c.location.state.toUpperCase()
      if (!sameState) continue
    }

    if (!best || nameScore > best.score) best = { api: c, score: nameScore, km }
  }
  return best
}

// ---- tee extraction: merge male + female, only rated, prefer men's on a
//      tee_color collision (course_tees has no gender column) ---------------
interface TeeRow {
  course_id: string
  tee_color: string
  tee_name: string | null
  course_rating: number
  slope_rating: number
  total_yards: number | null
  par: number | null
}
function ratedTeeRows(courseId: string, api: ApiCourse): TeeRow[] {
  const byColor = new Map<string, TeeRow>()
  const add = (tees: TeeBox[] | null | undefined, isMale: boolean) => {
    for (const t of tees ?? []) {
      if (t.course_rating == null || t.slope_rating == null || t.slope_rating <= 0) continue
      const name = (t.tee_name ?? '').trim()
      if (!name) continue
      const color = name.toLowerCase()
      // Men's wins a colour collision; don't overwrite a men's tee with a
      // women's one of the same colour.
      if (byColor.has(color) && !isMale) continue
      byColor.set(color, {
        course_id: courseId,
        tee_color: color,
        tee_name: name,
        course_rating: t.course_rating,
        slope_rating: t.slope_rating,
        total_yards: t.total_yards ?? null,
        par: t.par_total ?? null,
      })
    }
  }
  add(api.tees?.male, true)
  add(api.tees?.female, false)
  return [...byColor.values()]
}

// ---- main ------------------------------------------------------------------
async function loadDoneCourseIds(): Promise<Set<string>> {
  // Course ids that already have a rated tee — skipped so re-runs resume.
  const done = new Set<string>()
  const page = 1000
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from('course_tees')
      .select('course_id')
      .not('course_rating', 'is', null)
      .not('slope_rating', 'is', null)
      .range(from, from + page - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const r of data) done.add(r.course_id)
    if (data.length < page) break
  }
  return done
}

async function* candidateCourses(done: Set<string>): AsyncGenerator<CourseRow> {
  const page = 1000
  for (let from = 0; ; from += page) {
    let q = supabase
      .from('courses')
      .select('id, name, city, state, lat, lng')
      .order('id', { ascending: true })
      .range(from, from + page - 1)
    if (HAS_STATE) q = q.not('state', 'is', null)
    const { data, error } = await q
    if (error) throw error
    if (!data || data.length === 0) break
    for (const c of data as CourseRow[]) {
      if (!done.has(c.id)) yield c
    }
    if (data.length < page) break
  }
}

async function main() {
  console.log(
    `mode=${WRITE ? 'WRITE' : 'DRY-RUN'} limit=${LIMIT} threshold=${THRESHOLD} maxKm=${MAX_KM} hasState=${HAS_STATE}`,
  )
  const done = await loadDoneCourseIds()
  console.log(`${done.size} courses already have a rated tee — skipping those.`)

  let processed = 0
  let matched = 0
  let teesWritten = 0
  let noMatch = 0

  for await (const course of candidateCourses(done)) {
    if (processed >= LIMIT) break
    processed++

    // GolfCourseAPI's search is fairly literal — "Pebble Beach Golf Links"
    // returns 0 but "pebble beach" hits, since their record is "Pebble Beach
    // Gl". Query the normalized name (suffixes stripped) to maximise hits;
    // candidates are still scored against the original name below.
    const query = normalizeForMatch(course.name) || course.name
    const candidates = await searchApi(query)
    await sleep(DELAY_MS)
    const match = bestMatch(course, candidates)

    if (!match) {
      noMatch++
      continue
    }
    const tees = ratedTeeRows(course.id, match.api)
    if (tees.length === 0) {
      noMatch++
      continue
    }

    matched++
    teesWritten += tees.length
    const record = {
      course_id: course.id,
      ours: `${course.name} (${course.city ?? '?'}, ${course.state ?? '?'})`,
      matched_to: `${match.api.course_name ?? match.api.club_name} (${match.api.location?.city ?? '?'}, ${match.api.location?.state ?? '?'})`,
      api_id: match.api.id,
      score: Number(match.score.toFixed(3)),
      km: match.km == null ? null : Number(match.km.toFixed(1)),
      tees: tees.map((t) => `${t.tee_color} ${t.course_rating}/${t.slope_rating}`),
    }
    appendFileSync(OUT, JSON.stringify(record) + '\n')
    console.log(
      `  ✓ ${record.ours} → ${record.matched_to}  score=${record.score} km=${record.km}  [${record.tees.join(', ')}]`,
    )

    if (WRITE) {
      const { error } = await supabase
        .from('course_tees')
        .upsert(tees, { onConflict: 'course_id,tee_color' })
      if (error) {
        console.error(`  ✗ upsert failed for ${course.id}: ${error.message}`)
        teesWritten -= tees.length
        matched--
      }
    }
  }

  console.log('\n──── summary ────')
  console.log(`processed:    ${processed}`)
  console.log(`matched:      ${matched}`)
  console.log(`no match:     ${noMatch}`)
  console.log(`tees ${WRITE ? 'written' : 'proposed'}: ${teesWritten}`)
  console.log(`audit log:    ${OUT}`)
  if (!WRITE) console.log('\nDRY RUN — nothing written. Review the audit log, then re-run with --write.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
