import { describe, expect, it } from 'vitest'
import { paceLines } from './pace-lines'

// Same shapes as pin-sheet.test.ts: metres east (x) and north (y) of a point in Oklahoma.
const LAT0 = 35.6
const LNG0 = -97.6
const M_PER_DEG = 111_320
const KX = M_PER_DEG * Math.cos((LAT0 * Math.PI) / 180)
const geo = ([x, y]: [number, number]) => ({ lat: LAT0 + y / M_PER_DEG, lng: LNG0 + x / KX })
const back = (p: { lat: number; lng: number }): [number, number] => [(p.lng - LNG0) * KX, (p.lat - LAT0) * M_PER_DEG]
const YD = 0.9144

const RECT = [[0, 0], [30, 0], [30, 20], [0, 20], [0, 0]].map((p) => geo(p as [number, number]))
const C = [[0, 0], [30, 0], [30, 8], [10, 8], [10, 20], [30, 20], [30, 30], [0, 30], [0, 0]].map((p) =>
  geo(p as [number, number]),
)

describe('paceLines', () => {
  it('crosses a rectangle every 5 paces from the front edge, edge to edge', () => {
    // From the south the front edge is y = 0. Lines at 5, 10, 15, 20 paces =
    // 4.572, 9.144, 13.716, 18.288 m; 25 paces (22.86 m) is past the back (20 m).
    const lines = paceLines(RECT, geo([5, 8]), 0)
    expect(lines).toHaveLength(4)
    lines.forEach((seg, i) => {
      const [a, b] = seg.map(back)
      expect(a![1]).toBeCloseTo((i + 1) * 5 * YD, 4)
      expect(b![1]).toBeCloseTo((i + 1) * 5 * YD, 4)
      expect(Math.min(a![0], b![0])).toBeCloseTo(0, 4)
      expect(Math.max(a![0], b![0])).toBeCloseTo(30, 4)
    })
  })

  it('counts from the front edge that brackets the pin on a concave green', () => {
    // Pin on the C's back arm: the front edge on its line is y = 20, so lines
    // sit at 24.572 and 29.144 m (33.716 is past the back at 30).
    const lines = paceLines(C, geo([22, 24]), 0)
    expect(lines.map((s) => back(s[0]!)[1])).toEqual([expect.closeTo(20 + 5 * YD, 4), expect.closeTo(20 + 10 * YD, 4)])
  })

  it('splits a line where it leaves the green and comes back', () => {
    // Pin on the front arm (front edge y = 0). The line at 9.144 m runs through
    // the C's spine only (x 0–10); the notch is open to the east.
    const lines = paceLines(C, geo([22, 4]), 0)
    const at = lines.filter((s) => Math.abs(back(s[0]!)[1] - 2 * 5 * YD) < 1e-3)
    expect(at).toHaveLength(1)
    const xs = at[0]!.map((p) => back(p)[0]).sort((a, b) => a - b)
    expect(xs[0]).toBeCloseTo(0, 4)
    expect(xs[1]).toBeCloseTo(10, 4)
  })

  it('is empty when the pin is off the green', () => {
    expect(paceLines(RECT, geo([40, 8]), 0)).toEqual([])
  })
})
