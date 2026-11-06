// Google encoded polyline at precision 6, the storage format for green
// outlines (green_maps.outline). Pairs are lat then lng, as PostGIS's
// ST_LineFromEncodedPolyline(text, 6) reads them.
import type { GeoPoint } from '../shot-dispersion-geo'

const SCALE = 1e6

function encodeValue(v: number): string {
  let u = v < 0 ? -2 * v - 1 : 2 * v
  let out = ''
  while (u >= 32) {
    out += String.fromCharCode((32 | (u % 32)) + 63)
    u = Math.floor(u / 32)
  }
  return out + String.fromCharCode(u + 63)
}

export function encodePolyline(points: GeoPoint[]): string {
  let lat = 0
  let lng = 0
  let out = ''
  for (const p of points) {
    const a = Math.round(p.lat * SCALE)
    const b = Math.round(p.lng * SCALE)
    out += encodeValue(a - lat) + encodeValue(b - lng)
    lat = a
    lng = b
  }
  return out
}

export function decodePolyline(s: string): GeoPoint[] {
  const values: number[] = []
  let i = 0
  while (i < s.length) {
    let u = 0
    let scale = 1
    for (;;) {
      if (i >= s.length) throw new Error('Invalid polyline: a value is cut short')
      const c = s.charCodeAt(i++) - 63
      if (c < 0 || c > 63) throw new Error(`Invalid polyline: character ${i - 1} is outside the alphabet`)
      u += (c & 31) * scale
      scale *= 32
      if (c < 32) break
      if (scale > 2 ** 40) throw new Error('Invalid polyline: a value is too long')
    }
    values.push(u % 2 ? -(u + 1) / 2 : u / 2)
  }
  if (values.length % 2) throw new Error('Invalid polyline: a lat has no lng')
  const out: GeoPoint[] = []
  let lat = 0
  let lng = 0
  for (let j = 0; j < values.length; j += 2) {
    lat += values[j]!
    lng += values[j + 1]!
    out.push({ lat: lat / SCALE, lng: lng / SCALE })
  }
  return out
}
