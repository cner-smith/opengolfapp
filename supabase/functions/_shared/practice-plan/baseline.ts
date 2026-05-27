import type { SkillLevel, Goal } from '../constants.ts'
import type { PlanDraft, PlanCategory } from './types.ts'

// Baseline plans are static content (same `PlanDraft` shape the UI renders).
// NOTE: block `drill_ref` is a placeholder here — baseline drill references are
// resolved to real drill ids when the baseline content is authored (Phase B).
type BaselineVariant = Omit<PlanDraft, 'sessions'> & {
  primaryCategory: PlanCategory
  sessions: PlanDraft['sessions']
}
type Cell = `${SkillLevel}:${Goal}`

export const BASELINE_PLANS: Partial<Record<Cell | 'default', BaselineVariant[]>> = {
  default: [
    // Variant A — putting focus
    {
      primaryCategory: 'putting',
      week_focus: 'Build a repeatable putting stroke',
      coach_note:
        'Most strokes are lost on the greens. A consistent setup and read process pays dividends at every skill level.',
      focus_areas: [
        {
          category: 'putting',
          reason: 'Putting accounts for roughly 40 % of strokes; small gains here surface on the card fast.',
        },
        {
          category: 'around_green',
          reason: 'Getting up-and-down more often reduces the pressure on every putt.',
        },
      ],
      sessions: [
        {
          title: 'Putting fundamentals',
          total_minutes: 45,
          blocks: [
            {
              id: 'b-put-warmup',
              order: 0,
              type: 'warmup',
              drill_ref: 0, // Phase B: resolve to real drill id
              minutes: 10,
              rationale: 'Gate drill to ingrain a square face at impact.',
            },
            {
              id: 'b-put-technical',
              order: 1,
              type: 'putting',
              drill_ref: 0, // Phase B: resolve to real drill id
              minutes: 20,
              rationale: 'Distance-control ladder from 10 – 30 ft.',
            },
            {
              id: 'b-put-game',
              order: 2,
              type: 'pressure_game',
              drill_ref: 0, // Phase B: resolve to real drill id
              minutes: 15,
              rationale: '18-hole putting game on the practice green to simulate real-round pressure.',
            },
          ],
        },
        {
          title: 'Short game touch',
          total_minutes: 30,
          blocks: [
            {
              id: 'b-atg-chip',
              order: 0,
              type: 'technical',
              drill_ref: 0, // Phase B: resolve to real drill id
              minutes: 15,
              rationale: 'Bump-and-run from tight lies to a near pin.',
            },
            {
              id: 'b-atg-game',
              order: 1,
              type: 'skill_game',
              drill_ref: 0, // Phase B: resolve to real drill id
              minutes: 15,
              rationale: 'Up-and-down challenge: 10 balls from various lies around the green.',
            },
          ],
        },
      ],
    },

    // Variant B — approach focus
    {
      primaryCategory: 'approach',
      week_focus: 'Tighten approach-shot dispersion',
      coach_note:
        'Hitting greens in regulation is the single biggest driver of lower scores for mid-handicap players.',
      focus_areas: [
        {
          category: 'approach',
          reason: 'Improved GIR percentage directly lowers scores and reduces reliance on short-game recovery.',
        },
        {
          category: 'off_tee',
          reason: 'More fairways means shorter, cleaner approach distances.',
        },
      ],
      sessions: [
        {
          title: 'Iron accuracy block',
          total_minutes: 45,
          blocks: [
            {
              id: 'b-app-warmup',
              order: 0,
              type: 'warmup',
              drill_ref: 0, // Phase B: resolve to real drill id
              minutes: 10,
              rationale: 'Nine-o\'clock to three-o\'clock half-swing to groove contact.',
            },
            {
              id: 'b-app-technical',
              order: 1,
              type: 'technical',
              drill_ref: 0, // Phase B: resolve to real drill id
              minutes: 20,
              rationale: 'Alignment-stick target gate drill — 7-iron to a specific pin.',
            },
            {
              id: 'b-app-game',
              order: 2,
              type: 'skill_game',
              drill_ref: 0, // Phase B: resolve to real drill id
              minutes: 15,
              rationale: 'Hit-the-green game: score +1 for GIR, 0 for miss; target ≥ 7/10.',
            },
          ],
        },
        {
          title: 'Tee-shot consistency',
          total_minutes: 30,
          blocks: [
            {
              id: 'b-ott-technical',
              order: 0,
              type: 'technical',
              drill_ref: 0, // Phase B: resolve to real drill id
              minutes: 15,
              rationale: 'Slow-motion takeaway drill to reduce over-the-top path.',
            },
            {
              id: 'b-ott-game',
              order: 1,
              type: 'skill_game',
              drill_ref: 0, // Phase B: resolve to real drill id
              minutes: 15,
              rationale: 'Fairway-finder challenge: 10 drives, score for landing zone.',
            },
          ],
        },
      ],
    },
  ],
}

export function selectBaselinePlan(args: {
  skill: SkillLevel | null
  goal: Goal | null
  weekIndex: number
  worstCategory?: PlanCategory
}): PlanDraft {
  const cell = (args.skill && args.goal ? `${args.skill}:${args.goal}` : 'default') as Cell
  const variants = BASELINE_PLANS[cell] ?? BASELINE_PLANS.default ?? []
  if (!variants.length) throw new Error(`no baseline variant for ${cell}`)
  const matched = args.worstCategory
    ? variants.filter((v) => v.primaryCategory === args.worstCategory)
    : []
  const usable = matched.length ? matched : variants
  const chosen = usable[Math.abs(args.weekIndex) % usable.length]!
  const { primaryCategory: _omit, ...plan } = chosen
  return plan
}
