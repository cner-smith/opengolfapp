// Pin-sheet measures (#1378, #1385): paces from the front edge to the pin
// along the approach line, and from the pin to the nearest side edge.
import type { GeoPoint } from '../shot-dispersion-geo'
import { YARDS_TO_METERS } from '../units'

const M_PER_DEG = 111_320
/** Closer than this to the outline counts as on it. */
const ON_EDGE_M = 0.01

export interface PinSheet {
  onPaces: number
  sidePaces: number
  side: 'left' | 'right'
}

/**
 * `approachDeg` is the compass bearing the player travels toward the green.
 * Each measure uses the outline crossings that bracket the pin on its own
 * line, so a concave green measures from the edge nearest the pin, not the
 * green's overall front. Null when the pin is on or outside the outline.
 */
export function pinSheet(
  outline: GeoPoint[],
  pin: GeoPoint,
  approachDeg: number,
  paceM = YARDS_TO_METERS,
): PinSheet | null {
  if (outline.length < 3) return null
  const kx = M_PER_DEG * Math.cos((pin.lat * Math.PI) / 180)
  const b = (approachDeg * Math.PI) / 180
  const fx = Math.sin(b)
  const fy = Math.cos(b)
  // u = metres forward from the pin (toward the back), v = metres to the right.
  const pts = outline.map((p) => {
    const x = (p.lng - pin.lng) * kx
    const y = (p.lat - pin.lat) * M_PER_DEG
    return { u: x * fx + y * fy, v: x * fy - y * fx }
  })
  if (pts.length && (pts[0]!.u !== pts[pts.length - 1]!.u || pts[0]!.v !== pts[pts.length - 1]!.v)) pts.push(pts[0]!)

  let inside = false
  const alongU: number[] = []
  const alongV: number[] = []
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!
    const c = pts[i + 1]!
    const du = c.u - a.u
    const dv = c.v - a.v
    const len2 = du * du + dv * dv
    const t = len2 ? Math.max(0, Math.min(1, -(a.u * du + a.v * dv) / len2)) : 0
    if (Math.hypot(a.u + t * du, a.v + t * dv) < ON_EDGE_M) return null
    // Half-open tests so a vertex on the line counts once.
    if (a.v > 0 !== c.v > 0) {
      const u = a.u - (a.v * du) / dv
      alongU.push(u)
      if (u > 0) inside = !inside
    }
    if (a.u > 0 !== c.u > 0) alongV.push(a.v - (a.u * dv) / du)
  }
  if (!inside) return null

  const front = Math.max(...alongU.filter((u) => u < 0))
  const left = Math.max(...alongV.filter((v) => v < 0))
  const right = Math.min(...alongV.filter((v) => v > 0))
  const toLeft = -left
  return toLeft <= right
    ? { onPaces: -front / paceM, sidePaces: toLeft / paceM, side: 'left' }
    : { onPaces: -front / paceM, sidePaces: right / paceM, side: 'right' }
}
