import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Database } from '@oga/supabase'
import type { GeoPoint } from '@oga/core'

type OgaClient = ReturnType<(typeof import('@oga/supabase'))['createOgaServiceClient']>
type OgaCore = typeof import('@oga/core')
type GreenRow = Database['public']['Tables']['green_maps']['Row']

// Review queue for flagged green outlines (#1376), mounted by dev-admin-api under
// /api/dev-admin/greens. Same trust model as the rest of that plugin: dev server only,
// localhost only, service role.

export interface FlaggedGreen {
  holeId: string
  course: string
  state: string | null
  number: number
  ring: GeoPoint[]
  areaM2: number
  source: string
  score: number | null
  reason: string | null
  pin: GeoPoint | null
  hasGrid: boolean
}

export interface GreenContext {
  /** west, south, east, north: the photo's lng/lat box; every layer fills it exactly. */
  bbox: [number, number, number, number]
  layers: string[]
  credit: string
  osm: GeoPoint[][]
  osmError?: string
}

const LIST_LIMIT = 200
const PHOTO_PX = 800
const UA = 'OGA-dev-green-review (cner.smith@gmail.com)'
// Only these hosts go through the photo proxy. Never Mapbox, Google, Bing or Esri
// imagery under review: their terms forbid tracing from it (#1375).
const PHOTO_HOSTS = new Set(['planetarycomputer.microsoft.com', 'data.geopf.fr'])
const M_PER_DEG_LAT = 111_320
const osmCache = new Map<string, GeoPoint[][]>()

function photoBox(ring: GeoPoint[]): {
  centre: GeoPoint
  halfM: number
  bbox: GreenContext['bbox']
} {
  const lats = ring.map((p) => p.lat)
  const lngs = ring.map((p) => p.lng)
  const centre = {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  }
  const kx = M_PER_DEG_LAT * Math.cos((centre.lat * Math.PI) / 180)
  const spanM = Math.max(
    (Math.max(...lats) - Math.min(...lats)) * M_PER_DEG_LAT,
    (Math.max(...lngs) - Math.min(...lngs)) * kx,
  )
  const halfM = Math.max(45, spanM / 2 + 20)
  const dLat = halfM / M_PER_DEG_LAT
  const dLng = halfM / kx
  return {
    centre,
    halfM,
    bbox: [centre.lng - dLng, centre.lat - dLat, centre.lng + dLng, centre.lat + dLat],
  }
}

const proxied = (url: string) => `/api/dev-admin/greens/photo?u=${encodeURIComponent(url)}`

// Metropolitan France, roughly. Anything else is tried as US NAIP.
function inFrance(p: GeoPoint): boolean {
  return p.lng > -5.3 && p.lng < 9.7 && p.lat > 41.3 && p.lat < 51.2
}

// The same sources the outliner reads (docs/internal/green-data/scripts/outline/sources.py).
// green_maps keeps no imagery column yet, so NAIP takes the newest year here, as the
// outliner does first; it fell back a year only for items published empty.
async function photoLayers(
  centre: GeoPoint,
  bbox: GreenContext['bbox'],
): Promise<{ layers: string[]; credit: string }> {
  const box = bbox.join(',')
  if (inFrance(centre)) {
    const q = new URLSearchParams({
      SERVICE: 'WMS',
      REQUEST: 'GetMap',
      VERSION: '1.3.0',
      LAYERS: 'ORTHOIMAGERY.ORTHOPHOTOS',
      STYLES: '',
      CRS: 'CRS:84',
      BBOX: box,
      WIDTH: String(PHOTO_PX),
      HEIGHT: String(PHOTO_PX),
      FORMAT: 'image/png',
    })
    return {
      layers: [proxied(`https://data.geopf.fr/wms-r/wms?${q}`)],
      credit: 'IGN BD ORTHO, Licence Ouverte 2.0',
    }
  }
  const r = await fetch('https://planetarycomputer.microsoft.com/api/stac/v1/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({
      collections: ['naip'],
      bbox,
      limit: 30,
      sortby: [{ field: 'datetime', direction: 'desc' }],
    }),
  })
  if (!r.ok) throw new Error(`NAIP search: HTTP ${r.status}`)
  const feats =
    ((await r.json()) as { features?: { id: string; properties: { datetime: string } }[] })
      .features ?? []
  // Newest year first, every same-year item stacked (a green on a quarter-quad seam
  // needs two; outside its footprint an item's PNG is transparent). Some items are
  // published blank (FL 2022 fl_m_3008637_*), so a year whose items are all flat over
  // the box falls back to the next, as the outliner does.
  const [w, s, e, n] = bbox
  const box4326 = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [w, s],
          [e, s],
          [e, n],
          [w, n],
          [w, s],
        ],
      ],
    },
  }
  const params = (id: string) =>
    new URLSearchParams({
      collection: 'naip',
      item: id,
      assets: 'image',
      asset_bidx: 'image|1,2,3',
    })
  const years = [...new Set(feats.map((f) => f.properties.datetime.slice(0, 4)))]
  for (const year of years) {
    const items = feats.filter((f) => f.properties.datetime.startsWith(year))
    const usable = await Promise.all(
      items.map(async (f) => {
        const r = await fetch(
          `https://planetarycomputer.microsoft.com/api/data/v1/item/statistics?${params(f.id)}&max_size=256`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
            body: JSON.stringify(box4326),
          },
        )
        if (!r.ok) return true // can't tell; show it
        const stats = (
          (await r.json()) as { properties?: { statistics?: Record<string, { std: number }> } }
        ).properties?.statistics
        return Object.values(stats ?? {}).some((b) => b.std >= 4)
      }),
    )
    const keep = items.filter((_, i) => usable[i])
    if (!keep.length) continue
    const layers = keep.map((f) =>
      proxied(
        `https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/${box}/${PHOTO_PX}x${PHOTO_PX}.png?${params(f.id)}`,
      ),
    )
    return { layers, credit: `NAIP ${year}, USDA Farm Production and Conservation Business Center` }
  }
  return { layers: [], credit: 'Every NAIP photo here is blank' }
}

async function osmGreens(centre: GeoPoint, radiusM: number): Promise<GeoPoint[][]> {
  const around = `around:${Math.round(radiusM)},${centre.lat},${centre.lng}`
  const q = `[out:json][timeout:30];(way["golf"="green"](${around});relation["golf"="green"](${around}););out geom;`
  const r = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(q),
  })
  if (!r.ok) throw new Error(`Overpass: HTTP ${r.status}`)
  type Geom = { lat: number; lon: number }[]
  const els = (
    (await r.json()) as {
      elements: { type: string; geometry?: Geom; members?: { role: string; geometry?: Geom }[] }[]
    }
  ).elements
  const toRing = (g: Geom) => g.map((p) => ({ lat: p.lat, lng: p.lon }))
  return els.flatMap((el) =>
    el.type === 'way' && el.geometry
      ? [toRing(el.geometry)]
      : (el.members ?? [])
          .filter((m) => m.role === 'outer' && m.geometry)
          .map((m) => toRing(m.geometry!)),
  )
}

async function rowOf(client: OgaClient, holeId: string): Promise<Pick<GreenRow, 'outline'> | null> {
  const { data, error } = await client
    .from('green_maps')
    .select('outline')
    .eq('hole_id', holeId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

function validRing(body: unknown): GeoPoint[] | null {
  const ring = (body as { ring?: unknown })?.ring
  if (!Array.isArray(ring) || ring.length < 3 || ring.length > 5000) return null
  const ok = ring.every(
    (p) =>
      Number.isFinite(p?.lat) &&
      Number.isFinite(p?.lng) &&
      Math.abs(p.lat) <= 90 &&
      Math.abs(p.lng) <= 180,
  )
  return ok ? (ring as GeoPoint[]) : null
}

/** Handles /api/dev-admin/greens/*; returns false when the path isn't one of its routes. */
export async function greenReviewRoute(
  client: OgaClient,
  core: OgaCore,
  segments: string[],
  url: URL,
  method: string,
  req: IncomingMessage,
  res: ServerResponse,
  send: (res: ServerResponse, status: number, body: unknown) => void,
  readJson: (req: IncomingMessage) => Promise<unknown>,
): Promise<boolean> {
  if (segments[0] !== 'greens') return false
  const holeId = segments[1]

  if (segments.length === 1 && method === 'GET') {
    const { data, error, count } = await client
      .from('green_maps')
      .select(
        'hole_id, outline, area_m2, outline_source, outline_score, outline_flag_reason, grid_source, holes(number, pin_lat, pin_lng, courses(name, state))',
        { count: 'exact' },
      )
      .eq('outline_flagged', true)
      .order('updated_at')
      .range(0, LIST_LIMIT - 1)
    if (error) throw new Error(error.message)
    const rows: FlaggedGreen[] = (data ?? []).map((r) => ({
      holeId: r.hole_id,
      course: r.holes?.courses?.name ?? '?',
      state: r.holes?.courses?.state ?? null,
      number: r.holes?.number ?? 0,
      ring: core.decodePolyline(r.outline),
      areaM2: r.area_m2,
      source: r.outline_source,
      score: r.outline_score,
      reason: r.outline_flag_reason,
      pin:
        r.holes?.pin_lat != null && r.holes.pin_lng != null
          ? { lat: r.holes.pin_lat, lng: r.holes.pin_lng }
          : null,
      hasGrid: r.grid_source != null,
    }))
    send(res, 200, { total: count ?? rows.length, rows })
    return true
  }

  if (holeId === 'photo' && segments.length === 2 && method === 'GET') {
    const target = new URL(url.searchParams.get('u') ?? '')
    if (target.protocol !== 'https:' || !PHOTO_HOSTS.has(target.hostname)) {
      send(res, 400, { error: 'Not an allowed photo host' })
      return true
    }
    const r = await fetch(target, { headers: { 'User-Agent': UA } })
    res.statusCode = r.status
    res.setHeader('Content-Type', r.headers.get('content-type') ?? 'application/octet-stream')
    res.setHeader('Cache-Control', 'private, max-age=86400')
    res.end(Buffer.from(await r.arrayBuffer()))
    return true
  }

  if (!holeId || segments.length > 3) return false

  if (segments[2] === 'context' && method === 'GET') {
    const row = await rowOf(client, holeId)
    if (!row) {
      send(res, 404, { error: 'No outline for this hole' })
      return true
    }
    const { centre, halfM, bbox } = photoBox(core.decodePolyline(row.outline))
    const { layers, credit } = await photoLayers(centre, bbox)
    const ctx: GreenContext = { bbox, layers, credit, osm: [] }
    try {
      if (!osmCache.has(holeId)) osmCache.set(holeId, await osmGreens(centre, halfM * Math.SQRT2))
      ctx.osm = osmCache.get(holeId)!
    } catch (err) {
      ctx.osmError = err instanceof Error ? err.message : String(err)
    }
    send(res, 200, ctx)
    return true
  }

  // Every write below is guarded on outline_flagged, so a click from a stale page
  // can't touch an outline someone already reviewed.
  if (segments[2] === 'accept' && method === 'POST') {
    const { data, error } = await client
      .from('green_maps')
      .update({ outline_flagged: false, outline_flag_reason: null })
      .eq('hole_id', holeId)
      .eq('outline_flagged', true)
      .select('hole_id')
    if (error) throw new Error(error.message)
    send(
      res,
      data?.length ? 200 : 409,
      data?.length ? { ok: true } : { error: 'Not flagged any more' },
    )
    return true
  }

  // Reject: the green has no outline. outline is NOT NULL and a grid can't stand
  // without one, so this deletes the row, and refuses when the row holds a grid.
  if (segments.length === 2 && method === 'DELETE') {
    const { data, error } = await client
      .from('green_maps')
      .delete()
      .eq('hole_id', holeId)
      .eq('outline_flagged', true)
      .is('grid', null)
      .select('hole_id')
    if (error) throw new Error(error.message)
    if (data?.length) {
      send(res, 200, { ok: true })
      return true
    }
    send(res, 409, {
      error:
        'Not removed: the row holds a height grid, or it is no longer flagged. Redraw instead.',
    })
    return true
  }

  if (segments[2] === 'outline' && method === 'PUT') {
    const drawn = validRing(await readJson(req))
    if (!drawn) {
      send(res, 400, { error: 'Draw a closed loop of at least 3 points' })
      return true
    }
    const first = drawn[0]!
    const last = drawn[drawn.length - 1]!
    const ring = first.lat === last.lat && first.lng === last.lng ? drawn : [...drawn, first]
    const area = core.ringAreaM2(ring)
    if (!(area > 1)) {
      send(res, 400, { error: 'The drawn loop has no area' })
      return true
    }
    const { data, error } = await client
      .from('green_maps')
      .update({
        outline: core.encodePolyline(ring),
        area_m2: Math.round(area * 10) / 10,
        outline_source: 'manual',
        outline_score: null,
        outline_flagged: false,
        outline_flag_reason: null,
      })
      .eq('hole_id', holeId)
      .eq('outline_flagged', true)
      .select('hole_id')
    if (error) throw new Error(error.message)
    send(
      res,
      data?.length ? 200 : 409,
      data?.length ? { ok: true } : { error: 'Not flagged any more' },
    )
    return true
  }

  return false
}
