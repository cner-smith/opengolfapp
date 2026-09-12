import { haversineYards, YARDS_TO_METERS } from './units'
import type { GeoPoint } from './shot-dispersion-geo'

export type { GeoPoint }

/** A real golf course fits inside this. Anything wider is not one course's holes. */
export const MAX_COURSE_SPAN_M = 3000

/**
 * Maximum pairwise separation of a point set, in metres. 0 for fewer than two
 * points.
 *
 * Doubles as review evidence: "5 of 9 holes mapped, spanning 5,949 km" reads
 * as junk instantly, where "8 of 9, spanning 634 m" reads as real.
 *
 * O(n²), which is fine — n is a course's hole count, at most 18.
 */
export function pointSetDiameter(points: GeoPoint[]): number {
  let max = 0
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const a = points[i]!
      const b = points[j]!
      const metres = haversineYards(a.lat, a.lng, b.lat, b.lng) * YARDS_TO_METERS
      if (metres > max) max = metres
    }
  }
  return max
}

/**
 * Mean of a course's mapped hole coordinates, or null when the point set
 * cannot be trusted to describe one place.
 *
 * Null for fewer than two points: a single coordinate admits no
 * corroboration, and a stray tap reverse-geocodes to a real, plausible,
 * wrong place that no human reviewer can catch.
 *
 * Null for a set spanning more than MAX_COURSE_SPAN_M.
 *
 * Deliberately NOT a median. A live pending row has two holes in Paris and
 * three near Philadelphia; a median picks the three-point cluster and is
 * confidently wrong, where null is visibly absent and recoverable.
 */
export function courseCentroid(points: GeoPoint[]): GeoPoint | null {
  if (points.length < 2) return null
  if (pointSetDiameter(points) > MAX_COURSE_SPAN_M) return null
  const lat = points.reduce((sum, p) => sum + p.lat, 0) / points.length
  const lng = points.reduce((sum, p) => sum + p.lng, 0) / points.length
  return { lat, lng }
}
