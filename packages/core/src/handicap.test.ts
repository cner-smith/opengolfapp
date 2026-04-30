import { describe, expect, it } from 'vitest'
import {
  adjustedScore,
  calculateDifferential,
  calculateHandicapIndex,
} from './handicap'

describe('calculateDifferential', () => {
  it('matches the USGA formula (84, 71.2, 124) → ~11.66', () => {
    const d = calculateDifferential(84, 71.2, 124)
    // (84 - 71.2) * 113 / 124 = 11.6645
    expect(d).toBeCloseTo(11.66, 1)
  })

  it('returns negative differentials for sub-rating rounds', () => {
    const d = calculateDifferential(68, 70.5, 130)
    expect(d).toBeLessThan(0)
  })

  it('throws when slope is zero or negative', () => {
    expect(() => calculateDifferential(80, 72, 0)).toThrow()
    expect(() => calculateDifferential(80, 72, -120)).toThrow()
  })
})

describe('calculateHandicapIndex', () => {
  it('returns null with fewer than three differentials', () => {
    expect(calculateHandicapIndex([])).toBe(null)
    expect(calculateHandicapIndex([10])).toBe(null)
    expect(calculateHandicapIndex([10, 12])).toBe(null)
  })

  it('uses 1 of 3 best at 3 submissions', () => {
    // Best 1 of 3 = 10 → 10 * 0.96 = 9.6
    const idx = calculateHandicapIndex([15, 12, 10])
    expect(idx).toBe(9.6)
  })

  it('uses best 2 of 5', () => {
    const idx = calculateHandicapIndex([10, 11, 12, 13, 14])
    // best 2 = (10 + 11) / 2 = 10.5; * 0.96 = 10.08 → 10.1
    expect(idx).toBe(10.1)
  })

  it('uses best 8 of 20+', () => {
    const diffs = [
      8.0, 8.5, 9.1, 9.5, 10.0, 10.4, 10.8, 11.2, 11.5, 11.9,
      12.3, 12.7, 13.0, 13.4, 13.7, 14.0, 14.4, 14.8, 15.2, 15.5,
    ]
    const idx = calculateHandicapIndex(diffs)
    // best 8 = (8.0 + 8.5 + 9.1 + 9.5 + 10.0 + 10.4 + 10.8 + 11.2) / 8 = 9.6875
    // * 0.96 = 9.30 → 9.3
    expect(idx).toBe(9.3)
  })

  it('rounds to one decimal place', () => {
    const idx = calculateHandicapIndex([10.0, 10.0, 10.0])
    expect(idx).toBe(9.6)
  })

  it('ignores non-finite differentials', () => {
    const idx = calculateHandicapIndex([
      8,
      9,
      10,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ])
    expect(idx).not.toBeNull()
  })
})

describe('adjustedScore (ESC)', () => {
  const holes = [
    { score: 4, par: 4 }, // par
    { score: 6, par: 4 }, // double bogey
    { score: 9, par: 4 }, // triple bogey + 2 — will get capped
    { score: 5, par: 5 },
    { score: 8, par: 3 }, // very bad par 3
  ]

  it('caps to par + 2 for single-digit handicaps', () => {
    // Hole 3: par 4 → cap 6 (lost 3 strokes)
    // Hole 5: par 3 → cap 5 (lost 3 strokes)
    // Total raw = 32; capped = 4 + 6 + 6 + 5 + 5 = 26
    expect(adjustedScore(holes, 8)).toBe(26)
  })

  it('caps to 7 for handicap 10–19', () => {
    // Hole 3 → 7, hole 5 → 7
    // Total = 4 + 6 + 7 + 5 + 7 = 29
    expect(adjustedScore(holes, 15)).toBe(29)
  })

  it('caps to 8 for handicap 20–29', () => {
    expect(adjustedScore(holes, 24)).toBe(4 + 6 + 8 + 5 + 8)
  })

  it('caps to 9 for handicap 30–39', () => {
    expect(adjustedScore(holes, 35)).toBe(4 + 6 + 9 + 5 + 8)
  })

  it('caps to 10 for handicap 40+', () => {
    expect(adjustedScore(holes, 45)).toBe(4 + 6 + 9 + 5 + 8)
  })

  it('does not raise scores below the cap', () => {
    const easy = [{ score: 3, par: 4 }]
    expect(adjustedScore(easy, 8)).toBe(3)
  })
})
