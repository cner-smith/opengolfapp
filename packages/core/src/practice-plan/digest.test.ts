import { describe, it, expect } from 'vitest'
import { buildPlayerDigest } from './digest'
import type { RoundSG } from './types'

const r = (o: Partial<RoundSG>): RoundSG => ({
  sg_off_tee: null, sg_approach: null, sg_around_green: null, sg_putting: null, ...o,
})

describe('buildPlayerDigest', () => {
  it('averages per category and ranks weaknesses worst-first', () => {
    const d = buildPlayerDigest({
      profile: { skill_level: 'developing', handicap_index: 12.4, goal: 'break_80',
        facilities: ['range'], play_frequency: 'weekly' },
      rounds: [r({ sg_approach: -1.2, sg_putting: -0.4, sg_off_tee: 0.1, sg_around_green: 0.2 }),
               r({ sg_approach: -1.0, sg_putting: -0.8, sg_off_tee: -0.1, sg_around_green: 0.0 })],
      dispersion: [], lastFeedback: null,
    })
    expect(d.sg_summary.based_on_rounds).toBe(2)
    expect(d.sg_summary.averages.approach).toBeCloseTo(-1.1, 5)
    expect(d.sg_summary.ranked_weaknesses[0]).toBe('approach')
    expect(d.sg_summary.ranked_weaknesses).toHaveLength(4)
  })

  it('ties break by the fixed category order (putting > approach > around_green > off_tee)', () => {
    const d = buildPlayerDigest({
      profile: { skill_level: 'developing', handicap_index: null, goal: null,
        facilities: [], play_frequency: null },
      rounds: [r({ sg_off_tee: -0.5, sg_approach: -0.5, sg_around_green: -0.5, sg_putting: -0.5 })],
      dispersion: [], lastFeedback: null,
    })
    expect(d.sg_summary.ranked_weaknesses).toEqual(['putting','approach','around_green','off_tee'])
  })

  it('labels a declining category from the recent slope', () => {
    const d = buildPlayerDigest({
      profile: { skill_level: 'developing', handicap_index: null, goal: null,
        facilities: [], play_frequency: 'weekly' },
      rounds: [r({ sg_approach: -0.2, played_at: '2026-05-01' }),
               r({ sg_approach: -0.8, played_at: '2026-05-10' }),
               r({ sg_approach: -1.4, played_at: '2026-05-20' })],
      dispersion: [], lastFeedback: 'wedges helped',
    })
    expect(d.sg_summary.trend.approach).toBe('declining')
    expect(d.last_plan_feedback).toBe('wedges helped')
  })

  it('ignores null SG categories in the average (does not count as 0)', () => {
    const d = buildPlayerDigest({
      profile: { skill_level: 'casual', handicap_index: null, goal: null,
        facilities: [], play_frequency: 'weekly' },
      rounds: [r({ sg_putting: -0.6 }), r({ sg_putting: -0.4, sg_approach: -0.3 })],
      dispersion: [], lastFeedback: null,
    })
    expect(d.sg_summary.averages.putting).toBeCloseTo(-0.5, 5)
    expect(d.sg_summary.averages.off_tee).toBeNull()
  })

  it('warns when dispersion contradicts the top weakness (driver tight but off_tee worst)', () => {
    const d = buildPlayerDigest({
      profile: { skill_level: 'developing', handicap_index: null, goal: null, facilities: [], play_frequency: 'weekly' },
      rounds: [r({ sg_off_tee: -1.5, sg_approach: -0.1 })],
      dispersion: [{ club: 'driver', dominant_miss: 'right', shot_shape: 'fade', cone68: { lateral: 5, distance: 12 }, sample: 25 }],
      lastFeedback: null,
    })
    expect(d.sg_summary.ranked_weaknesses[0]).toBe('off_tee')
    expect(d.warnings && d.warnings.length).toBeTruthy()
  })

  it('no warning when dispersion is consistent with the ranking', () => {
    const d = buildPlayerDigest({
      profile: { skill_level: 'developing', handicap_index: null, goal: null, facilities: [], play_frequency: 'weekly' },
      rounds: [r({ sg_putting: -1.2, sg_off_tee: 0.2 })],
      dispersion: [{ club: 'driver', dominant_miss: 'right', shot_shape: 'fade', cone68: { lateral: 5, distance: 12 }, sample: 25 }],
      lastFeedback: null,
    })
    expect(d.warnings ?? []).toHaveLength(0)
  })
})
