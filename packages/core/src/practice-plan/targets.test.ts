import { describe, it, expect } from 'vitest'
import { resolveTarget } from './targets'
import type { TargetTemplate, PlayerDigest } from './types'

const tmpl: TargetTemplate = {
  metric: 'in_window', unit: 'of 10', scales_with: 'approach_dispersion',
  baseline: { beginner: 4, casual: 5, developing: 6, competitive: 7 },
  min: 3, max: 9,
}
const digest = (skill: string, lateral: number): PlayerDigest =>
  ({ profile: { skill_level: skill } as never,
     dispersion: [{ club: 'approach', dominant_miss: null, shot_shape: null,
       cone68: { lateral, distance: 0 }, sample: 20 }] } as unknown as PlayerDigest)

describe('resolveTarget', () => {
  it('picks the skill baseline', () => {
    expect(resolveTarget(tmpl, digest('developing', 12))).toBe(6)
  })
  it('raises the bar when the scaling stat is tight, clamps to max', () => {
    expect(resolveTarget(tmpl, digest('competitive', 4))).toBeLessThanOrEqual(9)
    expect(resolveTarget(tmpl, digest('competitive', 4))).toBeGreaterThanOrEqual(7)
  })
  it('clamps to min and falls back when skill/baseline missing', () => {
    const t2 = { ...tmpl, baseline: { developing: 6 } }
    expect(resolveTarget(t2, digest('beginner', 30))).toBeGreaterThanOrEqual(3)
  })
})
