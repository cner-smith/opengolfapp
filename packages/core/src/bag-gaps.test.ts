import { describe, expect, it } from 'vitest'
import { HOLE_YARDS, bagGaps, type BagClub } from './bag-gaps'

// A club measured from its shots, with its two-in-three range.
const m = (clubType: string, yards: number, low: number, high: number): BagClub => ({
  clubType,
  typical: { yards, source: 'shots' },
  range: { low, high },
})
// A club with only the player's estimate.
const e = (clubType: string, yards: number): BagClub => ({
  clubType,
  typical: { yards, source: 'estimate' },
  range: null,
})
// A club with no number at all.
const none = (clubType: string): BagClub => ({ clubType, typical: null, range: null })

const kinds = (clubs: BagClub[]) => bagGaps(clubs, 'yards').gaps.map((g) => g.kind)

describe('bagGaps', () => {
  it('a plain ladder: 10 yd steps, the putter sits out, the range sentence', () => {
    const putter = e('putter', 3)
    const bag = [m('7i', 150, 146, 154), m('8i', 140, 136, 144), m('9i', 130, 126, 134), m('pw', 120, 117, 124), putter]
    const r = bagGaps(bag, 'yards')
    expect(r.rungs).toEqual(bag.slice(0, 4))
    expect(r.gaps.map((g) => [g.longer.clubType, g.shorter.clubType, g.yards, g.kind, g.span])).toEqual([
      ['7i', '8i', 10, 'step', null],
      ['8i', '9i', 10, 'step', null],
      ['9i', 'pw', 10, 'step', null],
    ])
    // Ties go to the first in the bag.
    expect(r.widest).toBe(r.gaps[0])
    expect(r.unmeasured).toEqual([])
    expect(r.headline).toBe('Your 7-iron to your pitching wedge, 150 to 120\u00a0yd, with every gap under 20\u00a0yd.')
  })

  it('a hole: the biggest empty stretch between ranges is the headline', () => {
    const r = bagGaps([m('5i', 190, 182, 198), m('6i', 150, 143, 157), m('7i', 140, 136, 144), m('pw', 100, 97, 103)], 'yards')
    expect(r.gaps.map((g) => [g.yards, g.kind, g.span])).toEqual([
      [40, 'hole', { low: 157, high: 182 }], // 182 − 157 = 25
      [10, 'overlap', { low: 143, high: 144 }],
      [40, 'hole', { low: 103, high: 136 }], // 136 − 103 = 33
    ])
    // The widest gap ties at 40 (first wins); the headline names the bigger hole.
    expect(r.widest).toBe(r.gaps[0])
    expect(r.headline).toBe('33\u00a0yd hole between your 7-iron and pitching wedge.')
  })

  it('an overlap: crossing ranges, with the shared stretch', () => {
    const r = bagGaps([m('driver', 250, 235, 265), m('3w', 235, 225, 245)], 'yards')
    expect(r.gaps[0]).toMatchObject({ yards: 15, kind: 'overlap', span: { low: 235, high: 245 } })
    expect(r.headline).toBe('Your driver to your 3-wood, 250 to 235\u00a0yd, with every gap under 20\u00a0yd.')
  })

  it('ranges that only touch are a step, not an overlap', () => {
    expect(kinds([m('7i', 150, 145, 155), m('8i', 140, 135, 145)])).toEqual(['step'])
  })

  it('a run of clubs with no number: not measured, never a hole between the numbered ones', () => {
    const driver = none('driver')
    const [w5, h5, i5, lw] = [none('5w'), none('5h'), none('5i'), none('lw')]
    const r = bagGaps(
      [driver, m('3w', 225, 215, 235), w5, h5, i5, m('6i', 170, 162, 178), m('7i', 160, 153, 167), lw],
      'yards',
    )
    expect(r.rungs).toHaveLength(8)
    expect(r.gaps).toHaveLength(2)
    expect(r.gaps[0]).toMatchObject({ yards: 55, kind: 'not measured', span: { low: 178, high: 215 } })
    expect(r.gaps[0]!.unmeasured).toEqual([w5, h5, i5])
    expect(r.gaps[1]).toMatchObject({ yards: 10, kind: 'overlap', span: { low: 162, high: 167 }, unmeasured: [] })
    // The 55 yd across unmeasured clubs is not the widest gap.
    expect(r.widest).toBe(r.gaps[1])
    expect(r.unmeasured).toEqual([driver, w5, h5, i5, lw])
    expect(r.headline).toBe(
      '37\u00a0yd hole between your 3-wood and 6-iron, where your 5-wood, 5-hybrid and 5-iron have no number yet.',
    )
  })

  it('one club with no number in a hole: "has"', () => {
    const r = bagGaps([e('3w', 220), none('5w'), e('5h', 190)], 'yards')
    expect(r.headline).toBe('30\u00a0yd hole between your 3-wood and 5-hybrid, where your 5-wood has no number yet.')
  })

  it('a narrow gap across a club with no number is still not measured, and not a hole', () => {
    const r = bagGaps([e('7i', 150), none('8i'), e('9i', 140)], 'yards')
    expect(r.gaps[0]).toMatchObject({ kind: 'not measured', span: { low: 140, high: 150 } })
    expect(r.widest).toBeNull()
    expect(r.headline).toBe('Your 7-iron to your 9-iron, 150 to 140\u00a0yd, with every gap under 20\u00a0yd.')
  })

  it('estimates only: typical distances stand in for the range ends; 20 yd is a hole, 19 is not', () => {
    expect(HOLE_YARDS).toBe(20)
    const r = bagGaps([e('driver', 240), e('3w', 221), e('5i', 190), e('7i', 170)], 'yards')
    expect(r.gaps.map((g) => [g.yards, g.kind, g.span])).toEqual([
      [19, 'step', null],
      [31, 'hole', { low: 190, high: 221 }],
      [20, 'hole', { low: 170, high: 190 }],
    ])
    expect(r.rungs.every((c) => c.typical?.source === 'estimate')).toBe(true)
    expect(r.headline).toBe('31\u00a0yd hole between your 3-wood and 5-iron.')
  })

  it('a missing range falls back to the typical distance at that end only', () => {
    // 7i's bottom is its range (140); 9i has none, so its top is 115. 140 − 115 = 25.
    const r = bagGaps([m('7i', 150, 140, 160), e('9i', 115)], 'yards')
    expect(r.gaps[0]).toMatchObject({ yards: 35, kind: 'hole', span: { low: 115, high: 140 } })
  })

  it('a wide gap the ranges cover: the widest-gap sentence', () => {
    const r = bagGaps([m('pw', 130, 105, 150), m('gw', 83, 70, 96), m('sw', 70, 60, 80)], 'yards')
    expect(r.gaps.map((g) => [g.yards, g.kind])).toEqual([
      [47, 'step'], // 105 − 96 = 9, under a hole
      [13, 'overlap'],
    ])
    expect(r.headline).toBe('47\u00a0yd between your pitching wedge and gap wedge, the widest gap in the bag.')
  })

  it('a 20 yd widest gap the ranges cover is wide enough for the widest-gap sentence', () => {
    const r = bagGaps([m('pw', 120, 105, 130), m('gw', 100, 92, 108)], 'yards')
    expect(r.gaps[0]!.kind).toBe('overlap')
    expect(r.headline).toBe('20\u00a0yd between your pitching wedge and gap wedge, the widest gap in the bag.')
  })

  it('a wide overlap is never read as a hole', () => {
    const r = bagGaps([m('3w', 230, 200, 260), m('5w', 215, 185, 245)], 'yards')
    expect(r.gaps[0]).toMatchObject({ kind: 'overlap', span: { low: 200, high: 245 } })
    expect(r.headline).toBe('Your 3-wood to your 5-wood, 230 to 215\u00a0yd, with every gap under 20\u00a0yd.')
  })

  it('two holes of the same size: the first in the bag leads', () => {
    const r = bagGaps([e('3w', 220), e('5i', 190), e('7i', 160)], 'yards')
    expect(r.headline).toBe('30\u00a0yd hole between your 3-wood and 5-iron.')
  })

  it('a not-measured gap whose reaches cross has no span', () => {
    const r = bagGaps([m('7i', 150, 140, 160), none('8i'), m('9i', 140, 130, 150)], 'yards')
    expect(r.gaps[0]).toMatchObject({ kind: 'not measured', span: null })
  })

  it('all within 20: a 19 yd widest gap gives the range sentence', () => {
    const r = bagGaps([e('driver', 240), e('3w', 221), e('5w', 202)], 'yards')
    expect(r.widest?.yards).toBe(19)
    expect(r.headline).toBe('Your driver to your 5-wood, 240 to 202\u00a0yd, with every gap under 20\u00a0yd.')
  })

  it('the range sentence names the longest and shortest even when the bag is out of order', () => {
    const r = bagGaps([e('8i', 140), e('7i', 150), e('9i', 135)], 'yards')
    expect(r.gaps.map((g) => [g.longer.clubType, g.shorter.clubType, g.yards])).toEqual([
      ['7i', '8i', 10],
      ['7i', '9i', 15],
    ])
    expect(r.headline).toBe('Your 7-iron to your 9-iron, 150 to 135\u00a0yd, with every gap under 20\u00a0yd.')
  })

  it('metres: every number in the sentence is converted; the threshold stays 20 yd', () => {
    // 40 yd = 36.6 m, 240 yd = 219.5 m, 200 yd = 182.9 m, 20 yd = 18.3 m
    expect(bagGaps([e('driver', 240), e('3w', 200)], 'meters').headline).toBe(
      '37\u00a0m hole between your driver and 3-wood.',
    )
    expect(bagGaps([m('pw', 130, 105, 150), m('gw', 83, 70, 96)], 'meters').headline).toBe(
      '43\u00a0m between your pitching wedge and gap wedge, the widest gap in the bag.',
    )
    expect(bagGaps([e('driver', 240), e('3w', 221)], 'meters').headline).toBe(
      'Your driver to your 3-wood, 219 to 202\u00a0m, with every gap under 18\u00a0m.',
    )
    // Stored numbers stay in yards.
    expect(bagGaps([e('driver', 240), e('3w', 200)], 'meters').gaps[0]!.yards).toBe(40)
  })

  it('fewer than two clubs with a number: no gaps and no headline', () => {
    expect(bagGaps([], 'yards')).toEqual({ rungs: [], gaps: [], widest: null, unmeasured: [], headline: null })
    const r = bagGaps([e('7i', 150), none('8i'), e('putter', 3)], 'yards')
    expect(r.gaps).toEqual([])
    expect(r.headline).toBeNull()
    expect(r.unmeasured.map((c) => c.clubType)).toEqual(['8i'])
  })

  it('carries the caller\'s own fields through', () => {
    const r = bagGaps([{ ...e('7i', 150), id: 'a' }, { ...e('8i', 140), id: 'b' }], 'yards')
    expect(r.gaps[0]!.longer.id).toBe('a')
  })
})
