import { describe, it, expect } from 'vitest'
import { pickRoundFocus } from './round-nudge'

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
