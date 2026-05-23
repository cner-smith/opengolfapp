import { describe, it, expect } from 'vitest'
import { shotRowToDraft } from '../round'
import type { Database } from '@oga/supabase'

type ShotRow = Database['public']['Tables']['shots']['Row']

// shotRowToDraft only reads ~20 fields out of the full Row schema; the
// builder fills the read surface with sensible defaults so individual
// tests only assert what they care about.
const row = (overrides: Partial<ShotRow>): ShotRow =>
  ({
    id: 'shot-1',
    shot_number: 1,
    club: null,
    lie_type: null,
    lie_slope: null,
    lie_slope_forward: null,
    lie_slope_side: null,
    shot_result: null,
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
    aim_offset_yards: null,
    notes: null,
    ...overrides,
  }) as ShotRow

describe('shotRowToDraft', () => {
  it('maps the basic identifying + numeric columns', () => {
    const draft = shotRowToDraft(row({ id: 'shot-7', shot_number: 3, distance_to_target: 150 }))
    expect(draft.id).toBe('shot-7')
    expect(draft.shotNumber).toBe(3)
    expect(draft.distanceToTarget).toBe(150)
  })

  describe('shot_result fallback', () => {
    it('uses shot_result when present', () => {
      expect(shotRowToDraft(row({ shot_result: 'good' })).shotResult).toBe('good')
    })
    it("falls back to 'ob' when shot_result is null and ob=true", () => {
      expect(shotRowToDraft(row({ shot_result: null, ob: true })).shotResult).toBe('ob')
    })
    it("falls back to 'penalty' when shot_result is null and penalty=true", () => {
      expect(shotRowToDraft(row({ shot_result: null, penalty: true })).shotResult).toBe('penalty')
    })
    it('returns undefined when no result and no ob/penalty', () => {
      expect(shotRowToDraft(row({})).shotResult).toBeUndefined()
    })
  })

  describe('lie slope reconciliation', () => {
    it('prefers explicit lie_slope_forward / side over legacy lie_slope', () => {
      const draft = shotRowToDraft(row({
        lie_slope: 'uphill',
        lie_slope_forward: 'downhill',
        lie_slope_side: 'ball_above',
      }))
      expect(draft.lieSlopeForward).toBe('downhill')
      expect(draft.lieSlopeSide).toBe('ball_above')
    })
    it("derives lieSlopeForward from legacy 'uphill'/'downhill'/'level'", () => {
      expect(shotRowToDraft(row({ lie_slope: 'uphill' })).lieSlopeForward).toBe('uphill')
    })
    it("derives lieSlopeSide from legacy 'ball_above'/'ball_below'", () => {
      expect(shotRowToDraft(row({ lie_slope: 'ball_above' })).lieSlopeSide).toBe('ball_above')
    })
  })

  describe('legacy putt_result reconciliation', () => {
    it("sets puttMade=true when legacy putt_result='made'", () => {
      expect(shotRowToDraft(row({ putt_result: 'made' })).puttMade).toBe(true)
    })
    it("maps legacy 'short' → puttDistanceResult='short' when new column is null", () => {
      expect(shotRowToDraft(row({ putt_result: 'short' })).puttDistanceResult).toBe('short')
    })
    it("maps legacy 'long' → puttDistanceResult='long'", () => {
      expect(shotRowToDraft(row({ putt_result: 'long' })).puttDistanceResult).toBe('long')
    })
    it("maps legacy 'missed_left' → puttDirectionResult='left'", () => {
      expect(shotRowToDraft(row({ putt_result: 'missed_left' })).puttDirectionResult).toBe('left')
    })
    it("maps legacy 'missed_right' → puttDirectionResult='right'", () => {
      expect(shotRowToDraft(row({ putt_result: 'missed_right' })).puttDirectionResult).toBe('right')
    })
    it('prefers explicit new columns over legacy putt_result mapping', () => {
      const draft = shotRowToDraft(row({
        putt_result: 'short',
        putt_distance_result: 'long',
        putt_direction_result: 'right',
      }))
      expect(draft.puttDistanceResult).toBe('long')
      expect(draft.puttDirectionResult).toBe('right')
    })
  })

  describe('break_direction mapping', () => {
    it.each([
      ['left_to_right'],
      ['right_to_left'],
      ['uphill'],
      ['downhill'],
      ['straight'],
    ])('passes %s through unchanged', (v) => {
      expect(shotRowToDraft(row({ break_direction: v })).breakDirection).toBe(v)
    })
    it("maps legacy 'left' → 'right_to_left'", () => {
      expect(shotRowToDraft(row({ break_direction: 'left' })).breakDirection).toBe('right_to_left')
    })
    it("maps legacy 'right' → 'left_to_right'", () => {
      expect(shotRowToDraft(row({ break_direction: 'right' })).breakDirection).toBe('left_to_right')
    })
    it("defaults to 'straight' for null/unknown break_direction", () => {
      expect(shotRowToDraft(row({ break_direction: null })).breakDirection).toBe('straight')
      expect(shotRowToDraft(row({ break_direction: 'something_else' })).breakDirection).toBe('straight')
    })
  })

  describe('aim_offset_yards → aimOffsetInches', () => {
    it('converts 0.5 yards → 18 inches (rounded)', () => {
      expect(shotRowToDraft(row({ aim_offset_yards: 0.5 })).aimOffsetInches).toBe(18)
    })
    it('defaults to 0 when aim_offset_yards is null', () => {
      expect(shotRowToDraft(row({ aim_offset_yards: null })).aimOffsetInches).toBe(0)
    })
  })
})
