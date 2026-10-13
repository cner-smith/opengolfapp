import { describe, expect, it } from 'vitest'
import { buildInitialRows, reviewedRowToShotFields, type PlacedPoint } from '../round'
import { computeRoundSG } from '../sg'
import type { Database } from '@oga/supabase'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']
type ShotRow = Database['public']['Tables']['shots']['Row']

// Strokes gained on hand-worked holes, at two seams:
//   1. the end-of-hole review end to end: the points a player placed → the
//      rows the review sheet shows → the `shots` columns both review saves
//      write → SG;
//   2. stored `shots` rows straight into the engine, whichever writer made them.
// Every expected value is worked by hand from the sg-baselines tables (the
// lookups are in each test's comment), never recomputed through the code.

const PIN = { lat: 36.0, lng: -97.0 }
// Points on the pin's meridian, so haversine distance is exactly R·Δφ.
const YARD_DEG = (0.9144 / 6371000) * (180 / Math.PI)
const pointYardsFromPin = (yards: number): PlacedPoint => ({
  lat: PIN.lat - yards * YARD_DEG,
  lng: PIN.lng,
})

// `obShots`: shot numbers the player marked OB in the review sheet.
// `puttLengthsFt`: putt lengths the player chose in the review, by shot number.
function reviewSaveSG(
  par: number,
  yardsFromPin: number[],
  handicap: number,
  obShots: number[] = [],
  puttLengthsFt: Record<number, number> = {},
) {
  const rows = buildInitialRows(yardsFromPin.map(pointYardsFromPin), par, PIN.lat, PIN.lng).map(
    (row) => ({
      ...row,
      ...(obShots.includes(row.shotNumber) ? { shotResult: 'ob' as const } : {}),
      ...(row.shotNumber in puttLengthsFt ? { puttLengthFt: puttLengthsFt[row.shotNumber] } : {}),
    }),
  )
  const shots = rows.map((row) => ({
    ...shotRowDefaults(row.shotNumber),
    ...reviewedRowToShotFields(row, false),
  }))
  return computeRoundSG({
    holes: [holeRow(par)],
    holeScores: [holeScoreRow(yardsFromPin.length + obShots.length)],
    shots,
    handicap,
  }).round
}

describe('review save → strokes gained', () => {
  it('par 4 in four, 15 handicap: two putts from 30 ft and 3 ft', () => {
    // 15 handicap → bracket 15.
    // Tee, 400 yd: tee line 2.38 + 0.41·w + (0.0041 + 0.0025·w)·d, w = (15+5)/20 = 1
    //   → 2.79 + 0.0066·400 = 5.43
    // Approach, 150 yd: APPROACH[15][150] = 3.95
    // Putt, 30 ft (10 yd): PUTTING[15][30] = 2.34
    // Putt, 3 ft (1 yd):   PUTTING[15][3]  = 1.10, holed → 0
    // off tee  5.43 − 3.95 − 1 = 0.48
    // approach 3.95 − 2.34 − 1 = 0.61
    // putting  (2.34 − 1.10 − 1) + (1.10 − 0 − 1) = 0.24 + 0.10 = 0.34
    // total 1.43 (= 5.43 expected − 4 strokes)
    const sg = reviewSaveSG(4, [400, 150, 10, 1], 15)
    expect(sg.offTee).toBeCloseTo(0.48, 2)
    expect(sg.approach).toBeCloseTo(0.61, 2)
    expect(sg.putting).toBeCloseTo(0.34, 2)
    expect(sg.total).toBeCloseTo(1.43, 2)
  })

  it('par 3 in three, 15 handicap: green missed, chip from 20 yd, one putt from 6 ft', () => {
    // Par-3 tee shot is SG approach. 165 yd: APPROACH[15] 150→3.95, 175→4.13
    //   → 3.95 + (15/25)·0.18 = 4.058
    // Chip, 20 yd (≤ 30 → around green): AROUND[15][20] = 2.97
    // Putt, 6 ft: PUTTING[15] 5→1.27, 8→1.52 → 1.27 + (1/3)·0.25 = 1.3533, holed → 0
    // approach     4.058 − 2.97 − 1   = 0.088
    // around green 2.97 − 1.3533 − 1  = 0.6167
    // putting      1.3533 − 0 − 1     = 0.3533
    // total 1.058 (= 4.058 − 3)
    const sg = reviewSaveSG(3, [165, 20, 2], 15)
    expect(sg.offTee).toBeCloseTo(0, 2)
    expect(sg.approach).toBeCloseTo(0.088, 2)
    expect(sg.aroundGreen).toBeCloseTo(0.6167, 2)
    expect(sg.putting).toBeCloseTo(0.3533, 2)
    expect(sg.total).toBeCloseTo(1.058, 2)
  })

  it('par 5 in six, 15 handicap: three putts from 40 ft, 8 ft and 2 ft', () => {
    // Tee, 520 yd: 2.79 + 0.0066·520 = 6.222
    // 240 yd: APPROACH[15] 225→4.44, 250→4.67 → 4.44 + (15/25)·0.23 = 4.578
    // 60 yd:  APPROACH[15] 50→3.10, 75→3.32 → 3.10 + (10/25)·0.22 = 3.188
    // Putts: 40 ft → 2.48; 8 ft → 1.52; 2 ft clamps to the 3 ft key → 1.10, holed
    // off tee  6.222 − 4.578 − 1 = 0.644
    // approach (4.578 − 3.188 − 1) + (3.188 − 2.48 − 1) = 0.39 − 0.292 = 0.098
    // putting  (2.48 − 1.52 − 1) + (1.52 − 1.10 − 1) + (1.10 − 1) = −0.04 − 0.58 + 0.10 = −0.52
    // total 0.222 (= 6.222 − 6)
    const sg = reviewSaveSG(5, [520, 240, 60, 40 / 3, 8 / 3, 2 / 3], 15)
    expect(sg.offTee).toBeCloseTo(0.644, 2)
    expect(sg.approach).toBeCloseTo(0.098, 2)
    expect(sg.putting).toBeCloseTo(-0.52, 2)
    expect(sg.total).toBeCloseTo(0.222, 2)
  })

  it('par 4 in five, 15 handicap: three putts marked at one spot, lengths chosen as 20, 8 and 3 ft', () => {
    // GPS put all three putts 10 yd (30 ft) out; the player set the lengths.
    // Tee 400 yd 5.43; approach 150 yd 3.95 (as above)
    // Putts: PUTTING[15][20] = 2.12, [8] = 1.52, [3] = 1.10, holed → 0
    // off tee  5.43 − 3.95 − 1 = 0.48
    // approach 3.95 − 2.12 − 1 = 0.83   (the GPS 30 ft would give 0.61)
    // putting  (2.12 − 1.52 − 1) + (1.52 − 1.10 − 1) + (1.10 − 1) = −0.40 − 0.58 + 0.10 = −0.88
    // total 0.43 (= 5.43 − 5)
    const sg = reviewSaveSG(4, [400, 150, 10, 10, 10], 15, [], { 3: 20, 4: 8, 5: 3 })
    expect(sg.offTee).toBeCloseTo(0.48, 2)
    expect(sg.approach).toBeCloseTo(0.83, 2)
    expect(sg.putting).toBeCloseTo(-0.88, 2)
    expect(sg.total).toBeCloseTo(0.43, 2)
  })

  it('par 4, OB off the tee, re-tee from the same spot, double bogey 6', () => {
    // The review infers the re-tee's lie from distance (rough, not tee); the
    // engine must still score it as a tee shot. Same hand-worked hole as the
    // stored-rows OB case below: off tee −2 + (5.43 − 3.95 − 1) = −1.52,
    // approach 0.61, putting 0.34, total −0.57 (= 5.43 − 6).
    const sg = reviewSaveSG(4, [400, 400, 150, 10, 1], 15, [1])
    expect(sg.offTee).toBeCloseTo(-1.52, 2)
    expect(sg.approach).toBeCloseTo(0.61, 2)
    expect(sg.putting).toBeCloseTo(0.34, 2)
    expect(sg.total).toBeCloseTo(-0.57, 2)
  })
})

describe('stored rows → strokes gained', () => {
  const storedSG = (par: number, score: number, rows: Partial<ShotRow>[]) =>
    computeRoundSG({
      holes: [holeRow(par)],
      holeScores: [holeScoreRow(score)],
      shots: rows.map((r, i) => ({ ...shotRowDefaults(i + 1), ...r })),
      handicap: 15,
    }).round

  it('par 4, water off the tee, drop at 180 yd, bogey 5', () => {
    // Tee 400 yd → 5.43. Drop, 180 yd: APPROACH[15] 175→4.13, 200→4.29
    //   → 4.13 + (5/25)·0.16 = 4.162. Then 30 ft → 2.34, 3 ft → 1.10.
    // off tee  5.43 − 4.162 − 1 − 1 (penalty stroke) = −0.732
    // approach 4.162 − 2.34 − 1 = 0.822
    // putting  0.24 + 0.10 = 0.34
    // total 0.43 (= 5.43 − 5)
    const sg = storedSG(4, 5, [
      { lie_type: 'tee', distance_to_target: 400, penalty: true },
      { lie_type: 'rough', distance_to_target: 180 },
      { lie_type: 'green', club: 'putter', putt_distance_ft: 30 },
      { lie_type: 'green', club: 'putter', putt_distance_ft: 3, putt_result: 'made' },
    ])
    expect(sg.offTee).toBeCloseTo(-0.732, 2)
    expect(sg.approach).toBeCloseTo(0.822, 2)
    expect(sg.putting).toBeCloseTo(0.34, 2)
    expect(sg.total).toBeCloseTo(0.43, 2)
  })

  it('par 4, OB off the tee, re-tee, double bogey 6', () => {
    // Stroke and distance: the OB drive ends where it started → 5.43 − 5.43 − 1,
    // plus the penalty stroke = −2. The re-tee is a tee shot from 400 yd
    // (5.43) to 150 yd (3.95): 5.43 − 3.95 − 1 = 0.48.
    // off tee  −2 + 0.48 = −1.52
    // approach 3.95 − 2.34 − 1 = 0.61
    // putting  0.34
    // total −0.57 (= 5.43 − 6)
    const sg = storedSG(4, 6, [
      { lie_type: 'tee', distance_to_target: 400, ob: true },
      { lie_type: 'tee', distance_to_target: 400 },
      { lie_type: 'fairway', distance_to_target: 150 },
      { lie_type: 'green', club: 'putter', putt_distance_ft: 30 },
      { lie_type: 'green', club: 'putter', putt_distance_ft: 3, putt_result: 'made' },
    ])
    expect(sg.offTee).toBeCloseTo(-1.52, 2)
    expect(sg.approach).toBeCloseTo(0.61, 2)
    expect(sg.putting).toBeCloseTo(0.34, 2)
    expect(sg.total).toBeCloseTo(-0.57, 2)
  })

  it('par 4, OB, re-tee OB, then a casual drop at 121 yd, 7 (two penalty strokes)', () => {
    // Tee 327 yd: 2.79 + 0.0066·327 = 4.9482
    // Drop, 121 yd: APPROACH[15] 100→3.54, 125→3.74 → 3.54 + (21/25)·0.20 = 3.708
    // Putts: 66 ft clamps to the 60 ft key → 2.66; 6 ft → 1.3533, holed
    // OB drive, replayed from the tee: 4.9482 − 4.9482 − 1 − 1 = −2
    // Re-tee (a tee shot) OB, next shot from the drop: 4.9482 − 3.708 − 1 − 1 = −0.7598
    // off tee  −2 − 0.7598 = −2.7598
    // approach 3.708 − 2.66 − 1 = 0.048
    // putting  (2.66 − 1.3533 − 1) + (1.3533 − 1) = 0.3067 + 0.3533 = 0.66
    // total −2.0518 (= 4.9482 − 7)
    const sg = storedSG(4, 7, [
      { lie_type: 'tee', distance_to_target: 327, ob: true },
      { lie_type: 'rough', distance_to_target: 327, ob: true },
      { lie_type: 'rough', distance_to_target: 121 },
      { lie_type: 'green', club: 'putter', putt_distance_ft: 66 },
      { lie_type: 'green', club: 'putter', putt_distance_ft: 6, putt_result: 'made' },
    ])
    expect(sg.offTee).toBeCloseTo(-2.7598, 2)
    expect(sg.approach).toBeCloseTo(0.048, 2)
    expect(sg.putting).toBeCloseTo(0.66, 2)
    expect(sg.total).toBeCloseTo(-2.0518, 2)
  })

  // The replay is judged by start coordinates when both rows have them; the
  // distances here are deliberately equal so only the coordinates can decide.
  const reteeAt = (yardsApart: number) =>
    storedSG(4, 6, [
      { lie_type: 'tee', distance_to_target: 400, ob: true, start_lat: pointYardsFromPin(400).lat, start_lng: PIN.lng },
      { lie_type: 'rough', distance_to_target: 400, start_lat: pointYardsFromPin(400 - yardsApart).lat, start_lng: PIN.lng },
      { lie_type: 'fairway', distance_to_target: 150 },
      { lie_type: 'green', club: 'putter', putt_distance_ft: 30 },
      { lie_type: 'green', club: 'putter', putt_distance_ft: 3, putt_result: 'made' },
    ])

  it('a re-tee 9 yd from the OB spot is the replay: a tee shot', () => {
    // As the OB re-tee hole above: off tee −1.52, approach 0.61.
    const sg = reteeAt(9)
    expect(sg.offTee).toBeCloseTo(-1.52, 2)
    expect(sg.approach).toBeCloseTo(0.61, 2)
  })

  it('a shot 11 yd from the OB spot is not the replay: scored on its own terms', () => {
    // Shot 2 is then an approach from 400 yd: APPROACH[15][400] = 5.53.
    // OB drive ends at the next start: 5.43 − 5.53 − 1 − 1 = −2.10 off tee
    // approach (5.53 − 3.95 − 1) + (3.95 − 2.34 − 1) = 0.58 + 0.61 = 1.19
    const sg = reteeAt(11)
    expect(sg.offTee).toBeCloseTo(-2.1, 2)
    expect(sg.approach).toBeCloseTo(1.19, 2)
  })
})

function holeRow(par: number): HoleRow {
  return {
    id: 'h1',
    course_id: 'c',
    number: 1,
    par,
    par_source: null,
    yards: null,
    stroke_index: 1,
    tee_lat: null,
    tee_lng: null,
    pin_lat: PIN.lat,
    pin_lng: PIN.lng,
  }
}

function holeScoreRow(score: number): HoleScoreRow {
  return {
    id: 'hs',
    round_id: 'r',
    hole_id: 'h1',
    score,
    par: null,
    putts: null,
    penalties: 0,
    fairway_hit: null,
    gir: null,
    finished_at: null,
    pin_lat: PIN.lat,
    pin_lng: PIN.lng,
    sg_off_tee: null,
    sg_approach: null,
    sg_around_green: null,
    sg_putting: null,
  }
}

// The columns the caller owns, around the spread of reviewedRowToShotFields.
function shotRowDefaults(shotNumber: number): ShotRow {
  return {
    id: `s-${shotNumber}`,
    hole_score_id: 'hs',
    user_id: 'u',
    shot_number: shotNumber,
    start_lat: null,
    start_lng: null,
    end_lat: null,
    end_lng: null,
    aim_lat: null,
    aim_lng: null,
    distance_to_target: null,
    club: null,
    lie_type: null,
    lie_slope: null,
    lie_slope_forward: null,
    lie_slope_side: null,
    shot_result: null,
    contact: null,
    shape: null,
    start_line: null,
    penalty: false,
    ob: false,
    aim_offset_yards: null,
    break_direction: null,
    break_direction_vertical: null,
    break_direction_horizontal: null,
    putt_result: null,
    putt_distance_result: null,
    putt_direction_result: null,
    putt_distance_ft: null,
    putt_slope_pct: null,
    green_speed: null,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
  }
}
