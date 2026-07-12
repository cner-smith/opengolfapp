// Tour one-putt make percentage by distance (#791 step 4 — green make-%
// readout). Values are PGA Tour make rates from published ShotLink
// distributions, anchored at common distances and linearly interpolated
// between. Distance is in FEET; the value is a whole-number percent.
//
// This is the "tour" reference shown the moment a ball is marked on the
// green. The player's own make rate ("You") blends in later once enough
// green-lie putts are logged in a band — deferred, see the epic.

import { interpolateBaseline } from './sg-baselines'

export const TOUR_MAKE_PERCENT: Record<number, number> = {
  2: 99,
  3: 96,
  4: 88,
  5: 77,
  6: 66,
  7: 58,
  8: 50,
  9: 45,
  10: 40,
  15: 23,
  20: 15,
  25: 10,
  30: 7,
  40: 4,
  50: 3,
  60: 2,
}

// Tour make % for a putt of `distanceFt` feet, rounded to a whole percent.
// Clamps outside the table (<=2 ft → 99, >=60 ft → 2). Returns null for a
// non-finite distance so callers render a dash rather than NaN.
export function tourMakePercent(distanceFt: number): number | null {
  const pct = interpolateBaseline(TOUR_MAKE_PERCENT, distanceFt)
  return pct == null ? null : Math.round(pct)
}
