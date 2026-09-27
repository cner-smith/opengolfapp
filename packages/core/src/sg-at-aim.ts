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

/**
 * Expected strokes to hole out from `distanceYards` to the pin, keyed on
 * distance only (no lie data yet): putting inside 5 yd, around-green to 30,
 * approach beyond. The tables meet at 30 yd (#632), so the stitched curve is
 * non-decreasing.
 */
export function expectedStrokesFromPin(distanceYards: number, handicap: number): number {
  const d = Math.max(0, distanceYards)
  if (d < 5) return getExpectedStrokes('putting', undefined, d * 3, handicap) ?? 0
  if (d < 30) return getExpectedStrokes('around_green', d, undefined, handicap) ?? 0
  return getExpectedStrokes('approach', d, undefined, handicap) ?? 0
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
