import { describe, expect, it } from 'vitest'
import { DEFAULT_BAG, shotPickerClubGroups, splitBalancedRows } from '../constants'

const bag = (...types: string[]) => types.map((value) => ({ value, label: value }))
const shape = (groups: { label: string; opts: { value: string }[] }[]) =>
  groups.map((g) => [g.label, g.opts.map((o) => o.value)])

describe('shotPickerClubGroups', () => {
  it('splits the default bag into Woods, Irons, Wedges (putter with the wedges)', () => {
    expect(shape(shotPickerClubGroups(bag(...DEFAULT_BAG.map((c) => c.club_type))))).toEqual([
      ['Woods', ['driver', '3w', '5w', '5h']],
      ['Irons', ['5i', '6i', '7i', '8i', '9i']],
      ['Wedges', ['pw', 'gw', 'sw', 'lw', 'putter']],
    ])
  })

  it('folds a lonely middle group into the next one, in front', () => {
    expect(shape(shotPickerClubGroups(bag('driver', '3w', '7i', 'pw', 'sw', 'putter')))).toEqual([
      ['Woods', ['driver', '3w']],
      ['Wedges', ['7i', 'pw', 'sw', 'putter']],
    ])
  })

  it('folds a lonely last group into the previous one, behind', () => {
    expect(shape(shotPickerClubGroups(bag('driver', '3w', '5i', '6i', 'putter')))).toEqual([
      ['Woods', ['driver', '3w']],
      ['Irons', ['5i', '6i', 'putter']],
    ])
  })

  it('puts unknown club_types in Other, not Wedges; known odd ones in their group', () => {
    expect(
      shape(shotPickerClubGroups(bag('mini_driver', '3w', '7i', '8i', 'aw', 'cw', 'chipper', 'utility'))),
    ).toEqual([
      ['Woods', ['mini_driver', '3w']],
      ['Irons', ['7i', '8i']],
      ['Wedges', ['aw', 'cw']],
      ['Other', ['chipper', 'utility']],
    ])
  })

  it('keeps one club as one group', () => {
    expect(shape(shotPickerClubGroups(bag('chipper')))).toEqual([['Other', ['chipper']]])
  })
})

describe('splitBalancedRows', () => {
  it('balances rows of at most five, never one left over', () => {
    const n = (k: number) => Array.from({ length: k }, (_, i) => i)
    expect(splitBalancedRows(n(5)).map((r) => r.length)).toEqual([5])
    expect(splitBalancedRows(n(6)).map((r) => r.length)).toEqual([3, 3])
    expect(splitBalancedRows(n(11)).map((r) => r.length)).toEqual([4, 4, 3])
    expect(splitBalancedRows(n(14)).map((r) => r.length)).toEqual([5, 5, 4])
  })
})
