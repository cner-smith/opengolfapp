import { describe, it, expect } from 'vitest'
import { draftToShotUpdate } from '../shot-edit'
import { shotRowToDraft, type DraftShot } from '../round'
import { aimOffsetInchesToYards } from '../units'
import type { Database } from '@oga/supabase'

type ShotRow = Database['public']['Tables']['shots']['Row']

const row = (overrides: Partial<ShotRow>): ShotRow =>
  ({
    id: 'shot-1',
    hole_score_id: 'hs-1',
    user_id: 'u-1',
    shot_number: 1,
    start_lat: null,
    start_lng: null,
    end_lat: null,
    end_lng: null,
    aim_lat: null,
    aim_lng: null,
    club: null,
    lie_type: null,
    lie_slope: null,
    lie_slope_forward: null,
    lie_slope_side: null,
    shot_result: null,
    contact: null,
    shape: null,
    start_line: null,
    ob: false,
    penalty: false,
    distance_to_target: null,
    putt_distance_ft: null,
    putt_result: null,
    putt_distance_result: null,
    putt_direction_result: null,
    putt_slope_pct: null,
    green_speed: null,
    break_direction: null,
    break_direction_vertical: null,
    break_direction_horizontal: null,
    aim_offset_yards: null,
    notes: null,
    ...overrides,
  }) as ShotRow

// Every column the shot editor owns: what each test compares in full.
const NULL_PUTT_COLUMNS = {
  putt_distance_ft: null,
  putt_result: null,
  putt_distance_result: null,
  putt_direction_result: null,
  putt_slope_pct: null,
  green_speed: null,
  break_direction: null,
  break_direction_vertical: null,
  break_direction_horizontal: null,
  aim_offset_yards: null,
}

describe('draftToShotUpdate', () => {
  it('a full shot writes its own columns and clears every putt column', () => {
    const draft: DraftShot = {
      shotNumber: 2,
      club: '7i',
      lieType: 'fairway',
      lieSlopeForward: 'uphill',
      lieSlopeSide: 'ball_above',
      contact: 'thin',
      shape: 'draw',
      startLine: 'push',
      distanceToTarget: 152,
      notes: 'into the wind',
      // Leftovers from when this shot was a putt: none may survive.
      puttDistanceFt: 12,
      puttSlopePct: 2,
      aimOffsetInches: 9,
      greenSpeed: 'fast',
      breakDirectionHorizontal: 'left_to_right',
      puttDistanceResult: 'short',
    }
    expect(draftToShotUpdate(draft)).toEqual({
      club: '7i',
      lie_type: 'fairway',
      lie_slope: null,
      lie_slope_forward: 'uphill',
      lie_slope_side: 'ball_above',
      // contact 'thin' is a contact miss, which wins over the push.
      shot_result: 'thin',
      contact: 'thin',
      shape: 'draw',
      start_line: 'push',
      distance_to_target: 152,
      ...NULL_PUTT_COLUMNS,
      penalty: false,
      ob: false,
      notes: 'into the wind',
    })
  })

  it('a missed putt writes the green read and clears every full-shot column', () => {
    const draft: DraftShot = {
      shotNumber: 3,
      club: '7i', // the club picker's stale value: a putt is always the putter
      lieType: 'green',
      lieSlopeForward: 'downhill',
      contact: 'fat',
      penalty: true,
      ob: true,
      distanceToTarget: 9,
      puttDistanceFt: 18,
      puttDistanceResult: 'long',
      puttDirectionResult: 'right',
      puttSlopePct: 3,
      greenSpeed: 'slow',
      breakDirectionVertical: 'downhill',
      breakDirectionHorizontal: 'right_to_left',
      // 7 in / 36 = 0.1944 yd → 0.2
      aimOffsetInches: 7,
    }
    expect(draftToShotUpdate(draft)).toEqual({
      club: 'putter',
      lie_type: 'green',
      lie_slope: null,
      lie_slope_forward: null,
      lie_slope_side: null,
      shot_result: null,
      contact: null,
      shape: null,
      start_line: null,
      distance_to_target: null,
      putt_distance_ft: 18,
      // distance axis wins the legacy column
      putt_result: 'long',
      putt_distance_result: 'long',
      putt_direction_result: 'right',
      putt_slope_pct: 3,
      green_speed: 'slow',
      // horizontal wins the legacy column
      break_direction: 'right_to_left',
      break_direction_vertical: 'downhill',
      break_direction_horizontal: 'right_to_left',
      aim_offset_yards: 0.2,
      penalty: false,
      ob: false,
      notes: null,
    })
  })

  it('a made putt drops the miss axes but keeps the green read', () => {
    const out = draftToShotUpdate({
      shotNumber: 4,
      lieType: 'green',
      puttMade: true,
      puttDistanceResult: 'short',
      puttDirectionResult: 'left',
      puttSlopePct: 1,
      aimOffsetInches: -20, // −20 / 36 = −0.5556 → −0.6
    })
    expect(out.putt_result).toBe('made')
    expect(out.putt_distance_result).toBeNull()
    expect(out.putt_direction_result).toBeNull()
    expect(out.putt_slope_pct).toBe(1)
    expect(out.aim_offset_yards).toBe(-0.6)
  })

  it('cleared fields store null, not undefined', () => {
    const out = draftToShotUpdate({ shotNumber: 1, lieType: 'green' })
    expect(out.putt_distance_ft).toBeNull()
    expect(out.putt_result).toBeNull()
    expect(out.putt_slope_pct).toBeNull()
    expect(out.green_speed).toBeNull()
    expect(out.break_direction).toBeNull()
    expect(out.aim_offset_yards).toBeNull()
    const full = draftToShotUpdate({ shotNumber: 1 })
    expect(full.club).toBeNull()
    expect(full.lie_type).toBeNull()
    expect(full.lie_slope_forward).toBeNull()
    expect(full.shot_result).toBeNull()
    expect(full.distance_to_target).toBeNull()
    expect(full.notes).toBeNull()
  })

  it('OB and penalty on a full shot set the flags and the legacy result', () => {
    const ob = draftToShotUpdate({ shotNumber: 1, lieType: 'tee', ob: true, contact: 'solid' })
    expect([ob.ob, ob.penalty, ob.shot_result]).toEqual([true, false, 'ob'])
    const pen = draftToShotUpdate({ shotNumber: 1, lieType: 'rough', penalty: true })
    expect([pen.ob, pen.penalty, pen.shot_result]).toEqual([false, true, 'penalty'])
  })

  it('an aim of 0 in stores 0, an unset aim stores null', () => {
    expect(draftToShotUpdate({ shotNumber: 1, lieType: 'green', aimOffsetInches: 0 }).aim_offset_yards).toBe(0)
    expect(draftToShotUpdate({ shotNumber: 1, lieType: 'green' }).aim_offset_yards).toBeNull()
  })

  describe('round trip with shotRowToDraft', () => {
    it('a stored putt saves back unchanged', () => {
      const stored = row({
        club: 'putter',
        lie_type: 'green',
        putt_distance_ft: 14,
        putt_result: 'missed_left',
        putt_direction_result: 'left',
        putt_slope_pct: 2,
        green_speed: 'fast',
        break_direction: 'left_to_right',
        break_direction_horizontal: 'left_to_right',
        // 0.3 yd × 36 = 10.8 → 11 in; 11 / 36 = 0.3056 → 0.3
        aim_offset_yards: 0.3,
        notes: 'grain',
      })
      expect(draftToShotUpdate(shotRowToDraft(stored))).toEqual({
        club: 'putter',
        lie_type: 'green',
        lie_slope: null,
        lie_slope_forward: null,
        lie_slope_side: null,
        shot_result: null,
        contact: null,
        shape: null,
        start_line: null,
        distance_to_target: null,
        putt_distance_ft: 14,
        putt_result: 'missed_left',
        putt_distance_result: null,
        putt_direction_result: 'left',
        putt_slope_pct: 2,
        green_speed: 'fast',
        break_direction: 'left_to_right',
        break_direction_vertical: null,
        break_direction_horizontal: 'left_to_right',
        aim_offset_yards: 0.3,
        penalty: false,
        ob: false,
        notes: 'grain',
      })
    })

    it('a stored full shot saves back unchanged', () => {
      const stored = row({
        club: 'driver',
        lie_type: 'tee',
        lie_slope_forward: 'level',
        shot_result: 'pull_left',
        start_line: 'pull',
        shape: 'fade',
        distance_to_target: 401,
        ob: true,
      })
      const out = draftToShotUpdate(shotRowToDraft(stored))
      expect(out).toEqual({
        club: 'driver',
        lie_type: 'tee',
        lie_slope: null,
        lie_slope_forward: 'level',
        lie_slope_side: null,
        // ob wins the legacy result over the pull
        shot_result: 'ob',
        contact: null,
        shape: 'fade',
        start_line: 'pull',
        distance_to_target: 401,
        ...NULL_PUTT_COLUMNS,
        penalty: false,
        ob: true,
        notes: null,
      })
    })

    it('turning a putt into a chip clears the putt slope and aim offset', () => {
      const putt = row({
        club: 'putter',
        lie_type: 'green',
        putt_distance_ft: 30,
        putt_slope_pct: 2,
        aim_offset_yards: 0.3,
        green_speed: 'medium',
      })
      const draft = { ...shotRowToDraft(putt), lieType: 'fringe' as const, club: 'sw' as const }
      const out = draftToShotUpdate(draft)
      expect(out.putt_slope_pct).toBeNull()
      expect(out.aim_offset_yards).toBeNull()
      expect(out.putt_distance_ft).toBeNull()
      expect(out.green_speed).toBeNull()
      expect(out.club).toBe('sw')
    })

    it('a legacy single-axis slope moves onto the axes and the legacy column clears', () => {
      const out = draftToShotUpdate(shotRowToDraft(row({ lie_type: 'rough', lie_slope: 'ball_below' })))
      expect([out.lie_slope, out.lie_slope_forward, out.lie_slope_side]).toEqual([null, null, 'ball_below'])
    })
  })
})

describe('aimOffsetInchesToYards', () => {
  it.each([
    [0, 0],
    [36, 1], // 36 in = 1 yd
    [9, 0.3], // 0.25 → 0.3 (Math.round rounds .5 up)
    [-9, -0.2], // −0.25 → −0.2 (Math.round(−2.5) = −2)
    [4, 0.1], // 0.111 → 0.1
    [-50, -1.4], // −1.3889 → −1.4
  ])('%i in → %d yd', (inches, yards) => {
    expect(aimOffsetInchesToYards(inches)).toBe(yards)
  })
})
