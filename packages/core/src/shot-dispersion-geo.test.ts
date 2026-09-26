import { describe, expect, it } from 'vitest'
import {
  arcGeoJSON,
  circleGeoJSON,
  coneRingGeoJSON,
  destinationYards,
  dispersionRodsGeoJSON,
  scatterGeoJSON,
} from './shot-dispersion-geo'
import { bearingDegrees, haversineYards } from './units'

const ORIGIN = { lat: 40, lng: -75 }

// Smallest angular gap between two bearings, accounting for the 0≡360 wrap.
function angGap(got: number, want: number): number {
  return Math.abs(((got - want + 540) % 360) - 180)
}

describe('destinationYards', () => {
  it('places a point north for bearing 0', () => {
    const p = destinationYards(ORIGIN, 0, 200)
    expect(p.lat).toBeGreaterThan(ORIGIN.lat)
    expect(p.lng).toBeCloseTo(ORIGIN.lng, 6)
  })

  it('round-trips distance (within half a yard) for any bearing', () => {
    for (const brg of [0, 45, 90, 200, 315]) {
      const p = destinationYards(ORIGIN, brg, 250)
      expect(haversineYards(ORIGIN.lat, ORIGIN.lng, p.lat, p.lng)).toBeCloseTo(250, 0)
    }
  })

  it('round-trips bearing for cardinals (mod 360)', () => {
    for (const brg of [0, 90, 180, 270]) {
      const p = destinationYards(ORIGIN, brg, 250)
      expect(angGap(bearingDegrees(ORIGIN.lat, ORIGIN.lng, p.lat, p.lng), brg)).toBeLessThan(0.5)
    }
  })
})

describe('arcGeoJSON', () => {
  // Target due north of origin (~242 yd). Arc spans ±20 yd lateral, no bias.
  const TARGET = { lat: 40.002, lng: -75 }
  const MID = 12 // ARC_SAMPLES (24) → 25 coords → middle index sits at perp 0

  it('returns a LineString Feature with ARC_SAMPLES+1 coordinates', () => {
    const arc = arcGeoJSON(ORIGIN, TARGET, 20)!
    expect(arc).not.toBeNull()
    expect(arc.geometry.type).toBe('LineString')
    expect(arc.geometry.coordinates).toHaveLength(25)
  })

  it('center of the arc sits on the target', () => {
    const arc = arcGeoJSON(ORIGIN, TARGET, 20)!
    const [lng, lat] = arc.geometry.coordinates[MID]! // perp = 0
    expect(lat).toBeCloseTo(TARGET.lat, 4)
    expect(lng).toBeCloseTo(TARGET.lng, 4)
  })

  it('spans left (west) to right (east) when aiming north', () => {
    const coords = arcGeoJSON(ORIGIN, TARGET, 20)!.geometry.coordinates
    expect(coords[0]![0]).toBeLessThan(TARGET.lng) // first sample = leftmost = west
    expect(coords[coords.length - 1]![0]).toBeGreaterThan(TARGET.lng) // last = east
  })

  it('arc endpoint sits half-width yards laterally from the target', () => {
    const coords = arcGeoJSON(ORIGIN, TARGET, 20)!.geometry.coordinates
    const [lng, lat] = coords[coords.length - 1]!
    // +20 yd lateral endpoint; constant-radius arc keeps it ~20 yd off target.
    expect(haversineYards(TARGET.lat, TARGET.lng, lat, lng)).toBeCloseTo(20, 0)
  })

  it('shifts the whole arc to the players lateral bias', () => {
    // bias +15 yd right → center sample lands ~15 yd right (east) of target.
    const [lng, lat] = arcGeoJSON(ORIGIN, TARGET, 20, { biasYards: 15 })!.geometry.coordinates[MID]!
    expect(lng).toBeGreaterThan(TARGET.lng) // shifted east
    expect(haversineYards(TARGET.lat, TARGET.lng, lat, lng)).toBeCloseTo(15, 0)
  })

  it('returns null when biasYards is not finite', () => {
    expect(arcGeoJSON(ORIGIN, TARGET, 20, { biasYards: NaN })).toBeNull()
  })

  it('returns null when the target is on top of the origin (radius below floor)', () => {
    expect(arcGeoJSON(ORIGIN, ORIGIN, 20)).toBeNull()
  })
})

describe('circleGeoJSON', () => {
  it('returns a closed Polygon ring of samples+1 coordinates', () => {
    const c = circleGeoJSON(ORIGIN, 25, 48)!
    expect(c).not.toBeNull()
    expect(c.geometry.type).toBe('Polygon')
    const ring = c.geometry.coordinates[0]!
    expect(ring).toHaveLength(49)
    // first === last → closed ring
    expect(ring[0]).toEqual(ring[ring.length - 1])
  })

  it('every vertex sits radiusYards from the center', () => {
    const ring = circleGeoJSON(ORIGIN, 25)!.geometry.coordinates[0]!
    for (const [lng, lat] of ring) {
      expect(haversineYards(ORIGIN.lat, ORIGIN.lng, lat, lng)).toBeCloseTo(25, 0)
    }
  })

  it('returns null for a non-positive or non-finite radius', () => {
    expect(circleGeoJSON(ORIGIN, 0)).toBeNull()
    expect(circleGeoJSON(ORIGIN, -5)).toBeNull()
    expect(circleGeoJSON(ORIGIN, NaN)).toBeNull()
  })
})

describe('scatterGeoJSON', () => {
  const TARGET = { lat: 40.002, lng: -75 } // due north of ORIGIN (~242 yd)

  it('places a point past the target and right of the aim line', () => {
    // aiming north: along+ = further north, perp+ = east (right).
    const fc = scatterGeoJSON(ORIGIN, TARGET, [{ alongYards: 10, perpYards: 8 }])
    expect(fc.features).toHaveLength(1)
    const [lng, lat] = fc.features[0]!.geometry.coordinates
    expect(lat).toBeGreaterThan(TARGET.lat) // 10 yd long → further north
    expect(lng).toBeGreaterThan(TARGET.lng) // 8 yd right → east
  })

  it('places short/left points on the opposite sides', () => {
    const [lng, lat] = scatterGeoJSON(ORIGIN, TARGET, [
      { alongYards: -12, perpYards: -6 },
    ]).features[0]!.geometry.coordinates
    expect(lat).toBeLessThan(TARGET.lat) // short → south of target
    expect(lng).toBeLessThan(TARGET.lng) // left → west
  })

  it('skips non-finite points', () => {
    const fc = scatterGeoJSON(ORIGIN, TARGET, [
      { alongYards: NaN, perpYards: 0 },
      { alongYards: 5, perpYards: Infinity },
      { alongYards: 5, perpYards: 5 },
    ])
    expect(fc.features).toHaveLength(1)
  })

  it('returns an empty collection when origin and target coincide', () => {
    const fc = scatterGeoJSON(ORIGIN, ORIGIN, [{ alongYards: 5, perpYards: 5 }])
    expect(fc.features).toHaveLength(0)
  })
})

describe('coneRingGeoJSON', () => {
  const origin = { lat: 0, lng: 0 }
  const aim = { lat: 0, lng: 0.0011 } // ~120 yd east

  it('returns null when origin and aim coincide', () => {
    expect(coneRingGeoJSON(origin, origin, 20, 10)).toBeNull()
  })
  it('returns a closed ring (first == last vertex)', () => {
    const f = coneRingGeoJSON(origin, aim, 20, 10)!
    const ring = f.geometry.coordinates[0]!
    expect(ring.length).toBeGreaterThan(10)
    expect(ring[0]).toEqual(ring[ring.length - 1])
  })
  it('a circular cone (along==perp) has near-constant radius from center', () => {
    const f = coneRingGeoJSON(origin, aim, 15, 15)!
    const ring = f.geometry.coordinates[0]!
    // crude center = mean of vertices; all vertices ~equidistant from it
    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length
    const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length
    const rs = ring.map((p) => Math.hypot(p[0] - cx, p[1] - cy))
    const min = Math.min(...rs)
    const max = Math.max(...rs)
    expect((max - min) / max).toBeLessThan(0.05)
  })
})

describe('dispersionRodsGeoJSON', () => {
  // Aim due north of the origin, so along = north and perp (+ = right) = east.
  const AIM = destinationYards(ORIGIN, 0, 150)
  const D = { alongMean: -3, perpMean: 2, along68: 9, perp68: 21 }
  const yd = (a: [number, number], b: [number, number]) => haversineYards(a[1], a[0], b[1], b[0])
  // Planar (along, perp) of a [lng, lat] relative to the aim, in yards.
  const local = ([lng, lat]: [number, number]) => {
    const along = haversineYards(AIM.lat, AIM.lng, lat, AIM.lng) * Math.sign(lat - AIM.lat)
    const perp = haversineYards(AIM.lat, AIM.lng, AIM.lat, lng) * Math.sign(lng - AIM.lng)
    return { along, perp }
  }

  it('returns null when origin and aim coincide or a stat is non-finite', () => {
    expect(dispersionRodsGeoJSON(ORIGIN, ORIGIN, D)).toBeNull()
    expect(dispersionRodsGeoJSON(ORIGIN, AIM, { ...D, perp68: NaN })).toBeNull()
  })

  it('places the length rod right of the ring and the width rod on its near side', () => {
    const r = dispersionRodsGeoJSON(ORIGIN, AIM, D)!
    const [len, wid] = r.lines.features.filter((f) => f.properties.k === 'rod')
    const l0 = local(len!.geometry.coordinates[0]!)
    const l1 = local(len!.geometry.coordinates[1]!)
    expect(l0.perp).toBeCloseTo(2 + 21 + 4, 0)
    expect(l0.along).toBeCloseTo(-3 - 9, 0)
    expect(l1.along).toBeCloseTo(-3 + 9, 0)
    const w0 = local(wid!.geometry.coordinates[0]!)
    const w1 = local(wid!.geometry.coordinates[1]!)
    expect(w0.along).toBeCloseTo(-3 - 9 - 4, 0)
    expect(w0.perp).toBeCloseTo(2 - 21, 0)
    expect(w1.perp).toBeCloseTo(2 + 21, 0)
  })

  it('checks tile each rod exactly, 3 yd each, cream at the centre', () => {
    const r = dispersionRodsGeoJSON(ORIGIN, AIM, D)!
    const checks = r.lines.features.filter((f) => f.properties.k === 'check')
    const total = checks.reduce((s, f) => s + yd(f.geometry.coordinates[0]!, f.geometry.coordinates[1]!), 0)
    expect(total).toBeCloseTo(2 * 9 + 2 * 21, 0)
    for (const f of checks) expect(yd(f.geometry.coordinates[0]!, f.geometry.coordinates[1]!)).toBeLessThanOrEqual(3.01)
    // Each check that starts at a rod centre is cream; the next one out is ink.
    const atCentre = checks.filter((f) => {
      const p = local(f.geometry.coordinates[0]!)
      return Math.abs(p.along - D.alongMean) < 0.1 || Math.abs(p.perp - D.perpMean) < 0.1
    })
    expect(atCentre.length).toBe(4)
    expect(atCentre.every((f) => f.properties.c === 0)).toBe(true)
    expect(checks.some((f) => f.properties.c === 1)).toBe(true)
  })

  it('slides the width tag away from the aim line, toward the bias side', () => {
    expect(local(toLngLat(dispersionRodsGeoJSON(ORIGIN, AIM, D)!.widthTag)).perp).toBeCloseTo(2 + 8, 0)
    expect(local(toLngLat(dispersionRodsGeoJSON(ORIGIN, AIM, { ...D, perpMean: -2 })!.widthTag)).perp).toBeCloseTo(-2 - 8, 0)
    // A narrow rod keeps the tag on it (half the half-width).
    expect(local(toLngLat(dispersionRodsGeoJSON(ORIGIN, AIM, { ...D, perp68: 6 })!.widthTag)).perp).toBeCloseTo(2 + 3, 0)
  })
})

function toLngLat(p: { lat: number; lng: number }): [number, number] {
  return [p.lng, p.lat]
}
