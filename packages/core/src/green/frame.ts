// The green turned to the player's line (#1380): metres right (x) and forward
// (y, away from the player) of an origin, with the flat-earth step pinSheet uses.
import type { GeoPoint } from '../shot-dispersion-geo'
import { bearingDegrees, YARDS_TO_METERS } from '../units'
import { pointInRing } from '../green-outline'
import { GREEN_CELL_M, type GreenGrid } from './codec'
import { pinSheet } from './pin-sheet'

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

/** The mean of the outline's corners (a closing point counted once): the point the view turns on. */
export function greenMiddle(outline: GeoPoint[]): GeoPoint {
  const first = outline[0]
  const last = outline[outline.length - 1]
  const pts = outline.length > 1 && first && last && first.lat === last.lat && first.lng === last.lng ? outline.slice(0, -1) : outline
  let lat = 0
  let lng = 0
  for (const p of pts) {
    lat += p.lat / pts.length
    lng += p.lng / pts.length
  }
  return { lat, lng }
}

/**
 * The bearing the player approaches the green on, which fixes its front and
 * back: from the newest of `starts` (oldest first) that is off the green, to
 * the green's middle. Null when every start is on the green.
 */
export function greenApproach(outline: GeoPoint[], starts: GeoPoint[]): number | null {
  const mid = greenMiddle(outline)
  for (let i = starts.length - 1; i >= 0; i--) {
    const s = starts[i]!
    // pinSheet measures only a point inside the outline.
    if (pinSheet(outline, s, 0, YARDS_TO_METERS) === null) return bearingDegrees(s.lat, s.lng, mid.lat, mid.lng)
  }
  return null
}

/** A grid image's corners in metres (east, south) from cell (0,0)'s centre: NW, NE, SE, SW. */
export function gridCorners(width: number, height: number): [number, number][] {
  const h = GREEN_CELL_M / 2
  const e = width * GREEN_CELL_M - h
  const s = height * GREEN_CELL_M - h
  return [[-h, -h], [e, -h], [e, s], [-h, s]]
}

/**
 * The grid cut to the outline the player sees (#1502): a cell stays only if it
 * was surveyed and its centre is inside `ring`. Padded grids run past the
 * green, so redrawing the outline redraws the heat map with no new survey.
 */
export function clipGreenGrid(g: GreenGrid, lng0: number, lat0: number, ring: GeoPoint[]): GreenGrid {
  let south = Infinity, north = -Infinity, west = Infinity, east = -Infinity
  for (const p of ring) {
    south = Math.min(south, p.lat); north = Math.max(north, p.lat)
    west = Math.min(west, p.lng); east = Math.max(east, p.lng)
  }
  const mask = new Uint8Array(g.mask.length)
  const heightsMm = new Float64Array(g.heightsMm.length).fill(NaN)
  for (let r = 0; r < g.height; r++)
    for (let c = 0; c < g.width; c++) {
      const j = r * g.width + c
      if (!g.mask[j]) continue
      const p = gridPointGeo(lng0, lat0, c * GREEN_CELL_M, r * GREEN_CELL_M)
      // The box test only skips work; pointInRing decides.
      if (p.lat < south || p.lat > north || p.lng < west || p.lng > east || !pointInRing(p, ring)) continue
      mask[j] = 1
      heightsMm[j] = g.heightsMm[j]!
    }
  return { ...g, mask, heightsMm }
}

/**
 * The share of `ring`'s grid points (cell centres, on the grid's lattice, past
 * its edges too) that were surveyed. A player's outline (#1504) may run off the
 * padded grid; under 0.97 it gets no heat map, the loader's bar for ours.
 */
export function outlineCoverage(g: GreenGrid, lng0: number, lat0: number, ring: GeoPoint[]): number {
  const kx = M_PER_DEG * Math.cos((lat0 * Math.PI) / 180)
  let c0 = Infinity, c1 = -Infinity, r0 = Infinity, r1 = -Infinity
  for (const p of ring) {
    const c = ((p.lng - lng0) * kx) / GREEN_CELL_M
    const r = ((lat0 - p.lat) * M_PER_DEG) / GREEN_CELL_M
    c0 = Math.min(c0, c); c1 = Math.max(c1, c); r0 = Math.min(r0, r); r1 = Math.max(r1, r)
  }
  let n = 0
  let surveyed = 0
  for (let r = Math.ceil(r0); r <= Math.floor(r1); r++)
    for (let c = Math.ceil(c0); c <= Math.floor(c1); c++) {
      if (!pointInRing(gridPointGeo(lng0, lat0, c * GREEN_CELL_M, r * GREEN_CELL_M), ring)) continue
      n++
      if (r >= 0 && r < g.height && c >= 0 && c < g.width && g.mask[r * g.width + c]) surveyed++
    }
  return n ? surveyed / n : 0
}
