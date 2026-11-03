import { describe, expect, it } from 'vitest'
import { placeCallout } from './callout-place'

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
