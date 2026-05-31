import { describe, expect, it } from 'vitest'
import {
  aimRelativeOffsets,
  computeAimRelativeDispersion,
  computeDispersion,
  computeDispersionStats,
  dispersionVerdict,
  filterDispersionByLie,
  getAimCorrection,
  type DispersionPoint,
  type DispersionStats,
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

  it('projects start distance into the aim-relative plane when present', () => {
    const s = shot({
      aimLat: AIM_LAT,
      aimLng: AIM_LNG,
      startLat: AIM_LAT - 0.001, // ~121 yds short of aim
      endLat: AIM_LAT,
      endLng: AIM_LNG,
    })
    const [p] = computeDispersion([s])
    expect(p!.startDistanceOffsetYards).toBeCloseTo(-121, 0)
  })

  it('leaves start distance undefined when start coords are missing', () => {
    const s = shot({
      aimLat: AIM_LAT,
      aimLng: AIM_LNG,
      endLat: AIM_LAT + 0.001,
      endLng: AIM_LNG,
    })
    const [p] = computeDispersion([s])
    expect(p!.startDistanceOffsetYards).toBeUndefined()
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
    // 2D containment radii, not the 1-D 1σ / 1.96σ rule.
    expect(stats.cone68.lateral).toBeCloseTo(stats.stdLateral * 1.5096, 3)
    expect(stats.cone95.lateral).toBeCloseTo(stats.stdLateral * 2.4477, 3)
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

describe('dispersionVerdict', () => {
  const stats = (overrides: Partial<DispersionStats>): DispersionStats => ({
    avgLateralOffset: 0,
    avgDistanceOffset: 0,
    stdLateral: 0,
    stdDistance: 0,
    cone68: { lateral: 0, distance: 0 },
    cone95: { lateral: 0, distance: 0 },
    dominantMiss: 'straight',
    shotShape: 'straight',
    sampleSize: 10,
    ...overrides,
  })

  it('calls a centered, straight pattern dead straight', () => {
    expect(dispersionVerdict(stats({ shotShape: 'straight', dominantMiss: 'straight' }))).toBe(
      'Dead straight',
    )
  })
  it('names a consistent shape when the miss is straight', () => {
    expect(dispersionVerdict(stats({ shotShape: 'fade', dominantMiss: 'straight' }))).toBe(
      'A consistent fade',
    )
  })
  it('reports a straight shape that still misses to a side', () => {
    expect(dispersionVerdict(stats({ shotShape: 'straight', dominantMiss: 'left' }))).toBe(
      'Straight, missing left',
    )
  })
  it('describes a shape that leaks to its miss side', () => {
    expect(dispersionVerdict(stats({ shotShape: 'draw', dominantMiss: 'right' }))).toBe(
      'A draw that leaks right',
    )
  })
})

const AR_LAT = 40
const AR_LNG = -75
const Y_PER_DEG_LAT = 121_000
const yPerDegLng = (lat: number) => Y_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180)

// A shot aimed due NORTH (start due south of aim → bearing exactly 0),
// landing `alongYd` long and `perpYd` right of aim. With bearing 0 the
// aim-relative recovery is exact: along = north offset, perp = east offset.
function northAimed(alongYd: number, perpYd: number, id = 'n'): Shot {
  return shot({
    id,
    startLat: AR_LAT - 0.001,
    startLng: AR_LNG,
    aimLat: AR_LAT,
    aimLng: AR_LNG,
    endLat: AR_LAT + alongYd / Y_PER_DEG_LAT,
    endLng: AR_LNG + perpYd / yPerDegLng(AR_LAT),
  })
}

describe('aimRelativeOffsets', () => {
  it('returns null when start/aim/end coords are incomplete', () => {
    // aim + end present, start missing → cannot derive the shot bearing.
    expect(
      aimRelativeOffsets(shot({ aimLat: AR_LAT, aimLng: AR_LNG, endLat: AR_LAT, endLng: AR_LNG })),
    ).toBeNull()
  })

  it('aiming north: long = +along, right = +perp (exact at bearing 0)', () => {
    const r = aimRelativeOffsets(northAimed(100, 20))
    expect(r).not.toBeNull()
    expect(r!.alongYards).toBeCloseTo(100, 0)
    expect(r!.perpYards).toBeCloseTo(20, 0)
  })

  it('aiming east: right-of-aim stays positive, left negative — no mirror', () => {
    // start due west of aim → bearing ~90 (east). End is NE of aim:
    // east of aim is LONG; north of aim is LEFT of an east aim → perp < 0.
    const r = aimRelativeOffsets(
      shot({
        startLat: AR_LAT,
        startLng: AR_LNG - 0.001,
        aimLat: AR_LAT,
        aimLng: AR_LNG,
        endLat: AR_LAT + 0.001, // north of aim
        endLng: AR_LNG + 0.001, // east of aim
      }),
    )
    expect(r).not.toBeNull()
    expect(r!.alongYards).toBeGreaterThan(0) // east of aim = long
    expect(r!.perpYards).toBeLessThan(0) // north of aim = left of an east aim
    // ~121 yd N (left) vs ~93 yd E (long) → lateral magnitude dominates.
    expect(Math.abs(r!.perpYards)).toBeGreaterThan(Math.abs(r!.alongYards))
  })
})

describe('computeAimRelativeDispersion', () => {
  it('returns null below the 5-sample floor', () => {
    expect(
      computeAimRelativeDispersion([northAimed(100, 5, 'a'), northAimed(100, 5, 'b')]),
    ).toBeNull()
  })

  it('counts only shots that survive the start/aim/end skip', () => {
    const valid = [0, 1, 2, 3, 4].map((i) => northAimed(100, 5, `v${i}`))
    const noStart = shot({ id: 'x', aimLat: AR_LAT, aimLng: AR_LNG, endLat: AR_LAT, endLng: AR_LNG })
    const r = computeAimRelativeDispersion([...valid, noStart])
    expect(r).not.toBeNull()
    expect(r!.sampleSize).toBe(5) // not 6 — the no-start row is skipped
  })

  it('captures lateral bias sign and orders 68% inside 95%', () => {
    const shots = [4, 5, 6, 5, 4].map((p, i) => northAimed(100, p, `b${i}`))
    const r = computeAimRelativeDispersion(shots)!
    expect(r.alongMean).toBeCloseTo(100, 0)
    expect(r.perpMean).toBeCloseTo(4.8, 0) // all shots right of aim
    expect(r.perp95).toBeGreaterThan(r.perp68)
    expect(r.perp68).toBeGreaterThan(0)
  })
})
