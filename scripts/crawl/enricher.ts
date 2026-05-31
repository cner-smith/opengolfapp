// OpenGolfAPI fetch + normalize, fuzzy match against existing OSM
// courses, and the two crawl drivers (`crawlOpenGolfApi`, `crawlEnrich`).
import {
  MATCH_THRESHOLD,
  OPENGOLFAPI_BASE,
  OPENGOLFAPI_DELAY_MS,
  asInt,
  asNumber,
  sleep,
} from './util'
import type {
  CourseRowMin,
  OgaCourseDetail,
  OgaHole,
  OgaListItem,
  OgaTee,
  RawCourse,
  RawHole,
  RawTee,
} from './types'
import {
  fetchAlreadyTeedCourseIds,
  fetchOsmCoursesForState,
  findCourseByExternalId,
  getCrawlState,
  setCrawlState,
  updateCourseExternalId,
  upsertCourse,
  upsertHoles,
  upsertTees,
} from './db-writer'

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${url}`)
  }
  return res.json()
}

// Enrichment-path fetch. Never throws — returns null when the request can't be
// recovered. Handles 429 (Retry-After-style sleep), 404 (silent miss), and one
// retry on transient HTTP / network errors.
async function fetchJsonResilient(
  url: string,
  label: string,
): Promise<unknown | null> {
  let failedAttempts = 0
  const MAX_ATTEMPTS = 2
  while (true) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (res.status === 429) {
        console.warn(`[${label}] Rate limited — waiting 30s`)
        await sleep(30000)
        continue
      }
      if (res.status === 404) return null
      if (!res.ok) {
        failedAttempts++
        if (failedAttempts < MAX_ATTEMPTS) {
          console.warn(`[${label}] HTTP ${res.status} — retrying in 5s: ${url}`)
          await sleep(5000)
          continue
        }
        console.warn(`[${label}] HTTP ${res.status} — giving up: ${url}`)
        return null
      }
      return await res.json()
    } catch (err) {
      failedAttempts++
      const msg = (err as Error).message
      if (failedAttempts < MAX_ATTEMPTS) {
        console.warn(`[${label}] ${msg} — retrying in 5s`)
        await sleep(5000)
        continue
      }
      console.warn(`[${label}] ${msg} — giving up`)
      return null
    }
  }
}

// ---------------------------------------------------------------------------
// Payload normalization
// ---------------------------------------------------------------------------

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

function pickCoords(raw: RawCourse): { lat?: number; lng?: number } {
  const sources: Array<RawCourse['coordinates']> = [
    raw,
    raw.coordinates,
    raw.location && typeof raw.location === 'object' ? raw.location : undefined,
  ]
  for (const src of sources) {
    if (!src) continue
    const lat = asNumber(src.lat ?? src.latitude)
    const lng = asNumber(src.lng ?? src.longitude)
    if (lat != null && lng != null) return { lat, lng }
  }
  return {}
}

function normalizeListItem(raw: RawCourse): OgaListItem | null {
  const id = String(raw.id ?? raw.course_id ?? '')
  if (!id) return null
  const name = (raw.name ?? raw.course_name ?? '').trim()
  if (!name) return null
  const coords = pickCoords(raw)
  return {
    id,
    name,
    city: raw.city ?? undefined,
    state: raw.state ?? raw.region ?? undefined,
    lat: coords.lat,
    lng: coords.lng,
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
  const coords = pickCoords(raw)
  return {
    id,
    name,
    city: raw.city ?? undefined,
    state: raw.state ?? raw.region ?? undefined,
    lat: coords.lat,
    lng: coords.lng,
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
// Fuzzy matching
// ---------------------------------------------------------------------------

// Strip the boilerplate suffixes / connectors / punctuation that drown out
// real differences in club names. Both sides go through this before
// comparison, so "Lake Hefner Golf Club" and "Lake Hefner GC" collapse to
// the same canonical "lake hefner".
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

// Plain Levenshtein with a single rolling row. Casts are fine here — the
// arrays are filled before reads.
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev: number[] = Array.from({ length: n + 1 }, (_, j) => j)
  let curr: number[] = new Array<number>(n + 1).fill(0)
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1
      curr[j] = Math.min(
        (curr[j - 1] as number) + 1,
        (prev[j] as number) + 1,
        (prev[j - 1] as number) + cost,
      )
    }
    const tmp = prev
    prev = curr
    curr = tmp
  }
  return prev[n] as number
}

function nameSimilarity(a: string, b: string): number {
  const na = normalizeForMatch(a)
  const nb = normalizeForMatch(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  const maxLen = Math.max(na.length, nb.length)
  return maxLen === 0 ? 0 : 1 - levenshtein(na, nb) / maxLen
}

// Look up the OpenGolfAPI course that best matches `name` within `state`.
// Returns the full detail (with tees) if a confident match is found.
// Uses resilient fetcher — never throws on transient network/HTTP errors.
async function findOgaMatchForCourse(
  name: string,
  state: string,
  label: string,
  interReqDelayMs: number,
): Promise<OgaCourseDetail | null> {
  const searchUrl = `${OPENGOLFAPI_BASE}/courses/search?q=${encodeURIComponent(name)}&state=${encodeURIComponent(state)}`
  const payload = await fetchJsonResilient(searchUrl, label)
  if (!payload) return null
  const raws = pickArray(payload)
  let best: { item: OgaListItem; score: number } | null = null
  for (const raw of raws) {
    const item = normalizeListItem(raw)
    if (!item) continue
    // Only consider candidates from the right state — search ignores the
    // state filter for some queries and returns mixed results.
    if (item.state && item.state.toUpperCase() !== state.toUpperCase()) continue
    const score = nameSimilarity(name, item.name)
    if (score > (best?.score ?? 0)) best = { item, score }
  }
  if (!best || best.score < MATCH_THRESHOLD) return null
  await sleep(interReqDelayMs)
  const detailUrl = `${OPENGOLFAPI_BASE}/courses/${encodeURIComponent(best.item.id)}`
  const detailPayload = await fetchJsonResilient(detailUrl, label)
  if (!detailPayload) return null
  let raw: RawCourse | null = null
  if (Array.isArray(detailPayload)) {
    raw = (detailPayload[0] ?? null) as RawCourse | null
  } else if (detailPayload && typeof detailPayload === 'object') {
    const obj = detailPayload as { course?: unknown; data?: unknown }
    if (obj.course && typeof obj.course === 'object') {
      raw = obj.course as RawCourse
    } else if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
      raw = obj.data as RawCourse
    } else {
      raw = detailPayload as RawCourse
    }
  }
  if (!raw) return null
  return normalizeDetail(raw)
}

// ---------------------------------------------------------------------------
// Crawl drivers
// ---------------------------------------------------------------------------

export async function crawlOpenGolfApi(
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
          const city = (detail.city ?? item.city ?? '').trim() || null
          const stateCode = (detail.state ?? item.state ?? state).trim() || null
          const { id: courseId } = await upsertCourse({
            externalId,
            name: detail.name,
            city,
            state: stateCode,
            lat: detail.lat ?? item.lat ?? null,
            lng: detail.lng ?? item.lng ?? null,
          })
          // Holes + tees always re-upserted from the freshly-fetched
          // detail. Their own upsert keys (course_id,number /
          // course_id,tee_color) keep this idempotent.
          await upsertHoles(courseId, detail.holes)
          await upsertTees(courseId, detail.tees)
          totalImported++
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

export async function crawlEnrich(
  states: string[],
  force: boolean,
  limit: number | null,
  maxCourses: number | null = null,
): Promise<void> {
  let totalEnriched = 0
  let totalUnmatched = 0
  let totalSkipped = 0
  let totalErrors = 0
  // Global rate-limit budget: courses that have hit the OpenGolfAPI this run
  // (matched or no-match — both cost calls). Lets a daily cron stay under the
  // ~900/day cap and resume next run via the teedSet skip + in-progress state.
  let apiProcessed = 0
  let budgetReached = false
  for (const state of states) {
    const crawlId = `enrich:state:${state}`
    const prev = await getCrawlState(crawlId)
    if (prev?.status === 'done' && !force) {
      console.log(
        `[enrich:${state}] skip — already done (${prev.items_processed} courses)`,
      )
      continue
    }
    await setCrawlState(crawlId, { status: 'in_progress', errorMessage: null })

    let stateProcessed = 0
    let stateEnriched = 0
    let stateUnmatched = 0
    let stateErrors = 0
    try {
      // OSM-imported courses for this state. Excludes manual or
      // already-OpenGolfAPI-imported courses to keep the scope tight.
      console.log(`[enrich:${state}] fetching courses from DB...`)
      let courses: CourseRowMin[]
      try {
        courses = await fetchOsmCoursesForState(state)
      } catch (err) {
        const e = err as Error
        console.error(`[enrich:${state}] DB fetch failed:`, {
          message: e.message,
          stack: e.stack,
        })
        await setCrawlState(crawlId, {
          status: 'error',
          itemsProcessed: 0,
          errorMessage: `DB fetch failed: ${e.message}`,
        })
        continue
      }
      console.log(
        `[enrich:${state}] fetched ${courses.length} courses from DB`,
      )
      const targets = limit != null ? courses.slice(0, limit) : courses
      // Big states have hit OpenGolfAPI rate limits with the default 1100ms
      // cadence — bump to 2000ms when there's >200 to grind through.
      const perReqDelay = targets.length > 200 ? 2000 : OPENGOLFAPI_DELAY_MS
      console.log(
        `[enrich:${state}] ${targets.length} OSM course(s) to consider (delay ${perReqDelay}ms)`,
      )

      // Bulk-fetch existing tees so we can skip already-enriched courses
      // without one round-trip per course. Chunked to dodge the IN-list
      // URL-length cap.
      const courseIds = targets.map((c) => c.id)
      let teedSet: Set<string>
      try {
        console.log(
          `[enrich:${state}] looking up existing tees for ${courseIds.length} course(s)...`,
        )
        teedSet = await fetchAlreadyTeedCourseIds(courseIds, `enrich:${state}`)
        console.log(
          `[enrich:${state}] ${teedSet.size} course(s) already have tees`,
        )
      } catch (err) {
        const e = err as Error
        console.error(`[enrich:${state}] tees lookup failed:`, {
          message: e.message,
          stack: e.stack,
        })
        await setCrawlState(crawlId, {
          status: 'error',
          itemsProcessed: 0,
          errorMessage: `tees lookup failed: ${e.message}`,
        })
        continue
      }

      console.log(
        `[enrich:${state}] starting loop, first course: ${courses[0]?.name}`,
      )
      for (let i = 0; i < targets.length; i++) {
        const course = targets[i]
        if (!course) continue
        if (teedSet.has(course.id) && !force) {
          totalSkipped++
          continue
        }
        if (maxCourses != null && apiProcessed >= maxCourses) {
          budgetReached = true
          break
        }
        apiProcessed++
        try {
          const match = await findOgaMatchForCourse(
            course.name,
            state,
            `enrich:${state}`,
            perReqDelay,
          )
          stateProcessed++
          if (!match) {
            stateUnmatched++
            totalUnmatched++
            await sleep(perReqDelay)
            continue
          }
          if (match.tees.length > 0) {
            await upsertTees(course.id, match.tees)
          }
          // Switch the course's external_id to the OpenGolfAPI key so
          // in-app searches that hit OpenGolfAPI dedupe against this row
          // via getCourseByExternalId. The trade-off: a future OSM
          // crawl will create a new course row for the OSM way; that's
          // acceptable since the OSM crawl skips already-done states.
          await updateCourseExternalId(course.id, `opengolfapi_${match.id}`)
          stateEnriched++
          totalEnriched++
          if ((i + 1) % 50 === 0 || i === targets.length - 1) {
            console.log(
              `[enrich:${state}] ${i + 1}/${targets.length} — matched: ${course.name}`,
            )
            await setCrawlState(crawlId, { itemsProcessed: stateProcessed })
          }
        } catch (err) {
          stateErrors++
          totalErrors++
          console.warn(
            `[enrich:${state}] ${course.name}: ${(err as Error).message}`,
          )
        }
        await sleep(perReqDelay)
      }

      if (budgetReached) {
        await setCrawlState(crawlId, { itemsProcessed: stateProcessed })
        console.log(
          `[enrich:${state}] paused — ${maxCourses}-course daily budget reached (${stateEnriched} enriched so far; state left in-progress to resume next run)`,
        )
      } else {
        await setCrawlState(crawlId, {
          status: 'done',
          itemsProcessed: stateProcessed,
          errorMessage: null,
        })
        console.log(
          `[enrich:${state}] done — ${stateEnriched} enriched, ${stateUnmatched} no-match, ${stateErrors} errors`,
        )
      }
    } catch (err) {
      const e = err as Error
      console.error(`[enrich:${state}] fatal: ${e.message}`)
      console.error(`[enrich:${state}] fatal details:`, {
        message: e.message,
        stack: e.stack,
      })
      await setCrawlState(crawlId, {
        status: 'error',
        itemsProcessed: stateProcessed,
        errorMessage: e.message,
      })
    }
    if (budgetReached) break // stop touching further states this run
  }
  console.log(
    `\nEnrichment complete: ${totalEnriched} enriched, ${totalUnmatched} no-match, ${totalSkipped} already-teed, ${totalErrors} errors`,
  )
}
