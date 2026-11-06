// A green's outline from OSM, matched to one hole (#1374). Both OSM importers feed
// their golf=green ways and multipolygon relations through osmGreenMap, which picks
// the hole's green and returns what green_maps stores: the encoded ring and its area.
import type { GeoPoint } from './shot-dispersion-geo'
import { encodePolyline } from './green/polyline'

const EARTH_R_M = 6_371_000
const M_PER_DEG = (Math.PI / 180) * EARTH_R_M
/** An end or pin outside every green takes the nearest one this close, flagged. */
const NEAREST_GREEN_M = 30

/** Ray cast in lat/lng; fine at green size. */
export function pointInRing(pt: GeoPoint, ring: GeoPoint[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!
    const b = ring[j]!
    if (a.lng > pt.lng !== b.lng > pt.lng && pt.lat < ((b.lat - a.lat) * (pt.lng - a.lng)) / (b.lng - a.lng) + a.lat) {
      inside = !inside
    }
  }
  return inside
}

/** Shoelace area in m² on an equirectangular projection about the ring's mean latitude. */
export function ringAreaM2(ring: GeoPoint[]): number {
  const lat0 = ring.reduce((s, p) => s + p.lat, 0) / ring.length
  const kx = M_PER_DEG * Math.cos((lat0 * Math.PI) / 180)
  let twice = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!
    const b = ring[j]!
    twice += b.lng * kx * a.lat * M_PER_DEG - a.lng * kx * b.lat * M_PER_DEG
  }
  return Math.abs(twice) / 2
}

function samePoint(a: GeoPoint, b: GeoPoint): boolean {
  return Math.abs(a.lat - b.lat) < 1e-9 && Math.abs(a.lng - b.lng) < 1e-9
}

// Stitch outer member ways (a closed way is already a ring) into closed rings by
// matching endpoints. A chain that never closes is dropped: it isn't an area.
function closedRings(segments: GeoPoint[][]): GeoPoint[][] {
  const segs = segments.filter((s) => s.length >= 2)
  const used = segs.map(() => false)
  const rings: GeoPoint[][] = []
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue
    used[i] = true
    const ring = [...segs[i]!]
    let extended = true
    while (extended && !samePoint(ring[0]!, ring[ring.length - 1]!)) {
      extended = false
      for (let j = 0; j < segs.length; j++) {
        if (used[j]) continue
        const s = segs[j]!
        const last = ring[ring.length - 1]!
        if (samePoint(s[0]!, last)) ring.push(...s.slice(1))
        else if (samePoint(s[s.length - 1]!, last)) ring.push(...s.slice(0, -1).reverse())
        else continue
        used[j] = true
        extended = true
        break
      }
    }
    if (ring.length >= 4 && samePoint(ring[0]!, ring[ring.length - 1]!)) rings.push(ring)
  }
  return rings
}

function distanceToRingM(pt: GeoPoint, ring: GeoPoint[]): number {
  const kx = M_PER_DEG * Math.cos((pt.lat * Math.PI) / 180)
  const xy = (p: GeoPoint) => [(p.lng - pt.lng) * kx, (p.lat - pt.lat) * M_PER_DEG] as const
  let best = Infinity
  for (let i = 1; i < ring.length; i++) {
    const [ax, ay] = xy(ring[i - 1]!)
    const [bx, by] = xy(ring[i]!)
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2))
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy))
  }
  return best
}

export interface OsmGreenMap {
  outline: string
  /** The outer ring's area; a multipolygon's inner rings aren't subtracted (rare on greens). */
  areaM2: number
  flagged: boolean
  flagReason: string | null
}

/**
 * The hole's green among a course's OSM greens (each = its outer ways). The green the
 * hole way's end lies in; with no hole way, the green containing the pin; otherwise the
 * nearest within 30 m, flagged. Never simply the nearest green: about 1 in 5 OSM greens
 * is a practice green, often beside the hole's own.
 */
export function osmGreenMap(
  greens: GeoPoint[][][],
  holeEnd: GeoPoint | null,
  pin: GeoPoint | null,
): OsmGreenMap | null {
  const anchor = holeEnd ?? pin
  if (!anchor) return null
  const rings = greens.flatMap(closedRings).map((ring) => ({ ring, area: ringAreaM2(ring) }))

  const containing = rings.filter((r) => pointInRing(anchor, r.ring)).sort((a, b) => a.area - b.area)[0]
  if (containing) {
    return { outline: encodePolyline(containing.ring), areaM2: containing.area, flagged: false, flagReason: null }
  }

  let nearest: { ring: GeoPoint[]; area: number; d: number } | null = null
  for (const r of rings) {
    const d = distanceToRingM(anchor, r.ring)
    if (d <= NEAREST_GREEN_M && (!nearest || d < nearest.d)) nearest = { ...r, d }
  }
  if (!nearest) return null
  const from = holeEnd ? "the hole's end" : 'the pin'
  return {
    outline: encodePolyline(nearest.ring),
    areaM2: nearest.area,
    flagged: true,
    flagReason: `nearest green, ${Math.round(nearest.d)} m from ${from}`,
  }
}
