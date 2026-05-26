import { describe, it, expect } from 'vitest'
import { pickRoundFocus, roundFocusHeadline, selectNudgeDrills } from './round-nudge'

const base = { sg_off_tee: 0, sg_approach: 0, sg_around_green: 0, sg_putting: 0 }

describe('pickRoundFocus', () => {
  it('returns the most-negative category', () => {
    expect(pickRoundFocus({ ...base, sg_approach: -2.1, sg_putting: -0.6 }))
      .toEqual({ category: 'approach', sgDelta: -2.1 })
  })

  it('returns null when nothing is below the threshold (good/flat round)', () => {
    expect(pickRoundFocus({ ...base, sg_approach: -0.3 })).toBeNull()
    expect(pickRoundFocus({ ...base, sg_putting: 0.4 })).toBeNull()
  })

  it('ignores null categories and returns null when all null', () => {
    expect(
      pickRoundFocus({ sg_off_tee: null, sg_approach: null, sg_around_green: null, sg_putting: null }),
    ).toBeNull()
    expect(pickRoundFocus({ ...base, sg_off_tee: null, sg_approach: -1.5 }))
      .toEqual({ category: 'approach', sgDelta: -1.5 })
  })

  it('breaks exact ties by putting > approach > around_green > off_tee', () => {
    expect(pickRoundFocus({ ...base, sg_off_tee: -1.0, sg_putting: -1.0 }))
      .toEqual({ category: 'putting', sgDelta: -1.0 })
  })
})

describe('roundFocusHeadline', () => {
  it('names the category and the strokes lost, one decimal', () => {
    expect(roundFocusHeadline({ category: 'approach', sgDelta: -2.13 }))
      .toBe('Approach cost you about 2.1 strokes this round.')
  })
  it('handles the around-green label', () => {
    expect(roundFocusHeadline({ category: 'around_green', sgDelta: -1.0 }))
      .toBe('Around the green cost you about 1.0 strokes this round.')
  })
})

const d = (id: string, facility: string[] | null) => ({ id, facility })

describe('selectNudgeDrills', () => {
  it('keeps drills that need no facility or a facility the player has', () => {
    const drills = [d('a', null), d('b', ['range']), d('c', ['net'])]
    expect(selectNudgeDrills(drills, ['range']).map((x) => x.id)).toEqual(['a', 'b'])
  })
  it('caps at the limit (default 2)', () => {
    const drills = [d('a', null), d('b', null), d('c', null)]
    expect(selectNudgeDrills(drills, []).map((x) => x.id)).toEqual(['a', 'b'])
  })
  it('returns empty when nothing matches the player facilities', () => {
    expect(selectNudgeDrills([d('a', ['net'])], ['range'])).toEqual([])
  })
})
