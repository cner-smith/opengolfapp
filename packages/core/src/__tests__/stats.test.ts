import { describe, expect, it } from 'vitest'
import {
  computeDetailedStats,
  getProximityYards,
  scoringDistribution,
  scoringStats,
  shortGameStats,
  type DetailedHoleScore,
  type DetailedRound,
} from '../stats'
import { combinedPuttResult } from '../types'
import type { Database } from '@oga/supabase'

type RoundRow = Database['public']['Tables']['rounds']['Row']
type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']
type ShotRow = Database['public']['Tables']['shots']['Row']

// Defaults that satisfy the DB row contracts; tests override only the
// fields they care about.
function row<T>(overrides: Partial<T>): T {
  return overrides as T
}

function makeHole(overrides: Partial<HoleRow>): HoleRow {
  return row<HoleRow>({
    id: overrides.id ?? `h-${overrides.number ?? 1}`,
    course_id: overrides.course_id ?? 'course',
    number: overrides.number ?? 1,
    par: overrides.par ?? 4,
    yards: overrides.yards ?? 380,
    stroke_index: overrides.stroke_index ?? 1,
    tee_lat: overrides.tee_lat ?? null,
    tee_lng: overrides.tee_lng ?? null,
    pin_lat: overrides.pin_lat ?? null,
    pin_lng: overrides.pin_lng ?? null,
    ...overrides,
  })
}

function makeShot(overrides: Partial<ShotRow>): ShotRow {
  return row<ShotRow>({
    id: overrides.id ?? `s-${overrides.shot_number ?? 1}`,
    hole_score_id: overrides.hole_score_id ?? 'hs',
    user_id: overrides.user_id ?? 'u',
    shot_number: overrides.shot_number ?? 1,
    start_lat: overrides.start_lat ?? null,
    start_lng: overrides.start_lng ?? null,
    end_lat: overrides.end_lat ?? null,
    end_lng: overrides.end_lng ?? null,
    aim_lat: overrides.aim_lat ?? null,
    aim_lng: overrides.aim_lng ?? null,
    distance_to_target: overrides.distance_to_target ?? null,
    club: overrides.club ?? null,
    lie_type: overrides.lie_type ?? null,
    lie_slope: overrides.lie_slope ?? null,
    lie_slope_forward: overrides.lie_slope_forward ?? null,
    lie_slope_side: overrides.lie_slope_side ?? null,
    shot_result: overrides.shot_result ?? null,
    penalty: overrides.penalty ?? false,
    ob: overrides.ob ?? false,
    aim_offset_yards: overrides.aim_offset_yards ?? null,
    break_direction: overrides.break_direction ?? null,
    putt_result: overrides.putt_result ?? null,
    putt_distance_result: overrides.putt_distance_result ?? null,
    putt_direction_result: overrides.putt_direction_result ?? null,
    putt_distance_ft: overrides.putt_distance_ft ?? null,
    putt_slope_pct: overrides.putt_slope_pct ?? null,
    green_speed: overrides.green_speed ?? null,
    notes: overrides.notes ?? null,
    created_at: overrides.created_at ?? '2026-01-01T00:00:00Z',
  })
}

function makeHoleScore(overrides: Partial<DetailedHoleScore>): DetailedHoleScore {
  return row<DetailedHoleScore>({
    id: overrides.id ?? 'hs',
    round_id: overrides.round_id ?? 'r',
    hole_id: overrides.hole_id ?? 'h-1',
    score: overrides.score ?? 4,
    putts: overrides.putts ?? null,
    fairway_hit: overrides.fairway_hit ?? null,
    gir: overrides.gir ?? null,
    pin_lat: overrides.pin_lat ?? null,
    pin_lng: overrides.pin_lng ?? null,
    sg_off_tee: overrides.sg_off_tee ?? null,
    sg_approach: overrides.sg_approach ?? null,
    sg_around_green: overrides.sg_around_green ?? null,
    sg_putting: overrides.sg_putting ?? null,
    holes: overrides.holes ?? null,
    shots: overrides.shots ?? null,
  })
}

function makeRound(overrides: Partial<DetailedRound>): DetailedRound {
  return row<DetailedRound>({
    id: overrides.id ?? 'r',
    user_id: overrides.user_id ?? 'u',
    course_id: overrides.course_id ?? 'course',
    played_at: overrides.played_at ?? '2026-01-01',
    tee_color: overrides.tee_color ?? null,
    total_score: overrides.total_score ?? null,
    total_putts: overrides.total_putts ?? null,
    fairways_hit: overrides.fairways_hit ?? null,
    fairways_total: overrides.fairways_total ?? null,
    gir: overrides.gir ?? null,
    sg_off_tee: overrides.sg_off_tee ?? null,
    sg_approach: overrides.sg_approach ?? null,
    sg_around_green: overrides.sg_around_green ?? null,
    sg_putting: overrides.sg_putting ?? null,
    sg_total: overrides.sg_total ?? null,
    notes: overrides.notes ?? null,
    hole_scores: overrides.hole_scores ?? null,
  })
}

describe('computeDetailedStats — empty input', () => {
  it('returns null aggregates instead of NaN or throwing', () => {
    const stats = computeDetailedStats([], 15)
    expect(stats.rounds).toBe(0)
    expect(stats.holesPlayed).toBe(0)
    expect(stats.sg.offTee).toBeNull()
    expect(stats.sg.approach).toBeNull()
    expect(stats.sg.aroundGreen).toBeNull()
    expect(stats.sg.putting).toBeNull()
  })

  it('lists are empty, scoring counts are zero', () => {
    const stats = computeDetailedStats([], 15)
    expect(stats.sgTrend).toEqual([])
    expect(stats.missTendency).toEqual([])
    expect(stats.costlyLies).toEqual([])
    expect(stats.clubAccuracy).toEqual([])
    expect(stats.scoring.avgScore).toBeNull()
    expect(stats.scoring.bestRound).toBeNull()
    expect(stats.scoringDistribution.total).toBe(0)
  })

})

describe('sgTrend', () => {
  it('skips rounds that have no recorded sg_total', () => {
    const round = makeRound({
      played_at: '2026-01-15',
      hole_scores: [],
      sg_total: null,
    })
    const stats = computeDetailedStats([round], 15)
    expect(stats.sgTrend).toHaveLength(0)
  })

  it('reverses chronological order (oldest → newest) for charting', () => {
    // sgTrend is consumed by line charts that read left-to-right as
    // oldest → newest. The impl reverses the input array and filters
    // null sg_total. Pin the order so a chart regression surfaces.
    const rounds = [
      makeRound({ id: 'r3', played_at: '2026-03-01', sg_total: 0.3, hole_scores: [] }),
      makeRound({ id: 'r2', played_at: '2026-02-01', sg_total: 0.2, hole_scores: [] }),
      makeRound({ id: 'r1', played_at: '2026-01-01', sg_total: 0.1, hole_scores: [] }),
    ]
    const stats = computeDetailedStats(rounds, 15)
    expect(stats.sgTrend.map((p) => p.date)).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
    ])
  })
})

describe('computeDetailedStats — sgAverages', () => {
  it('averages over rounds that have non-null SG values', () => {
    const rounds: DetailedRound[] = [
      makeRound({ id: 'r1', sg_off_tee: 1.0, sg_approach: -0.5, hole_scores: [] }),
      makeRound({ id: 'r2', sg_off_tee: 0.5, sg_approach: -1.5, hole_scores: [] }),
    ]
    const stats = computeDetailedStats(rounds, 15)
    expect(stats.sg.offTee).toBeCloseTo(0.75, 6)
    expect(stats.sg.approach).toBeCloseTo(-1.0, 6)
  })

  it('handles a mix of null + populated SG values per category', () => {
    const rounds: DetailedRound[] = [
      makeRound({ id: 'r1', sg_putting: 0.5, hole_scores: [] }),
      makeRound({ id: 'r2', sg_putting: null, hole_scores: [] }),
    ]
    const stats = computeDetailedStats(rounds, 15)
    expect(stats.sg.putting).toBe(0.5)
  })
})

describe('scoringStats', () => {
  it('avgScore averages totalScore across rounds', () => {
    const rounds: DetailedRound[] = [
      makeRound({ id: 'r1', total_score: 80, hole_scores: [] }),
      makeRound({ id: 'r2', total_score: 90, hole_scores: [] }),
    ]
    expect(scoringStats(rounds).avgScore).toBe(85)
  })

  it('best/worst track the extremes', () => {
    const rounds: DetailedRound[] = [
      makeRound({ id: 'r1', total_score: 92, hole_scores: [] }),
      makeRound({ id: 'r2', total_score: 78, hole_scores: [] }),
      makeRound({ id: 'r3', total_score: 85, hole_scores: [] }),
    ]
    const s = scoringStats(rounds)
    expect(s.bestRound).toBe(78)
    expect(s.worstRound).toBe(92)
  })

  it('separates par-3 / par-4 / par-5 averages', () => {
    const par3 = makeHole({ id: 'h-3', number: 3, par: 3 })
    const par5 = makeHole({ id: 'h-5', number: 5, par: 5 })
    const round: DetailedRound = makeRound({
      hole_scores: [
        makeHoleScore({ id: 'hs1', score: 4, hole_id: 'h-3', holes: par3 }),
        makeHoleScore({ id: 'hs2', score: 6, hole_id: 'h-5', holes: par5 }),
      ],
    })
    const s = scoringStats([round])
    expect(s.avgPar3).toBe(4)
    expect(s.avgPar5).toBe(6)
    expect(s.avgPar4).toBeNull()
  })

  it('front 9 / back 9 split by hole number', () => {
    const round: DetailedRound = makeRound({
      hole_scores: [
        makeHoleScore({ id: 'hs1', score: 4, holes: makeHole({ id: 'h1', number: 1, par: 4 }) }),
        makeHoleScore({ id: 'hs2', score: 5, holes: makeHole({ id: 'h2', number: 9, par: 4 }) }),
        makeHoleScore({ id: 'hs3', score: 6, holes: makeHole({ id: 'h3', number: 10, par: 4 }) }),
        makeHoleScore({ id: 'hs4', score: 7, holes: makeHole({ id: 'h4', number: 18, par: 4 }) }),
      ],
    })
    const s = scoringStats([round])
    expect(s.front9Avg).toBe(4.5)
    expect(s.back9Avg).toBe(6.5)
  })
})

describe('scoringDistribution', () => {
  it('classifies score - par into the right bucket', () => {
    const round: DetailedRound = makeRound({
      hole_scores: [
        // Eagle (par 5 in 3)
        makeHoleScore({ id: 'hs1', score: 3, holes: makeHole({ id: 'h1', number: 1, par: 5 }) }),
        // Birdie
        makeHoleScore({ id: 'hs2', score: 3, holes: makeHole({ id: 'h2', number: 2, par: 4 }) }),
        // Par
        makeHoleScore({ id: 'hs3', score: 4, holes: makeHole({ id: 'h3', number: 3, par: 4 }) }),
        // Bogey
        makeHoleScore({ id: 'hs4', score: 5, holes: makeHole({ id: 'h4', number: 4, par: 4 }) }),
        // Double
        makeHoleScore({ id: 'hs5', score: 6, holes: makeHole({ id: 'h5', number: 5, par: 4 }) }),
        // Triple+
        makeHoleScore({ id: 'hs6', score: 8, holes: makeHole({ id: 'h6', number: 6, par: 4 }) }),
      ],
    })
    const dist = scoringDistribution([round])
    const counts = Object.fromEntries(dist.slices.map((s) => [s.key, s.count]))
    expect(counts.eagleOrBetter).toBe(1)
    expect(counts.birdie).toBe(1)
    expect(counts.par).toBe(1)
    expect(counts.bogey).toBe(1)
    expect(counts.double).toBe(1)
    expect(counts.triplePlus).toBe(1)
    expect(dist.total).toBe(6)
  })

  it('percentages sum to 100% (within rounding)', () => {
    const round: DetailedRound = makeRound({
      hole_scores: [
        makeHoleScore({ id: 'hs1', score: 4, holes: makeHole({ id: 'h1', number: 1, par: 4 }) }),
        makeHoleScore({ id: 'hs2', score: 5, holes: makeHole({ id: 'h2', number: 2, par: 4 }) }),
      ],
    })
    const dist = scoringDistribution([round])
    const total = dist.slices.reduce((sum, s) => sum + s.pct, 0)
    expect(total).toBeCloseTo(100, 6)
  })
})

describe('shortGameStats — putts and 3-putts', () => {
  const round: DetailedRound = makeRound({
    total_putts: 35,
    hole_scores: [
      makeHoleScore({
        id: 'hs1',
        score: 4,
        gir: true,
        putts: 2,
        holes: makeHole({ id: 'h1', number: 1, par: 4 }),
        shots: [],
      }),
      makeHoleScore({
        id: 'hs2',
        score: 6,
        gir: true,
        putts: 3,
        holes: makeHole({ id: 'h2', number: 2, par: 4 }),
        shots: [],
      }),
      makeHoleScore({
        id: 'hs3',
        score: 5,
        gir: false,
        putts: 2,
        holes: makeHole({ id: 'h3', number: 3, par: 4 }),
        shots: [],
      }),
    ],
  })

  it('puttsPerRound averages totals over rounds', () => {
    expect(shortGameStats([round]).puttsPerRound).toBe(35)
  })

  it('3-putt percentage counts only holes with ≥3 putts', () => {
    // 1 of 3 holes had 3+ putts → ~33%
    expect(shortGameStats([round]).threePuttPct).toBeCloseTo(100 / 3, 4)
  })

  it('puttsPerGir counts putts only on GIR holes', () => {
    // GIR holes had 2 + 3 = 5 putts over 2 holes → 2.5
    expect(shortGameStats([round]).puttsPerGir).toBe(2.5)
  })

  it('upAndDownPct = 0% when no missed-GIR hole salvaged par', () => {
    // 1 missed-GIR hole, score=5 (par 4) → not up-and-down → 0%
    expect(shortGameStats([round]).upAndDownPct).toBe(0)
  })

  it('upAndDownPct = 100% when every missed-GIR hole was par or better', () => {
    const r: DetailedRound = makeRound({
      hole_scores: [
        // missed GIR, made par → up & down
        makeHoleScore({
          id: 'hs1',
          score: 4,
          gir: false,
          putts: 1,
          holes: makeHole({ id: 'h1', number: 1, par: 4 }),
          shots: [],
        }),
      ],
    })
    expect(shortGameStats([r]).upAndDownPct).toBe(100)
  })

  it('scramblingPct counts holes with around-green shots that finished par-or-better', () => {
    // Two holes had a fringe lie; one was saved (par), one was not.
    const r: DetailedRound = makeRound({
      hole_scores: [
        makeHoleScore({
          id: 'hs1',
          score: 4,
          gir: false,
          holes: makeHole({ id: 'h1', number: 1, par: 4 }),
          shots: [makeShot({ shot_number: 3, lie_type: 'fringe' })],
        }),
        makeHoleScore({
          id: 'hs2',
          score: 6,
          gir: false,
          holes: makeHole({ id: 'h2', number: 2, par: 4 }),
          shots: [makeShot({ shot_number: 3, lie_type: 'rough' })],
        }),
      ],
    })
    expect(shortGameStats([r]).scramblingPct).toBe(50)
  })

  it('sandSavePct measures par-or-better recovery from sand lies', () => {
    const r: DetailedRound = makeRound({
      hole_scores: [
        makeHoleScore({
          id: 'hs1',
          score: 4,
          holes: makeHole({ id: 'h1', number: 1, par: 4 }),
          shots: [makeShot({ shot_number: 2, lie_type: 'sand' })],
        }),
      ],
    })
    expect(shortGameStats([r]).sandSavePct).toBe(100)
  })
})

describe('getProximityYards', () => {
  // OKC area; pin at one lat, ball end ~50 yd north.
  const PIN_LAT = 35.4676
  const PIN_LNG = -97.5164
  const NORTH_50YD = 35.4676 + 0.000411 // ~50 yd north

  it('measures distance to the per-round pin override when set', () => {
    const hs = { pin_lat: PIN_LAT, pin_lng: PIN_LNG }
    const hole = { pin_lat: null, pin_lng: null }
    const d = getProximityYards(NORTH_50YD, PIN_LNG, hs, hole)
    expect(d).not.toBeNull()
    expect(d!).toBeGreaterThan(45)
    expect(d!).toBeLessThan(55)
  })

  it('falls back to hole pin when round override is missing', () => {
    const hs = { pin_lat: null, pin_lng: null }
    const hole = { pin_lat: PIN_LAT, pin_lng: PIN_LNG }
    expect(getProximityYards(NORTH_50YD, PIN_LNG, hs, hole)).not.toBeNull()
  })

  it('returns null when both round and hole pins are missing', () => {
    const hs = { pin_lat: null, pin_lng: null }
    const hole = { pin_lat: null, pin_lng: null }
    expect(getProximityYards(NORTH_50YD, PIN_LNG, hs, hole)).toBeNull()
  })

  it('round override wins over hole default', () => {
    // hs pin in OKC, hole pin in Tulsa — should measure to OKC.
    const hs = { pin_lat: PIN_LAT, pin_lng: PIN_LNG }
    const hole = { pin_lat: 36.154, pin_lng: -95.9928 }
    const d = getProximityYards(NORTH_50YD, PIN_LNG, hs, hole)
    expect(d).toBeLessThan(100) // OKC, not 170k yd to Tulsa
  })
})

describe('combinedPuttResult', () => {
  // Has been broken twice — exhaustively cover every combo to lock in
  // the priority order: made > distance > direction.
  it('made → "made" regardless of axis values', () => {
    expect(combinedPuttResult({ made: true })).toBe('made')
    expect(combinedPuttResult({ made: true, distance: 'short' })).toBe('made')
    expect(combinedPuttResult({ made: true, direction: 'left' })).toBe('made')
    expect(combinedPuttResult({ made: true, distance: 'long', direction: 'right' })).toBe('made')
  })

  it('not-made + distance → distance value wins', () => {
    expect(combinedPuttResult({ made: false, distance: 'short' })).toBe('short')
    expect(combinedPuttResult({ distance: 'long' })).toBe('long')
    // Even with direction also set, distance takes priority.
    expect(combinedPuttResult({ distance: 'short', direction: 'left' })).toBe('short')
    expect(combinedPuttResult({ distance: 'long', direction: 'right' })).toBe('long')
  })

  it('not-made + direction-only → missed_<direction>', () => {
    expect(combinedPuttResult({ direction: 'left' })).toBe('missed_left')
    expect(combinedPuttResult({ direction: 'right' })).toBe('missed_right')
  })

  it('all-null inputs return null', () => {
    expect(combinedPuttResult({})).toBeNull()
    expect(combinedPuttResult({ made: false })).toBeNull()
    expect(combinedPuttResult({ made: false, distance: null, direction: null })).toBeNull()
  })
})
