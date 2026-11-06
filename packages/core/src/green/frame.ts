// The green turned to the player's line (#1380): metres right (x) and forward
// (y, away from the player) of an origin, with the flat-earth step pinSheet uses.
import type { GeoPoint } from '../shot-dispersion-geo'

const M_PER_DEG = 111_320

export interface GreenFrame {
  toLocal: (p: GeoPoint) => { x: number; y: number }
  toGeo: (x: number, y: number) => GeoPoint
}

/** `approachDeg` is the compass bearing the player travels toward the green. */
export function greenFrame(origin: GeoPoint, approachDeg: number): GreenFrame {
  const kx = M_PER_DEG * Math.cos((origin.lat * Math.PI) / 180)
  const b = (approachDeg * Math.PI) / 180
  const fx = Math.sin(b)
  const fy = Math.cos(b)
  return {
    toLocal: (p) => {
      const e = (p.lng - origin.lng) * kx
      const n = (p.lat - origin.lat) * M_PER_DEG
      return { x: e * fy - n * fx, y: e * fx + n * fy }
    },
    toGeo: (x, y) => ({ lat: origin.lat + (-x * fx + y * fy) / M_PER_DEG, lng: origin.lng + (x * fy + y * fx) / kx }),
  }
}

/** A point on a green grid, `eastM` and `southM` from the centre of cell (0,0) at (lng0, lat0). */
export function gridPointGeo(lng0: number, lat0: number, eastM: number, southM: number): GeoPoint {
  return { lat: lat0 - southM / M_PER_DEG, lng: lng0 + eastM / (M_PER_DEG * Math.cos((lat0 * Math.PI) / 180)) }
}
