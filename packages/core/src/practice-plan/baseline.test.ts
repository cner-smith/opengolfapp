import { describe, it, expect } from 'vitest'
import { selectBaselinePlan } from './baseline'

describe('selectBaselinePlan', () => {
  it('returns a plan for a known skill×goal cell', () => {
    const p = selectBaselinePlan({ skill: 'developing', goal: 'break_80', weekIndex: 0 })
    expect(p.sessions.length).toBeGreaterThan(0)
  })
  it('rotates variants by weekIndex mod variantCount', () => {
    const a = selectBaselinePlan({ skill: 'developing', goal: 'break_80', weekIndex: 0 })
    const b = selectBaselinePlan({ skill: 'developing', goal: 'break_80', weekIndex: 1 })
    expect(a.week_focus).toBeDefined(); expect(b.week_focus).toBeDefined()
    // index 0 vs 1 must select different variants, or "rotation" is a no-op
    expect(a.week_focus).not.toBe(b.week_focus)
  })
  it('with a known worst category, prefers the variant focused there', () => {
    const p = selectBaselinePlan({ skill: 'developing', goal: 'break_80', weekIndex: 0, worstCategory: 'putting' })
    expect(p.focus_areas.some((f) => f.category === 'putting')).toBe(true)
  })
  it('falls back to a default cell when skill/goal missing', () => {
    expect(selectBaselinePlan({ skill: null, goal: null, weekIndex: 3 }).sessions.length).toBeGreaterThan(0)
  })
})
