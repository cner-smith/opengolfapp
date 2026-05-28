import type { SkillLevel, Goal } from '../constants'

export type PlanCategory = 'off_tee' | 'approach' | 'around_green' | 'putting'
export type PlayFrequency = 'monthly' | 'weekly' | 'multi_weekly' | 'daily'
export type BlockType = 'warmup' | 'blocked' | 'random' | 'skill_game' | 'pressure_game' | 'on_course'

/** Already-fetched round, SG columns only (no stats engine needed). */
export interface RoundSG {
  sg_off_tee: number | null
  sg_approach: number | null
  sg_around_green: number | null
  sg_putting: number | null
  played_at?: string | null // for trend ordering
}

export interface DispersionSummary {
  club: string
  dominant_miss: 'left' | 'right' | null
  shot_shape: string | null
  cone68: { lateral: number; distance: number }
  sample: number
}

export interface PlayerDigest {
  profile: {
    skill_level: SkillLevel | null
    handicap_index: number | null
    goal: Goal | null
    facilities: string[]
    play_frequency: PlayFrequency | null
  }
  sg_summary: {
    based_on_rounds: number
    averages: Record<PlanCategory, number | null>
    trend: Partial<Record<PlanCategory, 'improving' | 'declining' | 'flat'>>
    ranked_weaknesses: PlanCategory[] // worst first
  }
  dispersion: DispersionSummary[]
  last_plan_feedback: string | null
  warnings?: string[] // self-consistency (added in a later unit)
}

export interface TargetTemplate {
  metric: string
  unit: string
  scales_with?: string // a digest stat key, e.g. 'approach_dispersion'
  baseline: Partial<Record<SkillLevel, number>>
  min: number
  max: number
}

export interface PlanBlock {
  id: string
  order: number
  type: BlockType
  drill_ref: number // index into the candidate pool
  minutes: number
  rationale: string
}
export interface PlanSession {
  title: string
  total_minutes: number
  blocks: PlanBlock[]
}
export interface PlanFocusArea {
  category: PlanCategory
  reason: string
  article_ref?: number
}
export interface PlanDraft {
  week_focus: string
  coach_note: string
  focus_areas: PlanFocusArea[]
  sessions: PlanSession[]
}

/** What retrieval hands the validator — index === drill_ref. */
export interface CandidateDrill {
  id: string
  name: string
  category: PlanCategory
  drill_type: BlockType
  duration_min: number | null
  facility: string[] | null
  target_template: TargetTemplate | null
}
