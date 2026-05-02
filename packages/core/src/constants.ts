// Stand-in handicap when a profile hasn't filled one in yet. Picked as
// the rough median of US recreational golfers (USGA mid-handicap)
// so SG baselines and bracket lookups don't degenerate to scratch
// or 30+ for a brand-new user. NEVER store this — only use as a
// transient calc input.
export const DEFAULT_HANDICAP = 15

export const CLUBS = [
  'driver',
  '3w',
  '5w',
  '7w',
  '3h',
  '4h',
  '5h',
  '2i',
  '3i',
  '4i',
  '5i',
  '6i',
  '7i',
  '8i',
  '9i',
  'pw',
  'gw',
  'sw',
  'lw',
  'putter',
] as const

export const LIE_TYPES = [
  'tee',
  'fairway',
  'rough',
  'sand',
  'fringe',
  'recovery',
  'green',
] as const

/** @deprecated retained for migration reads; new code uses
 *  LIE_SLOPES_FORWARD + LIE_SLOPES_SIDE so a lie can have both at once. */
export const LIE_SLOPES = [
  'level',
  'uphill',
  'downhill',
  'ball_above',
  'ball_below',
] as const

export const LIE_SLOPES_FORWARD = ['uphill', 'level', 'downhill'] as const

export const LIE_SLOPES_SIDE = ['ball_above', 'ball_below'] as const

export const SHOT_RESULTS = [
  'solid',
  'push_right',
  'pull_left',
  'fat',
  'thin',
  'shank',
  'topped',
  'penalty',
  'ob',
] as const

export const SKILL_LEVELS = ['beginner', 'casual', 'developing', 'competitive'] as const

export const GOALS = ['break_100', 'break_90', 'break_80', 'break_70s', 'scratch'] as const

export const FACILITIES = ['range', 'short_game', 'putting', 'sim'] as const

export const SHOT_CATEGORIES = ['off_tee', 'approach', 'around_green', 'putting'] as const

// ---------------------------------------------------------------------------
// Display label maps. Stored values stay snake_case + lowercase so the DB
// constraints don't break; render code looks the labels up here so the UI
// reads naturally and falls back to the raw value when something
// unexpected lands in the column.
// ---------------------------------------------------------------------------

export type Club = (typeof CLUBS)[number]
export type LieType = (typeof LIE_TYPES)[number]
/** @deprecated kept for legacy reads; new code uses LieSlopeForward + LieSlopeSide. */
export type LieSlope = (typeof LIE_SLOPES)[number]
export type LieSlopeForward = (typeof LIE_SLOPES_FORWARD)[number]
export type LieSlopeSide = (typeof LIE_SLOPES_SIDE)[number]
export type ShotResult = (typeof SHOT_RESULTS)[number]
export type SkillLevel = (typeof SKILL_LEVELS)[number]
export type Goal = (typeof GOALS)[number]
export type Facility = (typeof FACILITIES)[number]
export type ShotCategory = (typeof SHOT_CATEGORIES)[number]

// Local types for the label maps below. BreakDirection / LegacyPuttResult
// are mirrored in types.ts (which can't import from this file in the
// reverse direction without a cycle); the union duplication is small
// and locks the label maps to the exact set the DB enum allows.
type BreakDirectionKey =
  | 'left'
  | 'right'
  | 'straight'
  | 'left_to_right'
  | 'right_to_left'
  | 'uphill'
  | 'downhill'

type LegacyPuttResultKey =
  | 'made'
  | 'short'
  | 'long'
  | 'missed_left'
  | 'missed_right'

// Adding a new value in BREAK_DIRECTION (etc.) without adding its label
// is now a compile error — the previous Record<string, string> typing
// silently rendered the raw enum value when a key was missing.
export const BREAK_DIRECTION_LABELS: Record<BreakDirectionKey, string> = {
  left_to_right: 'L → R',
  right_to_left: 'R → L',
  straight: 'Straight',
  uphill: 'Uphill',
  downhill: 'Downhill',
  // Legacy single-letter values from pre-split rows.
  left: 'L → R',
  right: 'R → L',
}

export const PUTT_RESULT_LABELS: Record<LegacyPuttResultKey, string> = {
  made: 'Made',
  short: 'Short',
  long: 'Long',
  missed_left: 'Missed left',
  missed_right: 'Missed right',
}

export const SHOT_RESULT_LABELS: Record<ShotResult, string> = {
  solid: 'Solid',
  push_right: 'Push right',
  pull_left: 'Pull left',
  fat: 'Fat',
  thin: 'Thin',
  shank: 'Shank',
  topped: 'Topped',
  penalty: 'Penalty',
  ob: 'OB',
}

export const LIE_TYPE_LABELS: Record<LieType, string> = {
  tee: 'Tee',
  fairway: 'Fairway',
  rough: 'Rough',
  sand: 'Sand',
  fringe: 'Fringe',
  recovery: 'Recovery',
  green: 'Green',
}
