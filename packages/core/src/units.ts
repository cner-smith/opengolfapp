// Geo + unit primitives shared across web, mobile, and packages/core.
// All shot-distance / lateral-miss / proximity math goes through these so
// the conversion factors don't drift. Storage stays canonical (yards on
// land, feet on the green); display conversion is the caller's job.

export const YARDS_TO_METERS = 0.9144
export const METERS_TO_YARDS = 1.09361
export const FEET_TO_YARDS = 0.333333

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
