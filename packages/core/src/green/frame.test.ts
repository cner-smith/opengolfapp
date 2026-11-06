import { describe, expect, it } from 'vitest'
import { greenApproach, greenFrame, greenMiddle, gridCorners, gridPointGeo } from './frame'

const LAT0 = 35.6
const LNG0 = -97.6
const M_PER_DEG = 111_320
const KX = M_PER_DEG * Math.cos((LAT0 * Math.PI) / 180)
const O = { lat: LAT0, lng: LNG0 }
// Metres east (x) and north (y) of O.
const geo = (x: number, y: number) => ({ lat: LAT0 + y / M_PER_DEG, lng: LNG0 + x / KX })

describe('greenFrame', () => {
  it('approached from the south: north is forward, east is right', () => {
    const f = greenFrame(O, 0)
    expect(f.toLocal(geo(0, 10)).y).toBeCloseTo(10, 6)
    expect(f.toLocal(geo(0, 10)).x).toBeCloseTo(0, 6)
    expect(f.toLocal(geo(10, 0)).x).toBeCloseTo(10, 6)
    expect(f.toLocal(geo(10, 0)).y).toBeCloseTo(0, 6)
  })

  it('approached from the west (travelling east): east is forward, south is right', () => {
    const f = greenFrame(O, 90)
    expect(f.toLocal(geo(10, 0)).y).toBeCloseTo(10, 6)
    expect(f.toLocal(geo(10, 0)).x).toBeCloseTo(0, 6)
    expect(f.toLocal(geo(0, -10)).x).toBeCloseTo(10, 6)
  })

  it('round-trips a point through local metres', () => {
    const f = greenFrame(O, 37)
    const p = geo(12, -7)
    const l = f.toLocal(p)
    const back = f.toGeo(l.x, l.y)
    expect(back.lat).toBeCloseTo(p.lat, 10)
    expect(back.lng).toBeCloseTo(p.lng, 10)
  })
})

describe('gridPointGeo', () => {
  it('steps east and south from the centre of cell (0,0)', () => {
    const p = gridPointGeo(LNG0, LAT0, 10, 5)
    expect(p.lng).toBeCloseTo(LNG0 + 10 / KX, 10)
    expect(p.lat).toBeCloseTo(LAT0 - 5 / M_PER_DEG, 10)
  })
})

describe('greenMiddle', () => {
  it('averages the ring’s corners, counting a closing point once', () => {
    const m = greenMiddle([geo(0, 0), geo(10, 0), geo(10, 20), geo(0, 20), geo(0, 0)])
    expect(m.lat).toBeCloseTo(geo(5, 10).lat, 10)
    expect(m.lng).toBeCloseTo(geo(5, 10).lng, 10)
  })
})

describe('greenApproach', () => {
  const RING = [geo(0, 0), geo(10, 0), geo(10, 20), geo(0, 20), geo(0, 0)]
  it('bears from the newest start off the green to the green’s middle', () => {
    // The newest start, (5, -40), is due south of the middle (5, 10): travelling north.
    expect(greenApproach(RING, [geo(5, -200), geo(5, -40)])).toBeCloseTo(0, 3)
    // From due west of the middle: travelling east.
    expect(greenApproach(RING, [geo(5, -200), geo(-40, 10)])).toBeCloseTo(90, 3)
  })

  it('skips starts on the green', () => {
    expect(greenApproach(RING, [geo(-40, 10), geo(5, 15)])).toBeCloseTo(90, 3)
  })

  it('is null with no start off the green', () => {
    expect(greenApproach(RING, [geo(5, 15)])).toBeNull()
    expect(greenApproach(RING, [])).toBeNull()
  })
})

describe('gridCorners', () => {
  it('puts the image edges half a cell outside the cell centres', () => {
    expect(gridCorners(4, 2)).toEqual([[-0.25, -0.25], [1.75, -0.25], [1.75, 0.75], [-0.25, 0.75]])
  })
})
