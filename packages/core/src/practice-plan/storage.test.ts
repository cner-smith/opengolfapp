import { describe, it, expect, vi, afterEach } from 'vitest'
import { resolvePlanForStorage } from './storage'
import type { PlanDraft, CandidateDrill, PlayerDigest, TargetTemplate } from './types'

const wedgeTmpl: TargetTemplate = {
  metric: 'proximity', unit: 'ft', baseline: { developing: 30 }, min: 10, max: 60,
}
const gateTmpl: TargetTemplate = {
  metric: 'makes', unit: 'putts', baseline: { developing: 7 }, min: 1, max: 10,
}

// Same pool shape as validation.test.ts; d1/d2 carry target_templates, d0 (warmup) does not.
const pool: CandidateDrill[] = [
  { id: 'drill-uuid-0', name: 'Warm', category: 'approach', drill_type: 'warmup', duration_min: 8, facility: [], target_template: null },
  { id: 'drill-uuid-1', name: 'Wedge ladder', category: 'approach', drill_type: 'technical', duration_min: 20, facility: ['range'], target_template: wedgeTmpl },
  { id: 'drill-uuid-2', name: 'Gate', category: 'putting', drill_type: 'technical', duration_min: 15, facility: ['putting'], target_template: gateTmpl },
]

const articles = [
  { article_id: 'art-0', title: 'Strokes Gained Explained', slug: 'strokes-gained' },
  { article_id: 'art-1', title: 'Understanding Benchmarks', slug: 'benchmarks' },
]

const digest: PlayerDigest = {
  profile: { skill_level: 'developing', handicap_index: 12, goal: null, facilities: [], play_frequency: 'weekly' },
  sg_summary: { based_on_rounds: 8, averages: { off_tee: 0, approach: -0.5, around_green: 0, putting: -0.3 }, trend: {}, ranked_weaknesses: ['approach', 'putting'] },
  dispersion: [],
  last_plan_feedback: null,
}

const draft: PlanDraft = {
  week_focus: 'approach + putting',
  coach_note: 'Tied to your numbers.',
  focus_areas: [
    { category: 'approach', reason: 'worst', article_ref: 0 },
    { category: 'putting', reason: '2nd' },
  ],
  sessions: [
    { title: 'S1', total_minutes: 43, blocks: [
      { id: 's1b1', order: 1, type: 'warmup', drill_ref: 0, minutes: 8, rationale: 'loosen up' },
      { id: 's1b2', order: 2, type: 'technical', drill_ref: 1, minutes: 20, rationale: 'wedge control' },
      { id: 's1b3', order: 3, type: 'technical', drill_ref: 2, minutes: 15, rationale: 'gate' },
    ] },
  ],
}

const ctx = { pool, articles, digest }

afterEach(() => {
  vi.restoreAllMocks()
})

describe('resolvePlanForStorage', () => {
  it('resolves drill_ref to the real drill id (0-based round-trip, guards off-by-one)', () => {
    const out = resolvePlanForStorage(draft, ctx)
    const blocks = out.drills.sessions[0]!.blocks
    expect(blocks[0]!.drill_id).toBe('drill-uuid-0') // drill_ref 0 → pool[0].id
    expect(blocks[1]!.drill_id).toBe('drill-uuid-1') // drill_ref 1 → pool[1].id
    expect(blocks[2]!.drill_id).toBe('drill-uuid-2') // drill_ref 2 → pool[2].id
  })

  it('fills a numeric target on non-warmup blocks and null on warmup blocks', () => {
    const out = resolvePlanForStorage(draft, ctx)
    const blocks = out.drills.sessions[0]!.blocks
    expect(blocks[0]!.target).toBeNull() // warmup → null
    expect(blocks[1]!.target).toBe(30) // resolveTarget(wedgeTmpl, developing) = 30
    expect(blocks[2]!.target).toBe(7) // resolveTarget(gateTmpl, developing) = 7
  })

  it('uses null target for a non-warmup block whose drill has no target_template', () => {
    const noTmpl: PlanDraft = structuredClone(draft)
    // point block to d0 (no template) but keep it a non-warmup type the validator would gate;
    // here we only test storage's tmpl-absent branch.
    noTmpl.sessions[0]!.blocks[1]!.type = 'technical'
    noTmpl.sessions[0]!.blocks[1]!.drill_ref = 0 // pool[0].target_template is null
    const out = resolvePlanForStorage(noTmpl, ctx)
    expect(out.drills.sessions[0]!.blocks[1]!.target).toBeNull()
  })

  it('resolves article_ref to the catalog title+slug, not model text', () => {
    const out = resolvePlanForStorage(draft, ctx)
    const fa = out.focus_areas[0]!
    expect(fa.article).toEqual({ title: 'Strokes Gained Explained', slug: 'strokes-gained' })
    // a focus area with no article_ref carries no resolved article link
    expect(out.focus_areas[1]!.article).toBeUndefined()
  })

  it('preserves block id, order, type, minutes, rationale', () => {
    const out = resolvePlanForStorage(draft, ctx)
    const b = out.drills.sessions[0]!.blocks[1]!
    expect(b.id).toBe('s1b2')
    expect(b.order).toBe(2)
    expect(b.type).toBe('technical')
    expect(b.minutes).toBe(20)
    expect(b.rationale).toBe('wedge control')
  })

  it('returns the practice_plans column-shaped payload (based_on_rounds from digest)', () => {
    const out = resolvePlanForStorage(draft, ctx)
    expect(out.ai_insight).toBe('approach + putting') // week_focus
    expect(out.coach_note).toBe('Tied to your numbers.')
    // based_on_rounds is derived from ctx.digest.sg_summary.based_on_rounds, not a separate ctx field
    expect(out.based_on_rounds).toBe(digest.sg_summary.based_on_rounds) // 8
    expect(Array.isArray(out.focus_areas)).toBe(true)
    expect(out.drills.sessions).toHaveLength(1)
  })

  it('throws on an unresolved drill_ref (invariant violation — unreachable after validatePlanDraft)', () => {
    const bad: PlanDraft = structuredClone(draft)
    bad.sessions[0]!.blocks[1]!.drill_ref = 99 // out of range — unreachable after validation
    expect(() => resolvePlanForStorage(bad, ctx)).toThrow(/drill_ref/)
  })

  it('logs but drops an unresolved optional article_ref', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const bad: PlanDraft = structuredClone(draft)
    bad.focus_areas[0]!.article_ref = 99 // out of range
    const out = resolvePlanForStorage(bad, ctx)
    expect(out.focus_areas[0]!.article).toBeUndefined()
    expect(spy).toHaveBeenCalled()
  })
})
