import { describe, expect, it } from 'vitest'
import {
  CLUBS,
  CLUB_CATEGORIES,
  CLUB_CATEGORY_LABELS,
  DEFAULT_BAG,
  clubCategoryFor,
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

  it('maps degree-named wedges and attack wedge', () => {
    expect(clubCategoryFor('aw')).toBe('wedge')
    expect(clubCategoryFor('46°')).toBe('wedge')
    expect(clubCategoryFor('60°')).toBe('wedge')
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
