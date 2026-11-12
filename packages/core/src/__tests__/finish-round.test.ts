import { describe, expect, it } from 'vitest'
import { finishRoundPlan, roundSGPatch, type FinishRoundInput } from '../finish-round'
import type { Database } from '@oga/supabase'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']
type ShotRow = Database['public']['Tables']['shots']['Row']
type CourseTeeRow = Database['public']['Tables']['course_tees']['Row']

function hole(o: Partial<HoleRow> & { id: string }): HoleRow {
  return {
    course_id: 'c', loop_of: null, number: 1, par: 4, par_source: null, yards: 400, stroke_index: null,
    tee_lat: null, tee_lng: null, pin_lat: null, pin_lng: null, ...o,
  }
}

function hs(o: Partial<HoleScoreRow> & { id: string; hole_id: string }): HoleScoreRow {
  return {
    round_id: 'r', score: 0, par: null, putts: null, penalties: 0, fairway_hit: null, gir: null, finished_at: null,
    pin_lat: null, pin_lng: null, sg_off_tee: null, sg_approach: null, sg_around_green: null, sg_putting: null, ...o,
  }
}

function shot(o: Partial<ShotRow> & { hole_score_id: string; shot_number: number }): ShotRow {
  return {
    id: `${o.hole_score_id}-${o.shot_number}`, user_id: 'u', start_lat: null, start_lng: null, end_lat: null,
    end_lng: null, aim_lat: null, aim_lng: null, distance_to_target: null, club: null, lie_type: null, lie_slope: null,
    lie_slope_forward: null, lie_slope_side: null, shot_result: null, contact: null, shape: null, start_line: null,
    penalty: false, ob: false, aim_offset_yards: null, break_direction: null, break_direction_vertical: null,
    break_direction_horizontal: null, putt_result: null, putt_distance_result: null, putt_direction_result: null,
    putt_distance_ft: null, putt_slope_pct: null, green_speed: null, notes: null, created_at: '2026-01-01T00:00:00Z',
    ...o,
  }
}

function tee(o: Partial<CourseTeeRow> & { id: string }): CourseTeeRow {
  return {
    course_id: 'c', course_rating: null, created_at: '2026-01-01T00:00:00Z', created_by: null, is_primary: false,
    par: null, slope_rating: null, tee_color: 'white', tee_name: null, total_yards: null, ...o,
  }
}

function input(o: Partial<FinishRoundInput>): FinishRoundInput {
  return {
    holes: [], holeScores: [], shots: [], tees: [], courseTeeId: null, teeColor: null, roundHoleCount: null,
    handicap: 15, ...o,
  }
}

// All SG below at handicap 15 → bracket 15 (sg-baselines.ts):
//   putting 3 ft 1.10 · 10 ft 1.65 · approach 150 yd 3.95 · around green 10 yd 2.73
//   tee line, w = (15 + 5) / 20 = 1: 2.79 + 0.0066·d → 400 yd 5.43, 150 yd 3.78
// Shot SG = start − end − 1 (− 1 more for a penalty / OB stroke).
describe('finishRoundPlan', () => {
  it('OB hole stamped 0: score repaired to rows + OB, fairway/GIR filled, around-green null', () => {
    // Par 4, 400 yd. Rows: tee OB · re-tee · 150 yd fairway · 10 ft putt · 3 ft putt made.
    // Score: 5 rows + 1 OB stroke = 6 (was stamped 0).
    //   1 OB drive: 5.43 − 5.43 (replay, same spot) − 1 − 1 = −2.00 (off tee)
    //   2 re-tee:   5.43 − 3.95 − 1 = 0.48 (off tee, replay keeps the category)
    //   3 approach: 3.95 − 1.65 − 1 = 1.30
    //   4 putt:     1.65 − 1.10 − 1 = −0.45
    //   5 putt:     1.10 − 0    − 1 = 0.10
    // off tee −1.52, approach 1.30, around green: no shot → null, putting −0.35, total −0.57.
    // Fairway: shot 2 starts on the tee → false. GIR: first green start is shot 4 > par − 1 − OB = 2 → false.
    const plan = finishRoundPlan(
      input({
        holes: [hole({ id: 'h1' })],
        holeScores: [hs({ id: 'a', hole_id: 'h1', score: 0 })],
        shots: [
          shot({ hole_score_id: 'a', shot_number: 1, lie_type: 'tee', distance_to_target: 400, ob: true }),
          shot({ hole_score_id: 'a', shot_number: 2, lie_type: 'tee', distance_to_target: 400 }),
          shot({ hole_score_id: 'a', shot_number: 3, lie_type: 'fairway', distance_to_target: 150 }),
          shot({ hole_score_id: 'a', shot_number: 4, lie_type: 'green', putt_distance_ft: 10 }),
          shot({ hole_score_id: 'a', shot_number: 5, lie_type: 'green', putt_distance_ft: 3, putt_result: 'made' }),
        ],
      }),
    )
    expect(plan).toEqual({
      inferUpserts: [{ id: 'a', round_id: 'r', hole_id: 'h1', score: 6, fairway_hit: false, gir: false }],
      sgRows: [
        { id: 'a', round_id: 'r', hole_id: 'h1', score: 6, sg_off_tee: -1.52, sg_approach: 1.3, sg_around_green: null, sg_putting: -0.35 },
      ],
      roundPatch: {
        sg_off_tee: -1.52, sg_approach: 1.3, sg_around_green: null, sg_putting: -0.35, sg_total: -0.57,
        total_score: 6, total_putts: null, fairways_hit: 0, fairways_total: 1, gir: 0,
        course_tee_id: null, score_differential: null,
      },
      differential: null,
    })
  })

  it('par override: a par 4 played as a par 3 has no tee shot and no fairway', () => {
    // hole_scores.par 3 overrides the course's 4. Tee shot 150 yd on a par 3 is approach:
    //   1: 3.95 − 1.65 − 1 = 1.30 · 2: 1.65 − 1.10 − 1 = −0.45 · 3: 1.10 − 1 = 0.10
    // (As a par 4 it would be off tee: 3.78 − 1.65 − 1 = 1.13, and count a fairway.)
    // approach 1.30, putting −0.35, off tee + around green null, total 0.95.
    // GIR: first green start shot 2 ≤ 3 − 1 = 2 → true. Fairway: par 3 → stays null.
    const plan = finishRoundPlan(
      input({
        holes: [hole({ id: 'h1', par: 4 })],
        holeScores: [hs({ id: 'a', hole_id: 'h1', score: 3, par: 3, putts: 2 })],
        shots: [
          shot({ hole_score_id: 'a', shot_number: 1, lie_type: 'tee', distance_to_target: 150 }),
          shot({ hole_score_id: 'a', shot_number: 2, lie_type: 'green', putt_distance_ft: 10 }),
          shot({ hole_score_id: 'a', shot_number: 3, lie_type: 'green', putt_distance_ft: 3 }),
        ],
      }),
    )
    expect(plan.inferUpserts).toEqual([{ id: 'a', round_id: 'r', hole_id: 'h1', score: 3, fairway_hit: null, gir: true }])
    expect(plan.sgRows).toEqual([
      { id: 'a', round_id: 'r', hole_id: 'h1', score: 3, sg_off_tee: null, sg_approach: 1.3, sg_around_green: null, sg_putting: -0.35 },
    ])
    expect(plan.roundPatch).toEqual({
      sg_off_tee: null, sg_approach: 1.3, sg_around_green: null, sg_putting: -0.35, sg_total: 0.95,
      total_score: 3, total_putts: 2, fairways_hit: null, fairways_total: null, gir: 1,
      course_tee_id: null, score_differential: null,
    })
  })

  it('rated 9-hole tee: differential from the net-double-bogey gross; no shots → every SG null', () => {
    // 9 par 4s (par 36), stroke index 1..9, tee found by colour (case-insensitive): rating 35.0, slope 113.
    // Holes 1–8 score 5, hole 9 (SI 9) scores 9: gross 49.
    // Handicap 18 over 9 holes → index 9. Course handicap = round(9·113/113 + (35 − 36)) = 8.
    // 8 strokes over 9 holes: SI 1–8 get 1 (cap par + 2 + 1 = 7), SI 9 gets 0 (cap 6).
    // Adjusted = 8·5 + min(9, 6) = 46. Differential = (46 − 35)·113/113 = 11.0.
    const holes = Array.from({ length: 9 }, (_, i) => hole({ id: `h${i + 1}`, number: i + 1, stroke_index: i + 1 }))
    const holeScores = holes.map((h, i) => hs({ id: `s${i + 1}`, hole_id: h.id, score: i === 8 ? 9 : 5 }))
    const plan = finishRoundPlan(
      input({
        holes,
        holeScores,
        tees: [tee({ id: 't1', tee_color: 'white', course_rating: 35, slope_rating: 113 })],
        teeColor: 'White',
        roundHoleCount: 9,
        handicap: 18,
      }),
    )
    expect(plan).toEqual({
      inferUpserts: [],
      sgRows: [],
      roundPatch: {
        sg_off_tee: null, sg_approach: null, sg_around_green: null, sg_putting: null, sg_total: null,
        // No fairway or GIR recorded on any hole: null, not 0 of 9.
        total_score: 49, total_putts: null, fairways_hit: null, fairways_total: null, gir: null,
        course_tee_id: 't1', score_differential: 11,
      },
      differential: 11,
    })
  })

  it('unrated tee: no differential, the round keeps its tee', () => {
    const holes = Array.from({ length: 9 }, (_, i) => hole({ id: `h${i + 1}`, number: i + 1, stroke_index: i + 1 }))
    const holeScores = holes.map((h, i) => hs({ id: `s${i + 1}`, hole_id: h.id, score: 5 }))
    const plan = finishRoundPlan(
      input({ holes, holeScores, tees: [tee({ id: 't2', slope_rating: 113 })], courseTeeId: 't2', roundHoleCount: 9 }),
    )
    expect(plan.differential).toBeNull()
    expect(plan.roundPatch.score_differential).toBeNull()
    expect(plan.roundPatch.course_tee_id).toBe('t2')
    expect(plan.roundPatch.total_score).toBe(45)
  })

  it('no putts and no tee shot: putting and off tee are null, not 0', () => {
    // Par 3: 150 yd tee shot (approach) to 10 yd off the green, chipped in.
    //   1: 3.95 − 2.73 − 1 = 0.22 (approach) · 2: 2.73 − 0 − 1 = 1.73 (around green). Total 1.95.
    // GIR: no green start; holed out on stroke 2 > par − 2 = 1 → false.
    const plan = finishRoundPlan(
      input({
        holes: [hole({ id: 'h1', par: 3 })],
        holeScores: [hs({ id: 'a', hole_id: 'h1', score: 2, putts: 0 })],
        shots: [
          shot({ hole_score_id: 'a', shot_number: 1, lie_type: 'tee', distance_to_target: 150 }),
          shot({ hole_score_id: 'a', shot_number: 2, lie_type: 'rough', distance_to_target: 10 }),
        ],
      }),
    )
    expect(plan.roundPatch).toEqual({
      sg_off_tee: null, sg_approach: 0.22, sg_around_green: 1.73, sg_putting: null, sg_total: 1.95,
      total_score: 2, total_putts: null, fairways_hit: null, fairways_total: null, gir: 0,
      course_tee_id: null, score_differential: null,
    })
    expect(plan.inferUpserts).toEqual([{ id: 'a', round_id: 'r', hole_id: 'h1', score: 2, fairway_hit: null, gir: false }])
  })

  it('shots that cannot be valued count for no category', () => {
    // Par 3: tee shot 150 yd, then a putt with no length. The putt's start can't be valued,
    // so neither can the tee shot's end: both null, every category null, sg_total null.
    const plan = finishRoundPlan(
      input({
        holes: [hole({ id: 'h1', par: 3 })],
        holeScores: [hs({ id: 'a', hole_id: 'h1', score: 2, gir: true })],
        shots: [
          shot({ hole_score_id: 'a', shot_number: 1, lie_type: 'tee', distance_to_target: 150 }),
          shot({ hole_score_id: 'a', shot_number: 2, lie_type: 'green' }),
        ],
      }),
    )
    expect(plan.roundPatch).toMatchObject({
      sg_off_tee: null, sg_approach: null, sg_around_green: null, sg_putting: null, sg_total: null,
    })
    expect(plan.sgRows).toEqual([
      { id: 'a', round_id: 'r', hole_id: 'h1', score: 2, sg_off_tee: null, sg_approach: null, sg_around_green: null, sg_putting: null },
    ])
  })

  it('per-hole SG: a category with no valued shot on that hole is null, even when the round counts it', () => {
    // Two par 3s at handicap 15.
    // Hole 1: 150 yd tee shot to 10 ft, two putts.
    //   1: 3.95 − 1.65 − 1 = 1.30 (approach) · 2: 1.65 − 1.10 − 1 = −0.45 · 3: 1.10 − 1 = 0.10 → putting −0.35
    //   around green: no shot on this hole → null (the round counts it from hole 2).
    // Hole 2: 150 yd tee shot to 10 yd off the green, chipped in.
    //   1: 3.95 − 2.73 − 1 = 0.22 (approach) · 2: 2.73 − 1 = 1.73 (around green); putting → null.
    // Off the tee: no shot anywhere → null on both holes and the round.
    // Round: approach 1.52, around green 1.73, putting −0.35, total 2.90.
    const plan = finishRoundPlan(
      input({
        holes: [hole({ id: 'h1', par: 3 }), hole({ id: 'h2', number: 2, par: 3 })],
        holeScores: [hs({ id: 'a', hole_id: 'h1', score: 3 }), hs({ id: 'b', hole_id: 'h2', score: 2 })],
        shots: [
          shot({ hole_score_id: 'a', shot_number: 1, lie_type: 'tee', distance_to_target: 150 }),
          shot({ hole_score_id: 'a', shot_number: 2, lie_type: 'green', putt_distance_ft: 10 }),
          shot({ hole_score_id: 'a', shot_number: 3, lie_type: 'green', putt_distance_ft: 3 }),
          shot({ hole_score_id: 'b', shot_number: 1, lie_type: 'tee', distance_to_target: 150 }),
          shot({ hole_score_id: 'b', shot_number: 2, lie_type: 'rough', distance_to_target: 10 }),
        ],
      }),
    )
    expect(plan.sgRows).toEqual([
      { id: 'a', round_id: 'r', hole_id: 'h1', score: 3, sg_off_tee: null, sg_approach: 1.3, sg_around_green: null, sg_putting: -0.35 },
      { id: 'b', round_id: 'r', hole_id: 'h2', score: 2, sg_off_tee: null, sg_approach: 0.22, sg_around_green: 1.73, sg_putting: null },
    ])
    expect(plan.roundPatch).toMatchObject({
      sg_off_tee: null, sg_approach: 1.52, sg_around_green: 1.73, sg_putting: -0.35, sg_total: 2.9,
    })
  })

  it('fairways count only the par 4/5 holes played (score 0 = not played)', () => {
    // 3 par 4s; hole 1 scored 4 with the fairway hit, holes 2 and 3 not played.
    // Before: fairways 1 of 3. Now 1 of 1.
    const plan = finishRoundPlan(
      input({
        holes: [hole({ id: 'h1', number: 1 }), hole({ id: 'h2', number: 2 }), hole({ id: 'h3', number: 3 })],
        holeScores: [
          hs({ id: 'a', hole_id: 'h1', score: 4, fairway_hit: true }),
          hs({ id: 'b', hole_id: 'h2', score: 0 }),
          hs({ id: 'c', hole_id: 'h3', score: 0 }),
        ],
      }),
    )
    expect(plan.roundPatch).toMatchObject({ total_score: 4, fairways_hit: 1, fairways_total: 1 })
  })
})

// Owner 2026-11-11 (option A): fairways and GIR count only the holes where they
// were recorded (after the fill-in from shots); a blank is not a miss.
describe('finishRoundPlan: recorded fairways and GIR', () => {
  const threeFours = [hole({ id: 'h1', number: 1 }), hole({ id: 'h2', number: 2 }), hole({ id: 'h3', number: 3 })]

  it('nothing recorded: fairways and GIR are null, not 0 of n', () => {
    const plan = finishRoundPlan(
      input({
        holes: threeFours,
        holeScores: [
          hs({ id: 'a', hole_id: 'h1', score: 4 }),
          hs({ id: 'b', hole_id: 'h2', score: 5 }),
          hs({ id: 'c', hole_id: 'h3', score: 4 }),
        ],
      }),
    )
    expect(plan.roundPatch).toMatchObject({ fairways_hit: null, fairways_total: null, gir: null })
  })

  it('partly recorded: fairway on 2 of 3 played (1 hit) → 1 of 2; GIR on 2 of 3 (1 hit) → 1', () => {
    const plan = finishRoundPlan(
      input({
        holes: threeFours,
        holeScores: [
          hs({ id: 'a', hole_id: 'h1', score: 4, fairway_hit: true, gir: true }),
          hs({ id: 'b', hole_id: 'h2', score: 5, fairway_hit: false }),
          hs({ id: 'c', hole_id: 'h3', score: 4, gir: false }),
        ],
      }),
    )
    expect(plan.roundPatch).toMatchObject({ fairways_hit: 1, fairways_total: 2, gir: 1 })
  })

  it('GIR recorded but never hit stores 0, not null', () => {
    const plan = finishRoundPlan(
      input({ holes: threeFours, holeScores: [hs({ id: 'a', hole_id: 'h1', score: 5, gir: false })] }),
    )
    expect(plan.roundPatch.gir).toBe(0)
  })

  it('a shots round counts fully: the fill-in records fairway and GIR first', () => {
    // Hole 1 (par 4): tee → fairway 150 → green 10 ft → 3 ft. Fairway: shot 2 starts in
    // the fairway → hit. GIR: first green start shot 3 ≤ 4 − 1 = 3 → hit.
    // Hole 2 (par 4): tee → rough 150 → rough 20 → green. Fairway: shot 2 rough → missed.
    // GIR: first green start shot 4 > 3 → missed. Hole 3 not played.
    // Fairways 1 of 2, GIR 1 (recorded on 2).
    const plan = finishRoundPlan(
      input({
        holes: threeFours,
        holeScores: [
          hs({ id: 'a', hole_id: 'h1', score: 4 }),
          hs({ id: 'b', hole_id: 'h2', score: 5 }),
          hs({ id: 'c', hole_id: 'h3', score: 0 }),
        ],
        shots: [
          shot({ hole_score_id: 'a', shot_number: 1, lie_type: 'tee', distance_to_target: 400 }),
          shot({ hole_score_id: 'a', shot_number: 2, lie_type: 'fairway', distance_to_target: 150 }),
          shot({ hole_score_id: 'a', shot_number: 3, lie_type: 'green', putt_distance_ft: 10 }),
          shot({ hole_score_id: 'a', shot_number: 4, lie_type: 'green', putt_distance_ft: 3 }),
          shot({ hole_score_id: 'b', shot_number: 1, lie_type: 'tee', distance_to_target: 400 }),
          shot({ hole_score_id: 'b', shot_number: 2, lie_type: 'rough', distance_to_target: 150 }),
          shot({ hole_score_id: 'b', shot_number: 3, lie_type: 'rough', distance_to_target: 20 }),
          shot({ hole_score_id: 'b', shot_number: 4, lie_type: 'green', putt_distance_ft: 3 }),
          shot({ hole_score_id: 'b', shot_number: 5, lie_type: 'green', putt_distance_ft: 1 }),
        ],
      }),
    )
    expect(plan.roundPatch).toMatchObject({ fairways_hit: 1, fairways_total: 2, gir: 1 })
  })
})

describe('roundSGPatch', () => {
  it('a category with valued shots summing to 0 stays 0; one with none is null', () => {
    const patch = roundSGPatch({
      round: { offTee: 0, approach: 0.004, aroundGreen: 0, putting: 0, total: 0.004 },
      counted: { offTee: true, approach: true, aroundGreen: false, putting: false },
    })
    expect(patch).toEqual({ sg_off_tee: 0, sg_approach: 0, sg_around_green: null, sg_putting: null, sg_total: 0 })
  })
})
