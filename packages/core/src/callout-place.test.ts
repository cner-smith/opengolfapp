import { describe, expect, it } from 'vitest'
import { placeAimTag, placeCallout } from './callout-place'

const base = { box: { w: 116, h: 46 }, size: { w: 600, h: 700 }, prev: null, plates: [] }

describe('placeCallout', () => {
  it('goes up and to the right when nothing is there', () => {
    const p = placeCallout({ ...base, anchor: [300, 400], end: null, dots: [[300, 400]] })
    expect([p.bx, p.by]).toEqual([330, 324])
  })

  it('steps off a leg that runs up and to the right', () => {
    const p = placeCallout({ ...base, anchor: [300, 400], end: [420, 280], dots: [[300, 400], [420, 280]] })
    expect([p.bx, p.by]).toEqual([154, 324])
  })

  it('steps off a plate up and to the right', () => {
    const p = placeCallout({ ...base, anchor: [300, 400], end: null, dots: [[300, 400]], plates: [[340, 340, 360, 360]] })
    expect([p.bx, p.by]).toEqual([154, 324])
  })

  it('stays on the map at the right edge', () => {
    const p = placeCallout({ ...base, anchor: [590, 400], end: null, dots: [[590, 400]] })
    expect(p.bx + 116).toBeLessThanOrEqual(600 - 14)
  })

  it('runs the staff from the ring toward the box', () => {
    const p = placeCallout({ ...base, anchor: [300, 400], end: null, dots: [[300, 400]] })
    expect(Math.hypot(p.foot[0] - 300, p.foot[1] - 400)).toBeCloseTo(22)
    expect(p.head).toEqual([330, 370])
  })
})

describe('placeAimTag', () => {
  const tag = { box: { w: 120, h: 50 }, size: { w: 600, h: 400 } }

  it('sits to the right of the aim, centred on it', () => {
    expect(placeAimTag({ ...tag, anchor: [300, 200] })).toEqual({ x: 314, y: 175 })
  })

  it('flips to the left when the right edge would cut it', () => {
    expect(placeAimTag({ ...tag, anchor: [500, 200] })).toEqual({ x: 366, y: 175 })
  })

  it('stays inside the top and bottom edges', () => {
    expect(placeAimTag({ ...tag, anchor: [300, 10] }).y).toBe(8)
    expect(placeAimTag({ ...tag, anchor: [300, 395] }).y).toBe(342)
  })

  it('holds the left edge when neither side fits', () => {
    expect(placeAimTag({ ...tag, size: { w: 100, h: 400 }, anchor: [50, 200] }).x).toBe(8)
  })
})
