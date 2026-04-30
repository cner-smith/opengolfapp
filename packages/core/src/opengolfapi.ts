// Minimal client for opengolfapi.org. ODbL licensed; no API key required.
// Exposed from @oga/core so web + mobile share the same fetch wrapper and
// types. Defensive about missing fields (city, state, yards) since the
// upstream data is community-maintained.

const BASE_URL = 'https://api.opengolfapi.org/v1'

export interface OpenGolfApiSearchResult {
  id: string
  name: string
  city?: string
  state?: string
  par?: number
  holeCount?: number
}

export interface OpenGolfApiHole {
  number: number
  par: number
  yards?: number
}

export interface OpenGolfApiCourse {
  id: string
  name: string
  city?: string
  state?: string
  par?: number
  holes: OpenGolfApiHole[]
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
  hole_count?: number
  holes?: RawHole[]
  scorecard?: RawHole[]
  tees?: { holes?: RawHole[] }[]
}

function asInt(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v)
  if (typeof v === 'string') {
    const n = parseInt(v, 10)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function pickHoles(raw: RawCourse): RawHole[] {
  if (Array.isArray(raw.holes) && raw.holes.length) return raw.holes
  if (Array.isArray(raw.scorecard) && raw.scorecard.length) return raw.scorecard
  if (Array.isArray(raw.tees) && raw.tees[0]?.holes) return raw.tees[0]!.holes!
  return []
}

function normalizeCourse(raw: RawCourse): OpenGolfApiCourse {
  const id = String(raw.id ?? raw.course_id ?? '')
  const name = raw.name ?? raw.course_name ?? '(unnamed course)'
  const holesRaw = pickHoles(raw)
  const holes: OpenGolfApiHole[] = []
  for (const h of holesRaw) {
    const number = asInt(h.number ?? h.hole ?? h.hole_number)
    const par = asInt(h.par)
    if (number == null || par == null) continue
    const yards = asInt(h.yards ?? h.distance ?? h.yardage)
    holes.push(yards != null ? { number, par, yards } : { number, par })
  }
  holes.sort((a, b) => a.number - b.number)
  return {
    id,
    name,
    city: raw.city ?? undefined,
    state: raw.state ?? raw.region ?? undefined,
    par: asInt(raw.par ?? raw.total_par),
    holes,
  }
}

function normalizeSearch(raw: RawCourse): OpenGolfApiSearchResult {
  const id = String(raw.id ?? raw.course_id ?? '')
  return {
    id,
    name: raw.name ?? raw.course_name ?? '(unnamed course)',
    city: raw.city ?? undefined,
    state: raw.state ?? raw.region ?? undefined,
    par: asInt(raw.par ?? raw.total_par),
    holeCount: asInt(raw.hole_count),
  }
}

async function fetchJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`OpenGolfAPI ${res.status}: ${path}`)
  }
  return res.json()
}

export async function searchOpenGolfApi(
  query: string,
  signal?: AbortSignal,
): Promise<OpenGolfApiSearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []
  const data = (await fetchJson(
    `/courses/search?q=${encodeURIComponent(trimmed)}`,
    signal,
  )) as { results?: RawCourse[]; data?: RawCourse[] } | RawCourse[]
  const results = Array.isArray(data)
    ? data
    : Array.isArray((data as { results?: RawCourse[] }).results)
      ? (data as { results?: RawCourse[] }).results!
      : Array.isArray((data as { data?: RawCourse[] }).data)
        ? (data as { data?: RawCourse[] }).data!
        : []
  return results
    .map(normalizeSearch)
    .filter((r) => !!r.id && !!r.name)
}

export async function getOpenGolfApiCourse(
  id: string,
  signal?: AbortSignal,
): Promise<OpenGolfApiCourse> {
  const data = (await fetchJson(`/courses/${encodeURIComponent(id)}`, signal)) as
    | RawCourse
    | { course?: RawCourse; data?: RawCourse }
  const raw =
    'id' in data || 'name' in data
      ? (data as RawCourse)
      : (data as { course?: RawCourse; data?: RawCourse }).course ??
        (data as { course?: RawCourse; data?: RawCourse }).data ??
        ({} as RawCourse)
  return normalizeCourse(raw)
}

export function formatLocation(r: { city?: string; state?: string }): string {
  return [r.city, r.state].filter(Boolean).join(', ')
}
