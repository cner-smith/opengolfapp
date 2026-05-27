import { describe, it, expect } from 'vitest'
import { playFrequencyPlan } from './play-frequency'

describe('playFrequencyPlan', () => {
  it('maps each frequency to sessions/week', () => {
    expect(playFrequencyPlan('monthly').sessionCount).toBe(1)
    expect(playFrequencyPlan('weekly').sessionCount).toBe(2)
    expect(playFrequencyPlan('multi_weekly').sessionCount).toBe(3)
    expect(playFrequencyPlan('daily').sessionCount).toBe(4)
  })
  it('defaults null/unknown to weekly (2)', () => {
    expect(playFrequencyPlan(null).sessionCount).toBe(2)
    expect(playFrequencyPlan('whatever' as never).sessionCount).toBe(2)
  })
  it('validity is a fixed 7-day window (D5)', () => {
    expect(playFrequencyPlan('daily').validityDays).toBe(7)
    expect(playFrequencyPlan('monthly').validityDays).toBe(7)
  })
})
