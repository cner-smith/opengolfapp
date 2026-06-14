import { describe, expect, it } from 'vitest'
import { clubDistanceStats } from '../stats'

// Pure-latitude deltas → predictable haversine distance (~121,740 yd per
// degree of latitude). 0.0020° ≈ 243 yd, 0.00125° ≈ 152 yd.
function mk(club: string, dLat: number, lie_type = 'fairway') {
  return {
    club,
    lie_type,
    start_lat: 35,
    start_lng: -97,
    end_lat: 35 + dLat,
    end_lng: -97,
  }
}

describe('clubDistanceStats', () => {
  it('groups by club, sorted longest-first, with min/max/avg/count', () => {
    const res = clubDistanceStats([
      mk('driver', 0.002),
      mk('driver', 0.0024),
      mk('7i', 0.00125),
    ])
    expect(res.map((r) => r.club)).toEqual(['driver', '7i']) // longer avg first
    const driver = res[0]!
    expect(driver.count).toBe(2)
    expect(driver.min).toBeLessThan(driver.max)
    expect(driver.avg).toBeGreaterThan(driver.min)
    expect(driver.avg).toBeLessThan(driver.max)
    expect(driver.avg).toBeGreaterThan(200) // ~243–292 yd band
  })

  it('excludes putts, greenside, and missing-coord shots', () => {
    const res = clubDistanceStats([
      mk('putter', 0.0005),
      mk('lw', 0.0008, 'green'),
      {
        club: '8i',
        lie_type: 'fairway',
        start_lat: 35,
        start_lng: -97,
        end_lat: null,
        end_lng: null,
      },
    ])
    expect(res).toEqual([])
  })

  it('clamps GPS-zero and absurd distances out', () => {
    const res = clubDistanceStats([
      mk('9i', 0.000005), // ~0.6 yd < 3
      mk('9i', 1), // ~120k yd > 450
    ])
    expect(res).toEqual([])
  })
})
