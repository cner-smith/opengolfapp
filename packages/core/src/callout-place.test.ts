import { describe, expect, it } from 'vitest'
import { placeAimTag, placeCallout, placeLoupe } from './callout-place'

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

describe('placeLoupe', () => {
  // A 400 × 700 map, a 65 radius loupe: it stands 155 above the finger.
  const q = { r: 65, size: { w: 400, h: 700 }, keepOut: [] as { left: number; top: number; right: number; bottom: number }[], away: -1 as const }

  it('stands straight above the finger when nothing is there', () => {
    expect(placeLoupe({ ...q, finger: [200, 400] })).toEqual([200, 245])
  })

  it('slides in from a side edge instead of leaving the map', () => {
    expect(placeLoupe({ ...q, finger: [30, 400] })).toEqual([73, 245])
  })

  it('steps away from the tags when the remaining tag is above the finger', () => {
    // The tag starts on the line and runs right; the loupe goes up and left.
    const tag = { left: 200, top: 220, right: 330, bottom: 270 }
    expect(placeLoupe({ ...q, finger: [200, 400], keepOut: [tag] })).toEqual([123, 245])
    // Lefty: tags run left, so it goes up and right.
    const left = { left: 70, top: 220, right: 200, bottom: 270 }
    expect(placeLoupe({ ...q, finger: [200, 400], keepOut: [left], away: 1 })).toEqual([277, 245])
  })

  it('goes beside the finger near the top, never over the Mapbox logo', () => {
    // Finger near the top-left: above is off the map. Beside it to the left
    // runs off the map too, so it goes right; a logo there pushes it below.
    expect(placeLoupe({ ...q, finger: [100, 120] })).toEqual([255, 120])
    const logo = { left: 0, top: 0, right: 400, bottom: 200 }
    expect(placeLoupe({ ...q, finger: [100, 120], keepOut: [logo] })).toEqual([100, 275])
  })

  it('takes the spot touching the fewest boxes when none is clear', () => {
    const all = { left: 0, top: 0, right: 400, bottom: 700 }
    expect(placeLoupe({ ...q, finger: [200, 400], keepOut: [all] })).toEqual([200, 245])
  })
})
