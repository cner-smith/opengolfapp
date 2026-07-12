// Stand-in handicap when a profile hasn't filled one in yet. Picked as
// the rough median of US recreational golfers (USGA mid-handicap)
// so SG baselines and bracket lookups don't degenerate to scratch
// or 30+ for a brand-new user. NEVER store this — only use as a
// transient calc input.
export const DEFAULT_HANDICAP = 15

// Distance-to-target threshold splitting "approach" from "around green"
// for SG categorisation, lie inference, and stats bucketing. Keep the
// three uses (sg-calculator, stats, shotInference) on the same number
// so a shot can't be SG-classified one way and stats-bucketed another.
export const NEAR_GREEN_YARDS = 30

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

// Functional categories used by the bag-setup picklist UI. The free-text
// `name` field captures sub-type (mini driver, chipper, attack wedge, etc).
export const CLUB_CATEGORIES = [
  'driver',
  'wood',
  'hybrid',
  'iron',
  'wedge',
  'utility',
  'putter',
] as const

export type ClubCategory = (typeof CLUB_CATEGORIES)[number]

export const CLUB_CATEGORY_LABELS: Record<ClubCategory, string> = {
  driver: 'Driver',
  wood: 'Wood',
  hybrid: 'Hybrid',
  iron: 'Iron',
  wedge: 'Wedge',
  utility: 'Utility',
  putter: 'Putter',
}

// Map a canonical club_type to its category for the picklist UI. Anything
// not matched here falls back to 'utility' — the catch-all for chippers,
// truly custom one-offs, etc.
export function clubCategoryFor(clubType: string): ClubCategory {
  if (clubType === 'driver') return 'driver'
  if (clubType === 'putter') return 'putter'
  if (clubType === 'mini_driver' || /^\d{1,2}w$/.test(clubType)) return 'wood'
  if (/^\d{1,2}h$/.test(clubType)) return 'hybrid'
  if (/^\d{1,2}i$/.test(clubType)) return 'iron'
  if (
    clubType === 'pw' ||
    clubType === 'gw' ||
    clubType === 'sw' ||
    clubType === 'lw' ||
    clubType === 'aw' ||
    clubType === 'cw' ||
    // Legacy: pre-rename rows from the dev-test phase of issue #164.
    // Kept so any user_clubs row written before the rename still maps
    // to the wedge category. New rows use 'cw'.
    clubType === 'custom_wedge'
  )
    return 'wedge'
  return 'utility'
}

// Canonical picklist options per category, surfaced by the bag UIs on
// web and mobile. Lives here (not in app code) so both apps stay in
// lockstep — adding a club_type to the picklist is a one-file edit.
//
// Wedges are name-based (pw → lw covers ~90% of players) plus a `cw`
// slot for grinds outside the standard set. The user captures the
// loft via the bag editor's loft field; the shot picker reads loft
// via formatClubLabel below so a cw chip reads "58°" rather than the
// raw "cw" string.
export const CANONICAL_CLUBS_BY_CATEGORY: Record<ClubCategory, readonly string[]> = {
  driver: ['driver'],
  wood: ['mini_driver', '2w', '3w', '4w', '5w', '7w', '9w', '11w', '13w'],
  hybrid: ['2h', '3h', '4h', '5h', '6h', '7h'],
  iron: ['1i', '2i', '3i', '4i', '5i', '6i', '7i', '8i', '9i'],
  wedge: ['pw', 'gw', 'aw', 'sw', 'lw', 'cw'],
  putter: ['putter'],
  utility: [],
}

// Picker label for a bag entry. Plain club_type for everything except
// the custom-wedge slot (`cw`, or legacy `custom_wedge`), where the
// loft (e.g. "58°") is the meaningful label. Falls back to the club's
// free-text name, then a literal "wedge" when no loft is set.
//
// Underscores in the club_type are rendered as spaces so multi-word
// types (mini_driver, etc.) read cleanly under the bag UI's uppercase
// kicker style — "MINI DRIVER" instead of "MINI_DRIVER".
//
// `opts.hasDuplicateType` lets callers disambiguate two clubs of the
// same `club_type` in the bag (issue #151) — when set and the club has
// a loft, the loft is appended in parens: "lw (58°)" vs "lw (60°)".
// `cw` / `custom_wedge` already render as "58°" so they ignore the flag.
export function formatClubLabel(
  c: {
    club_type: string
    name?: string | null
    loft?: number | null
  },
  opts: { hasDuplicateType?: boolean } = {},
): string {
  if (c.club_type === 'cw' || c.club_type === 'custom_wedge') {
    if (c.loft != null && Number.isFinite(c.loft)) return `${c.loft}°`
    const trimmed = c.name?.trim()
    if (trimmed) return trimmed
    return 'wedge'
  }
  const base = c.club_type.replace(/_/g, ' ')
  if (
    opts.hasDuplicateType &&
    c.loft != null &&
    Number.isFinite(c.loft)
  ) {
    return `${base} (${c.loft}°)`
  }
  return base
}

// Default 14-club starting bag seeded for new users when their bag is
// empty. 14 is the legal max under USGA rules; we drop the 4-hybrid
// (most amateurs carry either the 5w or the 4h, not both — keeping
// the 5w covers more bag profiles). Players can swap in /settings/bag.
export interface DefaultBagEntry {
  club_type: string
  name: string
  sort_order: number
}

export const DEFAULT_BAG: readonly DefaultBagEntry[] = [
  { club_type: 'driver', name: 'Driver', sort_order: 0 },
  { club_type: '3w', name: '3 Wood', sort_order: 1 },
  { club_type: '5w', name: '5 Wood', sort_order: 2 },
  { club_type: '5h', name: '5 Hybrid', sort_order: 3 },
  { club_type: '5i', name: '5 Iron', sort_order: 4 },
  { club_type: '6i', name: '6 Iron', sort_order: 5 },
  { club_type: '7i', name: '7 Iron', sort_order: 6 },
  { club_type: '8i', name: '8 Iron', sort_order: 7 },
  { club_type: '9i', name: '9 Iron', sort_order: 8 },
  { club_type: 'pw', name: 'Pitching Wedge', sort_order: 9 },
  { club_type: 'gw', name: 'Gap Wedge', sort_order: 10 },
  { club_type: 'sw', name: 'Sand Wedge', sort_order: 11 },
  { club_type: 'lw', name: 'Lob Wedge', sort_order: 12 },
  { club_type: 'putter', name: 'Putter', sort_order: 13 },
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

// Live-round capture mode (#791 step 3). 'track_patterns' prompts for an
// explicit aim per shot (dispersion data); 'just_track' records ball
// locations only — score + GPS distances, no aim. Column: rounds.capture_mode.
export const CAPTURE_MODES = ['just_track', 'track_patterns'] as const

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
export type CaptureMode = (typeof CAPTURE_MODES)[number]

export const CAPTURE_MODE_LABELS: Record<CaptureMode, { title: string; subtitle: string }> = {
  just_track: {
    title: 'Just track my round',
    subtitle: 'Score + GPS distances. Fastest — tap where the ball is, keep moving.',
  },
  track_patterns: {
    title: 'Track shot patterns',
    subtitle: 'Set an aim per shot to build your dispersion data.',
  },
}

// LegacyPuttResultKey mirrors LegacyPuttResult in types.ts (which can't
// import from this file without a cycle); the union duplication locks
// PUTT_RESULT_LABELS to the exact set the DB enum allows. Adding a new
// value without its label is a compile error — the previous
// Record<string, string> typing silently rendered the raw enum value
// when a key was missing.
type LegacyPuttResultKey =
  | 'made'
  | 'short'
  | 'long'
  | 'missed_left'
  | 'missed_right'

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
