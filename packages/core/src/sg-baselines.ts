// Expected strokes to hole from distance, by handicap bracket.
// Adapted from Mark Broadie's "Every Shot Counts" (scratch baseline) plus
// amateur stroke-distribution data; non-scratch brackets are interpolated
// from published amateur SG datasets.
//
// Distance units: feet for putting, yards for approach/around-green.

export type HandicapBracket = 0 | 5 | 10 | 15 | 20 | 25 | 30

export const HANDICAP_BRACKETS: HandicapBracket[] = [0, 5, 10, 15, 20, 25, 30]

export const PUTTING_BASELINES: Record<HandicapBracket, Record<number, number>> = {
  0: { 3: 1.03, 5: 1.14, 8: 1.3, 10: 1.37, 15: 1.55, 20: 1.7, 30: 1.88, 40: 2.0, 60: 2.18 },
  5: { 3: 1.05, 5: 1.18, 8: 1.38, 10: 1.47, 15: 1.68, 20: 1.85, 30: 2.03, 40: 2.16, 60: 2.34 },
  10: { 3: 1.07, 5: 1.22, 8: 1.44, 10: 1.56, 15: 1.8, 20: 1.98, 30: 2.18, 40: 2.32, 60: 2.5 },
  15: { 3: 1.1, 5: 1.27, 8: 1.52, 10: 1.65, 15: 1.92, 20: 2.12, 30: 2.34, 40: 2.48, 60: 2.66 },
  20: { 3: 1.13, 5: 1.33, 8: 1.62, 10: 1.76, 15: 2.05, 20: 2.27, 30: 2.5, 40: 2.65, 60: 2.84 },
  25: { 3: 1.17, 5: 1.4, 8: 1.73, 10: 1.88, 15: 2.2, 20: 2.44, 30: 2.68, 40: 2.83, 60: 3.02 },
  30: { 3: 1.22, 5: 1.48, 8: 1.86, 10: 2.02, 15: 2.37, 20: 2.62, 30: 2.88, 40: 3.04, 60: 3.24 },
}

// Rows past 225 yd (par-5 second shots, long par-3s) continue each bracket
// along Broadie's PGA TOUR fairway column (Assessing Golfer Performance on the
// PGA TOUR, Interfaces 42(2) 2012, Table B.1): value(225) + k·(fairway(d) −
// fairway(225)), k = the bracket's own 125→225 rise over Broadie's (0.96 at
// scratch … 1.89 at 30). Before these rows the table clamped at 225 (#998).
export const APPROACH_BASELINES: Record<HandicapBracket, Record<number, number>> = {
  0: { 50: 2.6, 75: 2.72, 100: 2.85, 125: 2.98, 150: 3.12, 175: 3.24, 200: 3.35, 225: 3.45, 250: 3.61, 275: 3.75, 300: 3.86, 350: 3.99, 400: 4.18, 450: 4.37, 500: 4.56, 550: 4.75, 600: 4.93 },
  5: { 50: 2.75, 75: 2.9, 100: 3.05, 125: 3.2, 150: 3.36, 175: 3.5, 200: 3.63, 225: 3.75, 250: 3.93, 275: 4.1, 300: 4.23, 350: 4.38, 400: 4.6, 450: 4.82, 500: 5.04, 550: 5.27, 600: 5.48 },
  10: { 50: 2.92, 75: 3.1, 100: 3.28, 125: 3.46, 150: 3.64, 175: 3.8, 200: 3.95, 225: 4.08, 250: 4.29, 275: 4.47, 300: 4.62, 350: 4.8, 400: 5.04, 450: 5.29, 500: 5.54, 550: 5.79, 600: 6.04 },
  15: { 50: 3.1, 75: 3.32, 100: 3.54, 125: 3.74, 150: 3.95, 175: 4.13, 200: 4.29, 225: 4.44, 250: 4.67, 275: 4.89, 300: 5.05, 350: 5.25, 400: 5.53, 450: 5.81, 500: 6.09, 550: 6.37, 600: 6.65 },
  20: { 50: 3.3, 75: 3.56, 100: 3.82, 125: 4.05, 150: 4.28, 175: 4.48, 200: 4.66, 225: 4.82, 250: 5.08, 275: 5.31, 300: 5.5, 350: 5.71, 400: 6.02, 450: 6.32, 500: 6.63, 550: 6.95, 600: 7.25 },
  25: { 50: 3.52, 75: 3.82, 100: 4.12, 125: 4.38, 150: 4.63, 175: 4.85, 200: 5.05, 225: 5.22, 250: 5.5, 275: 5.75, 300: 5.96, 350: 6.19, 400: 6.53, 450: 6.86, 500: 7.2, 550: 7.54, 600: 7.87 },
  30: { 50: 3.76, 75: 4.1, 100: 4.44, 125: 4.74, 150: 5.01, 175: 5.25, 200: 5.47, 225: 5.66, 250: 5.97, 275: 6.25, 300: 6.47, 350: 6.72, 400: 7.09, 450: 7.46, 500: 7.83, 550: 8.2, 600: 8.56 },
}

// Around-green runs to 30 yd, where getShotCategory hands over to approach
// (whose table clamps to its 50-yd value below 50). Each row is the original
// curve's shape from 5 yd, rescaled so 30 yd meets approach@50 — the old rows
// sat above it in every bracket, so a shot from 30 yd "expected" more
// strokes than one from 50 (#632).
export const AROUND_GREEN_BASELINES: Record<HandicapBracket, Record<number, number>> = {
  0: { 5: 2.18, 10: 2.29, 15: 2.38, 20: 2.49, 30: 2.6 },
  5: { 5: 2.3, 10: 2.42, 15: 2.52, 20: 2.63, 30: 2.75 },
  10: { 5: 2.44, 10: 2.56, 15: 2.67, 20: 2.8, 30: 2.92 },
  15: { 5: 2.6, 10: 2.73, 15: 2.84, 20: 2.97, 30: 3.1 },
  20: { 5: 2.78, 10: 2.91, 15: 3.03, 20: 3.17, 30: 3.3 },
  25: { 5: 2.98, 10: 3.12, 15: 3.24, 20: 3.38, 30: 3.52 },
  30: { 5: 3.2, 10: 3.34, 15: 3.47, 20: 3.62, 30: 3.76 },
}

// Expected strokes from the TEE of a hole `distanceYards` long (par-4/5 tee
// shots). Broadie publishes two tee lines: PGA TOUR 2.38 + 0.0041·d (Interfaces
// 2012 §Tee Shot Benchmark) and the 90-golfer 2.79 + 0.0066·d (Broadie 2008,
// Golfmetrics). Brackets interpolate (and past 15, extrapolate) between them,
// placing a tour pro at +5 and a 90-golfer at a 15 index — assumptions, since
// Broadie reports by scoring average, not handicap. The fairway table can't
// stand in: tee and fairway expectations differ, and scaled up it credited a
// 20-handicap drive ~0.4 strokes too much (#998).
export function teeBaseline(bracket: HandicapBracket, distanceYards: number): number | null {
  if (!Number.isFinite(distanceYards)) return null
  const w = (bracket + 5) / 20
  return 2.38 + 0.41 * w + (0.0041 + 0.0025 * w) * distanceYards
}

export function getHandicapBracket(handicap: number): HandicapBracket {
  if (handicap <= 2) return 0
  if (handicap <= 7) return 5
  if (handicap <= 12) return 10
  if (handicap <= 17) return 15
  if (handicap <= 22) return 20
  if (handicap <= 27) return 25
  return 30
}

// Returns `null` when distance is NaN/Infinity. The previous behavior
// silently returned NaN (via `[undefined] + ratio * (...)`), which then
// got stored on hole_scores.sg_* as a literal Postgres NaN — corrupting
// stats forever. Callers already propagate null via getExpectedStrokes.
export function interpolateBaseline(
  table: Record<number, number>,
  distance: number,
): number | null {
  if (!Number.isFinite(distance)) return null
  const keys = Object.keys(table)
    .map(Number)
    .sort((a, b) => a - b)
  if (keys.length === 0) {
    throw new Error('Baseline table is empty')
  }
  const first = keys[0]!
  const last = keys[keys.length - 1]!
  if (distance <= first) return table[first]!
  if (distance >= last) return table[last]!
  const lower = keys.filter((k) => k <= distance).at(-1)!
  const upper = keys.find((k) => k > distance)!
  const ratio = (distance - lower) / (upper - lower)
  return table[lower]! + ratio * (table[upper]! - table[lower]!)
}
