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

// A 400 × 600 map with a 20 px inset: the arrow rides the ellipse centred on
// (200, 300) with radii 180 across and 280 down, and keeps a 14 px box clear.
const base = (ball: GeoPoint | null, over: Partial<WayfinderInput> = {}): WayfinderInput => ({
  ball,
  pin: PIN,
  zoom: 19.5,
  project: flat,
  area: { left: 0, top: 0, right: 400, bottom: 600 },
  inset: 20,
  arrow: 14,
  unit: 'yards',
  ...over,
})

describe('wayfinder', () => {
  it('is hidden while the ball is on screen', () => {
    expect(wayfinder(base(geo(25, -25)))).toBeNull()
  })

  it('sits at the bottom of the ellipse, pointing down, for a ball behind the view', () => {
    const w = wayfinder(base(geo(0, -YD150)))!
    expect(w.x).toBeCloseTo(200, 6)
    expect(w.y).toBeCloseTo(580, 6)
    expect(w.rotate).toBeCloseTo(180, 6)
    expect(w.inward[0]).toBeCloseTo(0, 6)
    expect(w.inward[1]).toBeCloseTo(-1, 6)
    expect(w.distance).toBe('150 yd')
  })

  it('sits at the top, right and left of the ellipse', () => {
    const up = wayfinder(base(geo(0, YD150)))!
    expect(up.x).toBeCloseTo(200, 6)
    expect(up.y).toBeCloseTo(20, 6)
    expect(up.rotate).toBeCloseTo(0, 6)
    const right = wayfinder(base(geo(YD150, 0)))!
    expect(right.x).toBeCloseTo(380, 6)
    expect(right.y).toBeCloseTo(300, 6)
    expect(right.rotate).toBeCloseTo(90, 6)
    const left = wayfinder(base(geo(-YD150, 0)))!
    expect(left.x).toBeCloseTo(20, 6)
    expect(left.rotate).toBeCloseTo(270, 6)
  })

  it('rides the curve toward a ball off the corner, in metres for a metric player', () => {
    // (160, -280) m = (640, 1120) px from the centre. On the ellipse:
    // s = 1 / √((640/180)² + (1120/280)²) = 0.186855 → (319.585, 509.275).
    // Haversine: 279.69 m south, 159.82 m east = 322.13 m.
    const w = wayfinder(base(geo(160, -280), { unit: 'meters' }))!
    expect(w.x).toBeCloseTo(319.585, 2)
    expect(w.y).toBeCloseTo(509.275, 2)
    // On the ray from the centre: 180 − atan(640 / 1120)
    expect(w.rotate).toBeCloseTo(150.255, 2)
    expect(w.distance).toBe('322 m')
  })

  it('counts a ball on the very edge as off screen, and one a margin inside as on', () => {
    // y = 600 is 75 m south; y = 580 is 70 m south.
    const w = wayfinder(base(geo(0, -75)))!
    expect(w.y).toBeCloseTo(580, 6)
    expect(wayfinder(base(geo(0, -70)))).toBeNull()
  })

  it('is hidden away from green zoom, with no ball, and with the pin off screen', () => {
    expect(wayfinder(base(geo(0, -YD150), { zoom: 17.9 }))).toBeNull()
    expect(wayfinder(base(null))).toBeNull()
    expect(wayfinder(base(geo(0, -YD150), { pin: geo(0, 100) }))).toBeNull()
    expect(wayfinder(base(geo(0, -YD150), { pin: null }))).toBeNull()
  })

  // A live dock: the map runs down to the footer at y 560, with key columns in
  // both bottom corners up to y 440. The columns hide the arrow, not the ball.
  const docked = (ball: GeoPoint) =>
    base(ball, {
      area: { left: 0, top: 0, right: 400, bottom: 560 },
      avoid: [
        { left: 0, top: 440, right: 100, bottom: 560 },
        { left: 300, top: 440, right: 400, bottom: 560 },
      ],
    })

  it('is hidden for a ball in view between the key columns, above the footer', () => {
    // 50 m south = y 500: below the columns' top, above the footer.
    expect(wayfinder(docked(geo(0, -50)))).toBeNull()
  })

  it('sits at the bottom of the ellipse between the key columns, above the footer', () => {
    // 70 m south = y 580, under the footer. The ellipse's bottom is y 540.
    const w = wayfinder(docked(geo(0, -70)))!
    expect(w.x).toBeCloseTo(200, 6)
    expect(w.y).toBeCloseTo(540, 6)
    expect(w.rotate).toBeCloseTo(180, 6)
  })

  it('slides along the ellipse past a key column, to the nearest clear angle', () => {
    // Ball at (-100, 700) px: the ray meets the ellipse at (63.33, 482.22),
    // inside the column grown by the arrow (x < 114, y > 426). The clear
    // stops on the curve: (114, 545.97) at 109.3° and (39.25, 426) at
    // 141.9°; the ray is at 126.9°, so the arrow slides up to (39.25, 426).
    const w = wayfinder(base(geo(-75, -100), { avoid: [{ left: 0, top: 440, right: 100, bottom: 600 }] }))!
    expect(w.x).toBeCloseTo(39.255, 2)
    expect(w.y).toBeCloseTo(426, 6)
    // From (39.25, 426) to (-100, 700)
    expect(w.rotate).toBeCloseTo(206.941, 2)
  })

  it('slides along the ellipse off a flag that stands on it', () => {
    // The pin at (200, 590): its flag grown by the arrow spans x 174–246,
    // y 538–612, over the ellipse's bottom. The ball a touch right of the
    // pin puts the ray at 89.45°; (174, 577.06) is at 95.5° and (246, 570.70)
    // at 80.4°, so the arrow slides left to (174, 577.06).
    const low = (p: GeoPoint): [number, number] => {
      const [x, y] = flat(p)
      return [x, y + 290]
    }
    const w = wayfinder(base(geo(2, -YD150), { project: low }))!
    expect(w.x).toBeCloseTo(174, 6)
    expect(w.y).toBeCloseTo(577.06, 2)
    // From (174, 577.06) to (208, 1138.64): 180 − atan(34 / 561.58)
    expect(w.rotate).toBeCloseTo(176.535, 2)
  })

  it('on a map turned to the player line, follows the turn', () => {
    // Heading 45: a ball due south of the centre sits down and to the right,
    // 45° off the vertical. On the ellipse: 1 / √(1/180² + 1/280²) = 151.41 px
    // along each axis.
    const cam = { center: PIN, zoom: 19.5, bearing: 45, pitch: 0, centerPx: [200, 300] as [number, number], height: 600 }
    const w = wayfinder(base(geo(0, -YD150), { project: (p) => viewPoint(p, cam) }))!
    expect(w.x).toBeCloseTo(351.41, 2)
    expect(w.y).toBeCloseTo(451.41, 2)
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
