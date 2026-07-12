import { describe, expect, it } from 'vitest'
import { tourMakePercent } from './putt-make'

describe('tourMakePercent', () => {
  it('returns exact anchor values', () => {
    expect(tourMakePercent(3)).toBe(96)
    expect(tourMakePercent(8)).toBe(50)
    expect(tourMakePercent(30)).toBe(7)
  })

  it('clamps outside the table', () => {
    expect(tourMakePercent(1)).toBe(99) // <= first anchor (2 ft)
    expect(tourMakePercent(0)).toBe(99)
    expect(tourMakePercent(80)).toBe(2) // >= last anchor (60 ft)
  })

  it('interpolates linearly between anchors', () => {
    // Between 8 ft (50) and 9 ft (45): midpoint = 47.5 → rounds to 48.
    expect(tourMakePercent(8.5)).toBe(48)
    // Between 10 ft (40) and 15 ft (23): 12.5 ft = 40 + 0.5*(23-40) = 31.5 → 32.
    expect(tourMakePercent(12.5)).toBe(32)
  })

  it('decreases monotonically with distance', () => {
    let prev = Infinity
    for (let ft = 2; ft <= 60; ft++) {
      const pct = tourMakePercent(ft)!
      expect(pct).toBeLessThanOrEqual(prev)
      prev = pct
    }
  })

  it('returns null for a non-finite distance', () => {
    expect(tourMakePercent(NaN)).toBeNull()
    expect(tourMakePercent(Infinity)).toBeNull()
  })
})
