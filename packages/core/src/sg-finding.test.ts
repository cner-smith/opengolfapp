import { describe, expect, it } from 'vitest'
import { sgFinding } from './sg-finding'

const tee = (value: number) => ({ label: 'Off the tee', value })
const approach = (value: number) => ({ label: 'Approach', value })
const putting = (value: number) => ({ label: 'Putting', value })

describe("sgFinding 'every part' (Home)", () => {
  it('names the leak and the strength', () => {
    expect(sgFinding(approach(-1.26), tee(0.71), 'every part')).toBe(
      'Approach costs you 1.3 strokes a round; off the tee gains you 0.7.',
    )
  })

  it('drops the strength under 0.05', () => {
    expect(sgFinding(approach(-1.26), tee(0.04), 'every part')).toBe('Approach costs you 1.3 strokes a round.')
    expect(sgFinding(approach(-1.26), tee(0.05), 'every part')).toBe(
      'Approach costs you 1.3 strokes a round; off the tee gains you 0.1.',
    )
  })

  it('a leak that rounds to 0.0 reads as gaining (#911); −0.05 still costs', () => {
    expect(sgFinding(approach(-0.04), tee(0.71), 'every part')).toBe(
      'Every part of your game is gaining strokes; off the tee leads at 0.7 a round.',
    )
    expect(sgFinding(approach(-0.05), tee(0.71), 'every part')).toBe(
      'Approach costs you 0.1 strokes a round; off the tee gains you 0.7.',
    )
  })

  it('every part gaining', () => {
    expect(sgFinding(approach(0.2), putting(0.9), 'every part')).toBe(
      'Every part of your game is gaining strokes; putting leads at 0.9 a round.',
    )
  })
})

describe("sgFinding 'softest area' (Stats)", () => {
  it('names the leak and the strength', () => {
    expect(sgFinding(approach(-1.26), tee(0.71), 'softest area')).toBe(
      'Approach costs you 1.3 strokes a round; off the tee gains you 0.7.',
    )
  })

  it('every part gaining: the weakest is the softest area', () => {
    expect(sgFinding(approach(0.2), putting(0.9), 'softest area')).toBe(
      'Approach is your softest area, still gaining 0.2 a round; putting gains you 0.9.',
    )
  })

  // #1185: within ±0.05 the number rounds to 0.0, so it reads even, not "costs you 0.0".
  it('a weakest within ±0.05 is about even, on either side of zero', () => {
    expect(sgFinding(approach(0), putting(0.04), 'softest area')).toBe('Approach is your softest area, about even.')
    expect(sgFinding(approach(-0.04), tee(0.71), 'softest area')).toBe(
      'Approach is your softest area, about even; off the tee gains you 0.7.',
    )
  })

  it('costs from −0.05, still gaining from +0.05', () => {
    expect(sgFinding(approach(-0.05), tee(0.71), 'softest area')).toBe(
      'Approach costs you 0.1 strokes a round; off the tee gains you 0.7.',
    )
    expect(sgFinding(approach(0.05), tee(0.71), 'softest area')).toBe(
      'Approach is your softest area, still gaining 0.1 a round; off the tee gains you 0.7.',
    )
  })

  it('one category, or no strongest: no strength clause', () => {
    expect(sgFinding(approach(0.6), approach(0.6), 'softest area')).toBe(
      'Approach is your softest area, still gaining 0.6 a round.',
    )
    expect(sgFinding(approach(-0.3), null, 'softest area')).toBe('Approach costs you 0.3 strokes a round.')
  })
})
