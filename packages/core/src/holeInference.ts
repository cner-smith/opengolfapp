// Per-hole stat inference from shot rows. Currently feeds
// hole_scores.fairway_hit / hole_scores.gir at save time so the
// scorecard and round-level totals reflect what the player actually
// did without making them tap two extra toggles per hole.

export interface HoleInferred {
  /** Green-in-regulation: ball reached the green by par - 2 strokes
   *  or fewer. Null when no shots are present. */
  gir: boolean | null
  /** Tee shot finished in the fairway. Null on par 3 (concept doesn't
   *  apply); false on par 4/5 holes-in-one (no fairway was hit). */
  fairway: boolean | null
}

interface ShotLike {
  shot_number: number
  lie_type: string | null
  shot_result?: string | null
}

export function inferHoleStats(
  shots: ReadonlyArray<ShotLike>,
  par: number,
): HoleInferred {
  const fairway = inferFairway(shots, par)
  const gir = inferGir(shots, par)
  return { gir, fairway }
}

function inferFairway(
  shots: ReadonlyArray<ShotLike>,
  par: number,
): boolean | null {
  if (par < 4) return null
  if (shots.length === 0) return null
  // Hole-in-one on par 4/5 — never reached a fairway.
  if (shots.length === 1) return false
  const shot2 = shots.find((s) => s.shot_number === 2)
  if (!shot2) return null
  return shot2.lie_type === 'fairway'
}

function inferGir(
  shots: ReadonlyArray<ShotLike>,
  par: number,
): boolean | null {
  if (shots.length === 0) return null
  const threshold = par - 2
  // First shot whose start lie is the green, OR the shot the player
  // holed (handles hole-in-one where shot 1 starts on tee but
  // shot_result='holed' means the ball reached the cup that stroke).
  const reaching = shots.find(
    (s) => s.lie_type === 'green' || s.shot_result === 'holed',
  )
  if (reaching) return reaching.shot_number <= threshold
  return false
}
