import { describe, it, expect } from 'vitest'
import { selectBaselinePlan, BASELINE_PLANS } from './baseline'
import type { BlockType } from './types'

const VALID_MODES: BlockType[] = ['warmup', 'blocked', 'random', 'skill_game', 'pressure_game', 'on_course']

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

  it('every block uses a valid practice MODE (no retired technical/putting types) and opens with a warmup', () => {
    for (const variants of Object.values(BASELINE_PLANS)) {
      for (const v of variants ?? []) {
        // first block of the first session is a warmup (Decisions §3)
        expect(v.sessions[0]!.blocks[0]!.type).toBe('warmup')
        for (const s of v.sessions) {
          for (const b of s.blocks) {
            expect(VALID_MODES).toContain(b.type)
          }
        }
      }
    }
  })

  it('every session of every variant closes on the green (last block is a putting/around_green drill)', () => {
    // Baseline block ids follow `b-<area>-<type>`; the green-area prefixes are `b-put-`
    // (putting) and `b-atg-` (around_green) — the only category signal a placeholder
    // block carries (drill_ref is a Phase-B placeholder). Per Decisions §3, the LAST
    // block of EVERY session must be one of these.
    for (const variants of Object.values(BASELINE_PLANS)) {
      for (const v of variants ?? []) {
        for (const s of v.sessions) {
          const last = s.blocks[s.blocks.length - 1]!
          expect(last.id).toMatch(/^b-(put|atg)-/)
        }
      }
    }
  })
})
