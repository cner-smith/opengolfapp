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

// Points sampled around the approach circle. 48 is round at any green-side
// zoom and cheap to recompute.
const CIRCLE_SAMPLES = 48

export interface CircleFeature {
  type: 'Feature'
  properties: Record<string, unknown>
  geometry: { type: 'Polygon'; coordinates: [number, number][][] }
}

/**
 * Filled circle (Polygon) of `radiusYards` around `center` — the approach
 * overlay ring, centered on the pin. Sampled via the great-circle
 * destination formula so it stays round at any latitude. Returns null for a
 * non-finite center or a non-positive / non-finite radius.
 */
export function circleGeoJSON(
  center: GeoPoint,
  radiusYards: number,
  samples: number = CIRCLE_SAMPLES,
): CircleFeature | null {
  if (!Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return null
  if (!Number.isFinite(radiusYards) || radiusYards <= 0) return null
  const ring: [number, number][] = []
  for (let i = 0; i <= samples; i++) {
    const p = destinationYards(center, (360 * i) / samples, radiusYards)
    ring.push([p.lng, p.lat])
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }
}

export interface ScatterFeatureCollection {
  type: 'FeatureCollection'
  features: {
    type: 'Feature'
    properties: Record<string, unknown>
    geometry: { type: 'Point'; coordinates: [number, number] }
  }[]
}

/**
 * Places aim-relative scatter points (a club's historical shot endings as
 * `{alongYards, perpYards}`) onto the hole around `target`, rotated to the
 * current origin→target bearing — the single-color dispersion-dots overlay.
 * `along` runs down the aim line (+ = past the target), `perp` is right of it
 * (+ = right), matching arcGeoJSON's sign convention. Non-finite points are
 * skipped; an empty collection comes back when origin and target coincide
 * (the bearing is undefined below the arc-radius floor).
 */
export function scatterGeoJSON(
  origin: GeoPoint,
  target: GeoPoint,
  points: { alongYards: number; perpYards: number }[],
): ScatterFeatureCollection {
  const features: ScatterFeatureCollection['features'] = []
  const radius = haversineYards(origin.lat, origin.lng, target.lat, target.lng)
  if (Number.isFinite(radius) && radius >= MIN_ARC_RADIUS_YARDS) {
    const bearing = bearingDegrees(origin.lat, origin.lng, target.lat, target.lng)
    for (const p of points) {
      if (!Number.isFinite(p.alongYards) || !Number.isFinite(p.perpYards)) continue
      // From the target: along the aim bearing, then perpendicular (+90 = right).
      // Signed distances place short/left points on the opposite side correctly.
      const alongPt = destinationYards(target, bearing, p.alongYards)
      const placed = destinationYards(alongPt, bearing + 90, p.perpYards)
      features.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: [placed.lng, placed.lat] },
      })
    }
  }
  return { type: 'FeatureCollection', features }
}

export interface ConeRingFeature {
  type: 'Feature'
  properties: Record<string, unknown>
  geometry: { type: 'Polygon'; coordinates: [number, number][][] }
}

const CONE_RING_SAMPLES = 48

/**
 * A dispersion cone (e.g. 95%) as a Polygon ring on the hole: an along/perp
 * ellipse centered on the mean landing (aim shifted by the player's bias),
 * oriented down the origin→aim line. `along95`/`perp95` are the ellipse
 * semi-axes in yards. Returns null if origin and aim coincide.
 */
export function coneRingGeoJSON(
  origin: GeoPoint,
  aim: GeoPoint,
  along95: number,
  perp95: number,
  opts: { alongMeanYards?: number; perpMeanYards?: number } = {},
): ConeRingFeature | null {
  const radius = haversineYards(origin.lat, origin.lng, aim.lat, aim.lng)
  if (!Number.isFinite(radius) || radius < MIN_ARC_RADIUS_YARDS) return null
  if (!Number.isFinite(along95) || !Number.isFinite(perp95)) return null
  const bearing = bearingDegrees(origin.lat, origin.lng, aim.lat, aim.lng)
  const alongMean = opts.alongMeanYards ?? 0
  const perpMean = opts.perpMeanYards ?? 0
  const fwd = destinationYards(aim, bearing, alongMean)
  const center = destinationYards(fwd, bearing + 90, perpMean)
  const ring: [number, number][] = []
  for (let i = 0; i <= CONE_RING_SAMPLES; i++) {
    const t = (2 * Math.PI * i) / CONE_RING_SAMPLES
    const along = along95 * Math.cos(t)
    const perp = perp95 * Math.sin(t)
    const dist = Math.hypot(along, perp)
    const angle = (Math.atan2(perp, along) * 180) / Math.PI
    const p = destinationYards(center, bearing + angle, dist)
    ring.push([p.lng, p.lat])
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }
}
