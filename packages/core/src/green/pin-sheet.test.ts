import { describe, expect, it } from 'vitest'
import { pinSheet } from './pin-sheet'

// Shapes are drawn in metres east (x) and north (y) of a point in Oklahoma,
// then turned into lat/lng with the same flat-earth step the code uses.
const LAT0 = 35.6
const LNG0 = -97.6
const M_PER_DEG = 111_320
const geo = ([x, y]: [number, number]) => ({
  lat: LAT0 + y / M_PER_DEG,
  lng: LNG0 + x / (M_PER_DEG * Math.cos((LAT0 * Math.PI) / 180)),
})
const ring = (pts: [number, number][]) => pts.map(geo)
const YD = 0.9144

// 30 m wide (x) by 20 m deep (y).
const RECT = ring([[0, 0], [30, 0], [30, 20], [0, 20], [0, 0]])
// A "C" opening east: a front arm (y 0–8), a back arm (y 20–30), joined on the west (x 0–10).
const C = ring([[0, 0], [30, 0], [30, 8], [10, 8], [10, 20], [30, 20], [30, 30], [0, 30], [0, 0]])

describe('pinSheet', () => {
  it('measures a rectangle approached from the south', () => {
    const m = pinSheet(RECT, geo([5, 8]), 0)!
    expect(m.onPaces).toBeCloseTo(8 / YD, 3)
    expect(m.side).toBe('left')
    expect(m.sidePaces).toBeCloseTo(5 / YD, 3)
  })

  it('turns with the approach: from the west, the west edge is the front and north is left', () => {
    const m = pinSheet(RECT, geo([5, 14]), 90)!
    expect(m.onPaces).toBeCloseTo(5 / YD, 3)
    expect(m.side).toBe('left')
    expect(m.sidePaces).toBeCloseTo(6 / YD, 3)
  })

  it('uses the crossings that bracket the pin on a concave green', () => {
    // On the back arm, the approach line through the pin crosses the outline at
    // y = 0, 8, 20 and 30. The front edge is 20, not the green's front at 0.
    const m = pinSheet(C, geo([22, 24]), 0)!
    expect(m.onPaces).toBeCloseTo(4 / YD, 3)
    expect(m.side).toBe('right')
    expect(m.sidePaces).toBeCloseTo(8 / YD, 3)
  })

  it('brackets the side edge too: from the east, the left (south) line crosses y = 20, 8 and 0', () => {
    const m = pinSheet(C, geo([22, 22]), 270)!
    expect(m.onPaces).toBeCloseTo(8 / YD, 3)
    expect(m.side).toBe('left')
    expect(m.sidePaces).toBeCloseTo(2 / YD, 3)
  })

  it('takes the nearest side across the C’s spine', () => {
    const m = pinSheet(C, geo([4, 14]), 0)!
    expect(m.onPaces).toBeCloseTo(14 / YD, 3)
    expect(m.side).toBe('left')
    expect(m.sidePaces).toBeCloseTo(4 / YD, 3)
  })

  it('counts in the pace length it is given', () => {
    expect(pinSheet(RECT, geo([5, 8]), 0, 0.8)!.onPaces).toBeCloseTo(10, 3)
  })

  it.each([
    ['outside the outline', [40, 8]],
    ['in the C’s open notch', [20, 14]],
    ['on the outline', [0, 8]],
  ] as [string, [number, number]][])('is null with the pin %s', (_, p) => {
    expect(pinSheet(C, geo(p), 0)).toBeNull()
  })
})
