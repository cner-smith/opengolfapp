import { describe, expect, it } from 'vitest'
import { courseCentroid, pointSetDiameter, type GeoPoint } from './course-geo'

// Saint Ouen L'aumône (prod, pending). Holes 1-2 are in France; holes 7-9 are
// near Philadelphia. It is the strongest-looking row in the queue — 8 rounds,
// 5 of 9 holes placed — which is exactly why a centroid must refuse it.
const SAINT_OUEN: GeoPoint[] = [
  { lat: 48.9088, lng: 2.3342 },
  { lat: 48.909, lng: 2.334 },
  { lat: 39.9994, lng: -75.0018 },
  { lat: 39.9996, lng: -75.0007 },
  { lat: 39.9987, lng: -75.0 },
]

// Le Manoir (prod, pending). 8 holes, all genuinely on one course.
const LE_MANOIR: GeoPoint[] = [
  { lat: 50.4998, lng: 1.5979 },
  { lat: 50.4988, lng: 1.5928 },
  { lat: 50.4969, lng: 1.5967 },
  { lat: 50.4989, lng: 1.5945 },
  { lat: 50.498, lng: 1.5932 },
  { lat: 50.4952, lng: 1.5969 },
  { lat: 50.4961, lng: 1.5946 },
  { lat: 50.4999, lng: 1.5965 },
]

describe('pointSetDiameter', () => {
  it('is 0 for an empty set or a single point', () => {
    expect(pointSetDiameter([])).toBe(0)
    expect(pointSetDiameter([{ lat: 50.4998, lng: 1.5979 }])).toBe(0)
  })

  it('measures a real single-site course in hundreds of metres', () => {
    const m = pointSetDiameter(LE_MANOIR)
    expect(m).toBeGreaterThan(300)
    expect(m).toBeLessThan(1000)
  })

  it('measures a two-continent point set in thousands of kilometres', () => {
    expect(pointSetDiameter(SAINT_OUEN)).toBeGreaterThan(1_000_000)
  })
})

describe('courseCentroid', () => {
  it('refuses fewer than two points — one point admits no corroboration', () => {
    expect(courseCentroid([])).toBeNull()
    expect(courseCentroid([{ lat: 50.4998, lng: 1.5979 }])).toBeNull()
  })

  it('refuses a point set that spans more than one course', () => {
    // The mean here is roughly (43.6, -44.1) — open ocean. Returning null is
    // the entire point of this function.
    //
    // This also guards against a later "fix" that swaps the mean for a
    // median: the median of SAINT_OUEN lands on the 3-point Philadelphia
    // cluster, which is confidently wrong rather than visibly absent.
    expect(courseCentroid(SAINT_OUEN)).toBeNull()
  })

  it('averages a genuine single-site course', () => {
    const c = courseCentroid(LE_MANOIR)
    expect(c).not.toBeNull()
    expect(c!.lat).toBeCloseTo(50.498, 2)
    expect(c!.lng).toBeCloseTo(1.5954, 2)
  })
})
