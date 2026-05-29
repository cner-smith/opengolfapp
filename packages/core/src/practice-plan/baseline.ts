import type { SkillLevel, Goal } from '../constants'
import type { PlanDraft, PlanCategory } from './types'

// Baseline plans are static content (same `PlanDraft` shape the UI renders).
// Block `drill_name` is the canonical corpus name; `serveBaseline` resolves
// each one to a real `drill_id` at storage time and strips the hint before
// INSERT. `drill_ref` stays 0 (placeholder — baselines don't go through the
// retrieval/Claude path that consumes it).
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
              drill_ref: 0,
              drill_name: 'Speed Station (15-Inches-Past Lag Primer)',
              minutes: 10,
              rationale: 'Easy lag rolls to find the speed of the greens before any focused work.',
            },
            {
              id: 'b-put-blocked',
              order: 1,
              type: 'blocked',
              drill_ref: 0,
              drill_name: 'Gate Drill',
              minutes: 20,
              rationale: 'Gate drill — repeated straight putts to ingrain a square face and start line.',
            },
            {
              id: 'b-put-game',
              order: 2,
              type: 'pressure_game',
              drill_ref: 0,
              drill_name: 'Golden Eight (Walters)',
              minutes: 15,
              rationale: '18-hole putting game on the practice green to add consequence to the stroke.',
            },
          ],
        },
        {
          title: 'Short game touch',
          total_minutes: 30,
          blocks: [
            {
              id: 'b-atg-blocked',
              order: 0,
              type: 'blocked',
              drill_ref: 0,
              drill_name: 'Bump-and-Run',
              minutes: 15,
              rationale: 'Bump-and-run from tight lies to a near pin — same shot, repeated.',
            },
            // Closes on the green (an around_green skill game) per Decisions §3.
            {
              id: 'b-atg-game',
              order: 1,
              type: 'skill_game',
              drill_ref: 0,
              drill_name: 'Up-and-Down Scoring Game',
              minutes: 15,
              rationale: 'Up-and-down challenge: 10 balls from various lies around the green, keep score.',
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
              drill_ref: 0,
              drill_name: '7-Iron Calibration Warm-Up',
              minutes: 10,
              rationale: 'Nine-o\'clock to three-o\'clock half-swings to groove contact.',
            },
            {
              id: 'b-app-blocked',
              order: 1,
              type: 'blocked',
              drill_ref: 0,
              drill_name: 'Tee-Gate Center-Face',
              minutes: 20,
              rationale: 'Alignment-stick target gate — 7-iron to a specific pin, same shot repeated.',
            },
            // Closes on the green (an around_green skill game) — every session ends on the green per Decisions §3.
            // Unique id (Variant A already uses `b-atg-game`); intentionally reuses the same drill name.
            {
              id: 'b-atg-updown-game',
              order: 2,
              type: 'skill_game',
              drill_ref: 0,
              drill_name: 'Up-and-Down Scoring Game',
              minutes: 15,
              rationale: 'Up-and-down challenge: 10 balls from various lies around the green, keep score.',
            },
          ],
        },
        {
          title: 'Tee shots, then close on the green',
          total_minutes: 45,
          blocks: [
            {
              id: 'b-ott-warmup',
              order: 0,
              type: 'warmup',
              drill_ref: 0,
              drill_name: 'Rhythm/Tempo Warm-Up',
              minutes: 10,
              rationale: 'Easy half-speed swings with a mid-iron to loosen up before driver.',
            },
            {
              id: 'b-ott-blocked',
              order: 1,
              type: 'blocked',
              drill_ref: 0,
              drill_name: 'Path Gate',
              minutes: 15,
              rationale: 'Path-gate drill to reduce an over-the-top move, same swing repeated.',
            },
            // Closes on the green (a putting skill game) per Decisions §3.
            // Unique id (Variant A already uses `b-put-game`).
            {
              id: 'b-put-lag-game',
              order: 2,
              type: 'skill_game',
              drill_ref: 0,
              drill_name: 'Distance Ladder',
              minutes: 20,
              rationale: 'Lag-ladder game from 10–40 ft to end every session on the green.',
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
