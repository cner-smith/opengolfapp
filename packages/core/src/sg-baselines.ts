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

export const APPROACH_BASELINES: Record<HandicapBracket, Record<number, number>> = {
  0: { 50: 2.6, 75: 2.72, 100: 2.85, 125: 2.98, 150: 3.12, 175: 3.24, 200: 3.35, 225: 3.45 },
  5: { 50: 2.75, 75: 2.9, 100: 3.05, 125: 3.2, 150: 3.36, 175: 3.5, 200: 3.63, 225: 3.75 },
  10: { 50: 2.92, 75: 3.1, 100: 3.28, 125: 3.46, 150: 3.64, 175: 3.8, 200: 3.95, 225: 4.08 },
  15: { 50: 3.1, 75: 3.32, 100: 3.54, 125: 3.74, 150: 3.95, 175: 4.13, 200: 4.29, 225: 4.44 },
  20: { 50: 3.3, 75: 3.56, 100: 3.82, 125: 4.05, 150: 4.28, 175: 4.48, 200: 4.66, 225: 4.82 },
  25: { 50: 3.52, 75: 3.82, 100: 4.12, 125: 4.38, 150: 4.63, 175: 4.85, 200: 5.05, 225: 5.22 },
  30: { 50: 3.76, 75: 4.1, 100: 4.44, 125: 4.74, 150: 5.01, 175: 5.25, 200: 5.47, 225: 5.66 },
}

export const AROUND_GREEN_BASELINES: Record<HandicapBracket, Record<number, number>> = {
  0: { 5: 2.18, 10: 2.3, 15: 2.4, 20: 2.52, 30: 2.64 },
  5: { 5: 2.3, 10: 2.44, 15: 2.56, 20: 2.7, 30: 2.84 },
  10: { 5: 2.44, 10: 2.6, 15: 2.74, 20: 2.9, 30: 3.06 },
  15: { 5: 2.6, 10: 2.78, 15: 2.94, 20: 3.12, 30: 3.3 },
  20: { 5: 2.78, 10: 2.98, 15: 3.16, 20: 3.36, 30: 3.56 },
  25: { 5: 2.98, 10: 3.2, 15: 3.4, 20: 3.62, 30: 3.84 },
  30: { 5: 3.2, 10: 3.44, 15: 3.66, 20: 3.9, 30: 4.14 },
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

export function interpolateBaseline(
  table: Record<number, number>,
  distance: number,
): number {
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
