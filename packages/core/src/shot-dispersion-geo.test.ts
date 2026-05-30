import { describe, expect, it } from 'vitest'
import { arcGeoJSON, circleGeoJSON, destinationYards, scatterGeoJSON } from './shot-dispersion-geo'
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
