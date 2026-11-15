import { describe, expect, it } from 'vitest'
import { aimGrid, bracketLabelAt, ringBracket, teeAxis, teeBreakFor, teeView, type TeePlotBox } from './pattern-charts'
import { cubic } from './shot-flight'
import { computeDispersionStats, ringExtent, type DispersionPoint } from './shot-patterns'

const M = 1 / 0.9144 // yards per metre

function pt(lat: number, dist: number): DispersionPoint {
  return { id: `${lat},${dist}`, lateralOffsetYards: lat, distanceOffsetYards: dist } as DispersionPoint
}
const spread = (avgLat: number, avgDist: number, lat: number, dist: number) => ({
  avgLateralOffset: avgLat,
  avgDistanceOffset: avgDist,
  cone95: { lateral: lat, distance: dist },
  cone68: { lateral: lat * 0.6, distance: dist * 0.6 },
})
const straight = (x: number, y: number) => cubic({ x: 0, y: 0 }, { x: x / 3, y: y / 3 }, { x: (2 * x) / 3, y: (2 * y) / 3 }, { x, y })

const BOX: TeePlotBox = { left: 40, right: 340, top: 16, teeY: 480, minBandPx: 64 }

describe('cone95 is the 95% ring\'s upright extent', () => {
  it('so reading cone95 (web) and ringExtent(ring95) (the app) draw the same box', () => {
    // A tilted scatter: the ring's bounding half-extent is k·σ on each axis.
    const s = computeDispersionStats([pt(-12, -9), pt(-4, -2), pt(1, 3), pt(6, 2), pt(14, 11), pt(3, -6)])!
    const e = ringExtent(s.ring95)
    expect(s.ring95.rotationDeg).not.toBe(0)
    expect(e.x).toBeCloseTo(s.cone95.lateral, 9)
    expect(e.y).toBeCloseTo(s.cone95.distance, 9)
    expect(s.ring95.cx).toBe(s.avgLateralOffset)
  })
})

describe('teeBreakFor', () => {
  it('is a round 25 at 82% of the nearest finish, ring near edge or aim', () => {
    // finishes 210 and 190, aim 200: low 190 → floor(155.8 / 25)·25 = 150
    expect(teeBreakFor([pt(-10, 10), pt(10, -10)], null, 200, 1)).toBe(150)
    // the ring's near edge 200 − 5 − 30 = 165 is nearer: floor(135.3 / 25)·25 = 125
    expect(teeBreakFor([pt(-10, 10), pt(10, -10)], spread(0, -5, 8, 30), 200, 1)).toBe(125)
  })
})

describe('teeView', () => {
  // Two finishes 10 yd either side, aim 200: brk 150, maxY = 210 + 4 = 214.
  // Wedge to the break: tan 4° · 150 = 10.489. Flight points past the break
  // reach ±10; xs span ±10.489 → halfW = 10.489 · 1.08 = 11.328.
  // H = 480 − 16 = 464, wide = 150 / 11.328 = 13.241.
  // steep = min(464 / (64 + 150/3), wide) = 464 / 114 = 4.070175.
  // comp = max(64, 4.070175 · 150 / 3) = 203.509, scale = (464 − 203.509) / 64 = 4.070175.
  const view = teeView(
    { points: [pt(-10, 10), pt(10, -10)], flights: [straight(-10, 210), straight(10, 190)], stats: null, ghost: null, avgAim: 200, yardsPerUnit: 1 },
    BOX,
  )

  it('hand-worked: break, extents, band and scale', () => {
    expect(view.brk).toBe(150)
    expect(view.maxY).toBe(214)
    expect(view.centre).toBeCloseTo(0, 9)
    expect(view.scale).toBeCloseTo(464 / 114, 6)
    expect(view.comp).toBeCloseTo((464 / 114) * 50, 6)
    expect(view.wedge.d).toBe(150)
    expect(view.wedge.x).toBeCloseTo(10.489, 3)
  })

  it('hand-worked: the tee sits on teeY, the break on teeY − comp, maxY on the top edge', () => {
    expect(view.y(0)).toBe(480)
    expect(view.y(150)).toBeCloseTo(480 - 203.509, 3)
    expect(view.y(214)).toBeCloseTo(16, 6)
    // below the break: comp · (75 / 150)^3 = 203.509 / 8 = 25.439
    expect(view.y(75)).toBeCloseTo(480 - 25.439, 3)
    // across at the true scale round the centre (40 + 340) / 2 = 190
    expect(view.x(10)).toBeCloseTo(190 + 40.70175, 4)
  })

  it('the curve meets the true scale at the break with the same slope', () => {
    const e = 1e-4
    const below = (view.y(150) - view.y(150 - e)) / e
    const above = (view.y(150 + e) - view.y(150)) / e
    expect(below).toBeCloseTo(-view.scale, 3)
    expect(above).toBeCloseTo(-view.scale, 3)
  })

  it('never bends the shortened stretch past power 3, on a wide or a long pattern', () => {
    for (const [lat, dist, aim] of [
      [60, 0, 240],
      [5, 40, 280],
      [0, 0, 120],
      [25, -30, 160],
    ] as const) {
      const v = teeView(
        { points: [pt(-lat, dist), pt(lat, -dist)], flights: [straight(-lat, aim + dist), straight(lat, aim - dist)], stats: null, ghost: null, avgAim: aim, yardsPerUnit: 1 },
        BOX,
      )
      expect(v.brk).toBeGreaterThan(0)
      expect((v.scale * v.brk) / v.comp).toBeLessThanOrEqual(3 + 1e-9)
      expect(v.comp).toBeGreaterThanOrEqual(64)
    }
  })

  it('a short pattern is not shortened: one straight scale from the tee', () => {
    // finishes 75 and 85: brk 0; maxY 85 + 4 = 89; scale = min(464 / 89, wide)
    const v = teeView(
      { points: [pt(0, -5), pt(0, 5)], flights: [straight(0, 75), straight(0, 85)], stats: null, ghost: null, avgAim: 80, yardsPerUnit: 1 },
      BOX,
    )
    expect(v.brk).toBe(0)
    expect(v.comp).toBe(0)
    expect(v.scale).toBeCloseTo(464 / 89, 6)
    expect(v.y(50)).toBeCloseTo(480 - 50 * (464 / 89), 6)
    // no break: the wedge runs to 35% of the aim, 28 yd
    expect(v.wedge.d).toBeCloseTo(28, 9)
  })

  it('holds the ghost ring too, pads across by 1.08 and 4 display units past the farthest edge', () => {
    // ghost far edge 200 + 10 + 30 = 240 → maxY 244 (web left the ghost out: 210 + 6 = 216)
    const v = teeView(
      { points: [pt(-10, 10), pt(10, -10)], flights: [straight(-10, 210), straight(10, 190)], stats: null, ghost: spread(0, 10, 60, 30), avgAim: 200, yardsPerUnit: 1 },
      BOX,
    )
    expect(v.maxY).toBe(244)
    // ghost across ±60 → halfW 64.8, wide = 150 / 64.8 = 2.3148 binds:
    // steep = min(464 / (94 + 50), 2.3148) = 2.3148, comp = max(64, 115.7),
    // scale = min(348.3 / 94, 2.3148). Web: halfW 10.489 · 1.1, no ghost.
    expect(v.scale).toBeCloseTo(150 / 64.8, 9)
    // metres: 4 m = 4.374 yd past the finish
    const m = teeView(
      { points: [pt(0, 0)], flights: [straight(0, 200)], stats: null, ghost: null, avgAim: 200, yardsPerUnit: M },
      BOX,
    )
    expect(m.maxY).toBeCloseTo(200 + 4 * M, 9)
  })
})

describe('teeView across', () => {
  it('the start-line wedge always fits, and only flights past the break set the width', () => {
    // Every finish on the aim line at 250: brk = floor(205 / 25)·25 = 200, wedge
    // tan 4° · 200 = 13.985 → halfW 15.104. A narrow 100 px plot: wide = 50 / 15.104
    // = 3.310 under steep 464 / (254 − 200 + 66.7) = 3.845, so the width binds.
    // The flight's 30 yd swing at 100 yd sits below the break and doesn't count.
    const v = teeView(
      { points: [pt(0, 0)], flights: [[{ x: 0, y: 0 }, { x: 30, y: 100 }, { x: 0, y: 250 }]], stats: null, ghost: null, avgAim: 250, yardsPerUnit: 1 },
      { ...BOX, right: 140 },
    )
    expect(v.brk).toBe(200)
    expect(v.scale).toBeCloseTo(50 / (Math.tan((4 * Math.PI) / 180) * 200 * 1.08), 9)
  })
})

describe('teeAxis', () => {
  // ruleStep: 5 if 5 units ≥ 14 px, 10 if 10 units ≥ 12 px, else 25.
  // labelStep: 10 if 10 units ≥ 26 px, 25 if 25 units ≥ 26 px, else 50.
  // barStep: 10 if 10 units ≥ 30 px, else 25.
  it.each([
    // scale px/yd → 5u / 10u / 25u in px; rule, label, bar
    [4.07, 5, 10, 10], // 20.4 / 40.7 / 101.8
    [2.5, 10, 25, 25], // 12.5 / 25 / 62.5 (the app labelled every 10 here: 25 ≥ 24)
    [1.5, 10, 25, 25], // 7.5 / 15 / 37.5
    [1.0, 25, 50, 25], // 5 / 10 / 25
  ])('scale %s px/yd: rule %s, label %s, bar %s', (scale, rule, label, bar) => {
    const a = teeAxis(scale, 0, 100, 1)
    expect([a.ruleStep, a.labelStep, a.barStep]).toEqual([rule, label, bar])
  })

  it('rules run from the first step past the break to maxY, in display units', () => {
    // brk 150, maxY 214, step 5: ceil(151 / 5) · 5 = 155 … 210; labels every 10
    const a = teeAxis(4.07, 150, 214, 1)
    expect(a.rules.map((r) => r.d)).toEqual([155, 160, 165, 170, 175, 180, 185, 190, 195, 200, 205, 210])
    expect(a.rules.filter((r) => r.label).map((r) => r.d)).toEqual([160, 170, 180, 190, 200, 210])
  })

  it('metres: steps counted in metres, rules past a 125 m break', () => {
    // 5 m = 5.468 yd · 3 px = 16.4 ≥ 14 → 5; 10 m · 3 = 32.8 → label 10, bar 10.
    // brk 125 m = 136.70 yd, maxY 160 m: ceil(126 / 5) · 5 = 130 … 160
    const a = teeAxis(3, 125 * M, 160 * M, M)
    expect([a.ruleStep, a.labelStep, a.barStep]).toEqual([5, 10, 10])
    expect(a.rules.map((r) => r.d)).toEqual([130, 135, 140, 145, 150, 155, 160])
  })
})

describe('aimGrid', () => {
  it('hand-worked: reach 20 yd in a 300 px square', () => {
    // reach max(20, 12, 8, 5, 10) = 20 → ceil(21.6 / 5) · 5 = 25; scale 150 / 25 = 6.
    // step: 5 · 6 = 30 ≥ 14 → 5; labels: 30 ≥ 19 → every 5.
    const g = aimGrid([pt(12, -20), pt(-5, 8)], null, null, 1, 300)
    expect(g.halfUnits).toBe(25)
    expect(g.half).toBe(25)
    expect(g.scale).toBe(6)
    expect(g.step).toBe(5)
    expect(g.rules.map((r) => r.v)).toEqual([-25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25])
    expect(g.rules.filter((r) => r.major).map((r) => r.v)).toEqual([-20, -10, 0, 10, 20])
    expect(g.rules.filter((r) => r.label).map((r) => r.v)).toEqual([-20, -15, -10, -5, 5, 10, 15, 20])
  })

  it('10-unit squares on an odd half-width: rules stay on the zero lines and inside the grid', () => {
    // reach 60 → ceil(64.8 / 5) · 5 = 65; scale 150 / 65 = 2.308; 5 · 2.308 = 11.5 < 14 → 10.
    // labels: 10 · 2.308 = 23.1 ≥ 19 → every 10. Web drew ±70 past the edge;
    // the app ruled −65, −55 … and lost the zero lines and every label.
    const g = aimGrid([pt(60, 0)], null, null, 1, 300)
    expect(g.halfUnits).toBe(65)
    expect(g.step).toBe(10)
    expect(g.rules.map((r) => r.v)).toEqual([-60, -50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50, 60])
    expect(g.rules.every((r) => r.major)).toBe(true)
    expect(g.rules.filter((r) => r.label).map((r) => r.v)).toEqual([-60, -50, -40, -30, -20, -10, 10, 20, 30, 40, 50, 60])
  })

  it('5-unit squares need 14 px, labels on every square need 19 px', () => {
    // reach 50 → ceil(54 / 5) · 5 = 55; scale 150 / 55 = 2.727; 5 · 2.727 = 13.6 < 14 → 10
    const a = aimGrid([pt(50, 0)], null, null, 1, 300)
    expect(a.step).toBe(10)
    expect(a.rules.map((r) => r.v)).toEqual([-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50])
    // reach 74 → ceil(79.9 / 5) · 5 = 80; scale 1.875; 10 · 1.875 = 18.75 < 19 → every 20
    const b = aimGrid([pt(74, 0)], null, null, 1, 300)
    expect(b.step).toBe(10)
    expect(b.rules.filter((r) => r.label).map((r) => r.v)).toEqual([-60, -40, -20, 20, 40, 60])
  })

  it('labels every other rule when a square is under 19 px', () => {
    // reach 80 → ceil(86.4 / 5) · 5 = 90; scale 150 / 90 = 1.667; 5 → 8.3 < 14 → 10; 16.7 < 19 → every 20
    const g = aimGrid([pt(0, 80)], null, null, 1, 300)
    expect(g.step).toBe(10)
    expect(g.rules.filter((r) => r.label).map((r) => r.v)).toEqual([-80, -60, -40, -20, 20, 40, 60, 80])
  })

  it('holds both 95% rings, the ghost at full size', () => {
    // stats: |2| + 10 = 12 across, |−3| + 15 = 18 deep; ghost 0 + 30 = 30 deep.
    // reach 30 → ceil(32.4 / 5) · 5 = 35 (web shrank the ghost to ×0.66: 19.8 → 25)
    const g = aimGrid([pt(1, 1)], spread(2, -3, 10, 15), spread(0, 0, 8, 30), 1, 300)
    expect(g.halfUnits).toBe(35)
  })

  it('metres: the 10-unit floor is 10 m and the half-width rounds to 5 m', () => {
    // no shots: reach 10 m → ceil(10.8 / 5) · 5 = 15 m (web floored at 10 yd = 9.1 m → 10 m)
    const g = aimGrid([], null, null, M, 300)
    expect(g.halfUnits).toBe(15)
    expect(g.half).toBeCloseTo(15 * M, 9)
    // 20 yd = 18.29 m · 1.08 = 19.75 → 20 m
    expect(aimGrid([pt(20, 0)], null, null, M, 300).halfUnits).toBe(20)
  })
})

describe('aim brackets', () => {
  it('span the average ± the 68% half-width and half-depth', () => {
    // px = 100 + 2·lat, py = 200 − 2·dist; avg (3, −4), cone68 (6, 9)
    const b = ringBracket(spread(3, -4, 10, 15), (l) => 100 + 2 * l, (d) => 200 - 2 * d)
    // cone68 here = 0.6 · cone95 = (6, 9): l = 100 + 2·(3 − 6) = 94, r = 118, t = 200 − 2·5 = 190, b = 226
    expect(b).toEqual({ l: 94, r: 118, t: 190, b: 226 })
  })

  it('labels sit at the middle of each bracket, kept clear of the corners', () => {
    const area = { left: 50, top: 12, size: 300 }
    expect(bracketLabelAt({ l: 150, r: 210, t: 100, b: 160 }, area)).toEqual({ acrossX: 180, deepY: 130 })
    // clamps: across in [98, 302], deep in [26, 296]
    expect(bracketLabelAt({ l: 40, r: 60, t: 0, b: 10 }, area)).toEqual({ acrossX: 98, deepY: 26 })
    expect(bracketLabelAt({ l: 330, r: 350, t: 300, b: 330 }, area)).toEqual({ acrossX: 302, deepY: 296 })
  })
})
