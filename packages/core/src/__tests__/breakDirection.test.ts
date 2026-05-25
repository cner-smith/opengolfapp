import { describe, it, expect } from 'vitest'
import {
  combinedBreakDirection,
  decombinedBreakDirection,
  type BreakDirection,
} from '../types'

describe('combinedBreakDirection', () => {
  it('returns horizontal value when only horizontal is set', () => {
    expect(combinedBreakDirection({ horizontal: 'left_to_right' })).toBe('left_to_right')
    expect(combinedBreakDirection({ horizontal: 'right_to_left' })).toBe('right_to_left')
    expect(combinedBreakDirection({ horizontal: 'straight' })).toBe('straight')
  })

  it('returns vertical value when only vertical is set', () => {
    expect(combinedBreakDirection({ vertical: 'uphill' })).toBe('uphill')
    expect(combinedBreakDirection({ vertical: 'downhill' })).toBe('downhill')
  })

  it('prefers horizontal when both axes are set', () => {
    expect(
      combinedBreakDirection({ vertical: 'uphill', horizontal: 'left_to_right' }),
    ).toBe('left_to_right')
    expect(
      combinedBreakDirection({ vertical: 'downhill', horizontal: 'right_to_left' }),
    ).toBe('right_to_left')
  })

  it('returns null when both axes are null or absent', () => {
    expect(combinedBreakDirection({})).toBeNull()
    expect(combinedBreakDirection({ vertical: null, horizontal: null })).toBeNull()
  })

  it('drops `flat` vertical when horizontal is null — no legacy equivalent', () => {
    expect(combinedBreakDirection({ vertical: 'flat' })).toBeNull()
    expect(
      combinedBreakDirection({ vertical: 'flat', horizontal: null }),
    ).toBeNull()
  })

  it('still returns horizontal when flat vertical is combined with horizontal', () => {
    expect(
      combinedBreakDirection({ vertical: 'flat', horizontal: 'straight' }),
    ).toBe('straight')
  })
})

describe('decombinedBreakDirection', () => {
  it('splits uphill onto the vertical axis', () => {
    expect(decombinedBreakDirection('uphill')).toEqual({
      vertical: 'uphill',
      horizontal: null,
    })
  })

  it('splits downhill onto the vertical axis', () => {
    expect(decombinedBreakDirection('downhill')).toEqual({
      vertical: 'downhill',
      horizontal: null,
    })
  })

  it('splits left_to_right / right_to_left / straight onto the horizontal axis', () => {
    expect(decombinedBreakDirection('left_to_right')).toEqual({
      vertical: null,
      horizontal: 'left_to_right',
    })
    expect(decombinedBreakDirection('right_to_left')).toEqual({
      vertical: null,
      horizontal: 'right_to_left',
    })
    expect(decombinedBreakDirection('straight')).toEqual({
      vertical: null,
      horizontal: 'straight',
    })
  })

  it('maps legacy single-letter `left` onto right_to_left horizontal', () => {
    expect(decombinedBreakDirection('left')).toEqual({
      vertical: null,
      horizontal: 'right_to_left',
    })
  })

  it('maps legacy single-letter `right` onto left_to_right horizontal', () => {
    expect(decombinedBreakDirection('right')).toEqual({
      vertical: null,
      horizontal: 'left_to_right',
    })
  })

  it('returns both nulls for null / undefined input', () => {
    expect(decombinedBreakDirection(null)).toEqual({
      vertical: null,
      horizontal: null,
    })
    expect(decombinedBreakDirection(undefined)).toEqual({
      vertical: null,
      horizontal: null,
    })
  })
})

describe('combinedBreakDirection ∘ decombinedBreakDirection roundtrip', () => {
  // The five canonical (non-legacy) values should roundtrip exactly.
  const canonical: BreakDirection[] = [
    'uphill',
    'downhill',
    'left_to_right',
    'right_to_left',
    'straight',
  ]

  it.each(canonical)('roundtrips %s', (value) => {
    expect(combinedBreakDirection(decombinedBreakDirection(value))).toBe(value)
  })

  it('legacy `left` lossily roundtrips to right_to_left', () => {
    expect(combinedBreakDirection(decombinedBreakDirection('left'))).toBe('right_to_left')
  })

  it('legacy `right` lossily roundtrips to left_to_right', () => {
    expect(combinedBreakDirection(decombinedBreakDirection('right'))).toBe('left_to_right')
  })
})
