import type { LieSlope, LieType, ShotResult } from './constants'
import type { Shot } from './types'

export interface DispersionPoint {
  /** Yards right of aim (negative = left) */
  lateralOffsetYards: number
  /** Yards long of aim (negative = short) */
  distanceOffsetYards: number
  shotResult?: ShotResult
  lieSlope?: LieSlope
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
      lateralOffsetYards: lngYards,
      distanceOffsetYards: latYards,
      shotResult: s.shotResult,
      lieSlope: s.lieSlope,
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

export function filterDispersionByLie(
  points: DispersionPoint[],
  lieSlope?: LieSlope,
  lieType?: LieType,
): DispersionPoint[] {
  return points.filter((p) => {
    if (lieSlope && p.lieSlope !== lieSlope) return false
    if (lieType && p.lieType !== lieType) return false
    return true
  })
}

export function getAimCorrection(stats: DispersionStats): string {
  const lateral = Math.round(Math.abs(stats.avgLateralOffset))
  if (stats.dominantMiss === 'straight' || lateral < DOMINANT_MISS_THRESHOLD_YARDS) {
    return 'Your pattern is well centered on target.'
  }
  const oppDir = stats.dominantMiss === 'right' ? 'left' : 'right'
  const noun = lateral === 1 ? 'yard' : 'yards'
  return `Aim ${lateral} ${noun} ${oppDir} of your target to center your pattern.`
}
