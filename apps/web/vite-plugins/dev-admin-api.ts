import type { ServerResponse } from 'node:http'
import type { Plugin, ViteDevServer } from 'vite'
// Type-only, so it is erased at build time and never triggers a runtime
// resolution of '@oga/supabase' from vite.config.ts's module graph.
import type { Database } from '@oga/supabase'
import type { GeoPoint } from '@oga/core'

import { rejectNonLocalRequest } from './dev-local-only'

type OgaSupabaseModule = typeof import('@oga/supabase')
type OgaSupabaseClient = ReturnType<OgaSupabaseModule['createOgaServiceClient']>
type OgaCoreModule = typeof import('@oga/core')
type CrawlStateRow = Database['public']['Tables']['crawl_state']['Row']

/** The dev Supabase project. Anything else is production — the page paints a red banner. */
const DEV_PROJECT_REF = 'txquvfeyvkaetqlamqlz'
const DAY_MS = 86_400_000

// PostgREST's default page size (unset db-max-rows still defaults to 1000 on
// Supabase-hosted projects) truncates any unranged select silently — no
// error, just a 206 with a Content-Range header nothing here reads. Verified
// live against oga-dev: an unranged `holes.select('course_id')` came back
// capped at 1000 of 159,748 rows, silently feeding a wrong number into
// oddHoleCount below with no error to catch it (see task-1-report.md).
// Anywhere a select's row count is unbounded (user-generated, not capped by
// something structural like geography), page through it with this size.
const POSTGREST_PAGE_SIZE = 1000

export interface DuplicateMatch {
  id: string
  name: string
  city: string | null
  state: string | null
  pending: boolean
  tier: string
  reason: string
  metres?: number
}

export interface PendingCourse {
  id: string
  name: string
  city: string | null
  state: string | null
  created_by: string | null
  created_at: string
  rounds: number
  roundsByOthers: number
  holes: number
  holesMapped: number
  holeSpanM: number
  centroid: { lat: number; lng: number } | null
  tees: number
  submitterPending: number
  duplicates: DuplicateMatch[]
}

export interface PendingPanel {
  total: number
  rows: PendingCourse[]
}

export interface CrawlerPanel {
  byStatus: Record<string, number>
  oldestCrawledAt: string | null
  errors: { id: string; error_message: string | null }[]
}

export interface Delta {
  current: number
  prior: number
}

export interface UsagePanel {
  profiles: Delta
  rounds: Delta
  activeUsers: Delta
}

export interface QualityPanel {
  missingState: number
  missingCoords: number
  oddHoleCount: number
}

/** Every panel resolves to its data or to its own error, so one bad query degrades one card. */
export type Panel<T> = T | { error: string }

export interface AdminStats {
  projectRef: string
  isDevProject: boolean
  pending: Panel<PendingPanel>
  crawler: Panel<CrawlerPanel>
  usage: Panel<UsagePanel>
  quality: Panel<QualityPanel>
}

async function panel<T>(fn: () => Promise<T>): Promise<Panel<T>> {
  try {
    return await fn()
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

async function countOf(
  query: PromiseLike<{
    count: number | null
    error: { message: string } | null
    status: number
    statusText: string
  }>,
): Promise<number> {
  const { count, error, status, statusText } = await query
  if (error) {
    // Every call site here uses { head: true } for an efficient count-only request. Per the
    // Fetch spec, a HEAD response never carries a body — verified live (curl -I against this
    // exact query, and reading @supabase/postgrest-js's PostgrestBuilder.processResponse):
    // even though PostgREST computes and sends a real JSON error, the client-side body comes
    // back '', JSON.parse('') throws, and postgrest-js's catch falls through to
    // `error = { message: body }` i.e. `{ message: '' }`. No amount of retrying or reading
    // `error` harder recovers that text — it was never delivered. So when message is empty,
    // surface the one thing that *did* arrive (the HTTP status) and say plainly why the rest
    // is missing, rather than let the caller render a blank, unexplained error box.
    const message = error.message.trim()
      ? error.message
      : `Count query failed: HTTP ${status} ${statusText}. HEAD responses carry no error body, so PostgREST's message wasn't delivered — re-run the same query without head:true (e.g. via curl) to see the actual cause.`
    throw new Error(message)
  }
  return count ?? 0
}

// ~1 km, as a latitude delta for a cheap bounding box before the exact
// haversine filter. Longitude degrees shrink with latitude, hence the cosine:
// without it the box is far too narrow in Scotland and too wide near the
// equator. The clamp stops a division blowup at the poles.
const NEARBY_LAT_DELTA = 0.01
const NEARBY_MAX_M = 1000

interface CandidateRow {
  id: string
  name: string
  city: string | null
  state: string | null
  lat: number | null
  lng: number | null
  approved_at: string | null
}

function toMatch(c: CandidateRow): Omit<DuplicateMatch, 'tier' | 'reason'> {
  return {
    id: c.id,
    name: c.name,
    city: c.city,
    state: c.state,
    pending: c.approved_at === null,
  }
}

async function findDuplicates(
  client: OgaSupabaseClient,
  core: OgaCoreModule,
  row: PendingCourse,
): Promise<DuplicateMatch[]> {
  const matches = new Map<string, DuplicateMatch>()
  const self = { name: row.name, city: row.city, state: row.state }

  // --- by name --------------------------------------------------------
  // Queries ALL courses, not just approved: "The Bel Short Course" appears
  // twice in this queue today, same submitter, 0 m apart. An approved-only
  // query flags neither of them.
  const token = core.distinctiveToken(row.name)
  if (token) {
    const { data, error, count } = await client
      .from('courses')
      .select('id,name,city,state,lat,lng,approved_at', { count: 'exact' })
      .ilike('name', `%${token}%`)
      .neq('id', row.id)
      .limit(200)
    if (error) throw new Error(error.message)
    const candidates = (data ?? []) as unknown as CandidateRow[]
    if ((count ?? 0) > candidates.length) {
      // Surfaced, not swallowed: a silent truncation here is a false
      // negative, which is the failure this panel exists to prevent.
      matches.set('__truncated__', {
        id: '__truncated__',
        name: `${count} name candidates for "${token}", only ${candidates.length} checked`,
        city: null,
        state: null,
        pending: false,
        tier: 'possible',
        reason: 'name-containment',
      })
    }
    const a = core.normalizeCourseName(row.name)
    for (const c of candidates) {
      const b = core.normalizeCourseName(c.name)
      if (core.isProbableSameCourse(self, { name: c.name, city: c.city, state: c.state })) {
        matches.set(c.id, { ...toMatch(c), tier: 'likely', reason: 'exact-name' })
      } else if (a && b && (a.includes(b) || b.includes(a))) {
        matches.set(c.id, { ...toMatch(c), tier: 'possible', reason: 'name-containment' })
      }
    }
  }

  // --- by geography ----------------------------------------------------
  // Catches what names cannot: "Sundridge Park West" is 513 m from the
  // approved "Sundridge Park Golf Course" and shares no normalized name.
  if (row.centroid) {
    const { lat, lng } = row.centroid
    const lngDelta = NEARBY_LAT_DELTA / Math.max(Math.cos((lat * Math.PI) / 180), 0.01)
    const { data, error } = await client
      .from('courses')
      .select('id,name,city,state,lat,lng,approved_at')
      .neq('id', row.id)
      .gte('lat', lat - NEARBY_LAT_DELTA)
      .lte('lat', lat + NEARBY_LAT_DELTA)
      .gte('lng', lng - lngDelta)
      .lte('lng', lng + lngDelta)
      .limit(50)
    if (error) throw new Error(error.message)
    for (const c of (data ?? []) as unknown as CandidateRow[]) {
      if (c.lat == null || c.lng == null) continue
      const metres = core.haversineYards(lat, lng, c.lat, c.lng) * core.YARDS_TO_METERS
      if (metres > NEARBY_MAX_M) continue
      // Never downgrade an exact-name hit to a proximity one.
      if (matches.get(c.id)?.tier === 'likely') continue
      matches.set(c.id, {
        ...toMatch(c),
        tier: 'possible',
        reason: 'proximity',
        metres: Math.round(metres),
      })
    }
  }

  return [...matches.values()]
}

async function pendingPanel(
  client: OgaSupabaseClient,
  core: OgaCoreModule,
): Promise<PendingPanel> {
  // One embedded query instead of a per-row fan-out. Paginated for the same
  // reason as everything else here: an unranged select silently truncates at
  // PostgREST's 1000-row default (see POSTGREST_PAGE_SIZE above).
  type Row = {
    id: string
    name: string
    city: string | null
    state: string | null
    created_by: string | null
    created_at: string
    holes: { number: number; tee_lat: number | null; tee_lng: number | null }[] | null
    rounds: { user_id: string }[] | null
    course_tees: { id: string }[] | null
  }

  const raw: Row[] = []
  let start = 0
  for (;;) {
    const { data, error } = await client
      .from('courses')
      .select(
        'id,name,city,state,created_by,created_at,holes(number,tee_lat,tee_lng),rounds(user_id),course_tees(id)',
      )
      .is('approved_at', null)
      .range(start, start + POSTGREST_PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    const page = (data ?? []) as unknown as Row[]
    raw.push(...page)
    if (page.length < POSTGREST_PAGE_SIZE) break
    start += POSTGREST_PAGE_SIZE
  }

  // "Other submissions by this submitter" means other rows in THIS queue.
  // Flood detection is about the queue, and queue-scoping makes it free —
  // it falls out of the rows already fetched instead of a query per submitter.
  const pendingBySubmitter = new Map<string, number>()
  for (const r of raw) {
    if (!r.created_by) continue
    pendingBySubmitter.set(r.created_by, (pendingBySubmitter.get(r.created_by) ?? 0) + 1)
  }

  const rows: PendingCourse[] = raw.map((r) => {
    const holes = r.holes ?? []
    const mapped: GeoPoint[] = holes
      .filter((h) => h.tee_lat != null && h.tee_lng != null)
      .map((h) => ({ lat: h.tee_lat as number, lng: h.tee_lng as number }))
    const roundRows = r.rounds ?? []
    return {
      id: r.id,
      name: r.name,
      city: r.city,
      state: r.state,
      created_by: r.created_by,
      created_at: r.created_at,
      rounds: roundRows.length,
      // 0053 gated on rounds by SOMEONE ELSE ("self-evidently real"). Every
      // rounds-bearing row in this queue is self-logged today, so collapsing
      // the two numbers would present self-attestation as corroboration.
      // A null created_by is an ORPHAN, not a third party: 0001 declares
      // created_by `on delete set null`, so deleting an account empties it
      // while approved_at stays null and the row stays queued. Without the
      // null check every round counts as corroboration and the least
      // attributable row in the queue sorts to the top of it.
      roundsByOthers: roundRows.filter(
        (x) => r.created_by != null && x.user_id !== r.created_by,
      ).length,
      holes: holes.length,
      holesMapped: mapped.length,
      holeSpanM: Math.round(core.pointSetDiameter(mapped)),
      centroid: core.courseCentroid(mapped),
      tees: (r.course_tees ?? []).length,
      submitterPending: r.created_by ? (pendingBySubmitter.get(r.created_by) ?? 1) - 1 : 0,
      duplicates: [],
    }
  })

  // Sort by evidence, not recency. 0027 permits 50 submissions per user per
  // day, so a created_at sort lets one account push real rows off the page.
  rows.sort(
    (a, b) =>
      b.roundsByOthers - a.roundsByOthers ||
      b.rounds - a.rounds ||
      b.holesMapped - a.holesMapped ||
      a.name.localeCompare(b.name),
  )

  const shown = rows.slice(0, 50)
  // Sequential, not Promise.all: up to 100 queries against production, and a
  // burst buys nothing on a page one person loads.
  for (const row of shown) {
    row.duplicates = await findDuplicates(client, core, row)
  }
  return { total: rows.length, rows: shown }
}

async function crawlerPanel(client: OgaSupabaseClient): Promise<CrawlerPanel> {
  // Deliberately unranged (unlike fetchAllCourseIds / activeIn below): unlike
  // `holes` or `rounds`, crawl_state is one row per `source:scope` written
  // only by our own crawler — currently ~50 rows, bounded by geography, not
  // by user activity. It cannot grow past PostgREST's 1000-row default page
  // on its own, so pagination here would be defending against a size the
  // data structurally can't reach.
  const { data, error } = await client
    .from('crawl_state')
    .select('id,status,last_crawled_at,error_message')
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as unknown as CrawlStateRow[]
  const byStatus: Record<string, number> = {}
  let oldest: string | null = null
  for (const row of rows) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1
    if (row.last_crawled_at && (oldest === null || row.last_crawled_at < oldest)) {
      oldest = row.last_crawled_at
    }
  }
  return {
    byStatus,
    oldestCrawledAt: oldest,
    errors: rows
      .filter((r) => r.status === 'error')
      .map((r) => ({ id: r.id, error_message: r.error_message })),
  }
}

async function usagePanel(client: OgaSupabaseClient): Promise<UsagePanel> {
  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const windowStart = new Date(now - 7 * DAY_MS).toISOString()
  const priorStart = new Date(now - 14 * DAY_MS).toISOString()

  // created_at, NOT played_at: played_at is the date the golf happened and can
  // be backdated by a past-round entry, so it does not measure activity.
  const countIn = (table: 'profiles' | 'rounds', from: string, to: string) =>
    countOf(
      client
        .from(table)
        .select('*', { count: 'exact', head: true })
        .gte('created_at', from)
        .lt('created_at', to),
    )

  // PostgREST has no count(distinct), so dedupe here. rounds is user-generated
  // and unbounded — this dashboard is meant to run against production too,
  // where a busy week could plausibly exceed 1000 rows — so this paginates
  // (see POSTGREST_PAGE_SIZE above) rather than trusting one unranged select.
  const activeIn = async (from: string, to: string): Promise<number> => {
    const userIds = new Set<string>()
    let start = 0
    for (;;) {
      const { data, error } = await client
        .from('rounds')
        .select('user_id')
        .gte('created_at', from)
        .lt('created_at', to)
        .range(start, start + POSTGREST_PAGE_SIZE - 1)
      if (error) throw new Error(error.message)
      const page = data ?? []
      for (const row of page) userIds.add(row.user_id)
      if (page.length < POSTGREST_PAGE_SIZE) break
      start += POSTGREST_PAGE_SIZE
    }
    return userIds.size
  }

  const [profilesNow, profilesPrior, roundsNow, roundsPrior, activeNow, activePrior] =
    await Promise.all([
      countIn('profiles', windowStart, nowIso),
      countIn('profiles', priorStart, windowStart),
      countIn('rounds', windowStart, nowIso),
      countIn('rounds', priorStart, windowStart),
      activeIn(windowStart, nowIso),
      activeIn(priorStart, windowStart),
    ])

  return {
    profiles: { current: profilesNow, prior: profilesPrior },
    rounds: { current: roundsNow, prior: roundsPrior },
    activeUsers: { current: activeNow, prior: activePrior },
  }
}

async function fetchAllCourseIds(client: OgaSupabaseClient): Promise<string[]> {
  const ids: string[] = []
  let from = 0
  for (;;) {
    const { data, error } = await client
      .from('holes')
      .select('course_id')
      .range(from, from + POSTGREST_PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    const page = (data ?? []) as { course_id: string }[]
    for (const row of page) ids.push(row.course_id)
    if (page.length < POSTGREST_PAGE_SIZE) break
    from += POSTGREST_PAGE_SIZE
  }
  return ids
}

async function qualityPanel(client: OgaSupabaseClient): Promise<QualityPanel> {
  const missingState = countOf(
    client.from('courses').select('*', { count: 'exact', head: true }).is('state', null),
  )
  const missingCoords = countOf(
    client
      .from('courses')
      .select('*', { count: 'exact', head: true })
      .or('lat.is.null,lng.is.null'),
  )
  // DEVIATION from the planned embedded-aggregate query (Step 2 fallback used
  // as primary — see task-1-report.md). `courses?select=id,holes!inner(count)`
  // does NOT behave as its own doc comment would claim: verified live against
  // oga-dev that `!inner` does not drop courses with zero `holes` rows from an
  // aggregate embed — every course still comes back as `{"count":0}`. Cross-
  // checked via SQL: the embedded-aggregate approach would have reported 6392
  // "odd" courses on dev's mirror-scale prod data vs. the correct 1779 that
  // actually have SOME hole geometry but not 9 or 18 of it. So this tallies
  // hole counts per course client-side instead, paginating through every
  // `holes` row via fetchAllCourseIds (one column, ~160k rows on prod today —
  // acceptable for a dev-only ops endpoint hit occasionally, not on every
  // page interaction).
  const oddHoleCount = (async () => {
    const courseIds = await fetchAllCourseIds(client)
    const perCourse = new Map<string, number>()
    for (const id of courseIds) perCourse.set(id, (perCourse.get(id) ?? 0) + 1)
    return [...perCourse.values()].filter((n) => n !== 9 && n !== 18).length
  })()

  const [state, coords, odd] = await Promise.all([missingState, missingCoords, oddHoleCount])
  return { missingState: state, missingCoords: coords, oddHoleCount: odd }
}

function refFromUrl(url: string): string {
  try {
    const { hostname } = new URL(url)
    if (hostname === 'localhost' || hostname === '127.0.0.1') return 'local'
    return hostname.split('.')[0] ?? hostname
  } catch {
    return 'unknown'
  }
}

/**
 * Dev-only ops dashboard backend (apps/web/src/pages/dev-admin).
 * `apply: 'serve'` means vite build never loads this file, so the service-role
 * key cannot ship in a production bundle.
 *
 * Mounted at /api/dev-admin rather than under dev-course-api's /api/dev prefix:
 * that plugin handles every /api/dev/* request and only falls through on no
 * match, so nesting here would silently depend on plugin registration order.
 *
 * No auth check on any route. Acceptable only because the whole plugin is
 * dev-server-only — anything reachable at `vite dev` has service-role access.
 */
export function devAdminApi(): Plugin {
  let modPromise: Promise<OgaSupabaseModule> | null = null
  let clientPromise: Promise<OgaSupabaseClient | null> | null = null
  let corePromise: Promise<OgaCoreModule> | null = null

  function loadOgaModule(server: ViteDevServer): Promise<OgaSupabaseModule> {
    modPromise ??= server.ssrLoadModule('@oga/supabase') as Promise<OgaSupabaseModule>
    return modPromise
  }

  function loadCore(server: ViteDevServer): Promise<OgaCoreModule> {
    // Same reasoning as loadOgaModule above: @oga/core is raw TS with
    // extensionless relative imports, which Node's loader cannot follow.
    corePromise ??= server.ssrLoadModule('@oga/core') as Promise<OgaCoreModule>
    return corePromise
  }

  function getClient(server: ViteDevServer): Promise<OgaSupabaseClient | null> {
    clientPromise ??= (async () => {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (!serviceKey) {
        server.config.logger.warn(
          '[dev-admin-api] SUPABASE_SERVICE_ROLE_KEY not set — /api/dev-admin/* will 500. Add bare SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY to apps/web/.env.local (see .env.example).',
        )
        return null
      }
      const url = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
      const mod = await loadOgaModule(server)
      return mod.createOgaServiceClient(url, serviceKey)
    })()
    return clientPromise
  }

  return {
    name: 'dev-admin-api',
    apply: 'serve',
    configureServer(server) {
      // Unconditional, fires at server startup (not per-request or after any
      // query resolves) so it covers the loading window, the error path, and
      // every route this plugin serves — including /dev/courses' Course
      // Editor writes, which have no on-page banner of their own. This is the
      // one warning that can never be silenced by a slow query or a page that
      // hasn't rendered yet.
      const startupUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
      const startupRef = refFromUrl(startupUrl)
      if (startupRef !== DEV_PROJECT_REF && startupRef !== 'local') {
        server.config.logger.warn(
          `[dev-admin-api] SUPABASE_URL resolves to project "${startupRef}", not the dev project (${DEV_PROJECT_REF}). The ops dashboard at /dev/admin will read PRODUCTION data, and the Course Editor's write endpoints at /dev/courses are ALSO live against production.`,
        )
      }
      server.middlewares.use('/api/dev-admin', async (req, res, next) => {
        // First, before anything reaches the service-role client: these routes
        // run ahead of Vite's own host check, so they must do it themselves.
        if (rejectNonLocalRequest(req, res, 'dev-admin-api')) return
        const client = await getClient(server)
        if (!client) {
          sendJson(res, 500, { error: 'SUPABASE_SERVICE_ROLE_KEY not set on the dev server' })
          return
        }
        const method = req.method ?? 'GET'
        const parsedUrl = new URL(req.url ?? '/', 'http://localhost')
        const segments = parsedUrl.pathname.split('/').filter(Boolean)

        try {
          if (segments[0] === 'stats' && segments.length === 1 && method === 'GET') {
            const url = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
            const projectRef = refFromUrl(url)
            const core = await loadCore(server)
            const [pending, crawler, usage, quality] = await Promise.all([
              panel(() => pendingPanel(client, core)),
              panel(() => crawlerPanel(client)),
              panel(() => usagePanel(client)),
              panel(() => qualityPanel(client)),
            ])
            const stats: AdminStats = {
              projectRef,
              isDevProject: projectRef === DEV_PROJECT_REF || projectRef === 'local',
              pending,
              crawler,
              usage,
              quality,
            }
            return sendJson(res, 200, stats)
          }

          if (
            segments[0] === 'courses' &&
            segments.length === 3 &&
            segments[2] === 'approve' &&
            method === 'POST'
          ) {
            const { data, error } = await client
              .from('courses')
              .update({ approved_at: new Date().toISOString() })
              .eq('id', segments[1]!)
              .is('approved_at', null)
              .select('id')
            if (error) return sendJson(res, 400, { error: error.message })
            if (!data || data.length === 0) {
              return sendJson(res, 409, { error: 'Not found, or already approved' })
            }
            return sendJson(res, 200, { ok: true })
          }

          // The `.is('approved_at', null)` guard is the point: a button click made
          // against a stale page cannot delete a course that has been approved since
          // the page loaded.
          if (segments[0] === 'courses' && segments.length === 2 && method === 'DELETE') {
            const { data, error } = await client
              .from('courses')
              .delete()
              .eq('id', segments[1]!)
              .is('approved_at', null)
              .select('id')
            if (error) {
              // rounds.course_id -> courses is NO ACTION (unlike holes/course_tees,
              // which cascade — see 0038's FK inventory), and 0053's backfill leaves
              // pending exactly the courses most likely to have a round attached
              // (someone created it to log a round there). Name what happened instead
              // of surfacing Postgres's raw FK-violation text.
              if (error.code === '23503') {
                return sendJson(res, 400, {
                  error:
                    'Rounds have been logged on this course, so it cannot be deleted. Nothing was changed.',
                })
              }
              return sendJson(res, 400, { error: error.message })
            }
            if (!data || data.length === 0) {
              return sendJson(res, 409, { error: 'Not found, or already approved' })
            }
            return sendJson(res, 200, { ok: true })
          }

          next()
        } catch (err) {
          sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) })
        }
      })
    },
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}
