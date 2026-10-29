import { bearingDegrees, haversineYards } from './units'
import { destinationYards, type GeoPoint } from './shot-dispersion-geo'
import { getExpectedStrokes } from './sg-calculator'
import type { AimRelativeDispersion } from './shot-patterns'

export interface SgAtAim {
  expectedStrokes: number
  avgDistanceToPinYards: number
  sampleSize: number
  confidence: 'high' | 'low'
}

const HIGH_CONFIDENCE_SAMPLES = 15

// Without lie data the planner can't tell a putt from a chip, so between 4 and
// 6 yd it blends the putting curve (d·3 ft) into the around-green one. The two
// tables differ by 0.6–0.8 strokes at 5 yd; a hard switch there made a landing
// at 4.99 yd look most of a stroke better than one at 5.0 (#671).
const BLEND_FROM_YARDS = 4
const BLEND_TO_YARDS = 6

/**
 * Expected strokes to hole out from `distanceYards` to the pin, keyed on
 * distance only (no lie data yet): putting inside 4 yd, a blend to 6,
 * around-green to 30, approach beyond. The tables meet at 30 yd (#632), so the
 * stitched curve is non-decreasing.
 */
export function expectedStrokesFromPin(distanceYards: number, handicap: number): number {
  const d = Math.max(0, distanceYards)
  if (d >= 30) return getExpectedStrokes('approach', d, undefined, handicap) ?? 0
  // Each range looks up only the table(s) it reads: this runs inside sgAtAim's Monte-Carlo loop.
  if (d <= BLEND_FROM_YARDS) return getExpectedStrokes('putting', undefined, d * 3, handicap) ?? 0
  const aroundGreen = getExpectedStrokes('around_green', d, undefined, handicap) ?? 0
  if (d >= BLEND_TO_YARDS) return aroundGreen
  const putting = getExpectedStrokes('putting', undefined, d * 3, handicap) ?? 0
  const w = (d - BLEND_FROM_YARDS) / (BLEND_TO_YARDS - BLEND_FROM_YARDS)
  return putting + w * (aroundGreen - putting)
}

/**
 * Expected strokes to hole out for a shot aimed at `aim` from `tee`, Monte-Carlo'd
 * over the player's real dispersion cloud for the chosen club. `expectedStrokes`
 * = 1 (the shot) + mean strokes-to-hole-out from where the cloud lands.
 */
export function sgAtAim(args: {
  tee: GeoPoint
  aim: GeoPoint
  pin: GeoPoint
  dispersion: AimRelativeDispersion
  handicap: number
}): SgAtAim {
  const { tee, aim, pin, dispersion, handicap } = args
  const b = bearingDegrees(tee.lat, tee.lng, aim.lat, aim.lng)
  let strokeSum = 0
  let distSum = 0
  let n = 0
  for (const p of dispersion.points) {
    if (!Number.isFinite(p.alongYards) || !Number.isFinite(p.perpYards)) continue
    const distFromAim = Math.hypot(p.alongYards, p.perpYards)
    const angle = (Math.atan2(p.perpYards, p.alongYards) * 180) / Math.PI
    const landing = destinationYards(aim, b + angle, distFromAim)
    const d = haversineYards(landing.lat, landing.lng, pin.lat, pin.lng)
    strokeSum += expectedStrokesFromPin(d, handicap)
    distSum += d
    n++
  }
  const meanStrokes = n > 0 ? strokeSum / n : 0
  return {
    expectedStrokes: 1 + meanStrokes,
    avgDistanceToPinYards: n > 0 ? distSum / n : 0,
    sampleSize: dispersion.sampleSize,
    confidence: dispersion.sampleSize >= HIGH_CONFIDENCE_SAMPLES ? 'high' : 'low',
  }
}
