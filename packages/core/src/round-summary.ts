// Pure, dependency-free content builder for the round-summary email
// scaffold (#317). IMPORT-FREE BY DESIGN so it can be vendored verbatim
// into the Deno Edge Function (see supabase/functions/_shared). Do not add
// imports here — keep `toParLabel` inline rather than reusing units.ts's
// formatToPar, so the single-file vendor copy needs no transitive files.

export interface RoundSummaryInput {
  courseName: string
  totalScore: number
  par: number
  sg: {
    offTee: number
    approach: number
    aroundGreen: number
    putting: number
  }
}

export interface SgBar {
  label: string
  value: number
  /** 0–100 fill width for a diverging bar centered at 50 = neutral (0 SG). */
  widthPct: number
}

export interface RoundSummaryContent {
  subject: string
  hero: { score: number; toPar: number; toParLabel: string }
  bars: SgBar[]
  lede: string
}

// ± this many strokes maps to a full half-bar.
const SG_SCALE = 5

function toParLabel(toPar: number): string {
  if (toPar === 0) return 'E'
  return toPar > 0 ? `+${toPar}` : `−${-toPar}`
}

function barWidth(sg: number): number {
  const pct = 50 + (sg / SG_SCALE) * 50
  return Math.max(0, Math.min(100, Math.round(pct)))
}

// The par a round's score is read against (#727): the par of the holes it
// scored (per-round override, else the hole's), so a 6-hole round on an
// 18-hole tee reads against 24, not 72. With no scored holes: the tee's par
// scaled to the round's hole count (a tee par of 36 or less is a 9-hole
// card), else 4 a hole, else the tee's par, else 72.
export function roundSummaryPar(
  scoredHolePars: readonly number[],
  teePar: number | null | undefined,
  holeCount: number | null | undefined,
): number {
  if (scoredHolePars.length > 0) return scoredHolePars.reduce((a, b) => a + b, 0)
  if (holeCount == null) return teePar ?? 72
  if (teePar == null) return 4 * holeCount
  return Math.round((teePar * holeCount) / (teePar <= 36 ? 9 : 18))
}

export function buildRoundSummary(input: RoundSummaryInput): RoundSummaryContent {
  const { courseName, totalScore, par, sg } = input
  const toPar = totalScore - par
  const label = toParLabel(toPar)
  return {
    subject: `Your round at ${courseName}: ${totalScore} (${label} to par)`,
    hero: { score: totalScore, toPar, toParLabel: label },
    bars: [
      { label: 'Off the tee', value: sg.offTee, widthPct: barWidth(sg.offTee) },
      { label: 'Approach', value: sg.approach, widthPct: barWidth(sg.approach) },
      { label: 'Around green', value: sg.aroundGreen, widthPct: barWidth(sg.aroundGreen) },
      { label: 'Putting', value: sg.putting, widthPct: barWidth(sg.putting) },
    ],
    lede: "Here's how your round broke down.",
  }
}
