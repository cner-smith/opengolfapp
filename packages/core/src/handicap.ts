// World Handicap System (WHS) mechanics — in effect since January 2020.
//
// - calculateDifferential: per-round score differential from adjusted
//   score, course rating, slope rating. Rounded to one decimal per
//   USGA Rule 5.1.
// - calculateHandicapIndex: averages the lowest N differentials per
//   the WHS table (Rule 5.2a) and applies the low-round adjustment.
//   Replaces the legacy 0.96 multiplier — WHS does not use one.
// - adjustedScore: net double bogey (Rule 3.1) caps each hole's score
//   at par + 2 + the strokes the player receives on it.
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

export interface AdjustHole {
  score: number
  par: number
  strokeIndex?: number | null
}

// Net double bogey (WHS Rule 3.1): each hole is capped at par + 2 + the
// strokes received there. Strokes come from the Course Handicap (Rule 6.1:
// index × slope/113 + rating − par; a 9-hole round uses half the index),
// allocated by stroke index (Rule 6.2) — plus handicaps give strokes back on
// the highest-index holes. Without a stroke index on every hole the
// allocation is unknown, so each hole gets the average share, CH / holes
// (unrounded): over the round that is exactly the Course Handicap, so the
// adjusted total is biased neither up nor down. Rounding it down instead
// capped a 15-handicap at par + 2 on every hole (#670 review).
export function adjustedScore(
  holes: AdjustHole[],
  handicapIndex: number,
  tee: { courseRating: number; slopeRating: number },
): number {
  const n = holes.length
  if (n === 0) return 0
  const par = holes.reduce((t, h) => t + h.par, 0)
  const index = n <= 9 ? handicapIndex / 2 : handicapIndex
  const ch = Math.round((index * tee.slopeRating) / 113 + (tee.courseRating - par))
  const base = Math.floor(ch / n)
  const extra = ((ch % n) + n) % n
  const withSi = holes.every((h) => h.strokeIndex != null)
  const rank = new Map(
    [...holes].sort((a, b) => a.strokeIndex! - b.strokeIndex!).map((h, i) => [h, i + 1] as const),
  )
  return holes.reduce((total, h) => {
    const strokes = withSi ? base + (rank.get(h)! <= extra ? 1 : 0) : ch / n
    return total + Math.min(h.score, h.par + 2 + strokes)
  }, 0)
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

// A handicap index as golfers write it: one decimal, and a plus handicap
// (better than scratch, stored as a negative index) with a leading plus.
export function formatHandicapIndex(index: number): string {
  const tenths = Math.round(index * 10) / 10
  return tenths < 0 ? `+${(-tenths).toFixed(1)}` : Math.abs(tenths).toFixed(1)
}

// The inverse, for a typed index: "+2.3" is a plus handicap (-2.3), a
// comma reads as the decimal point, and the result is rounded to tenths.
export function parseHandicapIndex(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) return null
  const n = Math.round(Math.abs(Number(t)) * 10) / 10
  return t.startsWith('+') || t.startsWith('-') ? -n || 0 : n
}

// A handicap in a sentence, to the whole stroke: "a 12-handicap", "a +2-handicap".
export function formatWholeHandicap(index: number): string {
  const n = Math.round(index)
  return n < 0 ? `+${-n}` : String(Math.abs(n))
}

// A handicap field as the profile forms hold it: the number as typed, and
// the plus-handicap toggle that sets its sign (a plus is stored negative).
export type HandicapIndexField = { text: string; plus: boolean }

// The field for a stored index: a plus 2 is the toggle on and "2.0".
export function handicapIndexField(index: number | null | undefined): HandicapIndexField {
  if (index == null) return { text: '', plus: false }
  const tenths = Math.round(index * 10) / 10
  return { text: Math.abs(tenths).toFixed(1), plus: tenths < 0 }
}

// What the field saves: blank clears the index, otherwise the number must
// parse and sit in the stored range (-10, a plus 10, to 54: the 0012 check).
// A sign left in the text ("+2", or the stored form "-2") also means plus.
export function readHandicapIndexField(
  field: HandicapIndexField,
): { index: number | null } | { error: string } {
  if (field.text.trim() === '') return { index: null }
  const n = parseHandicapIndex(field.text)
  if (n === null) return { error: 'Handicap must be a number' }
  const index = field.plus || n < 0 ? -Math.abs(n) || 0 : n
  if (index < -10 || index > 54) return { error: 'Handicap must be between +10 and 54' }
  return { index }
}

// Whether the field would save something other than the stored index
// ("13" over a stored 13 is not an edit; text that can't save is).
export function handicapIndexEdited(
  field: HandicapIndexField,
  index: number | null | undefined,
): boolean {
  const read = readHandicapIndexField(field)
  return 'error' in read || read.index !== (index ?? null)
}

// A sign typed into the number ("+2", on keyboards that have one) asks for
// the plus toggle; the field keeps the number alone.
export function typedHandicapSign(text: string): { text: string; plus: boolean } {
  const signed = /^\s*[+-]/.test(text)
  return { text: signed ? text.replace(/^\s*[+-]/, '') : text, plus: signed }
}

// The plus-handicap toggle. Most golfers aren't plus, so the first turn-on
// asks first, unless the stored index is already a plus handicap.
export type PlusHandicapToggle = { plus: boolean; asking: boolean; confirmed: boolean }

export function plusHandicapToggle(index: number | null | undefined): PlusHandicapToggle {
  const plus = handicapIndexField(index).plus
  return { plus, asking: false, confirmed: plus }
}

export function stepPlusHandicap(
  toggle: PlusHandicapToggle,
  action: 'on' | 'off' | 'confirm' | 'cancel',
): PlusHandicapToggle {
  switch (action) {
    case 'on':
      if (toggle.plus) return toggle
      return toggle.confirmed ? { ...toggle, plus: true } : { ...toggle, asking: true }
    case 'off':
      return { ...toggle, plus: false, asking: false }
    case 'confirm':
      return { plus: true, asking: false, confirmed: true }
    case 'cancel':
      return { ...toggle, asking: false }
  }
}

// The number when the plus toggle turns on. A number past the plus end
// (the 28 a casual golfer starts on) lands on 1, a plus 1, not the +10 cap:
// plus handicaps are mostly low, and 1 keeps the sign where 0 would be scratch.
export function plusStartNumber(n: number): number {
  const m = Math.abs(n)
  return m > 10 ? 1 : m
}

// The same for the typed field; text that isn't a number is left alone.
export function plusStartText(text: string): string {
  const n = parseHandicapIndex(text)
  return n !== null && Math.abs(n) > 10 ? plusStartNumber(n).toFixed(1) : text
}

export const PLUS_HANDICAP_QUESTION = 'Turn on plus handicap?'
export const PLUS_HANDICAP_EXPLAINER =
  'A plus handicap is better than scratch: a +2 shoots about 2 under par on a good day. Most golfers have a regular handicap.'
