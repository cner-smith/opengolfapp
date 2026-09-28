import { describe, expect, it } from 'vitest'
import {
  APPROACH_BASELINES,
  AROUND_GREEN_BASELINES,
  HANDICAP_BRACKETS,
  PUTTING_BASELINES,
  getHandicapBracket,
  interpolateBaseline,
  teeBaseline,
} from '../sg-baselines'

describe('teeBaseline — Broadie tee lines (#998)', () => {
  it('a tour pro (+5) sits on the PGA TOUR line 2.38 + 0.0041·d', () => {
    // bracket −5 isn't a bracket; check the line through the published anchors:
    // bracket 0 is a quarter of the way from tour to the 90-golfer (15).
    expect(teeBaseline(0, 400)).toBeCloseTo(2.38 + 0.41 * 0.25 + (0.0041 + 0.0025 * 0.25) * 400, 6)
  })

  it('the 15 bracket (90-golfer) matches Broadie 2008: 2.79 + 0.0066·d', () => {
    expect(teeBaseline(15, 400)).toBeCloseTo(2.79 + 0.0066 * 400, 6)
  })

  it('rises with distance and with handicap', () => {
    for (const b of HANDICAP_BRACKETS) expect(teeBaseline(b, 450)!).toBeGreaterThan(teeBaseline(b, 350)!)
    for (let i = 1; i < HANDICAP_BRACKETS.length; i++)
      expect(teeBaseline(HANDICAP_BRACKETS[i]!, 400)!).toBeGreaterThan(teeBaseline(HANDICAP_BRACKETS[i - 1]!, 400)!)
  })

  it('non-finite distance → null', () => {
    expect(teeBaseline(10, Number.NaN)).toBeNull()
  })
})

describe('getHandicapBracket', () => {
  // Bracket cutoffs documented in sg-baselines.ts:
  //   ≤2 → 0, ≤7 → 5, ≤12 → 10, ≤17 → 15, ≤22 → 20, ≤27 → 25, else 30.
  // Boundary tests guard against off-by-one regressions.
  it('clamps low — handicap below scratch falls into bracket 0', () => {
    expect(getHandicapBracket(-5)).toBe(0)
    expect(getHandicapBracket(0)).toBe(0)
  })

  it('clamps high — handicap above 30 falls into bracket 30', () => {
    expect(getHandicapBracket(36)).toBe(30)
    expect(getHandicapBracket(55)).toBe(30)
    expect(getHandicapBracket(100)).toBe(30)
  })

  it('exact boundary values land in the lower bracket', () => {
    expect(getHandicapBracket(2)).toBe(0)
    expect(getHandicapBracket(7)).toBe(5)
    expect(getHandicapBracket(12)).toBe(10)
    expect(getHandicapBracket(17)).toBe(15)
    expect(getHandicapBracket(22)).toBe(20)
    expect(getHandicapBracket(27)).toBe(25)
  })

  it('one above boundary moves to next bracket', () => {
    expect(getHandicapBracket(2.01)).toBe(5)
    expect(getHandicapBracket(7.01)).toBe(10)
    expect(getHandicapBracket(12.01)).toBe(15)
    expect(getHandicapBracket(17.01)).toBe(20)
    expect(getHandicapBracket(22.01)).toBe(25)
    expect(getHandicapBracket(27.01)).toBe(30)
  })

  it('one below boundary stays in current bracket', () => {
    expect(getHandicapBracket(1.99)).toBe(0)
    expect(getHandicapBracket(6.99)).toBe(5)
    expect(getHandicapBracket(11.99)).toBe(10)
    expect(getHandicapBracket(16.99)).toBe(15)
    expect(getHandicapBracket(21.99)).toBe(20)
    expect(getHandicapBracket(26.99)).toBe(25)
  })

  it('mid-range handicaps map to expected brackets', () => {
    expect(getHandicapBracket(5)).toBe(5)
    expect(getHandicapBracket(10)).toBe(10)
    expect(getHandicapBracket(15)).toBe(15)
    expect(getHandicapBracket(20)).toBe(20)
    expect(getHandicapBracket(25)).toBe(25)
    expect(getHandicapBracket(30)).toBe(30)
  })

  it('every returned bracket is a member of HANDICAP_BRACKETS', () => {
    for (const h of [-5, 0, 3, 8, 13, 18, 23, 28, 35, 100]) {
      expect(HANDICAP_BRACKETS).toContain(getHandicapBracket(h))
    }
  })
})

describe('interpolateBaseline', () => {
  const table = { 50: 2.6, 100: 2.85, 150: 3.12, 200: 3.35 }

  it('returns the exact value at a known key', () => {
    expect(interpolateBaseline(table, 50)).toBe(2.6)
    expect(interpolateBaseline(table, 100)).toBe(2.85)
    expect(interpolateBaseline(table, 200)).toBe(3.35)
  })

  it('clamps to first key when distance is below the range', () => {
    expect(interpolateBaseline(table, 25)).toBe(2.6)
    expect(interpolateBaseline(table, 0)).toBe(2.6)
    expect(interpolateBaseline(table, -10)).toBe(2.6)
  })

  it('clamps to last key when distance is above the range', () => {
    expect(interpolateBaseline(table, 250)).toBe(3.35)
    expect(interpolateBaseline(table, 1000)).toBe(3.35)
  })

  it('linearly interpolates between adjacent keys (midpoint)', () => {
    // Halfway between 100 (2.85) and 150 (3.12) → 2.985
    expect(interpolateBaseline(table, 125)).toBeCloseTo(2.985, 6)
  })

  it('linearly interpolates between adjacent keys (off-center)', () => {
    // 20% of the way from 50 (2.6) to 100 (2.85): 2.6 + 0.2*0.25 = 2.65
    expect(interpolateBaseline(table, 60)).toBeCloseTo(2.65, 6)
  })

  it('throws on an empty table', () => {
    expect(() => interpolateBaseline({}, 100)).toThrow()
  })

  it('returns null for NaN distance (prevents propagation into stored SG)', () => {
    expect(interpolateBaseline(table, Number.NaN)).toBe(null)
  })

  it('returns null for Infinity / -Infinity distance', () => {
    expect(interpolateBaseline(table, Number.POSITIVE_INFINITY)).toBe(null)
    expect(interpolateBaseline(table, Number.NEGATIVE_INFINITY)).toBe(null)
  })
})

describe('interpolateBaseline — putting baselines (feet)', () => {
  const scratch = PUTTING_BASELINES[0]

  // Concrete value pins — sourced from sg-baselines.ts. Catches a
  // table-edit regression. Not a tautology because we're asserting
  // documented baselines, not just "table value matches itself".
  it('scratch from 3 ft has expected ≈ 1.03 strokes', () => {
    expect(interpolateBaseline(scratch, 3)).toBe(1.03)
  })

  it('scratch from 10 ft has expected ≈ 1.37 strokes', () => {
    expect(interpolateBaseline(scratch, 10)).toBe(1.37)
  })

  it('scratch from 60 ft has expected ≈ 2.18 strokes', () => {
    expect(interpolateBaseline(scratch, 60)).toBe(2.18)
  })

  it('5 ft is harder for higher handicap brackets — strictly monotone', () => {
    // Same distance, scratch < 30-handicap (lower expected = closer to
    // holed). Seed prev to a known floor instead of -Infinity so the
    // first bracket is bounded too.
    let prev = 0
    for (const h of HANDICAP_BRACKETS) {
      const expected = interpolateBaseline(PUTTING_BASELINES[h], 5)
      if (expected === null) throw new Error('expected finite baseline')
      expect(expected).toBeGreaterThan(prev)
      prev = expected
    }
  })

  it('further putts always need strictly more strokes (within a bracket)', () => {
    // For a single bracket, expected strokes grow with distance. Use
    // strict > to surface a flat-table regression that ≥ would miss.
    let prev = 0
    for (const dist of [3, 5, 8, 10, 15, 20, 30, 40, 60]) {
      const e = interpolateBaseline(scratch, dist)
      if (e === null) throw new Error('expected finite baseline')
      expect(e).toBeGreaterThan(prev)
      prev = e
    }
  })
})

describe('interpolateBaseline — approach baselines (yards)', () => {
  const scratch = APPROACH_BASELINES[0]

  it('scratch approach from 50 yd ≈ 2.60 strokes', () => {
    expect(interpolateBaseline(scratch, 50)).toBe(2.6)
  })

  it('scratch approach from 150 yd ≈ 3.12 strokes', () => {
    expect(interpolateBaseline(scratch, 150)).toBe(3.12)
  })

  it('scratch approach from 225 yd ≈ 3.45 strokes (table max)', () => {
    expect(interpolateBaseline(scratch, 225)).toBe(3.45)
  })

  it('30 yd clamps to the 50 yd value (table minimum)', () => {
    expect(interpolateBaseline(scratch, 30)).toBe(scratch[50])
  })

  it('reads past 225 yd (#998: used to clamp there) and clamps at 600', () => {
    expect(interpolateBaseline(scratch, 300)).toBe(scratch[300])
    expect(scratch[300]).toBeGreaterThan(scratch[225]!)
    expect(interpolateBaseline(scratch, 700)).toBe(scratch[600])
  })

  it('every bracket is non-decreasing from 50 to 600 yd', () => {
    for (const b of HANDICAP_BRACKETS) {
      const row = APPROACH_BASELINES[b]
      const keys = Object.keys(row).map(Number).sort((x, y) => x - y)
      expect(keys.at(-1)).toBe(600)
      for (let i = 1; i < keys.length; i++) expect(row[keys[i]!]).toBeGreaterThanOrEqual(row[keys[i - 1]!]!)
    }
  })

  it('150 yd interp is strictly monotone across handicap brackets', () => {
    // Worse handicap → higher expected strokes from 150 yd. Seed prev
    // to a finite floor so the first bracket is bounded.
    let prev = 0
    for (const h of HANDICAP_BRACKETS) {
      const e = interpolateBaseline(APPROACH_BASELINES[h], 150)
      if (e === null) throw new Error('expected finite baseline')
      expect(e).toBeGreaterThan(prev)
      prev = e
    }
  })
})

describe('interpolateBaseline — around-green baselines (yards)', () => {
  const scratch = AROUND_GREEN_BASELINES[0]

  it('scratch around-green from 5 yd ≈ 2.18 strokes', () => {
    expect(interpolateBaseline(scratch, 5)).toBe(2.18)
  })

  it('scratch around-green from 30 yd ≈ 2.60 strokes', () => {
    expect(interpolateBaseline(scratch, 30)).toBe(2.6)
  })

  it('meets approach@50 at the 30-yd hand-over, never above it (#632)', () => {
    for (const b of HANDICAP_BRACKETS) {
      const ag = AROUND_GREEN_BASELINES[b]
      expect(ag[30]).toBe(APPROACH_BASELINES[b][50])
      const keys = Object.keys(ag).map(Number).sort((x, y) => x - y)
      for (let i = 1; i < keys.length; i++) expect(ag[keys[i]!]!).toBeGreaterThan(ag[keys[i - 1]!]!)
    }
  })

  it('40 yd clamps to 30 yd value (around-green tops out at 30)', () => {
    // Anything past 30 yd is "approach" by getShotCategory anyway;
    // this is just defensive.
    expect(interpolateBaseline(scratch, 40)).toBe(scratch[30])
  })

  it('between 5 and 10 interpolates smoothly', () => {
    const a = scratch[5]!
    const b = scratch[10]!
    // 7 yd is 40% of the way from 5 → 10
    const expected = a + 0.4 * (b - a)
    expect(interpolateBaseline(scratch, 7)).toBeCloseTo(expected, 6)
  })
})
