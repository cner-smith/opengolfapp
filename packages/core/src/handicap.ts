// USGA-style handicap mechanics.
// - calculateDifferential — per-round score differential from
//   adjusted score, course rating, slope rating.
// - calculateHandicapIndex — averages the best of the last N
//   differentials (lookup table per submission count) and applies
//   the 0.96 confidence factor.
// - adjustedScore — Equitable Stroke Control: caps each hole's
//   score for handicap purposes based on the player's index.
//
// Pure module — no DB, no React. Used by web + mobile finalize
// flows and any future server-side handicap recompute.

export function calculateDifferential(
  adjustedScore: number,
  courseRating: number,
  slopeRating: number,
): number {
  if (!Number.isFinite(slopeRating) || slopeRating <= 0) {
    throw new Error('slopeRating must be a positive number')
  }
  return ((adjustedScore - courseRating) * 113) / slopeRating
}

export function calculateHandicapIndex(
  differentials: number[],
): number | null {
  const valid = differentials.filter((d) => Number.isFinite(d))
  if (valid.length < 3) return null

  const sorted = [...valid].sort((a, b) => a - b)
  const count = valid.length

  let bestCount: number
  if (count >= 20) bestCount = 8
  else if (count >= 17) bestCount = 7
  else if (count >= 14) bestCount = 6
  else if (count >= 11) bestCount = 5
  else if (count >= 9) bestCount = 4
  else if (count >= 7) bestCount = 3
  else if (count >= 5) bestCount = 2
  else bestCount = 1

  const best = sorted.slice(0, bestCount)
  const avg = best.reduce((a, b) => a + b, 0) / best.length
  return Math.round(avg * 0.96 * 10) / 10
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
