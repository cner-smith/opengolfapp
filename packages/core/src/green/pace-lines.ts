// Pace lines (#1379 reading 1, a map layer): lines across the green every
// `everyPaces` paces from the front edge on the pin's line, square to the
// approach, cut where they leave the outline.
import type { GeoPoint } from '../shot-dispersion-geo'
import { YARDS_TO_METERS } from '../units'
import { greenFrame } from './frame'
import { pinSheet } from './pin-sheet'

/** Each line is one or more [start, end] segments. Empty when the pin is on or off the outline. */
export function paceLines(
  outline: GeoPoint[],
  pin: GeoPoint,
  approachDeg: number,
  everyPaces = 5,
  paceM = YARDS_TO_METERS,
): GeoPoint[][] {
  const sheet = pinSheet(outline, pin, approachDeg, paceM)
  if (!sheet) return []
  const f = greenFrame(pin, approachDeg)
  const pts = outline.map(f.toLocal)
  const first = pts[0]!
  const last = pts[pts.length - 1]!
  if (first.x !== last.x || first.y !== last.y) pts.push(first)
  const back = Math.max(...pts.map((p) => p.y))
  const out: GeoPoint[][] = []
  for (let y = -sheet.onPaces * paceM + everyPaces * paceM; y < back; y += everyPaces * paceM) {
    const xs: number[] = []
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i]!
      const c = pts[i + 1]!
      if (a.y > y !== c.y > y) xs.push(a.x + ((y - a.y) * (c.x - a.x)) / (c.y - a.y))
    }
    xs.sort((p, q) => p - q)
    for (let k = 0; k + 1 < xs.length; k += 2) out.push([f.toGeo(xs[k]!, y), f.toGeo(xs[k + 1]!, y)])
  }
  return out
}
