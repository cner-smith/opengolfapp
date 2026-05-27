import type {
  PlayerDigest, PlanCategory, RoundSG, DispersionSummary,
} from './types'

// Tie-break priority (cheapest strokes first) — matches round-nudge.ts.
const CATEGORIES = [
  { key: 'sg_putting', cat: 'putting' },
  { key: 'sg_approach', cat: 'approach' },
  { key: 'sg_around_green', cat: 'around_green' },
  { key: 'sg_off_tee', cat: 'off_tee' },
] as const satisfies ReadonlyArray<{ key: keyof RoundSG; cat: PlanCategory }>

// Pre-compute index map for explicit tie-breaking in sort.
const CATEGORY_INDEX: Record<PlanCategory, number> = {
  putting: 0,
  approach: 1,
  around_green: 2,
  off_tee: 3,
}

interface DigestInput {
  profile: PlayerDigest['profile']
  rounds: RoundSG[]
  dispersion: DispersionSummary[]
  lastFeedback: string | null
}

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}

/** Label from a first-half vs last-half split over chronologically-ordered values. */
function trendLabel(vals: number[]): 'improving' | 'declining' | 'flat' {
  if (vals.length < 3) return 'flat'
  const half = Math.floor(vals.length / 2)
  const early = mean(vals.slice(0, half))!
  const late = mean(vals.slice(-half))!
  const delta = late - early
  if (delta > 0.3) return 'improving'
  if (delta < -0.3) return 'declining'
  return 'flat'
}

function consistencyWarnings(
  ranked: PlanCategory[], dispersion: DispersionSummary[],
): string[] {
  const warnings: string[] = []
  const driver = dispersion.find((d) => d.club === 'driver')
  if (driver && driver.sample >= 20 && driver.cone68.lateral < 8 && ranked[0] === 'off_tee') {
    warnings.push(
      'off_tee is the top weakness but driver dispersion is tight — verify SG attribution before leaning on an off_tee focus.',
    )
  }
  return warnings
}

export function buildPlayerDigest(input: DigestInput): PlayerDigest {
  const { rounds } = input
  const averages = {} as Record<PlanCategory, number | null>
  for (const { key, cat } of CATEGORIES) {
    averages[cat] = mean(rounds.map((r) => r[key]).filter((v): v is number => v != null))
  }

  // Worst-first; nulls sort last; exact ties resolved by CATEGORIES order (putting first).
  const ranked_weaknesses = CATEGORIES
    .map(({ cat }) => cat)
    .sort((a, b) => {
      const av = averages[a], bv = averages[b]
      if (av == null && bv == null) return CATEGORY_INDEX[a] - CATEGORY_INDEX[b]
      if (av == null) return 1
      if (bv == null) return -1
      if (av === bv) return CATEGORY_INDEX[a] - CATEGORY_INDEX[b]
      return av - bv
    })

  const trend: PlayerDigest['sg_summary']['trend'] = {}
  const chrono = [...rounds].sort((a, b) =>
    (a.played_at ?? '').localeCompare(b.played_at ?? ''))
  for (const { key, cat } of CATEGORIES) {
    const vals = chrono.map((r) => r[key]).filter((v): v is number => v != null)
    const label = trendLabel(vals)
    if (label !== 'flat') trend[cat] = label
  }

  const warnings = consistencyWarnings(ranked_weaknesses, input.dispersion)

  return {
    profile: input.profile,
    sg_summary: { based_on_rounds: rounds.length, averages, trend, ranked_weaknesses },
    dispersion: input.dispersion,
    last_plan_feedback: input.lastFeedback,
    warnings,
  }
}
