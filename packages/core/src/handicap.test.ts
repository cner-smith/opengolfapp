import { describe, expect, it } from 'vitest'
import {
  adjustedScore,
  calculateDifferential,
  calculateHandicapIndex,
} from './handicap'

describe('calculateDifferential', () => {
  it('matches the WHS formula (84, 71.2, 124) → 11.7', () => {
    // (84 - 71.2) * 113 / 124 = 11.6645... → rounded to 11.7
    expect(calculateDifferential(84, 71.2, 124)).toBe(11.7)
  })

  it('returns negative differentials for sub-rating rounds', () => {
    expect(calculateDifferential(68, 70.5, 130)).toBeLessThan(0)
  })

  it('throws when slope is zero, negative, or non-finite', () => {
    expect(() => calculateDifferential(80, 72, 0)).toThrow()
    expect(() => calculateDifferential(80, 72, -120)).toThrow()
    expect(() => calculateDifferential(80, 72, Number.NaN)).toThrow()
  })

  it('rounds to one decimal place', () => {
    // (90 - 72) * 113 / 113 = 18.000 → 18
    expect(calculateDifferential(90, 72, 113)).toBe(18)
  })
})

describe('calculateHandicapIndex (WHS)', () => {
  it('returns null with fewer than three differentials', () => {
    expect(calculateHandicapIndex([])).toBe(null)
    expect(calculateHandicapIndex([10])).toBe(null)
    expect(calculateHandicapIndex([10, 12])).toBe(null)
  })

  it('uses lowest 1 minus 2.0 at 3 differentials', () => {
    // best 1 of [15, 12, 10] = 10; 10 - 2.0 = 8.0
    expect(calculateHandicapIndex([15, 12, 10])).toBe(8.0)
  })

  it('uses lowest 1 minus 1.0 at 4 differentials', () => {
    // best 1 of [15, 12, 11, 10] = 10; 10 - 1.0 = 9.0
    expect(calculateHandicapIndex([15, 12, 11, 10])).toBe(9.0)
  })

  it('uses lowest 1 with no adjustment at 5 differentials', () => {
    // best 1 of [10, 11, 12, 13, 14] = 10
    expect(calculateHandicapIndex([10, 11, 12, 13, 14])).toBe(10.0)
  })

  it('uses average of lowest 2 minus 1.0 at 6 differentials', () => {
    // best 2 of [10, 11, 12, 13, 14, 15] = (10 + 11) / 2 = 10.5; - 1.0 = 9.5
    expect(calculateHandicapIndex([10, 11, 12, 13, 14, 15])).toBe(9.5)
  })

  it('uses average of lowest 2 with no adjustment at 7 differentials', () => {
    // best 2 = (10 + 11) / 2 = 10.5
    expect(calculateHandicapIndex([10, 11, 12, 13, 14, 15, 16])).toBe(10.5)
  })

  it('uses average of lowest 3 at 9 differentials', () => {
    // best 3 of 9.0..17.0 = (9.0 + 10.0 + 11.0) / 3 = 10.0
    const diffs = [9.0, 10.0, 11.0, 12.0, 13.0, 14.0, 15.0, 16.0, 17.0]
    expect(calculateHandicapIndex(diffs)).toBe(10.0)
  })

  it('uses average of lowest 4 at 12 differentials', () => {
    // best 4 = (8 + 9 + 10 + 11) / 4 = 9.5
    const diffs = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
    expect(calculateHandicapIndex(diffs)).toBe(9.5)
  })

  it('uses average of lowest 8 of all 20 at 20 differentials', () => {
    const diffs = [
      8.0, 8.5, 9.1, 9.5, 10.0, 10.4, 10.8, 11.2, 11.5, 11.9,
      12.3, 12.7, 13.0, 13.4, 13.7, 14.0, 14.4, 14.8, 15.2, 15.5,
    ]
    // best 8 = (8.0 + 8.5 + 9.1 + 9.5 + 10.0 + 10.4 + 10.8 + 11.2) / 8
    //       = 77.5 / 8 = 9.6875 → 9.7
    expect(calculateHandicapIndex(diffs)).toBe(9.7)
  })

  it('uses only the most recent 20 at 25 differentials', () => {
    // First (most recent) 20 are 5..24; next 5 are 25..29 (all higher).
    // The recent-20 window's best 8 = (5+6+7+8+9+10+11+12)/8 = 8.5.
    // Without the window cap the best 8 would still be 5..12 = 8.5,
    // so to actually exercise the cap we put low values in the OLDEST
    // slots and high values in the newest 20. Reorder so the newest 20
    // are 30..49 and the oldest 5 are 1..5 — those should be ignored.
    const newest20 = Array.from({ length: 20 }, (_, i) => 30 + i) // 30..49 (most recent)
    const oldest5 = [1, 2, 3, 4, 5] // older — should be excluded
    const diffs = [...newest20, ...oldest5]
    // best 8 of recent 20 = (30+31+32+33+34+35+36+37)/8 = 33.5
    expect(calculateHandicapIndex(diffs)).toBe(33.5)
  })

  it('rounds to one decimal place', () => {
    // [10, 10, 10] → best 1 = 10; - 2.0 = 8.0
    expect(calculateHandicapIndex([10.0, 10.0, 10.0])).toBe(8.0)
  })

  it('caps the index at 54.0', () => {
    // best 1 of [60, 70, 80] = 60; - 2.0 = 58 → capped to 54.0
    expect(calculateHandicapIndex([60, 70, 80])).toBe(54.0)
  })

  it('ignores non-finite differentials', () => {
    const idx = calculateHandicapIndex([
      8,
      9,
      10,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ])
    // After filter: [8, 9, 10] — 3 valid diffs → best 1 = 8; - 2.0 = 6.0
    expect(idx).toBe(6.0)
  })

  it('does not apply the legacy 0.96 multiplier anywhere', () => {
    // Spot check: 5 diffs, lowest = 12. WHS yields 12.0, not 11.5.
    expect(calculateHandicapIndex([12, 13, 14, 15, 16])).toBe(12.0)
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
