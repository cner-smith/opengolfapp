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
  { id: 'd1', name: 'Wedge ladder', category: 'approach', drill_type: 'blocked', duration_min: 20, facility: ['range'], target_template: null },
  { id: 'd2', name: 'Gate', category: 'putting', drill_type: 'blocked', duration_min: 15, facility: ['putting'], target_template: null },
  { id: 'd3', name: 'Chip clock', category: 'around_green', drill_type: 'skill_game', duration_min: 15, facility: [], target_template: null },
  { id: 'd4', name: 'Draw bias', category: 'off_tee', drill_type: 'blocked', duration_min: 20, facility: ['range'], target_template: null },
]
const okDraft: PlanDraft = {
  week_focus: 'approach + putting',
  coach_note: 'Short note tied to your numbers.',
  focus_areas: [{ category: 'approach', reason: 'worst' }, { category: 'putting', reason: '2nd' }],
  sessions: [
    { title: 'S1', total_minutes: 43, blocks: [
      { id: 's1b1', order: 1, type: 'warmup', drill_ref: 0, minutes: 8, rationale: 'x' },
      { id: 's1b2', order: 2, type: 'blocked', drill_ref: 1, minutes: 20, rationale: 'x' },
      { id: 's1b3', order: 3, type: 'blocked', drill_ref: 2, minutes: 15, rationale: 'x' }, // green closer: d2 is putting (D10)
    ] },
    { title: 'S2', total_minutes: 35, blocks: [
      { id: 's2b1', order: 1, type: 'blocked', drill_ref: 1, minutes: 20, rationale: 'x' },
      { id: 's2b2', order: 2, type: 'blocked', drill_ref: 2, minutes: 15, rationale: 'x' }, // green closer: d2 is putting (D10)
    ] },
  ],
}
const ctx = { pool, weaknesses: ['approach', 'putting'] as const, sessionCount: 2,
  priorDrillIds: [] as string[], coachNoteMax: 800, articlesLen: 2 }

describe('validatePlanDraft', () => {
  it('accepts a well-formed draft', () => {
    expect(validatePlanDraft(okDraft, ctx).ok).toBe(true)
  })

  it('rejects an out-of-range drill_ref', () => {
    const bad = structuredClone(okDraft)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- structuredClone(okDraft) preserves the full shape, so this indexed access is non-null
    bad.sessions[0]!.blocks[1]!.drill_ref = 99
    const r = validatePlanDraft(bad, ctx)
    expect(r.ok).toBe(false); expect(r.errors.join(' ')).toMatch(/drill_ref/)
  })

  it('rejects a drill_type inconsistent with the referenced drill', () => {
    const bad = structuredClone(okDraft)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- structuredClone(okDraft) preserves the full shape, so this indexed access is non-null
    bad.sessions[0]!.blocks[2]!.type = 'warmup' // d2 is technical
    expect(validatePlanDraft(bad, ctx).ok).toBe(false)
  })

  it('accepts a draft whose total_minutes disagrees with the block sum (server derives it)', () => {
    // total_minutes is now server-derived from block minutes; the model's emitted value is
    // ignored — a mismatch (65 declared vs 85 in blocks) must no longer reject.
    const bad = structuredClone(okDraft)
    // S1 blocks sum to 43; set total_minutes to something wildly wrong
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- structuredClone(okDraft) preserves the full shape, so this indexed access is non-null
    bad.sessions[0]!.total_minutes = 65 // blocks still sum to 43 — mismatch, but should pass
    expect(validatePlanDraft(bad, ctx).ok).toBe(true)
  })

  it('rejects the wrong session count', () => {
    const bad = structuredClone(okDraft); bad.sessions.pop()
    expect(validatePlanDraft(bad, ctx).ok).toBe(false)
  })

  it('rejects when a top-2 weakness has no non-warmup block', () => {
    const bad = structuredClone(okDraft)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- structuredClone(okDraft) preserves the full shape, so this indexed access is non-null
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

  it('rejects a zero block minutes (per-block positivity check remains)', () => {
    // The per-block minutes check (D3-adjacent) is independent of the removed D4 total check.
    // A block with minutes=0 must still fail even though total_minutes is no longer validated.
    const bad = structuredClone(okDraft)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- structuredClone(okDraft) preserves the full shape, so this indexed access is non-null
    bad.sessions[0]!.blocks[1]!.minutes = 0
    const r = validatePlanDraft(bad, ctx)
    expect(r.ok).toBe(false); expect(r.errors.join(' ')).toMatch(/invalid/)
  })

  it('rejects a negative block minutes', () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- structuredClone(okDraft) preserves the full shape, so this indexed access is non-null
    const bad = structuredClone(okDraft); bad.sessions[0]!.blocks[1]!.minutes = -20
    const r = validatePlanDraft(bad, ctx)
    expect(r.ok).toBe(false); expect(r.errors.join(' ')).toMatch(/invalid/)
  })

  it('rejects an out-of-range article_ref (security: must trigger repair, not silent drop)', () => {
    const bad = structuredClone(okDraft)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- structuredClone(okDraft) preserves the full shape, so this indexed access is non-null
    bad.focus_areas[0]!.article_ref = 5 // articlesLen is 2 → index 5 is out of range
    const r = validatePlanDraft(bad, ctx)
    expect(r.ok).toBe(false); expect(r.errors.join(' ')).toMatch(/article_ref/)
  })

  it('accepts an in-range article_ref', () => {
    const ok = structuredClone(okDraft)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- structuredClone(okDraft) preserves the full shape, so this indexed access is non-null
    ok.focus_areas[0]!.article_ref = 1 // articlesLen is 2 → index 1 is valid
    expect(validatePlanDraft(ok, ctx).ok).toBe(true)
  })

  it('rejects a plan that does not open with a warmup (first block of the first session)', () => {
    const bad = structuredClone(okDraft)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- structuredClone(okDraft) preserves the full shape, so this indexed access is non-null
    bad.sessions[0]!.blocks[0]!.type = 'blocked' // d0 is a warmup drill; D3 still passes only if drill matches, so swap the drill too
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- structuredClone(okDraft) preserves the full shape, so this indexed access is non-null
    bad.sessions[0]!.blocks[0]!.drill_ref = 1 // d1 is blocked → D3 ok, but the plan no longer opens with a warmup
    const r = validatePlanDraft(bad, ctx)
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/open with a warmup/)
  })

  it('rejects a plan whose LAST session does not close on the green (last block category not putting/around_green)', () => {
    const bad = structuredClone(okDraft)
    // Point the final block of the last session at d4 (off_tee) — a non-green closer.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- structuredClone(okDraft) preserves the full shape, so this indexed access is non-null
    const last = bad.sessions[bad.sessions.length - 1]!
    last.blocks[last.blocks.length - 1]!.drill_ref = 4 // d4: off_tee/blocked
    const r = validatePlanDraft(bad, ctx)
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/close on the green/)
  })

  it('rejects a plan whose NON-final session does not close on the green (per-session D10)', () => {
    // D10 is PER-SESSION: every session must end on the green, not just the last one.
    // Point the final block of the FIRST (non-final) session at d4 (off_tee) — the last
    // session still closes green, so this fails only if the rule is enforced per-session.
    const bad = structuredClone(okDraft)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- structuredClone(okDraft) preserves the full shape, so this indexed access is non-null
    const first = bad.sessions[0]!
    first.blocks[first.blocks.length - 1]!.drill_ref = 4 // d4: off_tee/blocked — non-green closer
    const r = validatePlanDraft(bad, ctx)
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/close on the green/)
  })

  it('accepts a plan that closes on an around_green drill (not just putting)', () => {
    const ok = structuredClone(okDraft)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- structuredClone(okDraft) preserves the full shape, so this indexed access is non-null
    const last = ok.sessions[ok.sessions.length - 1]!
    last.blocks[last.blocks.length - 1]!.drill_ref = 3 // d3: around_green/skill_game
    last.blocks[last.blocks.length - 1]!.type = 'skill_game' // keep D3 (type==drill_type) satisfied
    expect(validatePlanDraft(ok, ctx).ok).toBe(true)
  })

  it('rejects a session with zero blocks (empty-blocks session would store total_minutes: 0)', () => {
    const bad = structuredClone(okDraft)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- structuredClone(okDraft) preserves the full shape, so this indexed access is non-null
    bad.sessions[1]!.blocks = []
    const r = validatePlanDraft(bad, ctx)
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/no blocks/)
  })
})
