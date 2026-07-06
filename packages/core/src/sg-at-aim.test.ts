import { describe, expect, it } from 'vitest'
import { expectedStrokesFromPin, sgAtAim } from './sg-at-aim'
import type { AimRelativeDispersion } from './shot-patterns'

const HCP = 15
// Due-east geometry: tee at origin, pin ~180 yd east. lng chosen so
// haversine ≈ 180 yd at the equator; exact value doesn't matter for
// the relative assertions below.
const tee = { lat: 0, lng: 0 }
const pin = { lat: 0, lng: 0.00166 } // ~180 yd east

function disp(points: { alongYards: number; perpYards: number }[], sampleSize = points.length): AimRelativeDispersion {
  return { alongMean: 0, perpMean: 0, along68: 0, along95: 0, perp68: 0, perp95: 0, points, sampleSize }
}

describe('expectedStrokesFromPin', () => {
  it('is finite and monotonically non-decreasing across band boundaries', () => {
    const ds = [1, 4, 5, 20, 29, 30, 40, 49, 50, 100, 200]
    const vals = ds.map((d) => expectedStrokesFromPin(d, HCP))
    for (const v of vals) expect(Number.isFinite(v)).toBe(true)
    for (let i = 1; i < vals.length; i++) expect(vals[i]!).toBeGreaterThanOrEqual(vals[i - 1]! - 1e-9)
  })
  it('floors the 30–50 yd seam flat (never dips below the around-green@30 value)', () => {
    // The around-green table at 30 yd exceeds the approach table at 50 yd in
    // every bracket, so the stitched band is clamped flat at the 30 yd floor.
    const at30 = expectedStrokesFromPin(30, HCP)
    const at40 = expectedStrokesFromPin(40, HCP)
    const at50 = expectedStrokesFromPin(50, HCP)
    expect(at40).toBe(at30)
    expect(at50).toBe(at30)
    // …and beyond the clamp the approach curve resumes rising.
    expect(expectedStrokesFromPin(150, HCP)).toBeGreaterThan(at50)
  })
})

describe('sgAtAim', () => {
  it('aiming at the pin beats aiming short, for a zero-spread cloud', () => {
    const cloud = disp([{ alongYards: 0, perpYards: 0 }])
    const atPin = sgAtAim({ tee, aim: pin, pin, dispersion: cloud, handicap: HCP })
    const short = sgAtAim({ tee, aim: { lat: 0, lng: 0.0011 }, pin, dispersion: cloud, handicap: HCP })
    expect(atPin.expectedStrokes).toBeLessThan(short.expectedStrokes)
  })
  it('a wider cone costs more strokes than a tight one at the same aim (Jensen)', () => {
    const tight = disp([{ alongYards: 0, perpYards: 0 }])
    const wide = disp([
      { alongYards: 0, perpYards: -30 },
      { alongYards: 0, perpYards: 30 },
    ])
    const a = sgAtAim({ tee, aim: pin, pin, dispersion: tight, handicap: HCP })
    const b = sgAtAim({ tee, aim: pin, pin, dispersion: wide, handicap: HCP })
    expect(b.expectedStrokes).toBeGreaterThan(a.expectedStrokes)
    expect(b.avgDistanceToPinYards).toBeGreaterThan(a.avgDistanceToPinYards)
  })
  it('confidence: 14 samples → low, 15 → high', () => {
    const pts = [{ alongYards: 0, perpYards: 0 }]
    expect(sgAtAim({ tee, aim: pin, pin, dispersion: disp(pts, 14), handicap: HCP }).confidence).toBe('low')
    expect(sgAtAim({ tee, aim: pin, pin, dispersion: disp(pts, 15), handicap: HCP }).confidence).toBe('high')
  })
})
