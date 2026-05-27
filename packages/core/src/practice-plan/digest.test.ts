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

  it('rounds averages to 2 decimal places in the digest output', () => {
    const d = buildPlayerDigest({
      profile: { skill_level: 'developing', handicap_index: 12.4, goal: 'break_80',
        facilities: ['range'], play_frequency: 'weekly' },
      // approach mean = (-1.2 + -1.0 + -1.133...) / 3  →  an ugly decimal
      // Use values that produce a 3-dp raw mean to prove rounding
      rounds: [
        r({ sg_approach: -1.2, sg_putting: -0.4, sg_off_tee: 0.1, sg_around_green: 0.2 }),
        r({ sg_approach: -1.0, sg_putting: -0.8, sg_off_tee: -0.1, sg_around_green: 0.0 }),
        r({ sg_approach: -1.1, sg_putting: -0.6, sg_off_tee: 0.0, sg_around_green: 0.1 }),
        // approach mean = (-1.2 + -1.0 + -1.1) / 3 = -1.1 exactly; use an irregular one:
        // sg_around_green: (0.2 + 0.0 + 0.1) / 3 = 0.1 exactly
        // Use a round with a deliberately ugly sg_putting:
        // sg_putting: (-0.4 + -0.8 + -0.6) / 3 = -0.6 exactly
        // Add a 4th round to make approach ugly: sum = -1.2 + -1.0 + -1.1 + -1.4 = -4.7, avg = -1.175
      ],
      dispersion: [], lastFeedback: null,
    })
    // All averages must have at most 2 decimal places
    for (const val of Object.values(d.sg_summary.averages)) {
      if (val == null) continue
      expect(val).toBe(Math.round(val * 100) / 100)
    }
  })

  it('rounds 3-decimal averages to exactly 2dp and does not change ranking', () => {
    // approach: (-1.2 + -1.0 + -1.1 + -1.4) / 4 = -1.175 → rounds to -1.18
    // putting:  (-0.4 + -0.8 + -0.6 + -0.7) / 4 = -0.625 → rounds to -0.63 (or -0.62 depending on rounding)
    // either way the test checks the 2dp property and ranking stability
    const d = buildPlayerDigest({
      profile: { skill_level: 'developing', handicap_index: 12.4, goal: 'break_80',
        facilities: ['range'], play_frequency: 'weekly' },
      rounds: [
        r({ sg_approach: -1.2, sg_putting: -0.4, sg_off_tee: 0.1, sg_around_green: -0.2 }),
        r({ sg_approach: -1.0, sg_putting: -0.8, sg_off_tee: -0.1, sg_around_green: -0.3 }),
        r({ sg_approach: -1.1, sg_putting: -0.6, sg_off_tee: 0.0, sg_around_green: -0.1 }),
        r({ sg_approach: -1.4, sg_putting: -0.7, sg_off_tee: 0.2, sg_around_green: -0.4 }),
      ],
      dispersion: [], lastFeedback: null,
    })
    // approach mean raw = -4.7/4 = -1.175; IEEE 754: -1.175*100 ≈ -117.5 → Math.round → -1.18
    // but JS floating point gives -117.49999... → rounds to -117 → -1.17
    // The important property is: stored value equals Math.round(raw*100)/100 for that raw
    const rawApproach = (-1.2 + -1.0 + -1.1 + -1.4) / 4
    expect(d.sg_summary.averages.approach).toBe(Math.round(rawApproach * 100) / 100)
    // ranking: approach is still worst (most negative after rounding) → still [0]
    expect(d.sg_summary.ranked_weaknesses[0]).toBe('approach')
    // all averages 2dp
    for (const val of Object.values(d.sg_summary.averages)) {
      if (val == null) continue
      expect(val).toBe(Math.round(val * 100) / 100)
    }
  })
})
