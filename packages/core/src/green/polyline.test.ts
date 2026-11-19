import { describe, expect, it } from 'vitest'
import { decodePolyline, encodePolyline } from './polyline'

// Google's documented example, (38.5, −120.2) (40.7, −120.95) (43.252, −126.453) at precision 5,
// is the same integers as these points at precision 6.
const POINTS = [
  { lat: 3.85, lng: -12.02 },
  { lat: 4.07, lng: -12.095 },
  { lat: 4.3252, lng: -12.6453 },
]
const ENCODED = '_p~iF~ps|U_ulLnnqC_mqNvxq`@'

describe('encoded polyline, precision 6', () => {
  it('encodes Google’s example, lat before lng', () => {
    expect(encodePolyline(POINTS)).toBe(ENCODED)
  })

  it('decodes it back', () => {
    const back = decodePolyline(ENCODED)
    expect(back).toHaveLength(3)
    back.forEach((p, i) => {
      expect(p.lat).toBeCloseTo(POINTS[i]!.lat, 9)
      expect(p.lng).toBeCloseTo(POINTS[i]!.lng, 9)
    })
  })

  it('round-trips a green ring to the micro-degree', () => {
    const ring = [
      { lat: 35.612983, lng: -97.61008 },
      { lat: 35.613101, lng: -97.609872 },
      { lat: 35.612877, lng: -97.609701 },
      { lat: 35.612983, lng: -97.61008 },
    ]
    expect(decodePolyline(encodePolyline(ring))).toEqual(ring)
  })

  it.each([
    ['a value cut short', '_p~iF~ps|U_ulLnnqC_mqNvxq'],
    ['a lat with no lng', '_p~iF'],
    ['a character outside the alphabet', '_p~iF~ps|U ulLnnqC'],
  ])('rejects %s', (_, s) => {
    expect(() => decodePolyline(s)).toThrow(/polyline/)
  })
})
