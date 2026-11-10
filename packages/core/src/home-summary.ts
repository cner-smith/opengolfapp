import { isPartialRound } from './round'
import { sgFinding } from './sg-finding'
import { sgBreakdown, type SGBreakdownKey, type SGRoundLike } from './stats'

// The strokes-gained summary Home, the web Dashboard and both Practice screens
// lead with: the newest 20 whole rounds, each category's average per round,
// the finding, total SG, average score and the round-by-round total SG trend.

export interface HomeSummaryRound extends SGRoundLike {
  played_at: string
  sg_total: number | null
  total_score: number | null
  hole_count?: number | null
  hole_scores?: Parameters<typeof isPartialRound>[0]
}

export interface HomeSummaryArea {
  key: SGBreakdownKey
  label: string
  /** null = no round in the window has this category (not counted, never 0). */
  value: number | null
}

export interface HomeSummary<T> {
  /** The newest 20 whole rounds, newest first. */
  whole: T[]
  areas: HomeSummaryArea[]
  /** Peak |average| over the areas, for the bar scale. */
  maxAbs: number
  /** Sum of the counted areas' averages; null when none is counted. */
  totalSG: number | null
  /** Over rounds with a real score; total_score 0 is the "no score yet" sentinel. */
  avgScore: number | null
  /** Total SG per round, oldest to newest; a round with no SG is not a point. */
  trend: { date: string; sg: number }[]
  /** null when no category is counted. */
  finding: string | null
}

const WINDOW = 20

// The four strokes-gained categories as every screen names them.
export const SG_AREAS: readonly { key: SGBreakdownKey; label: string }[] = [
  { key: 'sg_off_tee', label: 'Off the tee' },
  { key: 'sg_approach', label: 'Approach' },
  { key: 'sg_around_green', label: 'Around the green' },
  { key: 'sg_putting', label: 'Putting' },
]

export function homeSummary<T extends HomeSummaryRound>(rounds: readonly T[]): HomeSummary<T> {
  // Rounds ended early stay out: their totals don't compare with whole rounds (#911).
  const whole = rounds.filter((r) => !isPartialRound(r.hole_scores, r.hole_count)).slice(0, WINDOW)
  const { breakdown } = sgBreakdown(whole)
  // A category no round has is not counted (owner ruling, 2026-11-09):
  // sgBreakdown reads it as 0, so it is nulled here.
  const areas = SG_AREAS.map(({ key, label }) => ({
    key,
    label,
    value: whole.some((r) => r[key] != null) ? breakdown.find((b) => b.key === key)!.value : null,
  }))
  const counted = areas
    .filter((a): a is HomeSummaryArea & { value: number } => a.value != null)
    .sort((a, b) => b.value - a.value)
  const scored = whole.filter((r) => (r.total_score ?? 0) > 0)
  return {
    whole,
    areas,
    maxAbs: Math.max(0, ...counted.map((a) => Math.abs(a.value))),
    totalSG: counted.length > 0 ? counted.reduce((s, a) => s + a.value, 0) : null,
    avgScore: scored.length > 0 ? scored.reduce((s, r) => s + r.total_score!, 0) / scored.length : null,
    trend: [...whole].reverse().flatMap((r) => (r.sg_total == null ? [] : [{ date: r.played_at, sg: r.sg_total }])),
    finding: counted.length > 0 ? sgFinding(counted[counted.length - 1]!, counted[0]!, 'every part') : null,
  }
}
