import { describe, it, expect } from 'vitest'
import { resolveTarget } from './targets'
import type { TargetTemplate, PlayerDigest } from './types'

const tmpl: TargetTemplate = {
  metric: 'in_window', unit: 'of 10',
  baseline: { beginner: 4, casual: 5, developing: 6, competitive: 7 },
  min: 3, max: 9,
}
const digest = (skill: string): PlayerDigest =>
  ({ profile: { skill_level: skill }, dispersion: [] } as unknown as PlayerDigest)

describe('resolveTarget', () => {
  it('picks the skill baseline', () => {
    expect(resolveTarget(tmpl, digest('developing'))).toBe(6)
    expect(resolveTarget(tmpl, digest('competitive'))).toBe(7)
  })
  it('falls back to the developing baseline when the skill baseline is missing', () => {
    const t2: TargetTemplate = { ...tmpl, baseline: { developing: 6 } }
    expect(resolveTarget(t2, digest('beginner'))).toBe(6)
  })
  it('clamps to [min, max]', () => {
    expect(resolveTarget({ ...tmpl, baseline: { developing: 20 } }, digest('developing'))).toBe(9)
    expect(resolveTarget({ ...tmpl, baseline: { developing: 1 } }, digest('developing'))).toBe(3)
  })
})
