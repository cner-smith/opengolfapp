// The wayfinder (#1386): at green zoom, a key at the map's edge pointing at
// the player's ball when it is off screen, with the ball's distance to the pin.
import type { GeoPoint } from '../shot-dispersion-geo'
import type { DistanceUnit } from '../types'
import { formatDistance, haversineYards, toRadians } from '../units'

/** Out from this the map is not on the green. The web Green key lands at
 *  18.4 on a phone for a 50 m green, 19.6 on a desktop map. */
export const WAYFINDER_MIN_ZOOM = 18
// A ball within this many px of an edge still counts as off screen.
const MARGIN = 12
// The flag over the cup, px from it: the pole up 38 and the cloth to its right.
const FLAG = { left: -12, top: -38, right: 32, bottom: 8 }

export interface ScreenBox {
  left: number
  top: number
  right: number
  bottom: number
}

export interface WayfinderInput {
  ball: GeoPoint | null
  pin: GeoPoint | null
  zoom: number
  /** A point's screen position, px from the map's top left. */
  project: (p: GeoPoint) => [number, number]
  /** The open map, px: chrome along the edges already taken off. */
  area: ScreenBox
  /** px the arrow's ellipse keeps in from the area's edges, so it stays whole. */
  inset: number
  /** Half the arrow's size, px: the box it keeps clear of chrome and the flag. */
  arrow: number
  /** Chrome over the map (key columns, drawers) that hides the arrow but not
   *  the ball. */
  avoid?: ScreenBox[]
  unit: DistanceUnit
}

export interface Wayfinder {
  /** The arrow's centre, px, on the ellipse. */
  x: number
  y: number
  /** Toward the ball, degrees clockwise from screen up. */
  rotate: number
  /** Unit vector from the arrow toward the ellipse's centre: the side its
   *  distance label sits on, clear of the screen edge. */
  inward: [number, number]
  /** The ball's distance to the pin, in the player's unit. */
  distance: string
}

const inside = (x: number, y: number, b: ScreenBox) => x >= b.left && x <= b.right && y >= b.top && y <= b.bottom

export function wayfinder(i: WayfinderInput): Wayfinder | null {
  if (!i.ball || !i.pin || i.zoom < WAYFINDER_MIN_ZOOM) return null
  const a = i.area
  const [px, py] = i.project(i.pin)
  if (!inside(px, py, a)) return null
  const [bx, by] = i.project(i.ball)
  if (inside(bx, by, { left: a.left + MARGIN, top: a.top + MARGIN, right: a.right - MARGIN, bottom: a.bottom - MARGIN })) {
    return null
  }

  // A compass rose: the arrow rides an ellipse inscribed in the area, on the
  // ray from its centre toward the ball, slid along the curve off the flag and
  // any chrome.
  const ell = {
    cx: (a.left + a.right) / 2,
    cy: (a.top + a.bottom) / 2,
    rx: (a.right - a.left) / 2 - i.inset,
    ry: (a.bottom - a.top) / 2 - i.inset,
  }
  const r = i.arrow
  const flag = { left: px + FLAG.left, top: py + FLAG.top, right: px + FLAG.right, bottom: py + FLAG.bottom }
  const blocks = [flag, ...(i.avoid ?? [])].map((b) => ({ left: b.left - r, top: b.top - r, right: b.right + r, bottom: b.bottom + r }))
  const [x, y] = clearOnEllipse(Math.atan2(by - ell.cy, bx - ell.cx), ell, blocks)

  const deg = (Math.atan2(bx - x, -(by - y)) * 180) / Math.PI
  const toCentre = Math.hypot(ell.cx - x, ell.cy - y) || 1
  const yards = haversineYards(i.pin.lat, i.pin.lng, i.ball.lat, i.ball.lng)
  return {
    x,
    y,
    rotate: (deg + 360) % 360,
    inward: [(ell.cx - x) / toCentre, (ell.cy - y) / toCentre],
    distance: formatDistance(yards, i.unit),
  }
}

interface Ellipse {
  cx: number
  cy: number
  rx: number
  ry: number
}

// The point on the ellipse at screen angle `at` (radians from the centre), or
// if a block covers it, the nearest point along the curve that none covers:
// where the curve crosses a block's edge.
function clearOnEllipse(at: number, e: Ellipse, blocks: ScreenBox[]): [number, number] {
  const point = (t: number): [number, number] => {
    const c = Math.cos(t)
    const s = Math.sin(t)
    const k = 1 / Math.hypot(c / e.rx, s / e.ry)
    return [e.cx + c * k, e.cy + s * k]
  }
  const free = ([x, y]: [number, number]) => !blocks.some((b) => x > b.left && x < b.right && y > b.top && y < b.bottom)
  const want = point(at)
  if (free(want)) return want
  const crossings = blocks.flatMap((b) => [
    ...[b.left, b.right].flatMap((x) => {
      const u = (x - e.cx) / e.rx
      if (Math.abs(u) > 1) return []
      const dy = e.ry * Math.sqrt(1 - u * u)
      return [[x, e.cy - dy], [x, e.cy + dy]] as [number, number][]
    }),
    ...[b.top, b.bottom].flatMap((y) => {
      const v = (y - e.cy) / e.ry
      if (Math.abs(v) > 1) return []
      const dx = e.rx * Math.sqrt(1 - v * v)
      return [[e.cx - dx, y], [e.cx + dx, y]] as [number, number][]
    }),
  ])
  const turn = (p: [number, number]) => {
    const d = Math.abs(Math.atan2(p[1] - e.cy, p[0] - e.cx) - at) % (2 * Math.PI)
    return Math.min(d, 2 * Math.PI - d)
  }
  return crossings.filter(free).sort((p, q) => turn(p) - turn(q))[0] ?? want
}

export interface MapCamera {
  center: GeoPoint
  zoom: number
  /** Compass heading of screen up, degrees. */
  bearing: number
  pitch: number
  /** Where the camera centre renders, px (padding moves it off the middle). */
  centerPx: [number, number]
  /** The map's height, px. */
  height: number
}

// Mapbox's camera, as aim-frame models it: 512 px tiles, and a pinhole eye
// 1.5 map heights back (fov 36.87°). Flat-earth metres near the centre.
const EARTH_CIRCUMFERENCE_M = 40075016.686
const M_PER_DEG = EARTH_CIRCUMFERENCE_M / 360

/** A point's screen position for a camera, px — for maps that can't project off screen. */
export function viewPoint(p: GeoPoint, cam: MapCamera): [number, number] {
  const cos = Math.cos(toRadians(cam.center.lat))
  const k = (512 * 2 ** cam.zoom) / (EARTH_CIRCUMFERENCE_M * cos)
  const east = (p.lng - cam.center.lng) * M_PER_DEG * cos
  const north = (p.lat - cam.center.lat) * M_PER_DEG
  const b = toRadians(cam.bearing)
  const right = (east * Math.cos(b) - north * Math.sin(b)) * k
  const ahead = (east * Math.sin(b) + north * Math.cos(b)) * k
  const tilt = toRadians(cam.pitch)
  const D = 1.5 * cam.height
  // Behind the eye the depth turns negative and the image flips; a tiny
  // depth keeps the point far off on its own side instead.
  const depth = Math.max(D + ahead * Math.sin(tilt), 1e-3 * D)
  return [cam.centerPx[0] + (right * D) / depth, cam.centerPx[1] - (ahead * Math.cos(tilt) * D) / depth]
}
