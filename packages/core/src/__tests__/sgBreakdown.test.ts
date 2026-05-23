import { describe, it, expect } from 'vitest'
import { barScale, sgBreakdown, type SGRoundLike } from '../stats'

const row = (
  offTee: number | null,
  approach: number | null,
  aroundGreen: number | null,
  putting: number | null,
): SGRoundLike => ({
  sg_off_tee: offTee,
  sg_approach: approach,
  sg_around_green: aroundGreen,
  sg_putting: putting,
})

describe('sgBreakdown', () => {
  it('returns zeros and maxAbs of 0 for empty rounds', () => {
    const { breakdown, maxAbs } = sgBreakdown([])
    expect(breakdown.map((b) => b.value)).toEqual([0, 0, 0, 0])
    expect(maxAbs).toBe(0)
  })

  it('treats all-null categories as 0 (rendered as neutral bar)', () => {
    const { breakdown, maxAbs } = sgBreakdown([row(null, null, null, null)])
    expect(breakdown.map((b) => b.value)).toEqual([0, 0, 0, 0])
    expect(maxAbs).toBe(0)
  })

  it('averages non-null values per category, ignoring nulls', () => {
    const rounds = [
      row(0.4, -0.2, 0.1, -0.3),
      row(0.6, null, 0.3, -0.1),
      row(0.2, -0.4, null, -0.2),
    ]
    const { breakdown } = sgBreakdown(rounds)
    expect(breakdown.find((b) => b.key === 'sg_off_tee')!.value).toBe(0.4)
    expect(breakdown.find((b) => b.key === 'sg_approach')!.value).toBe(-0.3)
    expect(breakdown.find((b) => b.key === 'sg_around_green')!.value).toBe(0.2)
    expect(breakdown.find((b) => b.key === 'sg_putting')!.value).toBe(-0.2)
  })

  it('rounds each average to 2 decimal places', () => {
    const { breakdown } = sgBreakdown([row(0.123456, null, null, null)])
    expect(breakdown.find((b) => b.key === 'sg_off_tee')!.value).toBe(0.12)
  })

  it('reports maxAbs over the absolute values of all category averages', () => {
    const { maxAbs } = sgBreakdown([row(0.1, -0.8, 0.3, -0.2)])
    expect(maxAbs).toBe(0.8)
  })

  it('reports true peak when all averages are below 0.5 (no floor)', () => {
    const { maxAbs } = sgBreakdown([row(0.1, -0.2, 0.3, -0.1)])
    expect(maxAbs).toBe(0.3)
  })

  it('returns category keys in the canonical off_tee → approach → around_green → putting order', () => {
    const { breakdown } = sgBreakdown([])
    expect(breakdown.map((b) => b.key)).toEqual([
      'sg_off_tee',
      'sg_approach',
      'sg_around_green',
      'sg_putting',
    ])
  })
})

describe('barScale', () => {
  it('floors at 0.5 when input is below the floor', () => {
    expect(barScale(0)).toBe(0.5)
    expect(barScale(0.3)).toBe(0.5)
    expect(barScale(0.5)).toBe(0.5)
  })

  it('returns input unchanged when above the floor', () => {
    expect(barScale(0.8)).toBe(0.8)
    expect(barScale(2)).toBe(2)
  })
})
