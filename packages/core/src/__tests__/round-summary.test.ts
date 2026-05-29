import { describe, it, expect } from 'vitest'
import { buildRoundSummary } from '../round-summary'
import { formatToPar } from '../units'

const base = {
  courseName: 'Lincoln Park',
  totalScore: 85,
  par: 72,
  sg: { offTee: 1.2, approach: -2.4, aroundGreen: 0, putting: -0.8 },
}

describe('buildRoundSummary', () => {
  it('formats an over-par subject line', () => {
    expect(buildRoundSummary(base).subject).toBe(
      'Your round at Lincoln Park: 85 (+13 to par)',
    )
  })

  it('labels even par as E', () => {
    const c = buildRoundSummary({ ...base, totalScore: 72 })
    expect(c.hero.toParLabel).toBe('E')
    expect(c.hero.toPar).toBe(0)
  })

  it('labels under par with a minus sign', () => {
    const c = buildRoundSummary({ ...base, totalScore: 70 })
    expect(c.hero.toParLabel).toBe('-2')
  })

  it('centers a neutral SG bar at 50%', () => {
    // base fixture has aroundGreen: 0 → neutral SG maps to the bar midpoint
    const bar = buildRoundSummary(base).bars.find((b) => b.label === 'Around green')!
    expect(bar.widthPct).toBe(50)
  })

  it('clamps extreme SG to the bar bounds', () => {
    const c = buildRoundSummary({
      ...base,
      sg: { ...base.sg, offTee: 99, putting: -99 },
    })
    expect(c.bars.find((b) => b.label === 'Off the tee')!.widthPct).toBe(100)
    expect(c.bars.find((b) => b.label === 'Putting')!.widthPct).toBe(0)
  })

  it('produces one bar per SG category in fixed order', () => {
    const bars = buildRoundSummary(base).bars
    expect(bars.map((b) => b.label)).toEqual([
      'Off the tee', 'Approach', 'Around green', 'Putting',
    ])
  })

  it('keeps the inlined toParLabel in lockstep with @oga/core formatToPar', () => {
    for (const totalScore of [60, 70, 72, 73, 90]) {
      const c = buildRoundSummary({ ...base, totalScore })
      expect(c.hero.toParLabel).toBe(formatToPar(c.hero.toPar))
    }
  })
})
