import { describe, expect, it } from 'vitest'
import { osmGreenMap, pointInRing, ringAreaM2 } from './green-outline'
import { encodePolyline } from './green/polyline'
import type { GeoPoint } from './shot-dispersion-geo'

// Metres east/north of (0, 0). On the equator 1 m = 1 / 111,194.93 degrees both ways
// (R = 6,371,000 m), so these shapes have hand-checkable sizes.
const M = 111_194.93
const m = (x: number, y: number): GeoPoint => ({ lat: y / M, lng: x / M })
const square = (x0: number, y0: number, x1: number, y1: number): GeoPoint[] => [
  m(x0, y0),
  m(x1, y0),
  m(x1, y1),
  m(x0, y1),
  m(x0, y0),
]

// The hole's green: 30 x 30 m = 900 m². A practice green 2 m east of it:
// 10 x 10 m = 100 m², centre (37, 15).
const realGreen = square(0, 0, 30, 30)
const practiceGreen = square(32, 10, 42, 20)
const greens = [[realGreen], [practiceGreen]]

describe('pointInRing', () => {
  it('is true inside and false outside', () => {
    expect(pointInRing(m(15, 15), realGreen)).toBe(true)
    expect(pointInRing(m(31, 15), realGreen)).toBe(false)
  })
})

describe('ringAreaM2', () => {
  it('a 0.0001 degree square on the equator is 11.1195 m a side', () => {
    // side = 0.0001 * pi / 180 * 6,371,000 = 11.11949 m; area = 123.643 m²
    const ring = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 0.0001 },
      { lat: 0.0001, lng: 0.0001 },
      { lat: 0.0001, lng: 0 },
      { lat: 0, lng: 0 },
    ]
    expect(ringAreaM2(ring)).toBeCloseTo(123.643, 2)
  })

  it('shrinks east-west by cos(latitude): the same square at 60° N is half', () => {
    const ring = [
      { lat: 59.99995, lng: 0 },
      { lat: 59.99995, lng: 0.0001 },
      { lat: 60.00005, lng: 0.0001 },
      { lat: 60.00005, lng: 0 },
    ]
    expect(ringAreaM2(ring)).toBeCloseTo(61.822, 2)
  })
})

describe('encodePolyline (precision 6, lat then lng)', () => {
  it('encodes small deltas', () => {
    // chr(63 + zigzag): lat 1 -> 2 -> 'A'; lng 2 -> 4 -> 'C'; then -1 -> 1 -> '@', -2 -> 3 -> 'B'
    expect(encodePolyline([{ lat: 0.000001, lng: 0.000002 }, { lat: 0, lng: 0 }])).toBe('AC@B')
  })

  it("matches Google's worked example: 38.5 at precision 5 is 3.85 at precision 6", () => {
    expect(encodePolyline([{ lat: 3.85, lng: -12.02 }])).toBe('_p~iF~ps|U')
  })
})

describe('osmGreenMap', () => {
  it("takes the green the hole's end lies in, not the practice green with the nearer centre", () => {
    // End at (29, 15): inside the real green, 14 m from its centre but 8 m from the practice green's.
    const got = osmGreenMap(greens, m(29, 15), null)
    expect(got).not.toBeNull()
    expect(got!.areaM2).toBeCloseTo(900, 0)
    expect(got!.outline).toBe(encodePolyline(realGreen))
    expect(got!.flagged).toBe(false)
    expect(got!.flagReason).toBeNull()
  })

  it("takes the hole's end over the pin when both are given", () => {
    const got = osmGreenMap(greens, m(29, 15), m(37, 15))
    expect(got!.areaM2).toBeCloseTo(900, 0)
  })

  it('with no hole way, takes the green containing the pin', () => {
    const got = osmGreenMap(greens, null, m(37, 15))
    expect(got!.areaM2).toBeCloseTo(100, 0)
    expect(got!.flagged).toBe(false)
  })

  it('outside every green: the nearest edge within 30 m, flagged', () => {
    // End at (31.4, 15): 1.4 m from the real green's edge, 0.6 m from the practice green's.
    const got = osmGreenMap(greens, m(31.4, 15), null)
    expect(got!.areaM2).toBeCloseTo(100, 0)
    expect(got!.flagged).toBe(true)
    expect(got!.flagReason).toBe("nearest green, 1 m from the hole's end")
  })

  it('names the pin in the flag when there is no hole way', () => {
    const got = osmGreenMap(greens, null, m(15, 50))
    expect(got!.areaM2).toBeCloseTo(900, 0)
    expect(got!.flagReason).toBe('nearest green, 20 m from the pin')
  })

  it('nothing within 30 m: no green', () => {
    expect(osmGreenMap(greens, m(73, 15), null)).toBeNull()
    expect(osmGreenMap(greens, null, null)).toBeNull()
  })

  it('takes the smaller of two greens that both contain the end', () => {
    const inner = square(5, 5, 15, 15)
    expect(osmGreenMap([[realGreen], [inner]], m(10, 10), null)!.areaM2).toBeCloseTo(100, 0)
  })

  it('stitches a multipolygon outer ring split into ways, one of them reversed', () => {
    const south = [m(0, 30), m(0, 0), m(30, 0)]
    const northReversed = [m(0, 30), m(30, 30), m(30, 0)]
    const got = osmGreenMap([[south, northReversed]], m(15, 15), null)
    expect(got!.areaM2).toBeCloseTo(900, 0)
  })

  it('ignores an outer way that never closes', () => {
    expect(osmGreenMap([[[m(0, 0), m(30, 0), m(30, 30)]]], m(15, 15), null)).toBeNull()
  })

  it('a real OSM green (Oklahoma, way 1088044746): pin inside, area within 1% of the UTM area', () => {
    // [lng, lat] from OSM; 346.8 m² measured in UTM 14N by the offline pull.
    const coords: [number, number][] = [
      [-98.9550559, 35.5224789], [-98.9550251, 35.5224778], [-98.9549983, 35.5224604],
      [-98.9549755, 35.5224375], [-98.9549406, 35.52242], [-98.9549057, 35.522408],
      [-98.954887, 35.5223807], [-98.9548829, 35.5223403], [-98.9548937, 35.5223032],
      [-98.9549299, 35.5222825], [-98.9549715, 35.522277], [-98.955013, 35.5222792],
      [-98.9550573, 35.5222934], [-98.9550935, 35.5223141], [-98.9551042, 35.5223349],
      [-98.9551123, 35.5223643], [-98.9551069, 35.5224014], [-98.9551082, 35.5224255],
      [-98.9550975, 35.522456], [-98.9550801, 35.5224768], [-98.9550559, 35.5224789],
    ]
    const ring = coords.map(([lng, lat]) => ({ lat, lng }))
    // A 10 m practice square 5 m east of the green's east edge.
    const eastEdge = -98.9548829
    const dLng = 1 / (M * Math.cos((35.5224 * Math.PI) / 180))
    const practice = [
      { lat: 35.52232, lng: eastEdge + 5 * dLng },
      { lat: 35.52232, lng: eastEdge + 15 * dLng },
      { lat: 35.52232 + 10 / M, lng: eastEdge + 15 * dLng },
      { lat: 35.52232 + 10 / M, lng: eastEdge + 5 * dLng },
      { lat: 35.52232, lng: eastEdge + 5 * dLng },
    ]
    const pin = { lat: 35.522385, lng: -98.955014 }
    const got = osmGreenMap([[practice], [ring]], pin, null)
    expect(got!.flagged).toBe(false)
    expect(got!.areaM2).toBeGreaterThan(346.8 * 0.99)
    expect(got!.areaM2).toBeLessThan(346.8 * 1.01)
    expect(got!.outline).toBe(encodePolyline(ring))
  })
})
