import type {
  LieSlope,
  LieSlopeForward,
  LieSlopeSide,
  LieType,
  ShotResult,
} from './constants'
import type { Shot } from './types'
import { bearingDegrees, toRadians } from './units'

export interface DispersionPoint {
  /** Source shot id — used as a stable React key when rendering the
   *  dispersion plot, and lets a click handler trace back to the row. */
  id: string
  /** Yards right of aim (negative = left) */
  lateralOffsetYards: number
  /** Yards long of aim (negative = short) */
  distanceOffsetYards: number
  /** Start position long of aim (negative = short). Undefined when the
   *  shot has no recorded start. */
  startDistanceOffsetYards?: number
  shotResult?: ShotResult
  /** @deprecated populated from legacy rows; new code uses lieSlopeForward + lieSlopeSide. */
  lieSlope?: LieSlope
  lieSlopeForward?: LieSlopeForward
  lieSlopeSide?: LieSlopeSide
  lieType?: LieType
}

export interface DispersionStats {
  avgLateralOffset: number
  avgDistanceOffset: number
  stdLateral: number
  stdDistance: number
  cone68: { lateral: number; distance: number }
  cone95: { lateral: number; distance: number }
  dominantMiss: 'left' | 'right' | 'straight'
  shotShape: 'fade' | 'draw' | 'straight'
  sampleSize: number
}

const YARDS_PER_DEG_LAT = 121_000

function yardsPerDegLng(latDeg: number): number {
  return YARDS_PER_DEG_LAT * Math.cos((latDeg * Math.PI) / 180)
}

function isFiniteNumber(n: number | null | undefined): n is number {
  return n !== null && n !== undefined && Number.isFinite(n)
}

/** True only when start, aim, AND end coords are all finite — the minimum
 *  needed to derive the intended (start→aim) line and frame the shot to it. */
function hasAimGeometry(
  s: Shot,
): s is Shot &
  Record<
    'startLat' | 'startLng' | 'aimLat' | 'aimLng' | 'endLat' | 'endLng',
    number
  > {
  return (
    isFiniteNumber(s.startLat) &&
    isFiniteNumber(s.startLng) &&
    isFiniteNumber(s.aimLat) &&
    isFiniteNumber(s.aimLng) &&
    isFiniteNumber(s.endLat) &&
    isFiniteNumber(s.endLng)
  )
}

/**
 * Rotate a (target − aim) displacement into the aim-relative frame given the
 * intended-line bearing θ (radians, CW from N). `alongYards` = past the aim
 * point along the line; `perpYards` = right of the line. Scale deg→yards
 * BEFORE rotating — 1° lng ≠ 1° lat in distance.
 */
function rotateAroundAim(
  targetLat: number,
  targetLng: number,
  aimLat: number,
  aimLng: number,
  θ: number,
): { alongYards: number; perpYards: number } {
  const north = (targetLat - aimLat) * YARDS_PER_DEG_LAT
  const east = (targetLng - aimLng) * yardsPerDegLng(aimLat)
  return {
    alongYards: north * Math.cos(θ) + east * Math.sin(θ),
    perpYards: -north * Math.sin(θ) + east * Math.cos(θ),
  }
}

export function computeDispersion(shots: Shot[]): DispersionPoint[] {
  const points: DispersionPoint[] = []
  for (const s of shots) {
    // Aim-relative framing needs the start→aim line, so skip shots missing
    // start (compass-framing them and mixing bearings smears the pattern — #464).
    if (!hasAimGeometry(s)) continue
    const θ = toRadians(bearingDegrees(s.startLat, s.startLng, s.aimLat, s.aimLng))
    const end = rotateAroundAim(s.endLat, s.endLng, s.aimLat, s.aimLng, θ)
    const start = rotateAroundAim(s.startLat, s.startLng, s.aimLat, s.aimLng, θ)
    points.push({
      id: s.id,
      lateralOffsetYards: end.perpYards,
      distanceOffsetYards: end.alongYards,
      // Start projected onto the aim line (negative = behind aim = the carry).
      startDistanceOffsetYards: start.alongYards,
      shotResult: s.shotResult,
      lieSlope: s.lieSlope,
      lieSlopeForward: s.lieSlopeForward,
      lieSlopeSide: s.lieSlopeSide,
      lieType: s.lieType,
    })
  }
  return points
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function stdDev(xs: number[], avg: number): number {
  const variance = xs.reduce((a, b) => a + (b - avg) ** 2, 0) / xs.length
  return Math.sqrt(variance)
}

const DOMINANT_MISS_THRESHOLD_YARDS = 2
const SHOT_SHAPE_THRESHOLD_YARDS = 3
const MIN_SAMPLES_FOR_STATS = 5
// 2D containment radii. The fraction of a bivariate-normal scatter inside an
// axis-scaled ellipse is 1 − e^(−k²/2), so 68% / 95% containment needs
// k = √(−2·ln(1−p)) — NOT the 1-D 1σ / 1.96σ rule, which here would enclose
// only ~39% / ~85% of shots.
const CONE_68_K = 1.5096 // √(−2 ln 0.32)
const CONE_95_K = 2.4477 // √(−2 ln 0.05)

export function computeDispersionStats(points: DispersionPoint[]): DispersionStats | null {
  if (points.length < MIN_SAMPLES_FOR_STATS) return null

  const laterals = points.map((p) => p.lateralOffsetYards)
  const distances = points.map((p) => p.distanceOffsetYards)
  const avgLat = mean(laterals)
  const avgDist = mean(distances)
  const stdLat = stdDev(laterals, avgLat)
  const stdDist = stdDev(distances, avgDist)

  const dominantMiss: DispersionStats['dominantMiss'] =
    Math.abs(avgLat) < DOMINANT_MISS_THRESHOLD_YARDS
      ? 'straight'
      : avgLat > 0
        ? 'right'
        : 'left'

  const shotShape: DispersionStats['shotShape'] =
    Math.abs(avgLat) < SHOT_SHAPE_THRESHOLD_YARDS
      ? 'straight'
      : avgLat > 0
        ? 'fade'
        : 'draw'

  return {
    avgLateralOffset: avgLat,
    avgDistanceOffset: avgDist,
    stdLateral: stdLat,
    stdDistance: stdDist,
    cone68: { lateral: stdLat * CONE_68_K, distance: stdDist * CONE_68_K },
    cone95: { lateral: stdLat * CONE_95_K, distance: stdDist * CONE_95_K },
    dominantMiss,
    shotShape,
    sampleSize: points.length,
  }
}

/**
 * One shot's end position expressed in the AIM-RELATIVE frame:
 * `alongYards` long of aim (+ = past the aim point), `perpYards` right of
 * the aim line (+ = right). Unlike `computeDispersion` (which is compass-
 * framed N/E), this rotates by the shot's intended line so spreads can be
 * drawn correctly on a hole at any bearing. Returns null unless start, aim,
 * AND end coords are all finite — start+aim are needed to derive the bearing.
 */
export function aimRelativeOffsets(
  shot: Shot,
): { alongYards: number; perpYards: number } | null {
  if (!hasAimGeometry(shot)) return null
  // Bearing of the intended line (start → aim), compass degrees CW from N.
  const θ = toRadians(bearingDegrees(shot.startLat, shot.startLng, shot.aimLat, shot.aimLng))
  return rotateAroundAim(shot.endLat, shot.endLng, shot.aimLat, shot.aimLng, θ)
}

export interface AimRelativeDispersion {
  /** Mean long offset of the pattern (+ = long), yards. */
  alongMean: number
  /** Mean lateral offset (+ = right of aim) — the player's bias, yards. */
  perpMean: number
  /** 68% / 95% containment half-widths (radii) along each axis, yards. */
  along68: number
  along95: number
  perp68: number
  perp95: number
  /** Surviving aim-relative points (start+aim+end present). */
  points: { alongYards: number; perpYards: number }[]
  /** Count of surviving points — NOT the input length. */
  sampleSize: number
}

/**
 * Aim-relative dispersion across a set of shots (one club's worth, ideally).
 * Skips shots missing start/aim/end; returns null below MIN_SAMPLES_FOR_STATS.
 * Cones use the same 2D containment k-factors as computeDispersionStats.
 */
export function computeAimRelativeDispersion(shots: Shot[]): AimRelativeDispersion | null {
  const points: { alongYards: number; perpYards: number }[] = []
  for (const s of shots) {
    const o = aimRelativeOffsets(s)
    if (o) points.push(o)
  }
  if (points.length < MIN_SAMPLES_FOR_STATS) return null
  const alongs = points.map((p) => p.alongYards)
  const perps = points.map((p) => p.perpYards)
  const alongMean = mean(alongs)
  const perpMean = mean(perps)
  const alongStd = stdDev(alongs, alongMean)
  const perpStd = stdDev(perps, perpMean)
  return {
    alongMean,
    perpMean,
    along68: alongStd * CONE_68_K,
    along95: alongStd * CONE_95_K,
    perp68: perpStd * CONE_68_K,
    perp95: perpStd * CONE_95_K,
    points,
    sampleSize: points.length,
  }
}

export interface DispersionFilter {
  lieType?: LieType
  lieSlopeForward?: LieSlopeForward
  lieSlopeSide?: LieSlopeSide
  /** @deprecated legacy single-slope filter (matches either axis). Prefer
   *  lieSlopeForward / lieSlopeSide. */
  lieSlope?: LieSlope
}

export function filterDispersionByLie(
  points: DispersionPoint[],
  filter: DispersionFilter = {},
): DispersionPoint[] {
  return points.filter((p) => {
    if (filter.lieType && p.lieType !== filter.lieType) return false
    if (
      filter.lieSlopeForward &&
      p.lieSlopeForward !== filter.lieSlopeForward
    ) {
      return false
    }
    if (filter.lieSlopeSide && p.lieSlopeSide !== filter.lieSlopeSide) {
      return false
    }
    if (
      filter.lieSlope &&
      p.lieSlope !== filter.lieSlope &&
      p.lieSlopeForward !== filter.lieSlope &&
      p.lieSlopeSide !== filter.lieSlope
    ) {
      return false
    }
    return true
  })
}

export function getAimCorrection(
  stats: DispersionStats,
  unit: 'yards' | 'meters' = 'yards',
): string {
  const lateralYards = Math.abs(stats.avgLateralOffset)
  if (
    stats.dominantMiss === 'straight' ||
    lateralYards < DOMINANT_MISS_THRESHOLD_YARDS
  ) {
    return 'Your pattern is well centered on target.'
  }
  const value =
    unit === 'meters'
      ? Math.round(lateralYards * 0.9144)
      : Math.round(lateralYards)
  const singular = unit === 'meters' ? 'metre' : 'yard'
  const plural = unit === 'meters' ? 'metres' : 'yards'
  const noun = value === 1 ? singular : plural
  const oppDir = stats.dominantMiss === 'right' ? 'left' : 'right'
  return `Aim ${value} ${noun} ${oppDir} of your target to center your pattern.`
}

// One-line plain-language verdict from the dispersion shape + dominant miss.
// Lives here (not in an app) so the web and mobile share cards share one copy.
export function dispersionVerdict(stats: DispersionStats): string {
  const { shotShape, dominantMiss } = stats
  if (shotShape === 'straight' && dominantMiss === 'straight') return 'Dead straight'
  if (dominantMiss === 'straight') return `A consistent ${shotShape}`
  if (shotShape === 'straight') return `Straight, missing ${dominantMiss}`
  return `A ${shotShape} that leaks ${dominantMiss}`
}
