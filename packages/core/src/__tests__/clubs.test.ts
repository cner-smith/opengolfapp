import { describe, expect, it } from 'vitest'
import {
  CANONICAL_CLUBS_BY_CATEGORY,
  CLUBS,
  CLUB_CATEGORIES,
  CLUB_CATEGORY_LABELS,
  DEFAULT_BAG,
  clubCategoryFor,
  formatClubLabel,
} from '../constants'

describe('clubCategoryFor', () => {
  it('maps driver/putter to themselves', () => {
    expect(clubCategoryFor('driver')).toBe('driver')
    expect(clubCategoryFor('putter')).toBe('putter')
  })

  it('maps fairway woods', () => {
    expect(clubCategoryFor('3w')).toBe('wood')
    expect(clubCategoryFor('5w')).toBe('wood')
    expect(clubCategoryFor('7w')).toBe('wood')
  })

  it('maps hybrids', () => {
    expect(clubCategoryFor('3h')).toBe('hybrid')
    expect(clubCategoryFor('4h')).toBe('hybrid')
    expect(clubCategoryFor('5h')).toBe('hybrid')
  })

  it('maps irons 2 through 9', () => {
    expect(clubCategoryFor('2i')).toBe('iron')
    expect(clubCategoryFor('5i')).toBe('iron')
    expect(clubCategoryFor('9i')).toBe('iron')
  })

  it('maps wedges', () => {
    expect(clubCategoryFor('pw')).toBe('wedge')
    expect(clubCategoryFor('gw')).toBe('wedge')
    expect(clubCategoryFor('sw')).toBe('wedge')
    expect(clubCategoryFor('lw')).toBe('wedge')
  })

  it('maps mini driver and extended fairway woods', () => {
    expect(clubCategoryFor('mini_driver')).toBe('wood')
    expect(clubCategoryFor('2w')).toBe('wood')
    expect(clubCategoryFor('11w')).toBe('wood')
  })

  it('maps additional hybrids and irons', () => {
    expect(clubCategoryFor('6h')).toBe('hybrid')
    expect(clubCategoryFor('1i')).toBe('iron')
  })

  it('maps approach wedge and the cw custom-wedge slot', () => {
    expect(clubCategoryFor('aw')).toBe('wedge')
    expect(clubCategoryFor('cw')).toBe('wedge')
  })

  it('still maps the legacy custom_wedge string to wedge', () => {
    // Pre-rename rows from dev-test of #164. Kept for backwards compat.
    expect(clubCategoryFor('custom_wedge')).toBe('wedge')
  })

  it('no longer treats raw degree strings as wedges', () => {
    // Degree-named entries were removed from the picklist (issue #164).
    // The custom_wedge slot + the loft field carry the same intent;
    // a free-floating "60°" string falls through to utility now.
    expect(clubCategoryFor('60°')).toBe('utility')
    expect(clubCategoryFor('46°')).toBe('utility')
  })

  it('falls back to utility for genuinely non-canonical club_types', () => {
    expect(clubCategoryFor('chipper')).toBe('utility')
    expect(clubCategoryFor('')).toBe('utility')
  })

  it('every canonical CLUB has a category', () => {
    for (const c of CLUBS) {
      const cat = clubCategoryFor(c)
      expect(CLUB_CATEGORIES).toContain(cat)
    }
  })

  it('every category has a non-empty label', () => {
    for (const c of CLUB_CATEGORIES) {
      expect(CLUB_CATEGORY_LABELS[c]).toBeTruthy()
    }
  })
})

describe('DEFAULT_BAG', () => {
  it('has 14 entries (the USGA legal max)', () => {
    expect(DEFAULT_BAG.length).toBe(14)
  })

  it('every entry references a canonical CLUB', () => {
    for (const entry of DEFAULT_BAG) {
      expect(CLUBS).toContain(entry.club_type)
    }
  })

  it('sort_order values are 0..13 in order', () => {
    DEFAULT_BAG.forEach((entry, idx) => {
      expect(entry.sort_order).toBe(idx)
    })
  })

  it('club_types are all distinct', () => {
    const set = new Set(DEFAULT_BAG.map((c) => c.club_type))
    expect(set.size).toBe(DEFAULT_BAG.length)
  })

  it('includes a putter (to seed the on-green logger)', () => {
    expect(DEFAULT_BAG.some((c) => c.club_type === 'putter')).toBe(true)
  })

  it('includes a driver', () => {
    expect(DEFAULT_BAG.some((c) => c.club_type === 'driver')).toBe(true)
  })
})

describe('CANONICAL_CLUBS_BY_CATEGORY.wedge', () => {
  it('only contains the five traditional names plus cw', () => {
    expect(CANONICAL_CLUBS_BY_CATEGORY.wedge).toEqual([
      'pw',
      'gw',
      'aw',
      'sw',
      'lw',
      'cw',
    ])
  })

  it('contains no degree-based entries', () => {
    for (const c of CANONICAL_CLUBS_BY_CATEGORY.wedge) {
      expect(/°/.test(c)).toBe(false)
    }
  })
})

describe('formatClubLabel', () => {
  it('returns club_type unchanged for non-custom single-word entries', () => {
    expect(formatClubLabel({ club_type: 'pw' })).toBe('pw')
    expect(formatClubLabel({ club_type: '7i', loft: 34 })).toBe('7i')
    expect(formatClubLabel({ club_type: 'driver', loft: 10.5 })).toBe('driver')
  })

  it('humanizes underscored club_types so the kicker style does not read MINI_DRIVER', () => {
    expect(formatClubLabel({ club_type: 'mini_driver' })).toBe('mini driver')
  })

  it('returns the loft as the label for cw', () => {
    expect(formatClubLabel({ club_type: 'cw', loft: 58 })).toBe('58°')
    expect(formatClubLabel({ club_type: 'cw', loft: 62 })).toBe('62°')
  })

  it('also handles the legacy custom_wedge club_type', () => {
    expect(formatClubLabel({ club_type: 'custom_wedge', loft: 58 })).toBe(
      '58°',
    )
  })

  it('falls back to the user-set name when cw has no loft', () => {
    expect(formatClubLabel({ club_type: 'cw', name: 'lob v2' })).toBe('lob v2')
  })

  it('falls back to literal "wedge" when cw has no loft and no name', () => {
    expect(formatClubLabel({ club_type: 'cw' })).toBe('wedge')
    expect(formatClubLabel({ club_type: 'cw', name: '   ' })).toBe('wedge')
  })

  it('rejects non-finite loft values', () => {
    expect(formatClubLabel({ club_type: 'cw', loft: Number.NaN })).toBe(
      'wedge',
    )
  })
})
