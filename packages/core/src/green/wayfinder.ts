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
  /** The open map, px: chrome along the edges already taken off. The key
   *  stays inside it. */
  area: ScreenBox
  /** Where a ball still counts as on screen, when that reaches past `area`:
   *  a live dock's key columns hide the key but not the ball between them. */
  seen?: ScreenBox
  key: { width: number; height: number }
  /** Chrome inside the area that the key steps out of (key columns, bands);
   *  it steps off the pin's flag too. */
  avoid?: ScreenBox[]
  unit: DistanceUnit
}

export interface Wayfinder {
  /** The key's centre, px. */
  x: number
  y: number
  /** Toward the ball, degrees clockwise from screen up. */
  rotate: number
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
  const s = i.seen ?? a
  if (inside(bx, by, { left: s.left + MARGIN, top: s.top + MARGIN, right: s.right - MARGIN, bottom: s.bottom - MARGIN })) {
    return null
  }

  // Along the line from the area's centre to the ball, to the box the key's
  // centre may use (the area less half the key, so the key stays whole).
  const hw = i.key.width / 2
  const hh = i.key.height / 2
  const room = { left: a.left + hw, top: a.top + hh, right: a.right - hw, bottom: a.bottom - hh }
  const cx = (a.left + a.right) / 2
  const cy = (a.top + a.bottom) / 2
  const dx = bx - cx
  const dy = by - cy
  const t = Math.min(
    dx === 0 ? Infinity : (room.right - cx) / Math.abs(dx),
    dy === 0 ? Infinity : (room.bottom - cy) / Math.abs(dy),
  )
  let x = cx + dx * t
  let y = cy + dy * t

  // Off the flag, then out of any chrome, by the shortest step that stays in room.
  const flag = { left: px + FLAG.left, top: py + FLAG.top, right: px + FLAG.right, bottom: py + FLAG.bottom }
  for (const b of [flag, ...(i.avoid ?? [])]) {
    if (!(x > b.left - hw && x < b.right + hw && y > b.top - hh && y < b.bottom + hh)) continue
    const steps: [number, number][] = [
      [b.right + hw, y],
      [b.left - hw, y],
      [x, b.top - hh],
      [x, b.bottom + hh],
    ]
    const best = steps
      .filter(([sx, sy]) => inside(sx, sy, room))
      .sort((p, q) => Math.hypot(p[0] - x, p[1] - y) - Math.hypot(q[0] - x, q[1] - y))[0]
    if (best) [x, y] = best
  }

  const deg = (Math.atan2(bx - x, -(by - y)) * 180) / Math.PI
  const yards = haversineYards(i.pin.lat, i.pin.lng, i.ball.lat, i.ball.lng)
  return { x, y, rotate: (deg + 360) % 360, distance: formatDistance(yards, i.unit) }
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
