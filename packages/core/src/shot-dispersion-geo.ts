// Geo projection for the shot-pattern map overlay. Turns aim-relative
// dispersion (yards) into GeoJSON placed on a real hole, oriented down the
// origin→target line. Pure + cheap so it can recompute live as the target
// is dragged. Uses the same great-circle earth model as haversineYards /
// bearingDegrees so destination ↔ distance ↔ bearing round-trip exactly.
import { bearingDegrees, haversineYards, METERS_TO_YARDS, toRadians } from './units'

// Earth radius in yards, matching the 6371000 m sphere in haversineYards.
const EARTH_RADIUS_YARDS = 6_371_000 * METERS_TO_YARDS

export interface GeoPoint {
  lat: number
  lng: number
}

// Below this carry radius the arc's angular half-width saturates toward
// ±90° (atan(p/r) as r→0) and the bearing is meaningless — suppress it.
const MIN_ARC_RADIUS_YARDS = 5

// Sampled points across the arc. 24 is smooth at any realistic carry and
// cheap enough to recompute per drag frame.
const ARC_SAMPLES = 24

/**
 * Point reached by travelling `distYards` from `origin` on compass bearing
 * `bearingDeg`, via the great-circle destination formula — the exact inverse
 * of haversineYards + bearingDegrees.
 */
export function destinationYards(
  origin: GeoPoint,
  bearingDeg: number,
  distYards: number,
): GeoPoint {
  const δ = distYards / EARTH_RADIUS_YARDS // angular distance (radians)
  const θ = toRadians(bearingDeg)
  const φ1 = toRadians(origin.lat)
  const λ1 = toRadians(origin.lng)
  const sinφ2 = Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
  const φ2 = Math.asin(sinφ2)
  const λ2 =
    λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * sinφ2)
  return { lat: (φ2 * 180) / Math.PI, lng: (λ2 * 180) / Math.PI }
}

export interface ArcFeature {
  type: 'Feature'
  properties: Record<string, unknown>
  geometry: { type: 'LineString'; coordinates: [number, number][] }
}

/**
 * The dispersion arc: a constant-radius band at the target's carry distance,
 * spanning the lateral 68%/95% width as an arc (left-most to right-most).
 * `lateralHalfWidthYards` is the cone half-width (e.g. perp95); `biasYards`
 * offsets the whole band to the player's lateral bias (perpMean, + = right).
 * Returns null if the target is on top of the origin (radius below the floor).
 */
export function arcGeoJSON(
  origin: GeoPoint,
  target: GeoPoint,
  lateralHalfWidthYards: number,
  opts: { biasYards?: number } = {},
): ArcFeature | null {
  const radius = haversineYards(origin.lat, origin.lng, target.lat, target.lng)
  const halfWidth = Math.abs(lateralHalfWidthYards)
  const bias = opts.biasYards ?? 0
  if (!Number.isFinite(radius) || radius < MIN_ARC_RADIUS_YARDS) return null
  if (!Number.isFinite(halfWidth) || !Number.isFinite(bias)) return null

  const samples = ARC_SAMPLES
  const baseBearing = bearingDegrees(origin.lat, origin.lng, target.lat, target.lng)

  const leftPerp = bias - halfWidth
  const rightPerp = bias + halfWidth
  const coordinates: [number, number][] = []
  for (let i = 0; i <= samples; i++) {
    const perp = leftPerp + ((rightPerp - leftPerp) * i) / samples
    // Angular offset of a point `perp` yards off the centerline at radius
    // `radius`. atan saturates gracefully near the origin (vs asin → NaN).
    const angleDeg = (Math.atan2(perp, radius) * 180) / Math.PI
    const p = destinationYards(origin, baseBearing + angleDeg, radius)
    coordinates.push([p.lng, p.lat])
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } }
}
