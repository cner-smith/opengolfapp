import { describe, expect, it } from 'vitest'
import type { GreenGrid } from './codec'
import { clipGreenGrid, greenApproach, greenFrame, greenMiddle, gridCorners, gridPointGeo } from './frame'

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

describe('clipGreenGrid', () => {
  // 6×4 cells, all surveyed except (row 0, col 5); heights = cell index.
  const W = 6, H = 4
  const g: GreenGrid = {
    width: W, height: H, stepMm: 2, zMinMm: 0,
    mask: Uint8Array.from({ length: W * H }, (_, j) => (j === 5 ? 0 : 1)),
    heightsMm: Float64Array.from({ length: W * H }, (_, j) => (j === 5 ? NaN : j)),
  }
  // Cell (r, c) centre is c·0.5 m east, r·0.5 m south of O. This box holds columns 1–5 of rows 1–2.
  const box = [geo(0.25, -0.25), geo(2.75, -0.25), geo(2.75, -1.25), geo(0.25, -1.25)]

  it('keeps surveyed cells whose centre is inside the outline, with their heights', () => {
    const out = clipGreenGrid(g, LNG0, LAT0, box)
    const kept = [...out.mask].flatMap((m, j) => (m ? [j] : []))
    expect(kept).toEqual([7, 8, 9, 10, 11, 13, 14, 15, 16, 17])
    expect(kept.map((j) => out.heightsMm[j])).toEqual(kept)
    expect(out.heightsMm[0]).toBeNaN()
    expect([out.width, out.height, out.stepMm, out.zMinMm]).toEqual([W, H, 2, 0])
  })

  it('never turns on an unsurveyed cell and leaves the input alone', () => {
    const all = [geo(-1, 1), geo(5, 1), geo(5, -5), geo(-1, -5)]
    const out = clipGreenGrid(g, LNG0, LAT0, all)
    expect([...out.mask]).toEqual([...g.mask])
    expect(g.mask[5]).toBe(0)
    expect(clipGreenGrid(g, LNG0, LAT0, box).mask).not.toBe(g.mask)
  })

  it('drops every cell when the outline is elsewhere', () => {
    const away = [geo(50, 50), geo(60, 50), geo(60, 40), geo(50, 40)]
    expect(clipGreenGrid(g, LNG0, LAT0, away).mask.some((m) => m)).toBe(false)
  })
})

describe('clipGreenGrid on a slanted edge', () => {
  it('cuts along the outline, not its bounding box', () => {
    const g: GreenGrid = { width: 6, height: 4, stepMm: 2, zMinMm: 0, mask: new Uint8Array(24).fill(1), heightsMm: new Float64Array(24) }
    // Hypotenuse from 2.75 m east, 0.25 m south to 0.25 m east, 1.25 m south.
    const tri = [geo(0.25, -0.25), geo(2.75, -0.25), geo(0.25, -1.25)]
    const out = clipGreenGrid(g, LNG0, LAT0, tri)
    expect([...out.mask].flatMap((m, j) => (m ? [j] : []))).toEqual([7, 8, 9, 10, 13])
  })
})
