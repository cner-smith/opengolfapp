import { bearingDegrees, haversineYards, toRadians, YARDS_TO_METERS } from './units'
import { destinationYards, type GeoPoint } from './shot-dispersion-geo'

// Mapbox renders through a pinhole camera: the default field of view (36.87°,
// tan(fov/2) = 1/3) puts the eye 1.5 × the viewport height from the point it
// looks at. With pitch p, a ground point s world-px up the screen from the
// camera centre lands at y = D·s·cos p / (D + s·sin p) — solved in reverse
// below, so any pitch frames exactly with no iterating.
const CAMERA_DISTANCE_PER_HEIGHT = 1.5
const EARTH_CIRCUMFERENCE_M = 40075016.686
const TILE_SIZE = 512

export interface AimFrameInput {
  ball: GeoPoint
  pin: GeoPoint
  /** Map view height, dp. */
  mapHeight: number
  /** Camera pitch, degrees. */
  pitch: number
  /** How far below the map's middle the camera centre actually renders, dp —
   *  measured on-device, since padding / viewport offsets move it. */
  centerOffsetY?: number
  /** The top anchor's distance below the map top, dp. */
  topInset: number
  /** The flag icon's top, dp above the pin coordinate (a screen-space icon). */
  flagHeight: number
  /** The ball's distance above the map bottom, dp. */
  ballInset: number
  /** How far the green's back edge sits beyond the pin, yards. */
  greenDepthYards: number
}

export interface AimFrame {
  center: GeoPoint
  zoom: number
  heading: number
}

// Aim-view camera (#899): heading up the hole, the ball `ballInset` above the
// map bottom, and the higher of the flag's top and the green's back edge
// `topInset` below the map top.
export function aimFrame(i: AimFrameInput): AimFrame {
  const heading = bearingDegrees(i.ball.lat, i.ball.lng, i.pin.lat, i.pin.lng)
  const p = toRadians(i.pitch)
  const D = CAMERA_DISTANCE_PER_HEIGHT * i.mapHeight
  // Screen y (dp up from the camera centre) → ground distance (world px).
  const ground = (y: number) => (y * D) / (D * Math.cos(p) - y * Math.sin(p))
  const middle = i.mapHeight / 2 + (i.centerOffsetY ?? 0)
  const sBall = ground(-(i.mapHeight - i.ballInset - middle))
  const pinYards = haversineYards(i.ball.lat, i.ball.lng, i.pin.lat, i.pin.lng)
  const pxPerYard = (anchorYards: number, anchorInset: number) =>
    (ground(middle - anchorInset) - sBall) / anchorYards
  // Either anchor can bind; the frame zoomed out further satisfies both.
  const k = Math.min(
    pxPerYard(pinYards, i.topInset + i.flagHeight),
    pxPerYard(pinYards + i.greenDepthYards, i.topInset),
  )
  const center = destinationYards(i.ball, heading, -sBall / k)
  const metresPerPx = YARDS_TO_METERS / k
  const zoom = Math.log2(
    (EARTH_CIRCUMFERENCE_M * Math.cos(toRadians(center.lat))) / (TILE_SIZE * metresPerPx),
  )
  return { center, zoom, heading }
}
