// Per-hole stat inference from shot rows. Currently feeds
// hole_scores.fairway_hit / hole_scores.gir at save time so the
// scorecard and round-level totals reflect what the player actually
// did without making them tap two extra toggles per hole.

export interface HoleInferred {
  /** Green-in-regulation: ball reached the green by par - 2 strokes
   *  or fewer. Null when no shots are present. */
  gir: boolean | null
  /** Tee shot finished in the fairway. Null on par 3 (concept doesn't
   *  apply) or when a single logged shot can't be distinguished from a
   *  partially-logged hole; false on a known par 4/5 hole-in-one. */
  fairway: boolean | null
}

interface ShotLike {
  shot_number: number
  lie_type: string | null
}

/**
 * `holedOut` = the LAST shot in `shots` finished in the cup. Only the
 * caller knows this: the web post-round review flow is holed-out by
 * construction (the final marker ends at the pin and score = placed
 * shots), so it passes true. Mobile has no reliable holing signal for
 * off-green hole-outs (no 'holed' shot_result exists — the DB CHECK
 * constraint excludes it, #669), so mobile callers omit it and get the
 * conservative default.
 */
export function inferHoleStats(
  shots: ReadonlyArray<ShotLike>,
  par: number,
  holedOut = false,
): HoleInferred {
  const fairway = inferFairway(shots, par, holedOut)
  const gir = inferGir(shots, par, holedOut)
  return { gir, fairway }
}

function inferFairway(
  shots: ReadonlyArray<ShotLike>,
  par: number,
  holedOut: boolean,
): boolean | null {
  if (par < 4) return null
  if (shots.length === 0) return null
  // One logged shot is a par-4/5 hole-in-one (never reached a fairway)
  // only when we KNOW it holed out — otherwise it's a partially-logged
  // hole and the fairway is simply unknown (#669).
  if (shots.length === 1) return holedOut ? false : null
  const shot2 = shots.find((s) => s.shot_number === 2)
  if (!shot2) return null
  return shot2.lie_type === 'fairway'
}

function inferGir(
  shots: ReadonlyArray<ShotLike>,
  par: number,
  holedOut: boolean,
): boolean | null {
  if (shots.length === 0) return null
  // lie_type is the start lie, so shot N starting on the green means the
  // ball reached the green on stroke N-1. GIR = on green in (par-2)
  // strokes → the first green-start shot must be number <= par-1.
  const greenNumbers = shots
    .filter((s) => s.lie_type === 'green')
    .map((s) => s.shot_number)
  if (greenNumbers.length > 0) return Math.min(...greenNumbers) <= par - 1
  // No shot ever STARTED on the green — the ball still reached it only by
  // holing out from off the green (ace, chip-in, holed approach). The cup
  // is on the green, so the ball got there ON the holing stroke itself:
  // GIR when that stroke is <= par-2. Note this is one stroke stricter
  // than the green-start branch — a chip-in for par (stroke par-1) is NOT
  // a GIR, which the old dead `shot_result === 'holed'` branch got wrong.
  if (holedOut) {
    return Math.max(...shots.map((s) => s.shot_number)) <= par - 2
  }
  return false
}
