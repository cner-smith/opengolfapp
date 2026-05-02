import type {
  LieSlope,
  LieSlopeForward,
  LieSlopeSide,
  LieType,
  ShotResult,
} from './constants'
import type { Shot } from './types'

export interface DispersionPoint {
  /** Source shot id — used as a stable React key when rendering the
   *  dispersion plot, and lets a click handler trace back to the row. */
  id: string
  /** Yards right of aim (negative = left) */
  lateralOffsetYards: number
  /** Yards long of aim (negative = short) */
  distanceOffsetYards: number
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

export function computeDispersion(shots: Shot[]): DispersionPoint[] {
  const points: DispersionPoint[] = []
  for (const s of shots) {
    if (
      !isFiniteNumber(s.aimLat) ||
      !isFiniteNumber(s.aimLng) ||
      !isFiniteNumber(s.endLat) ||
      !isFiniteNumber(s.endLng)
    ) {
      continue
    }
    const aimLat = s.aimLat
    const aimLng = s.aimLng
    const endLat = s.endLat
    const endLng = s.endLng
    const latYards = (endLat - aimLat) * YARDS_PER_DEG_LAT
    const lngYards = (endLng - aimLng) * yardsPerDegLng(aimLat)
    points.push({
      id: s.id,
      lateralOffsetYards: lngYards,
      distanceOffsetYards: latYards,
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
    cone68: { lateral: stdLat, distance: stdDist },
    cone95: { lateral: stdLat * 1.96, distance: stdDist * 1.96 },
    dominantMiss,
    shotShape,
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
