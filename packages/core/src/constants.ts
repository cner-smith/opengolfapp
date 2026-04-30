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
