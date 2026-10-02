import { describe, expect, it } from 'vitest'
import {
  lieSlopeLabel,
  reviewedRowToShotFields,
  type ReviewedShotRow,
} from '../round'
import type { Database } from '@oga/supabase'

type ShotInsert = Database['public']['Tables']['shots']['Insert']

// A full shot, not a putt entry (fairway lie, 7 iron).
const shotRow = (overrides: Partial<ReviewedShotRow> = {}): ReviewedShotRow => ({
  shotNumber: 2,
  club: '7i',
  lieType: 'fairway',
  startLat: 35.4676,
  startLng: -97.5164,
  endLat: 35.4689,
  endLng: -97.5161,
  distanceYards: 150,
  distanceToPin: 152.5,
  isLastShot: false,
  ...overrides,
})

// A putt entry (green lie AND putter).
const puttRow = (overrides: Partial<ReviewedShotRow> = {}): ReviewedShotRow =>
  shotRow({
    shotNumber: 3,
    club: 'putter',
    lieType: 'green',
    distanceYards: 4,
    distanceToPin: 4,
    isLastShot: true,
    ...overrides,
  })

// Every optional field set at once, shot-only and putt-only alike, so a
// whole-object comparison shows which half the gate drops.
const EVERYTHING: Partial<ReviewedShotRow> = {
  puttMade: false,
  puttDistanceResult: 'short',
  puttDirectionResult: 'left',
  aimOffsetInches: 18,
  breakDirectionVertical: 'uphill',
  breakDirectionHorizontal: 'left_to_right',
  puttSlopePct: 2.5,
  greenSpeed: 'fast',
  notes: 'into the wind',
  shotResult: 'ob',
  contact: 'thin',
  shape: 'fade',
  startLine: 'push',
  penalty: true,
  lieSlopeForward: 'uphill',
  lieSlopeSide: 'ball_above',
}

const MAPPED_KEYS = [
  'shot_number',
  'start_lat',
  'start_lng',
  'end_lat',
  'end_lng',
  'distance_to_target',
  'club',
  'lie_type',
  'lie_slope',
  'lie_slope_forward',
  'lie_slope_side',
  'shot_result',
  'contact',
  'shape',
  'start_line',
  'penalty',
  'ob',
  'putt_distance_ft',
  'putt_result',
  'putt_distance_result',
  'putt_direction_result',
  'putt_slope_pct',
  'green_speed',
  'break_direction',
  'break_direction_vertical',
  'break_direction_horizontal',
  'aim_offset_yards',
  'notes',
]

const CALLER_OWNED_KEYS = ['id', 'hole_score_id', 'user_id', 'aim_lat', 'aim_lng', 'created_at']

describe('reviewedRowToShotFields', () => {
  describe('key set', () => {
    it('returns exactly the 28 mapped columns, which spread into a shots insert', () => {
      const row = shotRow(EVERYTHING)
      const fields = reviewedRowToShotFields(row, undefined)

      // Compile-time half (core's tsc covers tests): no cast on any of the
      // three. The last two fail under a bare Pick, so they pin Required.
      const insert: ShotInsert = { hole_score_id: '', user_id: '', ...fields }
      const p: boolean = fields.penalty
      const s: string | null = fields.lie_slope

      expect(Object.keys(fields).sort()).toEqual([...MAPPED_KEYS].sort())
      expect(Object.keys(insert).sort()).toEqual(
        [...MAPPED_KEYS, 'hole_score_id', 'user_id'].sort(),
      )
      expect(p).toBe(true)
      expect(s).toBeNull()
    })

    it('returns the same 28 columns for a putt', () => {
      const fields = reviewedRowToShotFields(puttRow(EVERYTHING), undefined)
      expect(Object.keys(fields).sort()).toEqual([...MAPPED_KEYS].sort())
    })

    it('returns all 28 columns for a shot with no optional field set', () => {
      const fields = reviewedRowToShotFields(shotRow(), undefined)
      expect(Object.keys(fields).sort()).toEqual([...MAPPED_KEYS].sort())
    })

    it('returns all 28 columns for a putt with no optional field set', () => {
      const fields = reviewedRowToShotFields(puttRow(), undefined)
      expect(Object.keys(fields).sort()).toEqual([...MAPPED_KEYS].sort())
    })

    it.each([
      ['a bare shot', shotRow()],
      ['a bare putt', puttRow()],
    ])('has no undefined value for %s', (_label, row) => {
      const fields = reviewedRowToShotFields(row, undefined)
      const undefinedKeys = Object.entries(fields)
        .filter(([, v]) => v === undefined)
        .map(([k]) => k)
      expect(undefinedKeys).toEqual([])
    })

    it.each(CALLER_OWNED_KEYS)('never carries the caller-owned key %s', (key) => {
      expect(reviewedRowToShotFields(shotRow(EVERYTHING), true)).not.toHaveProperty(key)
      expect(reviewedRowToShotFields(puttRow(EVERYTHING), true)).not.toHaveProperty(key)
    })
  })

  describe('storedPenalty argument', () => {
    it('is a required argument that accepts undefined', () => {
      // @ts-expect-error storedPenalty cannot be omitted — a call site that drops it must not compile
      const dropped = reviewedRowToShotFields(shotRow())
      const explicit = reviewedRowToShotFields(shotRow(), undefined)
      expect(dropped.penalty).toBe(false)
      expect(explicit.penalty).toBe(false)
    })
  })

  describe('whole payload', () => {
    it('maps a full shot with every field set, dropping the putt-only fields', () => {
      expect(reviewedRowToShotFields(shotRow(EVERYTHING), false)).toEqual({
        shot_number: 2,
        start_lat: 35.4676,
        start_lng: -97.5164,
        end_lat: 35.4689,
        end_lng: -97.5161,
        distance_to_target: 153,
        club: '7i',
        lie_type: 'fairway',
        lie_slope: null,
        lie_slope_forward: 'uphill',
        lie_slope_side: 'ball_above',
        shot_result: 'ob',
        contact: 'thin',
        shape: 'fade',
        start_line: 'push',
        penalty: true,
        ob: true,
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
        notes: 'into the wind',
      })
    })

    it('maps a putt with every field set, dropping the shot-only fields', () => {
      expect(reviewedRowToShotFields(puttRow(EVERYTHING), false)).toEqual({
        shot_number: 3,
        start_lat: 35.4676,
        start_lng: -97.5164,
        end_lat: 35.4689,
        end_lng: -97.5161,
        distance_to_target: null,
        club: 'putter',
        lie_type: 'green',
        lie_slope: null,
        lie_slope_forward: null,
        lie_slope_side: null,
        shot_result: null,
        contact: null,
        shape: null,
        start_line: null,
        penalty: true,
        ob: false,
        putt_distance_ft: 12,
        putt_result: 'short',
        putt_distance_result: 'short',
        putt_direction_result: 'left',
        putt_slope_pct: 2.5,
        green_speed: 'fast',
        break_direction: 'left_to_right',
        break_direction_vertical: 'uphill',
        break_direction_horizontal: 'left_to_right',
        aim_offset_yards: 0.5,
        notes: 'into the wind',
      })
    })

    it('maps a shot with no optional field set to nulls and false', () => {
      expect(reviewedRowToShotFields(shotRow(), undefined)).toEqual({
        shot_number: 2,
        start_lat: 35.4676,
        start_lng: -97.5164,
        end_lat: 35.4689,
        end_lng: -97.5161,
        distance_to_target: 153,
        club: '7i',
        lie_type: 'fairway',
        lie_slope: null,
        lie_slope_forward: null,
        lie_slope_side: null,
        shot_result: null,
        contact: null,
        shape: null,
        start_line: null,
        penalty: false,
        ob: false,
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
      })
    })

    it('maps a putt with no optional field set to nulls and false', () => {
      expect(reviewedRowToShotFields(puttRow(), undefined)).toEqual({
        shot_number: 3,
        start_lat: 35.4676,
        start_lng: -97.5164,
        end_lat: 35.4689,
        end_lng: -97.5161,
        distance_to_target: null,
        club: 'putter',
        lie_type: 'green',
        lie_slope: null,
        lie_slope_forward: null,
        lie_slope_side: null,
        shot_result: null,
        contact: null,
        shape: null,
        start_line: null,
        penalty: false,
        ob: false,
        putt_distance_ft: 12,
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
      })
    })
  })

  describe('putt gate', () => {
    it('treats a putter from a green lie as a putt', () => {
      const fields = reviewedRowToShotFields(
        puttRow({ distanceYards: 4, distanceToPin: 4 }),
        undefined,
      )
      expect(fields.putt_distance_ft).toBe(12)
      expect(fields.distance_to_target).toBeNull()
    })

    it('treats a wedge from a green lie as a full shot', () => {
      const fields = reviewedRowToShotFields(
        puttRow({ club: 'lw', distanceYards: 4, distanceToPin: 6.4, ...EVERYTHING }),
        undefined,
      )
      expect(fields.putt_distance_ft).toBeNull()
      expect(fields.putt_result).toBeNull()
      expect(fields.distance_to_target).toBe(6)
      expect(fields.shot_result).toBe('ob')
      expect(fields.ob).toBe(true)
    })

    it('treats a putter from a non-green lie as a full shot', () => {
      const fields = reviewedRowToShotFields(
        puttRow({ lieType: 'fringe', distanceYards: 4, distanceToPin: 6.4, ...EVERYTHING }),
        undefined,
      )
      expect(fields.putt_distance_ft).toBeNull()
      expect(fields.putt_result).toBeNull()
      expect(fields.distance_to_target).toBe(6)
      expect(fields.shot_result).toBe('ob')
      expect(fields.ob).toBe(true)
    })
  })

  describe('pass-through columns', () => {
    it.each([
      ['a shot', shotRow({ shotNumber: 7 })],
      ['a putt', puttRow({ shotNumber: 7 })],
    ])('copies shot_number for %s', (_label, row) => {
      expect(reviewedRowToShotFields(row, undefined).shot_number).toBe(7)
    })

    it.each([
      ['a shot', shotRow({ startLat: null, startLng: null })],
      ['a putt', puttRow({ startLat: null, startLng: null })],
    ])('keeps a null start position for %s', (_label, row) => {
      const fields = reviewedRowToShotFields(row, undefined)
      expect(fields.start_lat).toBeNull()
      expect(fields.start_lng).toBeNull()
    })

    it.each([
      ['a shot', shotRow({ startLat: 1.5, startLng: 2.5, endLat: 3.5, endLng: 4.5 })],
      ['a putt', puttRow({ startLat: 1.5, startLng: 2.5, endLat: 3.5, endLng: 4.5 })],
    ])('copies each coordinate to its own column for %s', (_label, row) => {
      const fields = reviewedRowToShotFields(row, undefined)
      expect([fields.start_lat, fields.start_lng, fields.end_lat, fields.end_lng]).toEqual([
        1.5, 2.5, 3.5, 4.5,
      ])
    })

    it('copies a custom club string as is', () => {
      const fields = reviewedRowToShotFields(shotRow({ club: '4 hybrid', lieType: 'rough' }), undefined)
      expect(fields.club).toBe('4 hybrid')
      expect(fields.lie_type).toBe('rough')
    })

    it.each([
      ['a shot', shotRow(EVERYTHING)],
      ['a putt', puttRow(EVERYTHING)],
    ])('writes lie_slope null for %s', (_label, row) => {
      expect(reviewedRowToShotFields(row, undefined).lie_slope).toBeNull()
    })
  })

  describe('notes', () => {
    it.each([
      ['a shot', shotRow],
      ['a putt', puttRow],
    ])('keeps the text for %s', (_label, build) => {
      expect(reviewedRowToShotFields(build({ notes: 'lipped out' }), undefined).notes).toBe(
        'lipped out',
      )
    })

    it.each([
      ['a shot', shotRow],
      ['a putt', puttRow],
    ])('keeps an empty string for %s (?? not ||)', (_label, build) => {
      expect(reviewedRowToShotFields(build({ notes: '' }), undefined).notes).toBe('')
    })

    it.each([
      ['a shot', shotRow],
      ['a putt', puttRow],
    ])('is null when unset for %s', (_label, build) => {
      expect(reviewedRowToShotFields(build(), undefined).notes).toBeNull()
    })
  })

  describe('penalty', () => {
    // row.penalty ?? storedPenalty ?? false
    it.each<[boolean | undefined, boolean | null | undefined, boolean]>([
      [undefined, undefined, false],
      [undefined, null, false],
      [undefined, false, false],
      [undefined, true, true],
      [true, undefined, true],
      [true, null, true],
      [true, false, true],
      [true, true, true],
      [false, undefined, false],
      [false, null, false],
      [false, false, false],
      [false, true, false],
    ])('shot: row.penalty %s with stored %s gives %s', (rowPenalty, stored, expected) => {
      const fields = reviewedRowToShotFields(shotRow({ penalty: rowPenalty }), stored)
      expect(fields.penalty).toBe(expected)
    })

    it.each<[boolean | undefined, boolean | null | undefined, boolean]>([
      [undefined, undefined, false],
      [undefined, null, false],
      [undefined, true, true],
      [true, false, true],
      [false, true, false],
    ])('putt: row.penalty %s with stored %s gives %s', (rowPenalty, stored, expected) => {
      const fields = reviewedRowToShotFields(puttRow({ penalty: rowPenalty }), stored)
      expect(fields.penalty).toBe(expected)
    })

    it('is not derived from the shot result', () => {
      expect(
        reviewedRowToShotFields(shotRow({ shotResult: 'penalty' }), undefined).penalty,
      ).toBe(false)
      expect(reviewedRowToShotFields(shotRow({ shotResult: 'ob' }), undefined).penalty).toBe(false)
    })
  })

  describe('distance_to_target', () => {
    it.each([
      [152.5, 153],
      [152.49, 152],
      [0, 0],
    ])('rounds %s yd to the pin to %s for a shot', (distanceToPin, expected) => {
      expect(
        reviewedRowToShotFields(shotRow({ distanceToPin }), undefined).distance_to_target,
      ).toBe(expected)
    })

    it('is null for a putt', () => {
      expect(
        reviewedRowToShotFields(puttRow({ distanceToPin: 152.5 }), undefined).distance_to_target,
      ).toBeNull()
    })
  })

  describe('lie slope axes', () => {
    it('stores both axes for a shot', () => {
      const fields = reviewedRowToShotFields(
        shotRow({ lieSlopeForward: 'downhill', lieSlopeSide: 'ball_below' }),
        undefined,
      )
      expect(fields.lie_slope_forward).toBe('downhill')
      expect(fields.lie_slope_side).toBe('ball_below')
    })

    it('stores one axis without the other', () => {
      const forwardOnly = reviewedRowToShotFields(shotRow({ lieSlopeForward: 'level' }), undefined)
      expect(forwardOnly.lie_slope_forward).toBe('level')
      expect(forwardOnly.lie_slope_side).toBeNull()

      const sideOnly = reviewedRowToShotFields(shotRow({ lieSlopeSide: 'ball_above' }), undefined)
      expect(sideOnly.lie_slope_forward).toBeNull()
      expect(sideOnly.lie_slope_side).toBe('ball_above')
    })

    it('is null on both axes for a putt even when the row carries them', () => {
      const fields = reviewedRowToShotFields(
        puttRow({ lieSlopeForward: 'downhill', lieSlopeSide: 'ball_below' }),
        undefined,
      )
      expect(fields.lie_slope_forward).toBeNull()
      expect(fields.lie_slope_side).toBeNull()
    })
  })

  describe('shot result and its axes', () => {
    it('stores shot_result for a shot', () => {
      expect(reviewedRowToShotFields(shotRow({ shotResult: 'fat' }), undefined).shot_result).toBe(
        'fat',
      )
    })

    it('stores contact, shape and start_line each in its own column', () => {
      const fields = reviewedRowToShotFields(
        shotRow({ contact: 'topped', shape: 'hook', startLine: 'pull' }),
        undefined,
      )
      expect(fields.contact).toBe('topped')
      expect(fields.shape).toBe('hook')
      expect(fields.start_line).toBe('pull')
    })

    it('keeps an explicit null axis as null', () => {
      const fields = reviewedRowToShotFields(
        shotRow({ contact: null, shape: null, startLine: null }),
        undefined,
      )
      expect(fields.contact).toBeNull()
      expect(fields.shape).toBeNull()
      expect(fields.start_line).toBeNull()
    })

    it('is null on a putt even when the row carries them', () => {
      const fields = reviewedRowToShotFields(
        puttRow({ shotResult: 'fat', contact: 'topped', shape: 'hook', startLine: 'pull' }),
        undefined,
      )
      expect(fields.shot_result).toBeNull()
      expect(fields.contact).toBeNull()
      expect(fields.shape).toBeNull()
      expect(fields.start_line).toBeNull()
    })
  })

  describe('ob', () => {
    it("is true for a shot whose result is 'ob'", () => {
      expect(reviewedRowToShotFields(shotRow({ shotResult: 'ob' }), undefined).ob).toBe(true)
    })

    it.each<[ReviewedShotRow['shotResult']]>([['solid'], ['penalty'], [undefined]])(
      'is false for a shot whose result is %s',
      (shotResult) => {
        expect(reviewedRowToShotFields(shotRow({ shotResult }), undefined).ob).toBe(false)
      },
    )

    it('takes nothing from the stored penalty or the row penalty', () => {
      expect(reviewedRowToShotFields(shotRow(), true).ob).toBe(false)
      expect(reviewedRowToShotFields(shotRow({ penalty: true }), true).ob).toBe(false)
    })

    it("is false with a null shot_result on a missed putt whose row says 'ob'", () => {
      const fields = reviewedRowToShotFields(puttRow({ shotResult: 'ob' }), undefined)
      expect(fields.ob).toBe(false)
      expect(fields.shot_result).toBeNull()
    })

    it("is false with a null shot_result on a made putt whose row says 'ob'", () => {
      const fields = reviewedRowToShotFields(
        puttRow({ shotResult: 'ob', puttMade: true }),
        undefined,
      )
      expect(fields.ob).toBe(false)
      expect(fields.shot_result).toBeNull()
      expect(fields.putt_result).toBe('made')
    })
  })

  describe('putt_distance_ft', () => {
    it.each<[number, number | null]>([
      [4, 12],
      [1.4, 4],
      [0, 0],
      [333, 999],
      [333.1, 999],
      [333.2, null],
      [333.4, null],
      [400, null],
      [Number.NaN, null],
      [Number.POSITIVE_INFINITY, null],
    ])('turns a %s yd putt into %s ft', (distanceYards, expected) => {
      expect(
        reviewedRowToShotFields(puttRow({ distanceYards }), undefined).putt_distance_ft,
      ).toBe(expected)
    })

    it('is null for a shot', () => {
      expect(
        reviewedRowToShotFields(shotRow({ distanceYards: 4 }), undefined).putt_distance_ft,
      ).toBeNull()
    })
  })

  describe('putt_result', () => {
    type Parts = Pick<ReviewedShotRow, 'puttMade' | 'puttDistanceResult' | 'puttDirectionResult'>

    it.each<[string, Parts, string | null]>([
      ['a made putt', { puttMade: true }, 'made'],
      [
        'a made putt with stale miss axes',
        { puttMade: true, puttDistanceResult: 'long', puttDirectionResult: 'right' },
        'made',
      ],
      ['a short miss', { puttMade: false, puttDistanceResult: 'short' }, 'short'],
      ['a long miss', { puttMade: false, puttDistanceResult: 'long' }, 'long'],
      ['a left miss', { puttMade: false, puttDirectionResult: 'left' }, 'missed_left'],
      ['a right miss', { puttMade: false, puttDirectionResult: 'right' }, 'missed_right'],
      [
        'a short-and-left miss (distance wins)',
        { puttMade: false, puttDistanceResult: 'short', puttDirectionResult: 'left' },
        'short',
      ],
      [
        'a long-and-right miss (distance wins)',
        { puttMade: false, puttDistanceResult: 'long', puttDirectionResult: 'right' },
        'long',
      ],
      ['a miss with no axis', { puttMade: false }, null],
      ['a short miss with puttMade unset', { puttDistanceResult: 'short' }, 'short'],
      ['a putt with nothing set', {}, null],
    ])('is the legacy value for %s', (_label, parts, expected) => {
      expect(reviewedRowToShotFields(puttRow(parts), undefined).putt_result).toBe(expected)
    })

    it('is null for a shot even when the row says the putt was made', () => {
      expect(
        reviewedRowToShotFields(shotRow({ puttMade: true }), undefined).putt_result,
      ).toBeNull()
    })
  })

  describe('putt miss axes', () => {
    it('stores distance and direction independently on a miss', () => {
      const fields = reviewedRowToShotFields(
        puttRow({ puttMade: false, puttDistanceResult: 'long', puttDirectionResult: 'right' }),
        undefined,
      )
      expect(fields.putt_distance_result).toBe('long')
      expect(fields.putt_direction_result).toBe('right')
    })

    it('stores them when puttMade is unset', () => {
      const fields = reviewedRowToShotFields(
        puttRow({ puttDistanceResult: 'short', puttDirectionResult: 'left' }),
        undefined,
      )
      expect(fields.putt_distance_result).toBe('short')
      expect(fields.putt_direction_result).toBe('left')
    })

    it('stores one axis without the other', () => {
      const distanceOnly = reviewedRowToShotFields(
        puttRow({ puttMade: false, puttDistanceResult: 'short' }),
        undefined,
      )
      expect(distanceOnly.putt_distance_result).toBe('short')
      expect(distanceOnly.putt_direction_result).toBeNull()

      const directionOnly = reviewedRowToShotFields(
        puttRow({ puttMade: false, puttDirectionResult: 'right' }),
        undefined,
      )
      expect(directionOnly.putt_distance_result).toBeNull()
      expect(directionOnly.putt_direction_result).toBe('right')
    })

    it('drops both on a made putt', () => {
      const fields = reviewedRowToShotFields(
        puttRow({ puttMade: true, puttDistanceResult: 'long', puttDirectionResult: 'right' }),
        undefined,
      )
      expect(fields.putt_distance_result).toBeNull()
      expect(fields.putt_direction_result).toBeNull()
    })

    it('is null on both for a shot', () => {
      const fields = reviewedRowToShotFields(
        shotRow({ puttMade: false, puttDistanceResult: 'long', puttDirectionResult: 'right' }),
        undefined,
      )
      expect(fields.putt_distance_result).toBeNull()
      expect(fields.putt_direction_result).toBeNull()
    })
  })

  describe('green read', () => {
    it('keeps a 0% slope (?? not ||)', () => {
      expect(reviewedRowToShotFields(puttRow({ puttSlopePct: 0 }), undefined).putt_slope_pct).toBe(0)
    })

    it('stores the slope percentage', () => {
      expect(
        reviewedRowToShotFields(puttRow({ puttSlopePct: 3.5 }), undefined).putt_slope_pct,
      ).toBe(3.5)
    })

    it.each<[NonNullable<ReviewedShotRow['greenSpeed']>]>([['slow'], ['medium'], ['fast']])(
      'stores green speed %s',
      (greenSpeed) => {
        expect(reviewedRowToShotFields(puttRow({ greenSpeed }), undefined).green_speed).toBe(
          greenSpeed,
        )
      },
    )

    it.each<[NonNullable<ReviewedShotRow['breakDirectionVertical']>]>([
      ['uphill'],
      ['flat'],
      ['downhill'],
    ])('stores the vertical break %s as is', (breakDirectionVertical) => {
      expect(
        reviewedRowToShotFields(puttRow({ breakDirectionVertical }), undefined)
          .break_direction_vertical,
      ).toBe(breakDirectionVertical)
    })

    it.each<[NonNullable<ReviewedShotRow['breakDirectionHorizontal']>]>([
      ['left_to_right'],
      ['right_to_left'],
      ['straight'],
    ])('stores the horizontal break %s as is', (breakDirectionHorizontal) => {
      expect(
        reviewedRowToShotFields(puttRow({ breakDirectionHorizontal }), undefined)
          .break_direction_horizontal,
      ).toBe(breakDirectionHorizontal)
    })

    it('keeps the whole read on a made putt', () => {
      const fields = reviewedRowToShotFields(
        puttRow({
          puttMade: true,
          puttSlopePct: 2.5,
          greenSpeed: 'slow',
          breakDirectionVertical: 'downhill',
          breakDirectionHorizontal: 'right_to_left',
          aimOffsetInches: 36,
        }),
        undefined,
      )
      expect({
        putt_slope_pct: fields.putt_slope_pct,
        green_speed: fields.green_speed,
        break_direction: fields.break_direction,
        break_direction_vertical: fields.break_direction_vertical,
        break_direction_horizontal: fields.break_direction_horizontal,
        aim_offset_yards: fields.aim_offset_yards,
      }).toEqual({
        putt_slope_pct: 2.5,
        green_speed: 'slow',
        break_direction: 'right_to_left',
        break_direction_vertical: 'downhill',
        break_direction_horizontal: 'right_to_left',
        aim_offset_yards: 1,
      })
    })

    it('is null throughout for a shot even when the row carries a read', () => {
      const fields = reviewedRowToShotFields(
        shotRow({
          puttSlopePct: 2.5,
          greenSpeed: 'slow',
          breakDirectionVertical: 'downhill',
          breakDirectionHorizontal: 'right_to_left',
          aimOffsetInches: 36,
        }),
        undefined,
      )
      expect({
        putt_slope_pct: fields.putt_slope_pct,
        green_speed: fields.green_speed,
        break_direction: fields.break_direction,
        break_direction_vertical: fields.break_direction_vertical,
        break_direction_horizontal: fields.break_direction_horizontal,
        aim_offset_yards: fields.aim_offset_yards,
      }).toEqual({
        putt_slope_pct: null,
        green_speed: null,
        break_direction: null,
        break_direction_vertical: null,
        break_direction_horizontal: null,
        aim_offset_yards: null,
      })
    })
  })

  describe('break_direction, the legacy combined value', () => {
    type Break = Pick<ReviewedShotRow, 'breakDirectionVertical' | 'breakDirectionHorizontal'>

    it.each<[string, Break, string | null]>([
      ['left to right', { breakDirectionHorizontal: 'left_to_right' }, 'left_to_right'],
      ['right to left', { breakDirectionHorizontal: 'right_to_left' }, 'right_to_left'],
      ['straight', { breakDirectionHorizontal: 'straight' }, 'straight'],
      [
        'straight and uphill (horizontal wins)',
        { breakDirectionHorizontal: 'straight', breakDirectionVertical: 'uphill' },
        'straight',
      ],
      [
        'right to left and downhill (horizontal wins)',
        { breakDirectionHorizontal: 'right_to_left', breakDirectionVertical: 'downhill' },
        'right_to_left',
      ],
      ['uphill only', { breakDirectionVertical: 'uphill' }, 'uphill'],
      ['downhill only', { breakDirectionVertical: 'downhill' }, 'downhill'],
      ['flat only', { breakDirectionVertical: 'flat' }, null],
      ['nothing set', {}, null],
    ])('for %s', (_label, parts, expected) => {
      expect(reviewedRowToShotFields(puttRow(parts), undefined).break_direction).toBe(expected)
    })
  })

  describe('aim_offset_yards', () => {
    // -0-producing inputs (small negatives) are deliberately not asserted.
    it.each<[number | undefined, number | null]>([
      [18, 0.5],
      [-18, -0.5],
      [0, 0],
      [2, 0.1],
      [36, 1],
      [100, 2.8],
      [undefined, null],
    ])('turns an aim offset of %s in into %s yd on a putt', (aimOffsetInches, expected) => {
      expect(
        reviewedRowToShotFields(puttRow({ aimOffsetInches }), undefined).aim_offset_yards,
      ).toBe(expected)
    })

    it('is null for a shot', () => {
      expect(
        reviewedRowToShotFields(shotRow({ aimOffsetInches: 18 }), undefined).aim_offset_yards,
      ).toBeNull()
    })
  })

  describe('purity', () => {
    it.each([
      ['a shot', shotRow(EVERYTHING)],
      ['a putt', puttRow(EVERYTHING)],
    ])('does not throw on a frozen row for %s', (_label, row) => {
      const frozen = Object.freeze(row)
      expect(() => reviewedRowToShotFields(frozen, true)).not.toThrow()
    })

    it.each([
      ['a shot', shotRow(EVERYTHING)],
      ['a putt', puttRow(EVERYTHING)],
    ])('leaves the row as it was for %s', (_label, row) => {
      const before = structuredClone(row)
      reviewedRowToShotFields(row, true)
      expect(row).toEqual(before)
    })

    it.each([
      ['a shot', shotRow(EVERYTHING)],
      ['a putt', puttRow(EVERYTHING)],
    ])('returns a fresh, equal object on each call for %s', (_label, row) => {
      const first = reviewedRowToShotFields(row, true)
      const second = reviewedRowToShotFields(row, true)
      expect(second).not.toBe(first)
      expect(second).toEqual(first)
    })
  })
})

describe('lieSlopeLabel', () => {
  it.each([
    ['ball_above', 'Ball above'],
    ['ball_below', 'Ball below'],
    ['uphill', 'Uphill'],
    ['level', 'Level'],
    ['downhill', 'Downhill'],
    ['a_b_c', 'A b c'],
    ['', ''],
  ])('labels %j as %j', (value, expected) => {
    expect(lieSlopeLabel(value)).toBe(expected)
  })
})
