// Geo + unit primitives shared across web, mobile, and packages/core.
// All shot-distance / lateral-miss / proximity math goes through these so
// the conversion factors don't drift. Storage stays canonical (yards on
// land, feet on the green); display conversion is the caller's job.

import type { DistanceUnit } from './types'

export const YARDS_TO_METERS = 0.9144
export const METERS_TO_YARDS = 1.09361
export const FEET_TO_YARDS = 0.333333
export const FEET_TO_METERS = 0.3048
export const FEET_TO_CM = 30.48

export function toRadians(deg: number): number {
  return (deg * Math.PI) / 180
}

export function haversineYards(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000
  const φ1 = toRadians(lat1)
  const φ2 = toRadians(lat2)
  const Δφ = toRadians(lat2 - lat1)
  const Δλ = toRadians(lng2 - lng1)
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  const meters = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return meters * METERS_TO_YARDS
}

export function formatSG(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}`
}

export function formatToPar(diff: number): string {
  if (diff === 0) return 'E'
  return diff > 0 ? `+${diff}` : `${diff}`
}

// Shot distances: yards under 'yards' mode, metres under 'meters'. Caller
// picks decimals (default 0 = whole units, the live-round display default).
export function formatDistance(yards: number, unit: DistanceUnit, decimals = 0): string {
  if (!Number.isFinite(yards)) return '—'
  if (unit === 'meters') {
    return (yards * YARDS_TO_METERS).toFixed(decimals) + ' m'
  }
  return yards.toFixed(decimals) + ' yd'
}

// Putt distances: feet under 'yards' mode (US convention), centimetres
// under 'meters' mode (metric golfers still call putt distance in cm even
// when other distances are metres). Always whole units — sub-foot/cm
// precision is noise on a putting surface.
export function formatPuttDistance(feet: number, unit: DistanceUnit): string {
  if (!Number.isFinite(feet)) return '—'
  if (unit === 'meters') {
    return Math.round(feet * FEET_TO_CM) + ' cm'
  }
  return Math.round(feet) + ' ft'
}
