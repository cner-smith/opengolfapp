import { describe, it, expect } from 'vitest'
import { validatePlanDraft } from './validation'
import type { PlanDraft, CandidateDrill } from './types'

// Base pool — 5 drills so the "pool allows variety" guard (pool.length >= usedIds+2)
// is satisfied for the anti-repetition test: pool(5) >= used(2)+2 → 5>=4 true.
// The original task spec used only 3 drills; that makes the guard 3>=4=false,
// which suppresses the overlap check and causes the test to pass vacuously.
// Adding 2 extra drills (d3, d4) gives the pool genuine variety, which is exactly
// the precondition the guard is testing for.
const pool: CandidateDrill[] = [
  { id: 'd0', name: 'Warm', category: 'approach', drill_type: 'warmup', duration_min: 8, facility: [], target_template: null },
  { id: 'd1', name: 'Wedge ladder', category: 'approach', drill_type: 'technical', duration_min: 20, facility: ['range'], target_template: null },
  { id: 'd2', name: 'Gate', category: 'putting', drill_type: 'technical', duration_min: 15, facility: ['putting'], target_template: null },
  { id: 'd3', name: 'Chip clock', category: 'around_green', drill_type: 'skill_game', duration_min: 15, facility: [], target_template: null },
  { id: 'd4', name: 'Draw bias', category: 'off_tee', drill_type: 'technical', duration_min: 20, facility: ['range'], target_template: null },
]
const okDraft: PlanDraft = {
  week_focus: 'approach + putting',
  coach_note: 'Short note tied to your numbers.',
  focus_areas: [{ category: 'approach', reason: 'worst' }, { category: 'putting', reason: '2nd' }],
  sessions: [
    { title: 'S1', total_minutes: 43, blocks: [
      { id: 's1b1', order: 1, type: 'warmup', drill_ref: 0, minutes: 8, rationale: 'x' },
      { id: 's1b2', order: 2, type: 'technical', drill_ref: 1, minutes: 20, rationale: 'x' },
      { id: 's1b3', order: 3, type: 'technical', drill_ref: 2, minutes: 15, rationale: 'x' },
    ] },
    { title: 'S2', total_minutes: 35, blocks: [
      { id: 's2b1', order: 1, type: 'technical', drill_ref: 1, minutes: 20, rationale: 'x' },
      { id: 's2b2', order: 2, type: 'technical', drill_ref: 2, minutes: 15, rationale: 'x' },
    ] },
  ],
}
const ctx = { pool, weaknesses: ['approach', 'putting'] as const, sessionCount: 2,
  priorDrillIds: [] as string[], coachNoteMax: 800 }

describe('validatePlanDraft', () => {
  it('accepts a well-formed draft', () => {
    expect(validatePlanDraft(okDraft, ctx).ok).toBe(true)
  })

  it('rejects an out-of-range drill_ref', () => {
    const bad = structuredClone(okDraft)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    bad.sessions[0]!.blocks[1]!.drill_ref = 99
    const r = validatePlanDraft(bad, ctx)
    expect(r.ok).toBe(false); expect(r.errors.join(' ')).toMatch(/drill_ref/)
  })

  it('rejects a drill_type inconsistent with the referenced drill', () => {
    const bad = structuredClone(okDraft)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    bad.sessions[0]!.blocks[2]!.type = 'warmup' // d2 is technical
    expect(validatePlanDraft(bad, ctx).ok).toBe(false)
  })

  it('rejects when block minutes diverge >20% from total_minutes', () => {
    const bad = structuredClone(okDraft)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    bad.sessions[0]!.total_minutes = 200
    expect(validatePlanDraft(bad, ctx).ok).toBe(false)
  })

  it('rejects the wrong session count', () => {
    const bad = structuredClone(okDraft); bad.sessions.pop()
    expect(validatePlanDraft(bad, ctx).ok).toBe(false)
  })

  it('rejects when a top-2 weakness has no non-warmup block', () => {
    const bad = structuredClone(okDraft)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    for (const s of bad.sessions) s.blocks = s.blocks.filter((b) => pool[b.drill_ref]!.category !== 'putting')
    expect(validatePlanDraft(bad, ctx).ok).toBe(false)
  })

  it('rejects >=60% drill overlap with the prior plan when the pool allows variety', () => {
    // draft uses d0+d1+d2 (3 distinct drills); prior is also ['d1','d2'] → 100% overlap of d1+d2.
    // pool has 5 drills; guard: pool.length(5) >= usedIds(3)+2 → true → check fires.
    const r = validatePlanDraft(okDraft, { ...ctx, priorDrillIds: ['d1', 'd2'] })
    expect(r.ok).toBe(false); expect(r.errors.join(' ')).toMatch(/repetition|overlap/i)
  })

  it('rejects an over-long coach_note', () => {
    const bad = { ...okDraft, coach_note: 'x'.repeat(900) }
    expect(validatePlanDraft(bad, ctx).ok).toBe(false)
  })

  it('rejects a non-positive total_minutes (no longer silently skipped)', () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const bad = structuredClone(okDraft); bad.sessions[0]!.total_minutes = 0
    const r = validatePlanDraft(bad, ctx)
    expect(r.ok).toBe(false); expect(r.errors.join(' ')).toMatch(/total_minutes/)
  })

  it('rejects a negative block minutes', () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const bad = structuredClone(okDraft); bad.sessions[0]!.blocks[1]!.minutes = -20
    const r = validatePlanDraft(bad, ctx)
    expect(r.ok).toBe(false); expect(r.errors.join(' ')).toMatch(/invalid/)
  })
})
