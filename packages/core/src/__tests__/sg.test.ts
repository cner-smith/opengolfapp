import { describe, expect, it } from 'vitest'
import {
  averageSGBreakdown,
  calculateRoundSG,
  calculateShotSG,
  getExpectedStrokes,
  type ShotWithContext,
} from '../sg-calculator'
import { computeRoundSG } from '../sg'
import type { SGBreakdown, Shot } from '../types'
import type { Database } from '@oga/supabase'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']
type ShotRow = Database['public']['Tables']['shots']['Row']

// Build a ShotWithContext from a sparse spec — keeps tests readable.
function shot(
  spec: Partial<Shot> & {
    par: number
    isLastShot: boolean
    shotNumber: number
  },
): ShotWithContext {
  return {
    id: spec.id ?? `shot-${spec.shotNumber}`,
    holeScoreId: spec.holeScoreId ?? 'hs',
    userId: spec.userId ?? 'user',
    shotNumber: spec.shotNumber,
    par: spec.par,
    isLastShot: spec.isLastShot,
    distanceToTarget: spec.distanceToTarget,
    lieType: spec.lieType,
    puttDistanceFt: spec.puttDistanceFt,
    puttResult: spec.puttResult,
    penalty: spec.penalty ?? false,
    ob: spec.ob ?? false,
  }
}

describe('getExpectedStrokes — direct', () => {
  it('approach 150 yd for scratch player → 3.12 (table value)', () => {
    expect(getExpectedStrokes('approach', 150, undefined, 0)).toBe(3.12)
  })

  it('off_tee uses the approach baseline table for the start distance', () => {
    // Tee shots share the approach interpolation.
    expect(getExpectedStrokes('off_tee', 150, undefined, 0)).toBe(3.12)
  })

  it('around_green 5 yd for scratch player → 2.18', () => {
    expect(getExpectedStrokes('around_green', 5, undefined, 0)).toBe(2.18)
  })

  it('putting needs the feet distance, ignores yards', () => {
    expect(getExpectedStrokes('putting', undefined, 10, 0)).toBe(1.37)
  })

  it('returns null when the required distance is missing', () => {
    expect(getExpectedStrokes('approach', undefined, undefined, 15)).toBeNull()
    expect(getExpectedStrokes('putting', undefined, undefined, 15)).toBeNull()
  })

  it('clamps to bracket — handicap 50 reads from the 30-bracket table', () => {
    // High handicap clamps to bracket 30. From 150 yd that's 5.01.
    expect(getExpectedStrokes('approach', 150, undefined, 50)).toBe(5.01)
  })
})

describe('averageSGBreakdown', () => {
  const r1: SGBreakdown = { offTee: 1.0, approach: 0.5, aroundGreen: 0.0, putting: -0.5, total: 1.0 }
  const r2: SGBreakdown = { offTee: -1.0, approach: -0.5, aroundGreen: 0.0, putting: 0.5, total: -1.0 }

  it('averages each category over multiple rounds', () => {
    const avg = averageSGBreakdown([r1, r2])
    expect(avg.offTee).toBe(0)
    expect(avg.approach).toBe(0)
    expect(avg.putting).toBe(0)
    expect(avg.total).toBe(0)
  })

  it('empty input returns zero breakdown — not NaN', () => {
    const avg = averageSGBreakdown([])
    expect(avg.offTee).toBe(0)
    expect(avg.approach).toBe(0)
    expect(avg.aroundGreen).toBe(0)
    expect(avg.putting).toBe(0)
    expect(avg.total).toBe(0)
  })

  it('single round returns its own breakdown', () => {
    expect(averageSGBreakdown([r1])).toEqual(r1)
  })
})

describe('calculateShotSG (pure formula)', () => {
  it('SG = start − end − 1 — neutral when no progress made', () => {
    expect(calculateShotSG(3.0, 2.0)).toBe(0)
  })

  it('positive when end is much closer than start', () => {
    expect(calculateShotSG(4.0, 2.0)).toBe(1)
    expect(calculateShotSG(3.5, 1.0)).toBe(1.5)
  })

  it('negative when expected progress was not made', () => {
    expect(calculateShotSG(3.0, 2.5)).toBe(-0.5)
    expect(calculateShotSG(2.0, 2.0)).toBe(-1)
  })
})

describe('calculateRoundSG — driveable par 4', () => {
  // Drive that leaves 70 yd, wedge to 10 ft, 1-putt holed.
  // Hand-computed against the baselines in sg-baselines.ts so the
  // assertions catch a baseline-table or formula regression.
  function buildRound(): ShotWithContext[] {
    return [
      shot({ shotNumber: 1, par: 4, isLastShot: false, lieType: 'tee', distanceToTarget: 350 }),
      shot({ shotNumber: 2, par: 4, isLastShot: false, lieType: 'fairway', distanceToTarget: 70 }),
      shot({ shotNumber: 3, par: 4, isLastShot: false, lieType: 'green', puttDistanceFt: 10 }),
      shot({ shotNumber: 4, par: 4, isLastShot: true, lieType: 'green', puttDistanceFt: 1, puttResult: 'made' }),
    ]
  }

  it('off-tee SG = 0.31 for hcp 20 — drive cleared 280 yd', () => {
    // start (off_tee, 350 yd → APPROACH[20] clamped 225) = 4.82
    // end (next shot from 70 yd fairway, APPROACH[20][70] interp) = 3.508
    // SG = 4.82 − 3.508 − 1 = 0.312
    const sg = calculateRoundSG(buildRound(), 20)
    expect(sg.offTee).toBeCloseTo(0.312, 2)
  })

  it('approach SG = 0.75 for hcp 20 — wedge to 10 ft', () => {
    // start (approach, 70 yd → APPROACH[20] interp) = 3.508
    // end (next shot 10 ft on green, PUTTING[20][10]) = 1.76
    // SG = 3.508 − 1.76 − 1 = 0.748
    const sg = calculateRoundSG(buildRound(), 20)
    expect(sg.approach).toBeCloseTo(0.748, 2)
  })

  it('putting SG = -0.24 for hcp 20 — left a 1 ft second, holed', () => {
    // PUTTING_BASELINES[20] minimum key is 3 ft, so 1 ft tap-ins
    // clamp to PUTTING[20][3] = 1.13. The second putt then "earns"
    // 1.13 - 0 - 1 = 0.13 because the last-shot endExpected is 0.
    //
    // putt 1 (10 ft → 1.76) → next 1 ft (clamped 3 ft → 1.13): -0.37
    // putt 2 (1 ft [clamped], last + holed): 1.13 − 0 − 1 = 0.13
    // putting total = -0.24
    const sg = calculateRoundSG(buildRound(), 20)
    expect(sg.putting).toBeCloseTo(-0.24, 2)
  })
})

describe('calculateRoundSG — 3-putt from 6 feet (handicap 0)', () => {
  // Approach from 150 yd → green 6 ft, 3-putt for bogey.
  const ROUND: ShotWithContext[] = [
    shot({ shotNumber: 1, par: 4, isLastShot: false, lieType: 'tee', distanceToTarget: 380 }),
    shot({ shotNumber: 2, par: 4, isLastShot: false, lieType: 'fairway', distanceToTarget: 150 }),
    // Three-putt from 6 ft.
    shot({ shotNumber: 3, par: 4, isLastShot: false, lieType: 'green', puttDistanceFt: 6 }),
    shot({ shotNumber: 4, par: 4, isLastShot: false, lieType: 'green', puttDistanceFt: 1.5 }),
    shot({ shotNumber: 5, par: 4, isLastShot: true, lieType: 'green', puttDistanceFt: 0.5, puttResult: 'made' }),
  ]

  it('putting SG = -1.81 — pinned to the hand-computed value', () => {
    // PUTTING_BASELINES[0]'s minimum key is 3 ft, so any distance ≤3
    // ft clamps to PUTTING[0][3] = 1.03. That's why the math below
    // shows 1.5 ft and 0.5 ft both expecting 1.03 strokes — the
    // baseline table simply doesn't model sub-3-ft tap-ins, and a putt
    // from 1.5 ft to 0.5 ft therefore "earns" SG = 1.03 - 1.03 - 1
    // = -1.0 (it cost a stroke without changing the expected). This
    // is a documented coarseness in the baseline tables, not a logic
    // bug in calculateRoundSG.
    //
    // putt 1 (6 ft → 1.193, next 1.5 ft → 1.03 [clamped]): -0.837
    // putt 2 (1.5 ft → 1.03 [clamped], next 0.5 ft → 1.03 [clamped]): -1.0
    // putt 3 (0.5 ft → 1.03 [clamped], holed → 0): 0.03
    // sum = -1.807
    const sg = calculateRoundSG(ROUND, 0)
    expect(sg.putting).toBeCloseTo(-1.807, 2)
  })

  it('round total ≈ -1.55 strokes lost — 3-putt drags it negative', () => {
    // offTee(-0.67) + approach(0.927) + putting(-1.807) ≈ -1.55
    const sg = calculateRoundSG(ROUND, 0)
    expect(sg.total).toBeCloseTo(-1.55, 1)
  })
})

describe('calculateRoundSG — holing out from 50 yards', () => {
  // Par 4 holed from 50 yd on shot 2 (eagle 2). isLastShot=true on
  // shot 2 means the SG calc treats endExpected as 0.
  const ROUND: ShotWithContext[] = [
    shot({ shotNumber: 1, par: 4, isLastShot: false, lieType: 'tee', distanceToTarget: 380 }),
    shot({ shotNumber: 2, par: 4, isLastShot: true, lieType: 'fairway', distanceToTarget: 50 }),
  ]

  it('scratch hole-out from 50 yd → +1.60 strokes gained', () => {
    // APPROACH[0][50] = 2.6, end = 0 → SG = 1.6
    const sg = calculateRoundSG(ROUND, 0)
    expect(sg.approach).toBeCloseTo(1.6, 2)
  })

  it('hcp-20 hole-out from 50 yd → +2.30 strokes gained', () => {
    // APPROACH[20][50] = 3.30 → SG = 2.30. Higher-handicap players
    // gain more from the same magic shot because their baseline is
    // worse — ~0.7 strokes more than scratch in this scenario.
    const sg = calculateRoundSG(ROUND, 20)
    expect(sg.approach).toBeCloseTo(2.3, 2)
    const scratch = calculateRoundSG(ROUND, 0).approach
    expect(sg.approach - scratch).toBeGreaterThan(0.5)
  })
})

describe('calculateRoundSG — empty / degenerate inputs', () => {
  it('no shots → all-zero breakdown', () => {
    const sg = calculateRoundSG([], 15)
    expect(sg.offTee).toBe(0)
    expect(sg.approach).toBe(0)
    expect(sg.aroundGreen).toBe(0)
    expect(sg.putting).toBe(0)
    expect(sg.total).toBe(0)
  })

  it('par-3 tee shot routes to approach, not off-tee', () => {
    // Off-tee category is reserved for par 4/5 — par 3 tee shots count
    // as approach in SG analysis. So a par-3 round should have offTee=0
    // even though the player did hit a tee shot.
    const round: ShotWithContext[] = [
      shot({ shotNumber: 1, par: 3, isLastShot: false, lieType: 'tee', distanceToTarget: 150 }),
      shot({ shotNumber: 2, par: 3, isLastShot: false, lieType: 'green', puttDistanceFt: 25 }),
      shot({ shotNumber: 3, par: 3, isLastShot: true, lieType: 'green', puttDistanceFt: 0.5, puttResult: 'made' }),
    ]
    const sg = calculateRoundSG(round, 15)
    expect(sg.offTee).toBe(0)
  })
})

describe('computeRoundSG (sg.ts) — DB row → result adapter', () => {
  // Build minimal DB rows. Only the fields computeRoundSG reads matter.
  function holeRow(overrides: Partial<HoleRow>): HoleRow {
    return {
      id: overrides.id ?? 'h1',
      course_id: overrides.course_id ?? 'c',
      number: overrides.number ?? 1,
      par: overrides.par ?? 4,
      yards: overrides.yards ?? 380,
      stroke_index: overrides.stroke_index ?? 1,
      tee_lat: overrides.tee_lat ?? null,
      tee_lng: overrides.tee_lng ?? null,
      pin_lat: overrides.pin_lat ?? null,
      pin_lng: overrides.pin_lng ?? null,
    }
  }

  function holeScoreRow(overrides: Partial<HoleScoreRow>): HoleScoreRow {
    return {
      id: overrides.id ?? 'hs',
      round_id: overrides.round_id ?? 'r',
      hole_id: overrides.hole_id ?? 'h1',
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
    }
  }

  function shotRow(overrides: Partial<ShotRow>): ShotRow {
    return {
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
    }
  }

  it('aggregates totals across multiple holes', () => {
    const holes = [
      holeRow({ id: 'h1', par: 4 }),
      holeRow({ id: 'h2', par: 4 }),
    ]
    const holeScores = [
      holeScoreRow({ id: 'hs1', hole_id: 'h1', score: 4, putts: 2, fairway_hit: true, gir: true }),
      holeScoreRow({ id: 'hs2', hole_id: 'h2', score: 5, putts: 2, fairway_hit: false, gir: false }),
    ]
    const shots = [
      shotRow({ shot_number: 1, hole_score_id: 'hs1', lie_type: 'tee', distance_to_target: 380 }),
      shotRow({ shot_number: 2, hole_score_id: 'hs1', lie_type: 'green', putt_distance_ft: 5 }),
      shotRow({ shot_number: 1, hole_score_id: 'hs2', lie_type: 'tee', distance_to_target: 380 }),
    ]
    const result = computeRoundSG({ holes, holeScores, shots, handicap: 15 })
    expect(result.totals.totalScore).toBe(9)
    expect(result.totals.totalPutts).toBe(4)
    expect(result.totals.fairwaysHit).toBe(1)
    expect(result.totals.fairwaysTotal).toBe(2)
    expect(result.totals.gir).toBe(1)
  })

  it('skips hole_scores with no shots — no crash', () => {
    const holes = [holeRow({ id: 'h1', par: 4 })]
    const holeScores = [holeScoreRow({ id: 'hs1', hole_id: 'h1', score: 4 })]
    const result = computeRoundSG({ holes, holeScores, shots: [], handicap: 15 })
    expect(result.round.total).toBe(0)
    expect(result.perHoleScore).toEqual({})
  })

  it('par-3 holes do not contribute to fairwaysTotal', () => {
    const holes = [holeRow({ id: 'h1', par: 3 })]
    const holeScores = [holeScoreRow({ id: 'hs1', hole_id: 'h1', score: 3 })]
    const result = computeRoundSG({ holes, holeScores, shots: [], handicap: 15 })
    expect(result.totals.fairwaysTotal).toBe(0)
    expect(result.totals.fairwaysHit).toBe(0)
  })
})

describe('calculateRoundSG — penalty / OB attribution', () => {
  function buildClean(): ShotWithContext[] {
    return [
      shot({ shotNumber: 1, par: 4, isLastShot: false, lieType: 'tee', distanceToTarget: 380 }),
      shot({ shotNumber: 2, par: 4, isLastShot: true, lieType: 'fairway', distanceToTarget: 50 }),
    ]
  }

  it('penalty stroke subtracts 1 from the affected category SG', () => {
    const withPenalty: ShotWithContext[] = [
      shot({ shotNumber: 1, par: 4, isLastShot: false, lieType: 'tee', distanceToTarget: 380, penalty: true }),
      shot({ shotNumber: 2, par: 4, isLastShot: true, lieType: 'fairway', distanceToTarget: 50 }),
    ]
    const a = calculateRoundSG(buildClean(), 15)
    const b = calculateRoundSG(withPenalty, 15)
    expect(b.offTee).toBeCloseTo(a.offTee - 1, 6)
    // Approach SG and other categories unchanged.
    expect(b.approach).toBeCloseTo(a.approach, 6)
  })

  it('OB stroke subtracts 1 from the affected category SG', () => {
    // OB is graded the same as a one-stroke penalty in the SG impl
    // (penaltyAdjust = penalty || ob). Stroke-and-distance is not
    // separately modeled — the dropped re-tee just becomes the next
    // shot in the array. This pin makes sure the OB branch stays
    // wired up and doesn't silently zero out.
    const withOB: ShotWithContext[] = [
      shot({ shotNumber: 1, par: 4, isLastShot: false, lieType: 'tee', distanceToTarget: 380, ob: true }),
      shot({ shotNumber: 2, par: 4, isLastShot: true, lieType: 'fairway', distanceToTarget: 50 }),
    ]
    const a = calculateRoundSG(buildClean(), 15)
    const b = calculateRoundSG(withOB, 15)
    expect(b.offTee).toBeCloseTo(a.offTee - 1, 6)
    expect(b.approach).toBeCloseTo(a.approach, 6)
  })

  it('OB and penalty stack — both flags subtract together', () => {
    // The impl uses `penalty || ob`, so a shot flagged with both still
    // takes only ONE -1 adjustment, not two. Lock this in so a future
    // refactor that splits them doesn't accidentally double-count.
    const both: ShotWithContext[] = [
      shot({ shotNumber: 1, par: 4, isLastShot: false, lieType: 'tee', distanceToTarget: 380, penalty: true, ob: true }),
      shot({ shotNumber: 2, par: 4, isLastShot: true, lieType: 'fairway', distanceToTarget: 50 }),
    ]
    const a = calculateRoundSG(buildClean(), 15)
    const b = calculateRoundSG(both, 15)
    expect(b.offTee).toBeCloseTo(a.offTee - 1, 6)
  })
})
