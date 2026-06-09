// World Handicap System (WHS) mechanics — in effect since January 2020.
//
// - calculateDifferential: per-round score differential from adjusted
//   score, course rating, slope rating. Rounded to one decimal per
//   USGA Rule 5.1.
// - calculateHandicapIndex: averages the lowest N differentials per
//   the WHS table (Rule 5.2a) and applies the low-round adjustment.
//   Replaces the legacy 0.96 multiplier — WHS does not use one.
// - adjustedScore: Equitable Stroke Control caps each hole's score
//   for handicap purposes based on the player's index.
//
// Pure module — no DB, no React. Used by web + mobile finalize flows
// and any future server-side handicap recompute.

const MAX_HANDICAP_INDEX = 54.0
const RECENT_WINDOW = 20

// WHS Rule 5.2a needs at least 3 acceptable score differentials before an
// index can be computed. Below this, the stored handicap_index is whatever
// the player entered, not a derived value — see handicapProvenance.
export const MIN_ROUNDS_FOR_HANDICAP = 3

export function calculateDifferential(
  adjustedScore: number,
  courseRating: number,
  slopeRating: number,
): number {
  if (!Number.isFinite(slopeRating) || slopeRating <= 0) {
    throw new Error('slopeRating must be a positive number')
  }
  const raw = ((adjustedScore - courseRating) * 113) / slopeRating
  return Math.round(raw * 10) / 10
}

interface BracketRule {
  bestCount: number
  adjustment: number
}

// WHS Rule 5.2a table. `count` is the number of acceptable
// differentials (capped at 20 — see `considered` below).
function bracketFor(count: number): BracketRule {
  if (count >= 20) return { bestCount: 8, adjustment: 0 }
  if (count === 19) return { bestCount: 7, adjustment: 0 }
  if (count >= 17) return { bestCount: 6, adjustment: 0 }
  if (count >= 15) return { bestCount: 5, adjustment: 0 }
  if (count >= 12) return { bestCount: 4, adjustment: 0 }
  if (count >= 9) return { bestCount: 3, adjustment: 0 }
  if (count >= 7) return { bestCount: 2, adjustment: 0 }
  if (count === 6) return { bestCount: 2, adjustment: -1.0 }
  if (count === 5) return { bestCount: 1, adjustment: 0 }
  if (count === 4) return { bestCount: 1, adjustment: -1.0 }
  return { bestCount: 1, adjustment: -2.0 } // count === 3
}

// `differentials` is most-recent-first. For 20+ we drop everything
// past the most-recent-20 window before picking the best 8 — this
// matches WHS "of the most recent 20 scores" wording.
export function calculateHandicapIndex(
  differentials: number[],
): number | null {
  const valid = differentials.filter((d) => Number.isFinite(d))
  if (valid.length < MIN_ROUNDS_FOR_HANDICAP) return null

  const considered =
    valid.length >= RECENT_WINDOW ? valid.slice(0, RECENT_WINDOW) : valid

  const { bestCount, adjustment } = bracketFor(considered.length)
  const sorted = [...considered].sort((a, b) => a - b)
  const best = sorted.slice(0, bestCount)
  const avg = best.reduce((a, b) => a + b, 0) / best.length
  const result = avg + adjustment
  const rounded = Math.round(result * 10) / 10
  return Math.min(rounded, MAX_HANDICAP_INDEX)
}

// ESC: cap each hole's gross score before computing the adjusted
// total used in the differential formula.
export function adjustedScore(
  holes: { score: number; par: number }[],
  handicapIndex: number,
): number {
  return holes.reduce((total, hole) => {
    const max = capForHole(hole.par, handicapIndex)
    return total + Math.min(hole.score, max)
  }, 0)
}

function capForHole(par: number, handicapIndex: number): number {
  if (handicapIndex <= 9) return par + 2
  if (handicapIndex <= 19) return 7
  if (handicapIndex <= 29) return 8
  if (handicapIndex <= 39) return 9
  return 10
}

// Provenance of a stored handicap_index: 'calculated' once the player has
// enough rated rounds for the WHS index to have been derived (and the
// finalize flow to have overwritten the entered value), 'provisional'
// otherwise. The number of rounds with a non-null score_differential is
// the signal — it's also 0 for any player who has only ever entered a
// value (e.g. mobile, which doesn't yet compute differentials). See #521.
export type HandicapProvenance = 'calculated' | 'provisional'

export function handicapProvenance(
  differentialsCount: number,
): HandicapProvenance {
  return differentialsCount >= MIN_ROUNDS_FOR_HANDICAP
    ? 'calculated'
    : 'provisional'
}

export const HANDICAP_PROVENANCE_LABEL: Record<HandicapProvenance, string> = {
  calculated: 'WHS index',
  provisional: 'Provisional',
}
