import { describe, expect, it } from 'vitest'
import {
  aimRelativeOffsets,
  clubTypicalDistance,
  computeAimRelativeDispersion,
  computeDispersion,
  aimAdvice,
  computeDispersionStats,
  dispersionVerdict,
  filterDispersionByLie,
  getAimCorrection,
  missTally,
  missLean,
  MIN_SAMPLES_FOR_STATS,
  recentVsAll,
  shapeTally,
  startLineTally,
  startShapeMatrix,
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
    // Aimed due north (start south of aim). End 0.001 deg lat ≈ 121 yds north
    // of aim = straight down the line → distanceOffset ~ +121, lateral ~0.
    const s = shot({
      startLat: AIM_LAT - 0.001,
      startLng: AIM_LNG,
      aimLat: AIM_LAT,
      aimLng: AIM_LNG,
      endLat: AIM_LAT + 0.001,
      endLng: AIM_LNG,
    })
    const [p] = computeDispersion([s])
    expect(p!.distanceOffsetYards).toBeCloseTo(121, 0)
    expect(p!.lateralOffsetYards).toBeCloseTo(0, 5)
  })

  it('frames offsets relative to the aim line, not compass N/E (regression #464)', () => {
    // Shot aimed due EAST (start west of aim → bearing ~90°), landing
    // straight down the line: purely east of aim = all distance, no
    // perpendicular miss. Compass framing mislabels the eastward end as a
    // huge LATERAL offset; aim-relative framing must read it as ~all distance.
    const s = shot({
      id: 'east',
      startLat: AIM_LAT,
      startLng: AIM_LNG - 0.001,
      aimLat: AIM_LAT,
      aimLng: AIM_LNG,
      endLat: AIM_LAT,
      endLng: AIM_LNG + 0.001,
    })
    const [p] = computeDispersion([s])
    expect(p!.lateralOffsetYards).toBeCloseTo(0, 0) // no perpendicular miss
    expect(p!.distanceOffsetYards).toBeGreaterThan(50) // it's all distance
  })

  it('reads identical perp misses identically regardless of aim bearing (regression #464)', () => {
    // Same shot — 30 yds right of aim, dead on for distance — flown on two
    // different compass bearings (north vs east). The compass frame smears
    // these into different lateral/distance offsets; the aim-relative frame
    // must report the same perpendicular miss for both.
    const PERP = 30
    const northAimedRight = shot({
      id: 'n',
      startLat: AIM_LAT - 0.001,
      startLng: AIM_LNG,
      aimLat: AIM_LAT,
      aimLng: AIM_LNG,
      endLat: AIM_LAT,
      endLng: AIM_LNG + PERP / (Y_PER_DEG_LAT * Math.cos((AIM_LAT * Math.PI) / 180)),
    })
    const eastAimedRight = shot({
      id: 'e',
      startLat: AIM_LAT,
      startLng: AIM_LNG - 0.001,
      aimLat: AIM_LAT,
      aimLng: AIM_LNG,
      endLat: AIM_LAT - PERP / Y_PER_DEG_LAT, // south of an east aim = right
      endLng: AIM_LNG,
    })
    const [pn] = computeDispersion([northAimedRight])
    const [pe] = computeDispersion([eastAimedRight])
    expect(pn!.lateralOffsetYards).toBeCloseTo(PERP, 0)
    expect(pe!.lateralOffsetYards).toBeCloseTo(pn!.lateralOffsetYards, 0)
  })

  it('projects start distance into the aim-relative plane when present', () => {
    const s = shot({
      startLat: AIM_LAT - 0.001, // ~121 yds short of aim, due south
      startLng: AIM_LNG,
      aimLat: AIM_LAT,
      aimLng: AIM_LNG,
      endLat: AIM_LAT,
      endLng: AIM_LNG,
    })
    const [p] = computeDispersion([s])
    expect(p!.startDistanceOffsetYards).toBeCloseTo(-121, 0)
  })

  it('carries the recorded shape, start line and played date onto the point', () => {
    const s = shot({
      startLat: AIM_LAT - 0.001,
      startLng: AIM_LNG,
      aimLat: AIM_LAT,
      aimLng: AIM_LNG,
      endLat: AIM_LAT,
      endLng: AIM_LNG,
      shape: 'fade',
      startLine: 'pull',
      playedAt: '2026-10-12',
    })
    expect(computeDispersion([s])[0]).toMatchObject({ shape: 'fade', startLine: 'pull', playedAt: '2026-10-12' })
  })

  it('skips shots without a start position (cannot derive the aim line)', () => {
    const s = shot({
      aimLat: AIM_LAT,
      aimLng: AIM_LNG,
      endLat: AIM_LAT + 0.001,
      endLng: AIM_LNG,
    })
    expect(computeDispersion([s])).toHaveLength(0)
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
    shape: 'straight',
    ring68: { cx: 0, cy: 0, rx: 0, ry: 0, rotationDeg: 0 },
    ring95: { cx: 0, cy: 0, rx: 0, ry: 0, rotationDeg: 0 },
    avgAimDistance: null,
    sampleSize: 10,
    ...overrides,
  })

  it('calls a centered, straight pattern dead straight', () => {
    expect(dispersionVerdict(stats({ shape: 'straight', dominantMiss: 'straight' }))).toBe(
      'Dead straight',
    )
  })
  it('names a consistent shape when the miss is straight', () => {
    expect(dispersionVerdict(stats({ shape: 'fade', dominantMiss: 'straight' }))).toBe(
      'A consistent fade',
    )
  })
  it('reports a straight shape that still misses to a side', () => {
    expect(dispersionVerdict(stats({ shape: 'straight', dominantMiss: 'left' }))).toBe(
      'Straight, missing left',
    )
  })
  it('describes a shape that leaks to its miss side', () => {
    expect(dispersionVerdict(stats({ shape: 'draw', dominantMiss: 'right' }))).toBe(
      'A draw that leaks right',
    )
  })
  it('speaks only the miss when no shape holds half the recorded shots', () => {
    expect(dispersionVerdict(stats({ shape: 'mixed', dominantMiss: 'right' }))).toBe('Misses right')
    expect(dispersionVerdict(stats({ shape: null, dominantMiss: 'left' }))).toBe('Misses left')
    expect(dispersionVerdict(stats({ shape: 'mixed', dominantMiss: 'straight' }))).toBe(
      'Centered on your aim',
    )
  })
  it('names the recorded shape, not one inferred from the miss (WEB-12)', () => {
    // Five shots 11 yd right (the old engine called this a fade), three recorded as draws.
    const pts: DispersionPoint[] = [10, 12, 9, 11, 13].map((x, i) => ({
      id: `v${i}`,
      lateralOffsetYards: x,
      distanceOffsetYards: 0,
      shape: i < 3 ? 'draw' : i === 3 ? 'straight' : null,
    }))
    // Recorded 4: draw 3/4 = 75%, but only 4 recorded (< 5) → no shape word.
    expect(computeDispersionStats(pts)!.shape).toBeNull()
    expect(dispersionVerdict(computeDispersionStats(pts)!)).toBe('Misses right')
    pts[4] = { ...pts[4]!, shape: 'draw' }
    // Recorded 5: draw 4/5 = 80%.
    expect(dispersionVerdict(computeDispersionStats(pts)!)).toBe('A draw that leaks right')
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

describe('clubTypicalDistance', () => {
  it('uses the measured median once the club has MIN_SAMPLES_FOR_STATS shots', () => {
    expect(clubTypicalDistance(152, MIN_SAMPLES_FOR_STATS, 140)).toEqual({ yards: 152, source: 'shots' })
  })

  it('falls back to the typed distance one shot short of the threshold', () => {
    expect(clubTypicalDistance(152, MIN_SAMPLES_FOR_STATS - 1, 140)).toEqual({ yards: 140, source: 'estimate' })
  })

  it('falls back to the typed distance when no shot had both ends', () => {
    expect(clubTypicalDistance(null, 12, 140)).toEqual({ yards: 140, source: 'estimate' })
  })

  it('is null with too few shots and nothing typed', () => {
    expect(clubTypicalDistance(152, 2, null)).toBeNull()
    expect(clubTypicalDistance(undefined, 0, undefined)).toBeNull()
  })
})

const pt = (id: string, x: number, y: number, extra: Partial<DispersionPoint> = {}): DispersionPoint => ({
  id,
  lateralOffsetYards: x,
  distanceOffsetYards: y,
  ...extra,
})

// At exactly ±45° both eigenvectors sit on the ±45° diagonals, so (45°, a, b)
// and (−45°, b, a) are the same ellipse: compare the major axis instead.
function majorAxis(r: { rx: number; ry: number; rotationDeg: number }) {
  return r.rx >= r.ry
    ? { deg: r.rotationDeg, major: r.rx, minor: r.ry }
    : { deg: r.rotationDeg > 0 ? r.rotationDeg - 90 : r.rotationDeg + 90, major: r.ry, minor: r.rx }
}

describe('computeDispersionStats rings (WEB-15)', () => {
  it('an axis-aligned pattern keeps today’s rings, unrotated', () => {
    // (±3, 0), (0, ±4), (0, 0): σx² = 18/5 = 3.6, σy² = 32/5 = 6.4, σxy = 0.
    // 68%: √3.6·1.5096 = 2.8643, √6.4·1.5096 = 3.8190. 95%: ·2.4477 = 4.6442, 6.1922.
    const s = computeDispersionStats([pt('a', 3, 0), pt('b', -3, 0), pt('c', 0, 4), pt('d', 0, -4), pt('e', 0, 0)])!
    expect(s.ring68.rotationDeg).toBeCloseTo(0, 6)
    expect(s.ring68.rx).toBeCloseTo(2.8643, 3)
    expect(s.ring68.ry).toBeCloseTo(3.819, 3)
    expect(s.ring95.rx).toBeCloseTo(4.6442, 3)
    expect(s.ring95.ry).toBeCloseTo(6.1922, 3)
    expect(s.ring68.rx).toBeCloseTo(s.cone68.lateral, 9)
    expect(s.ring68.ry).toBeCloseTo(s.cone68.distance, 9)
  })

  it('tilts a pattern whose long misses go right by +45°', () => {
    // (−2,−2), (2,2), (−1,1), (1,−1), (0,0), shifted by (5,−3):
    // σxx = σyy = 10/5 = 2, σxy = (4 + 4 − 1 − 1)/5 = 1.2 → θ = ½·atan2(2.4, 0) = 45°.
    // Along 45°: 2 + 1.2 = 3.2 → √3.2 = 1.78885; across: 2 − 1.2 = 0.8 → 0.89443.
    // 68%: 2.70045, 1.35023. 95%: 4.37858, 2.18929.
    const s = computeDispersionStats(
      [[-2, -2], [2, 2], [-1, 1], [1, -1], [0, 0]].map(([x, y], i) => pt(`t${i}`, x! + 5, y! - 3)),
    )!
    expect(s.ring68).toMatchObject({ cx: 5, cy: -3 })
    const m68 = majorAxis(s.ring68)
    expect(m68.deg).toBeCloseTo(45, 6)
    expect(m68.major).toBeCloseTo(2.70045, 4)
    expect(m68.minor).toBeCloseTo(1.35023, 4)
    expect(majorAxis(s.ring95).major).toBeCloseTo(4.37858, 4)
    expect(majorAxis(s.ring95).minor).toBeCloseTo(2.18929, 4)
    // The width/depth extents along the aim axes stay as they were: √2·1.5096.
    expect(s.cone68.lateral).toBeCloseTo(2.13489, 4)
  })

  it('tilts the other way (−45°) when long misses go left', () => {
    const s = computeDispersionStats([[2, -2], [-2, 2], [1, 1], [-1, -1], [0, 0]].map(([x, y], i) => pt(`m${i}`, x!, y!)))!
    expect(majorAxis(s.ring68).deg).toBeCloseTo(-45, 6)
    expect(majorAxis(s.ring68).major).toBeCloseTo(2.70045, 4)
  })

  it('keeps the rotation within ±45° and measures rx along the rotated lateral axis', () => {
    // (0,±3), (±1,±1 same sign), (0,0): σxx = 0.4, σyy = 4, σxy = 0.4.
    // atan2(0.8, −3.6) = 180° − atan(0.2222) = 167.4712°, half = 83.7356° → the other eigenvector, −6.2644°.
    // Eigenvalues 2.2 ± √(1.8² + 0.4²) = 2.2 ± 1.84391 → 0.35609 (near-lateral), 4.04391.
    // 68%: rx = √0.35609·1.5096 = 0.90083, ry = √4.04391·1.5096 = 3.03573.
    const s = computeDispersionStats([pt('a', 0, 3), pt('b', 0, -3), pt('c', 1, 1), pt('d', -1, -1), pt('e', 0, 0)])!
    expect(s.ring68.rotationDeg).toBeCloseTo(-6.2644, 3)
    expect(s.ring68.rx).toBeCloseTo(0.90083, 4)
    expect(s.ring68.ry).toBeCloseTo(3.03573, 4)
    // Mirrored in x (σxy = −0.4): ½·atan2(−0.8, −3.6) = −83.7356° → +6.2644°, same radii.
    const m = computeDispersionStats([pt('a', 0, 3), pt('b', 0, -3), pt('c', -1, 1), pt('d', 1, -1), pt('e', 0, 0)])!
    expect(m.ring68.rotationDeg).toBeCloseTo(6.2644, 3)
    expect(m.ring68.rx).toBeCloseTo(0.90083, 4)
  })
})

describe('computeDispersionStats avgAimDistance (WEB-24)', () => {
  it('averages the start-to-aim distance over shots that have a start', () => {
    // Starts 150 and 152 yd short of the aim → 151; the shot without a start is left out.
    const s = computeDispersionStats([
      pt('a', 0, 0, { startDistanceOffsetYards: -150 }),
      pt('b', 0, 0, { startDistanceOffsetYards: -152 }),
      pt('c', 0, 0),
      pt('d', 0, 0, { startDistanceOffsetYards: -150 }),
      pt('e', 0, 0, { startDistanceOffsetYards: -152 }),
    ])!
    expect(s.avgAimDistance).toBeCloseTo(151, 9)
  })
  it('is null when no shot has a start', () => {
    expect(computeDispersionStats([0, 1, 2, 3, 4].map((i) => pt(`n${i}`, 0, 0)))!.avgAimDistance).toBeNull()
  })
})

describe('aimAdvice (WEB-13 / WEB-34)', () => {
  // Rule: advise only when |mean| > 2·SE, SE = s/√n with the sample s = σ/√((n−1)/n),
  // i.e. SE = σ_pop/√(n−1); and never under the 2 yd floor.
  // Laterals m ± 5 twice and m once: σ_pop² = 4·25/5 = 20, SE = √20/√4 = 2.2361, 2·SE = 4.4721.
  const spread = (m: number, axis: 'x' | 'y') =>
    computeDispersionStats(
      [m - 5, m + 5, m - 5, m + 5, m].map((v, i) => (axis === 'x' ? pt(`s${i}`, v, 0) : pt(`s${i}`, 0, v))),
    )!

  it('keeps the aim when the average miss is inside twice its own uncertainty', () => {
    expect(aimAdvice(spread(4.4, 'x')).lateral).toBeNull()
    expect(spread(4.4, 'x').dominantMiss).toBe('straight')
    expect(getAimCorrection(spread(4.4, 'x'))).toMatch(/centered/i)
  })
  it('advises once the average miss is beyond it', () => {
    expect(aimAdvice(spread(4.6, 'x')).lateral).toBe('right')
    expect(aimAdvice(spread(-4.6, 'x')).lateral).toBe('left')
    expect(spread(4.6, 'x').dominantMiss).toBe('right')
    expect(getAimCorrection(spread(4.6, 'x'))).toBe('Move your aim 5 yards left to center your pattern.')
  })
  it('applies the same rule short and long', () => {
    expect(aimAdvice(spread(-4.4, 'y')).distance).toBeNull()
    expect(aimAdvice(spread(-4.6, 'y')).distance).toBe('short')
    expect(aimAdvice(spread(4.6, 'y')).distance).toBe('long')
  })
  it('never advises under 2 yd, however tight the pattern', () => {
    // σ = 0 → SE = 0; the 2 yd floor decides.
    const tight = (m: number) => computeDispersionStats([0, 1, 2, 3, 4].map((i) => pt(`f${i}`, m, m)))!
    expect(aimAdvice(tight(1.9))).toEqual({ lateral: null, distance: null })
    expect(aimAdvice(tight(2))).toEqual({ lateral: 'right', distance: 'long' })
  })
})

const withShapes = (shapes: (DispersionPoint['shape'])[]) => shapes.map((shape, i) => pt(`sh${i}`, 0, 0, { shape }))
const withStarts = (starts: (DispersionPoint['startLine'])[]) => starts.map((startLine, i) => pt(`st${i}`, 0, 0, { startLine }))
const rep = <T,>(v: T, n: number): T[] => Array.from({ length: n }, () => v)

describe('shapeTally / startLineTally (WEB-11 / WEB-32)', () => {
  it('counts recorded values and the shots without one', () => {
    const t = shapeTally(withShapes(['draw', 'draw', 'slice', null, undefined]), false)
    expect(t.counts).toEqual({ hook: 0, draw: 2, straight: 0, fade: 0, slice: 1 })
    expect(t.recorded).toBe(3)
    expect(t.notRecorded).toBe(2)
  })
  it('gives no word under five recorded, whatever the split', () => {
    expect(shapeTally(withShapes([...rep('draw' as const, 4), ...rep(null, 9)]), false).verdict).toBeNull()
  })
  it('names a value that holds at least half of five or more recorded', () => {
    // 3 of 5 = 60%.
    expect(shapeTally(withShapes([...rep('draw' as const, 3), 'fade', 'fade']), false).verdict).toBe('draw')
    // 3 of 6 = 50% exactly, the next is 2.
    expect(shapeTally(withShapes([...rep('draw' as const, 3), 'fade', 'fade', 'slice']), false).verdict).toBe('draw')
  })
  it('says mixed below half, and leans to the side with more', () => {
    // The 7-iron: 3 draws, 2 straight, 2 slices of 7 = 43% → mixed; left (3) vs right (2).
    const t = shapeTally(withShapes([...rep('draw' as const, 3), 'straight', 'straight', 'slice', 'slice']), false)
    expect(t.verdict).toBe('mixed')
    expect(t.lean).toBe('left')
    // A left-hander's draw curves right: same tags, the other side.
    expect(shapeTally(withShapes([...rep('draw' as const, 3), 'straight', 'straight', 'slice', 'slice']), true).lean).toBe('right')
  })
  it('says mixed when two values split it half and half', () => {
    const t = shapeTally(withShapes([...rep('draw' as const, 4), ...rep('fade' as const, 4)]), false)
    expect(t.verdict).toBe('mixed')
    expect(t.lean).toBeNull()
  })
  it('counts hook with draw and slice with fade for the lean', () => {
    // Left: hook 2 + draw 1 = 3; right: fade 1 + slice 1 = 2; straight 2 is neither.
    const t = shapeTally(withShapes(['hook', 'hook', 'draw', 'fade', 'slice', 'straight', 'straight']), false)
    expect(t.lean).toBe('left')
  })
  it('tallies start lines the same way', () => {
    // 5 push, 4 pull, 4 on line = 5/13 → mixed, leaning right (push) for a right-hander.
    const t = startLineTally(withStarts([...rep('push' as const, 5), ...rep('pull' as const, 4), ...rep('on_line' as const, 4)]), false)
    expect(t.counts).toEqual({ pull: 4, on_line: 4, push: 5 })
    expect(t.verdict).toBe('mixed')
    expect(t.lean).toBe('right')
    expect(startLineTally(withStarts([...rep('push' as const, 5), ...rep('pull' as const, 4)]), true).lean).toBe('left')
    expect(startLineTally(withStarts([...rep('on_line' as const, 5), 'push']), false).verdict).toBe('on_line')
  })
})

describe('missTally (WEB-14)', () => {
  it('counts short / long and left / right of the aim; level shots count neither', () => {
    const t = missTally([pt('a', -1, -3), pt('b', 0, 0), pt('c', 2, 5), pt('d', 3, -1)])
    expect(t).toEqual({ short: 2, long: 1, left: 1, right: 2 })
  })
})

describe('missLean', () => {
  // 13 shots, 10 short: 10/13 = 0.77 ≥ 0.7 → short. Left/right 4 vs 9: 9/13 = 0.69 < 0.7 → no lean.
  const iron = [...rep(0, 10).map((_, i) => pt(`s${i}`, i < 4 ? -2 : 2, -3)), ...rep(0, 3).map((_, i) => pt(`l${i}`, 2, 4))]
  it('names the side that holds at least 70% of the shots', () => {
    expect(missLean(iron)).toEqual({ distance: 'short', lateral: null })
  })
  it('says nothing under five shots', () => {
    // 4 of 4 short would be 100%, but 4 shots is too few.
    expect(missLean(iron.slice(0, 4))).toEqual({ distance: null, lateral: null })
  })
  it('counts level shots in the total, so they dilute a lean', () => {
    // 7 short of 10 = 0.7 → short; add 1 level shot: 7/11 = 0.64 → none.
    const ten = rep(0, 10).map((_, i) => pt(`t${i}`, 0, i < 7 ? -2 : 2))
    expect(missLean(ten).distance).toBe('short')
    expect(missLean([...ten, pt('lvl', 0, 0)]).distance).toBe(null)
  })
  it('finds a long or a left lean the same way', () => {
    const pts = rep(0, 6).map((_, i) => pt(`g${i}`, -1, i < 5 ? 3 : -3))
    expect(missLean(pts)).toEqual({ distance: 'long', lateral: 'left' })
  })
})

describe('startShapeMatrix (WEB-20)', () => {
  const both = (startLine: DispersionPoint['startLine'], shape: DispersionPoint['shape'], n: number) =>
    rep(0, n).map((_, i) => pt(`${startLine}-${shape}-${i}`, 0, 0, { startLine, shape }))

  it('counts only shots with both recorded and names the commonest cell', () => {
    const m = startShapeMatrix([
      ...both('push', 'fade', 3),
      ...both('pull', 'hook', 2),
      ...both('push', null, 4),
      ...both(null, 'fade', 4),
    ])
    expect(m.total).toBe(5)
    expect(m.counts.push.fade).toBe(3)
    expect(m.counts.pull.hook).toBe(2)
    expect(m.counts.on_line.straight).toBe(0)
    expect(m.commonest).toEqual({ startLine: 'push', shape: 'fade', count: 3 })
  })
  it('names no cell on a tie or when empty', () => {
    expect(startShapeMatrix([...both('push', 'fade', 2), ...both('pull', 'hook', 2)]).commonest).toBeNull()
    expect(startShapeMatrix([]).commonest).toBeNull()
  })
})

describe('recentVsAll (WEB-17)', () => {
  // 20 recent shots at ±2 yd (October) and 5 old ones at 20, −20, 20, −20, 0 (March).
  // Recent: σ = 2 → 68% width = 2·2·1.5096 = 6.0384.
  // All 25: mean 0, σ² = (20·4 + 4·400)/25 = 67.2, σ = 8.19756 → width = 2·8.19756·1.5096 = 24.7500.
  // Change = 6.0384 − 24.7500 = −18.7116.
  const recent = rep(0, 20).map((_, i) =>
    pt(`r${i}`, i % 2 ? 2 : -2, 0, { playedAt: `2026-10-${String(i + 1).padStart(2, '0')}` }),
  )
  const old = [20, -20, 20, -20, 0].map((x, i) => pt(`o${i}`, x, 0, { playedAt: `2026-03-0${i + 1}` }))

  it('compares the 20 most recent by played date with all of them', () => {
    // Old shots sit in the middle of the input: order must come from the dates.
    const r = recentVsAll([...recent.slice(0, 10), ...old, ...recent.slice(10)])!
    expect(r.recent.sampleSize).toBe(20)
    expect(r.all.sampleSize).toBe(25)
    expect(r.recent.cone68.lateral * 2).toBeCloseTo(6.0384, 3)
    expect(r.all.cone68.lateral * 2).toBeCloseTo(24.75, 3)
    expect(r.width68Change).toBeCloseTo(-18.7116, 3)
  })
  it('treats a shot without a date as the oldest', () => {
    const undated = old.map(({ playedAt: _, ...p }) => p)
    expect(recentVsAll([...undated, ...recent])!.recent.cone68.lateral * 2).toBeCloseTo(6.0384, 3)
  })
  it('has nothing to compare when every shot is recent', () => {
    expect(recentVsAll(recent)).toBeNull()
  })
  it('takes another count when given one', () => {
    // The 5 newest are October 16–20: +2, −2, +2, −2, +2 → mean 0.4, σ² = (3·1.6² + 2·2.4²)/5 = 3.84, σ = 1.95959.
    const r = recentVsAll([...old, ...recent], 5)!
    expect(r.recent.sampleSize).toBe(5)
    expect(r.recent.stdLateral).toBeCloseTo(1.95959, 4)
  })
})
