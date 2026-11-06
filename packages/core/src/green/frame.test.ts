import { describe, expect, it } from 'vitest'
import { greenFrame, gridPointGeo } from './frame'

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
