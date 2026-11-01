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

  // #671: the putting table (d·3 ft) and the around-green table met with a
  // 0.6–0.8-stroke step at 5 yd. Every bracket must cross it smoothly.
  it.each([0, 15, 25])('has no step at the 5-yd putting/around-green seam (hcp %i)', (hcp) => {
    const jump = expectedStrokesFromPin(5, hcp) - expectedStrokesFromPin(4.99, hcp)
    expect(Math.abs(jump)).toBeLessThan(0.02)
  })

  it.each([0, 15, 25])('is non-decreasing from 0 to 40 yd in 0.05-yd steps (hcp %i)', (hcp) => {
    let prev = expectedStrokesFromPin(0, hcp)
    for (let i = 1; i <= 800; i++) {
      const v = expectedStrokesFromPin(i * 0.05, hcp)
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9)
      prev = v
    }
  })

  // Hand-worked from sg-baselines, bracket 15. PUTTING 10ft 1.65, 15ft 1.92;
  // AROUND_GREEN 5yd 2.60, 10yd 2.73 (clamped to 2.60 below 5 yd).
  it('blends putting into around-green linearly between 4 and 6 yd', () => {
    // 4 yd = 12 ft, pure putting: 1.65 + (2/5)·(1.92 − 1.65) = 1.65 + 0.108 = 1.758
    expect(expectedStrokesFromPin(4, HCP)).toBeCloseTo(1.758, 6)
    // 4.5 yd = 13.5 ft: putting 1.65 + (3.5/5)·0.27 = 1.839; around-green 2.60;
    // weight (4.5 − 4)/2 = 0.25 → 1.839 + 0.25·(2.60 − 1.839) = 1.839 + 0.19025 = 2.02925
    expect(expectedStrokesFromPin(4.5, HCP)).toBeCloseTo(2.02925, 6)
    // 5 yd = 15 ft: weight 0.5 → (1.92 + 2.60)/2 = 2.26
    expect(expectedStrokesFromPin(5, HCP)).toBeCloseTo(2.26, 6)
    // 6 yd, pure around-green: 2.60 + (1/5)·(2.73 − 2.60) = 2.626
    expect(expectedStrokesFromPin(6, HCP)).toBeCloseTo(2.626, 6)
  })

  it('leaves values well inside each table untouched', () => {
    // 2 yd = 6 ft putt: 1.27 + (1/3)·(1.52 − 1.27) = 1.27 + 0.08333 = 1.35333
    expect(expectedStrokesFromPin(2, HCP)).toBeCloseTo(1.353333, 5)
    // 10 yd chip: AROUND_GREEN[15][10] = 2.73
    expect(expectedStrokesFromPin(10, HCP)).toBeCloseTo(2.73, 6)
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
