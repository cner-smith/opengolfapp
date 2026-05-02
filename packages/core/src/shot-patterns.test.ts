import { describe, expect, it } from 'vitest'
import {
  computeDispersion,
  computeDispersionStats,
  filterDispersionByLie,
  getAimCorrection,
  type DispersionPoint,
} from './shot-patterns'
import type { Shot } from './types'

function shot(overrides: Partial<Shot>): Shot {
  return {
    id: overrides.id ?? 'shot',
    holeScoreId: 'hs',
    userId: 'u',
    shotNumber: 1,
    ...overrides,
  }
}

const AIM_LAT = 40.0
const AIM_LNG = -75.0

describe('computeDispersion', () => {
  it('skips shots without aim/end coords', () => {
    const points = computeDispersion([shot({}), shot({ aimLat: AIM_LAT, aimLng: AIM_LNG })])
    expect(points).toHaveLength(0)
  })

  it('converts lat/lng deltas to yard offsets', () => {
    // 0.001 deg lat ≈ 121 yards north → distanceOffset ~ +121
    // 0.001 deg lng at lat 40 ≈ 121000 * cos(40°) ~ 92,690 yards/deg
    const s = shot({
      aimLat: AIM_LAT,
      aimLng: AIM_LNG,
      endLat: AIM_LAT + 0.001,
      endLng: AIM_LNG,
    })
    const [p] = computeDispersion([s])
    expect(p!.distanceOffsetYards).toBeCloseTo(121, 0)
    expect(p!.lateralOffsetYards).toBeCloseTo(0, 5)
  })

  it('positive lateral when end is east of aim', () => {
    const s = shot({
      aimLat: AIM_LAT,
      aimLng: AIM_LNG,
      endLat: AIM_LAT,
      endLng: AIM_LNG + 0.0001,
    })
    const [p] = computeDispersion([s])
    expect(p!.lateralOffsetYards).toBeGreaterThan(0)
  })
})

describe('computeDispersionStats', () => {
  it('returns null for tiny sample', () => {
    expect(computeDispersionStats([])).toBeNull()
    expect(
      computeDispersionStats([{ id: 'tiny', lateralOffsetYards: 0, distanceOffsetYards: 0 }]),
    ).toBeNull()
  })

  it('computes mean / std and labels miss tendency', () => {
    const pts: DispersionPoint[] = [
      { id: 'p1', lateralOffsetYards: 10, distanceOffsetYards: -5 },
      { id: 'p2', lateralOffsetYards: 12, distanceOffsetYards: -10 },
      { id: 'p3', lateralOffsetYards: 9, distanceOffsetYards: 0 },
      { id: 'p4', lateralOffsetYards: 11, distanceOffsetYards: -3 },
      { id: 'p5', lateralOffsetYards: 13, distanceOffsetYards: -8 },
    ]
    const stats = computeDispersionStats(pts)!
    expect(stats.sampleSize).toBe(5)
    expect(stats.avgLateralOffset).toBeCloseTo(11)
    expect(stats.dominantMiss).toBe('right')
    expect(stats.shotShape).toBe('fade')
    expect(stats.cone68.lateral).toBeGreaterThan(0)
    expect(stats.cone95.lateral).toBeCloseTo(stats.cone68.lateral * 1.96)
  })

  it('labels balanced patterns as straight', () => {
    const pts: DispersionPoint[] = Array.from({ length: 10 }, (_, i) => ({
      id: `bal-${i}`,
      lateralOffsetYards: i % 2 === 0 ? 1 : -1,
      distanceOffsetYards: 0,
    }))
    const stats = computeDispersionStats(pts)!
    expect(stats.dominantMiss).toBe('straight')
    expect(stats.shotShape).toBe('straight')
  })
})

describe('filterDispersionByLie', () => {
  const pts: DispersionPoint[] = [
    { id: 'lf1', lateralOffsetYards: 0, distanceOffsetYards: 0, lieSlope: 'level', lieType: 'fairway' },
    { id: 'lf2', lateralOffsetYards: 0, distanceOffsetYards: 0, lieSlope: 'uphill', lieType: 'fairway' },
    { id: 'lf3', lateralOffsetYards: 0, distanceOffsetYards: 0, lieSlope: 'level', lieType: 'rough' },
  ]
  it('filters by slope', () => {
    expect(filterDispersionByLie(pts, { lieSlope: 'uphill' })).toHaveLength(1)
  })
  it('filters by type', () => {
    expect(filterDispersionByLie(pts, { lieType: 'fairway' })).toHaveLength(2)
  })
  it('filters by both', () => {
    expect(
      filterDispersionByLie(pts, { lieSlope: 'level', lieType: 'fairway' }),
    ).toHaveLength(1)
  })
})

describe('getAimCorrection', () => {
  it('reports centered when miss is small', () => {
    const stats = computeDispersionStats(
      Array.from({ length: 10 }, (_, i) => ({
        id: `c-${i}`,
        lateralOffsetYards: 0.5,
        distanceOffsetYards: 0,
      })),
    )!
    expect(getAimCorrection(stats)).toMatch(/centered/i)
  })

  it('suggests opposite-side aim for right-miss bias', () => {
    const stats = computeDispersionStats(
      Array.from({ length: 6 }, (_, i) => ({
        id: `r-${i}`,
        lateralOffsetYards: 8,
        distanceOffsetYards: 0,
      })),
    )!
    expect(getAimCorrection(stats)).toContain('left')
    expect(getAimCorrection(stats)).toContain('8')
  })
})
