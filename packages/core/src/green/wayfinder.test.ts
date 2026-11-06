import { describe, expect, it } from 'vitest'
import type { GeoPoint } from '../shot-dispersion-geo'
import { viewPoint, wayfinder, type WayfinderInput } from './wayfinder'

const LAT0 = 35.6
const LNG0 = -97.6
const M_PER_DEG = 111_320
const KX = M_PER_DEG * Math.cos((LAT0 * Math.PI) / 180)
const PIN = { lat: LAT0, lng: LNG0 }
// Metres east (x) and north (y) of the pin.
const geo = (x: number, y: number): GeoPoint => ({ lat: LAT0 + y / M_PER_DEG, lng: LNG0 + x / KX })
// A north-up test map: the pin at (200, 300), 4 px to the metre.
const flat = (p: GeoPoint): [number, number] => [
  200 + (p.lng - LNG0) * KX * 4,
  300 - (p.lat - LAT0) * M_PER_DEG * 4,
]
// 150 yd = 137.16 m, 548.64 px on the test map.
const YD150 = 137.16

// A 400 × 600 map, an 80 × 40 key: its centre stays in x 40–360, y 20–580.
const base = (ball: GeoPoint | null, over: Partial<WayfinderInput> = {}): WayfinderInput => ({
  ball,
  pin: PIN,
  zoom: 19.5,
  project: flat,
  area: { left: 0, top: 0, right: 400, bottom: 600 },
  key: { width: 80, height: 40 },
  unit: 'yards',
  ...over,
})

describe('wayfinder', () => {
  it('is hidden while the ball is on screen', () => {
    expect(wayfinder(base(geo(25, -25)))).toBeNull()
  })

  it('sits on the bottom edge, pointing down, for a ball behind the view', () => {
    const w = wayfinder(base(geo(0, -YD150)))!
    expect(w.x).toBeCloseTo(200, 6)
    expect(w.y).toBeCloseTo(580, 6)
    expect(w.rotate).toBeCloseTo(180, 6)
    expect(w.distance).toBe('150 yd')
  })

  it('sits on the top edge, pointing up', () => {
    const w = wayfinder(base(geo(0, YD150)))!
    expect(w.x).toBeCloseTo(200, 6)
    expect(w.y).toBeCloseTo(20, 6)
    expect(w.rotate).toBeCloseTo(0, 6)
  })

  it('sits on the right edge, pointing right', () => {
    const w = wayfinder(base(geo(YD150, 0)))!
    expect(w.x).toBeCloseTo(360, 6)
    expect(w.y).toBeCloseTo(300, 6)
    expect(w.rotate).toBeCloseTo(90, 6)
  })

  it('sits on the left edge, pointing left', () => {
    const w = wayfinder(base(geo(-YD150, 0)))!
    expect(w.x).toBeCloseTo(40, 6)
    expect(w.y).toBeCloseTo(300, 6)
    expect(w.rotate).toBeCloseTo(270, 6)
  })

  it('reaches the corner along the diagonal, in metres for a metric player', () => {
    // (160, -280) m = (640, 1120) px: both edges bind at t = 1/4.
    // Haversine: 279.69 m south, 159.82 m east = 322.13 m = 352.29 yd.
    const w = wayfinder(base(geo(160, -280), { unit: 'meters' }))!
    expect(w.x).toBeCloseTo(360, 6)
    expect(w.y).toBeCloseTo(580, 6)
    // 180 − atan(640 / 1120) = 180 − 29.745
    expect(w.rotate).toBeCloseTo(150.255, 2)
    expect(w.distance).toBe('322 m')
  })

  it('counts a ball on the very edge as off screen, and one a margin inside as on', () => {
    // y = 600 is 75 m south; y = 580 is 70 m south.
    const w = wayfinder(base(geo(0, -75)))!
    expect(w.x).toBeCloseTo(200, 6)
    expect(w.y).toBeCloseTo(580, 6)
    expect(w.rotate).toBeCloseTo(180, 6)
    expect(wayfinder(base(geo(0, -70)))).toBeNull()
  })

  it('is hidden away from green zoom, with no ball, and with the pin off screen', () => {
    expect(wayfinder(base(geo(0, -YD150), { zoom: 17.9 }))).toBeNull()
    expect(wayfinder(base(null))).toBeNull()
    expect(wayfinder(base(geo(0, -YD150), { pin: geo(0, 100) }))).toBeNull()
    expect(wayfinder(base(geo(0, -YD150), { pin: null }))).toBeNull()
  })

  it('steps sideways out of a key column, and still points at the ball', () => {
    // Ball at (0, 900) px: the edge point (106.67, 580) is inside the column
    // grown by the key's half size (x < 140, y > 420). Right to x = 140 is
    // the shortest way out; up to y = 420 is longer, left is off the map.
    const w = wayfinder(
      base(geo(-50, -150), { avoid: [{ left: 0, top: 440, right: 100, bottom: 600 }] }),
    )!
    expect(w.x).toBeCloseTo(140, 6)
    expect(w.y).toBeCloseTo(580, 6)
    // From (140, 580) to (0, 900): 180 + atan(140 / 320)
    expect(w.rotate).toBeCloseTo(203.629, 2)
  })

  it('steps up out of a band along the bottom', () => {
    const w = wayfinder(base(geo(0, -YD150), { avoid: [{ left: 0, top: 560, right: 400, bottom: 600 }] }))!
    expect(w.x).toBeCloseTo(200, 6)
    expect(w.y).toBeCloseTo(540, 6)
    expect(w.rotate).toBeCloseTo(180, 6)
  })

  it('on a map turned to the player line, follows the turn', () => {
    // Heading 45: the camera looks north-east, so a ball due south of the
    // centre sits down and to the right, 45° off the vertical. The direction
    // (1, 1) meets the x edge first: t = 160 / dx puts it at (360, 460).
    const cam = { center: PIN, zoom: 19.5, bearing: 45, pitch: 0, centerPx: [200, 300] as [number, number], height: 600 }
    const w = wayfinder(base(geo(0, -YD150), { project: (p) => viewPoint(p, cam) }))!
    expect(w.x).toBeCloseTo(360, 6)
    expect(w.y).toBeCloseTo(460, 6)
    expect(w.rotate).toBeCloseTo(135, 6)
    expect(w.distance).toBe('150 yd')
  })
})

describe('viewPoint', () => {
  // Zoom 20 at 35.6°N: 512 · 2^20 / (40 075 016.686 · cos 35.6°) = 16.476 px/m.
  const cam = { center: PIN, zoom: 20, bearing: 0, pitch: 0, centerPx: [200, 300] as [number, number], height: 600 }

  it('puts the camera centre at its screen point and scales by zoom', () => {
    expect(viewPoint(PIN, cam)).toEqual([200, 300])
    const [x, y] = viewPoint(geo(10, 0), cam)
    expect(x).toBeCloseTo(364.76, 1)
    expect(y).toBeCloseTo(300, 6)
  })

  it('turns with the heading: heading 90 puts east at the top', () => {
    const [x, y] = viewPoint(geo(10, 0), { ...cam, bearing: 90 })
    expect(x).toBeCloseTo(200, 6)
    expect(y).toBeCloseTo(135.24, 1)
  })

  it('tilts with the pitch: the eye is 1.5 heights back', () => {
    // 60°: a point s = 100 px ahead lands 100 · cos 60 · 900 / (900 + 100 · sin 60)
    // = 45.61 px above the centre. One 100 px to the side stays 100 px out.
    const tilted = { ...cam, pitch: 60 }
    const ahead = viewPoint(geo(0, 100 / 16.476), tilted)
    expect(ahead[0]).toBeCloseTo(200, 6)
    expect(ahead[1]).toBeCloseTo(254.39, 0)
    expect(viewPoint(geo(100 / 16.476, 0), tilted)[0]).toBeCloseTo(300, 0)
  })

  it('sends a point behind the tilted eye down the screen, not up', () => {
    const [, y] = viewPoint(geo(0, -200), { ...cam, pitch: 60 })
    expect(y).toBeGreaterThan(600)
  })
})
