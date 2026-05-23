import type {
  Club,
  Facility,
  Goal,
  LieSlope,
  LieSlopeForward,
  LieSlopeSide,
  LieType,
  ShotCategory,
  ShotResult,
  SkillLevel,
} from './constants'

export type DistanceUnit = 'yards' | 'meters'

export type GreenSpeed = 'slow' | 'medium' | 'fast'

// Canonical 7-value vocabulary matching shots.break_direction in the DB.
// `left` / `right` are legacy single-letter values from pre-split rows;
// new code writes one of the explicit five.
/** @deprecated Use {@link BreakDirectionVertical} and
 *  {@link BreakDirectionHorizontal} — break direction is two independent
 *  axes (slope + line), not one. */
export type BreakDirection =
  | 'left'
  | 'right'
  | 'straight'
  | 'left_to_right'
  | 'right_to_left'
  | 'uphill'
  | 'downhill'

// Two independent axes for shots.break_direction_vertical and
// shots.break_direction_horizontal (migration 0028). A putt can break
// both up/down AND L→R / R→L on the same line; the legacy
// BreakDirection enum collapsed that into one value, losing half the
// information. Either axis can be null when the player skipped it.
export type BreakDirectionVertical = 'uphill' | 'downhill' | 'flat'
export type BreakDirectionHorizontal = 'left_to_right' | 'right_to_left' | 'straight'

export type PuttDistanceResult = 'short' | 'long'
export type PuttDirectionResult = 'left' | 'right'

// Shot-result quality lookup used by stats heuristics (most costly lies,
// slope impact, etc.). Lower = worse outcome. Domain constant — not a
// view-config map; UI labels live in SHOT_RESULT_LABELS.
//
// Keyed on ShotResult so adding/removing a value in SHOT_RESULTS without
// updating this map is a compile error rather than silently degrading
// stats: an unknown shot_result would have read `undefined` here, used
// as 0 via `?? 0` in stats.ts, neutralising the row.
export const RESULT_QUALITY: Record<ShotResult, number> = {
  solid: 1,
  push_right: 0,
  pull_left: 0,
  fat: -1,
  thin: -1,
  topped: -1,
  shank: -1,
  penalty: -1,
  ob: -1,
}

export interface Profile {
  id: string
  username: string
  handicapIndex: number
  skillLevel: SkillLevel
  goal: Goal
  playFrequency: string
  facilities: Facility[]
  playStyle: 'casual' | 'mixed' | 'competitive'
  createdAt: string
}

export interface Course {
  id: string
  name: string
  location?: string
  mapboxId?: string
}

export interface Hole {
  id: string
  courseId: string
  number: number
  par: number
  yards?: number
  strokeIndex?: number
  teeLat?: number
  teeLng?: number
  pinLat?: number
  pinLng?: number
}

export interface Round {
  id: string
  userId: string
  courseId: string
  playedAt: string
  teeColor?: string
  totalScore?: number
  totalPutts?: number
  fairwaysHit?: number
  fairwaysTotal?: number
  gir?: number
  sgOffTee?: number
  sgApproach?: number
  sgAroundGreen?: number
  sgPutting?: number
  sgTotal?: number
  notes?: string
}

export interface HoleScore {
  id: string
  roundId: string
  holeId: string
  score: number
  putts?: number
  fairwayHit?: boolean
  gir?: boolean
  sgOffTee?: number
  sgApproach?: number
  sgAroundGreen?: number
  sgPutting?: number
}

export interface Shot {
  id: string
  holeScoreId: string
  userId: string
  shotNumber: number
  startLat?: number
  startLng?: number
  endLat?: number
  endLng?: number
  aimLat?: number
  aimLng?: number
  distanceToTarget?: number
  club?: Club
  lieType?: LieType
  /** @deprecated read-only on legacy rows; new writes use lieSlopeForward + lieSlopeSide. */
  lieSlope?: LieSlope
  lieSlopeForward?: LieSlopeForward
  lieSlopeSide?: LieSlopeSide
  shotResult?: ShotResult
  penalty?: boolean
  ob?: boolean
  aimOffsetYards?: number
  breakDirection?: BreakDirection
  /** @deprecated combined value retained for back-compat reads. New code
   *  uses puttMade + puttDistanceResult + puttDirectionResult — three
   *  independent dimensions. */
  puttResult?: 'made' | 'short' | 'long' | 'missed_left' | 'missed_right'
  puttMade?: boolean
  puttDistanceResult?: PuttDistanceResult
  puttDirectionResult?: PuttDirectionResult
  puttDistanceFt?: number
  puttSlopePct?: number
  greenSpeed?: GreenSpeed
  notes?: string
}

export type LegacyPuttResult =
  | 'made'
  | 'short'
  | 'long'
  | 'missed_left'
  | 'missed_right'

/** Reconstruct legacy putt_result from the three new putting axes so
 *  writers can keep the legacy column populated for back-compat. */
export function combinedPuttResult(args: {
  made?: boolean
  distance?: PuttDistanceResult | null
  direction?: PuttDirectionResult | null
}): LegacyPuttResult | null {
  if (args.made) return 'made'
  if (args.distance === 'short') return 'short'
  if (args.distance === 'long') return 'long'
  if (args.direction === 'left') return 'missed_left'
  if (args.direction === 'right') return 'missed_right'
  return null
}

/** Inverse of combinedPuttResult — render a human-readable label from
 *  the two miss axes. Returns '' when both are null (e.g. line + pace
 *  were both fine). */
export function decombinedPuttResult(
  distance: PuttDistanceResult | null,
  direction: PuttDirectionResult | null,
): string {
  const parts: string[] = []
  if (distance === 'short') parts.push('Short')
  else if (distance === 'long') parts.push('Long')
  if (direction === 'left') parts.push('Missed left')
  else if (direction === 'right') parts.push('Missed right')
  return parts.join(', ')
}

/** Reconstruct legacy break_direction from the two new axes so writers
 *  can keep the legacy column populated for back-compat. When both axes
 *  are set, prefers horizontal — the more frequently-diagnostic axis
 *  for putt line correction. `flat` vertical has no legacy equivalent
 *  and is dropped if horizontal carries information.
 *  Mirrors {@link combinedPuttResult} above. */
export function combinedBreakDirection(args: {
  vertical?: BreakDirectionVertical | null
  horizontal?: BreakDirectionHorizontal | null
}): BreakDirection | null {
  if (args.horizontal === 'left_to_right') return 'left_to_right'
  if (args.horizontal === 'right_to_left') return 'right_to_left'
  if (args.horizontal === 'straight') return 'straight'
  if (args.vertical === 'uphill') return 'uphill'
  if (args.vertical === 'downhill') return 'downhill'
  return null
}

/** Inverse of {@link combinedBreakDirection} — decompose a legacy
 *  BreakDirection value into the two new axes for the read-path
 *  fallback. Legacy single-letter `left` / `right` map onto the
 *  break-from→to vocabulary the same way `mapBreakDirection()` in
 *  round.ts does (left = breaks right-to-left, right = breaks
 *  left-to-right). */
export function decombinedBreakDirection(
  legacy: BreakDirection | null | undefined,
): {
  vertical: BreakDirectionVertical | null
  horizontal: BreakDirectionHorizontal | null
} {
  switch (legacy) {
    case 'uphill':
      return { vertical: 'uphill', horizontal: null }
    case 'downhill':
      return { vertical: 'downhill', horizontal: null }
    case 'left_to_right':
      return { vertical: null, horizontal: 'left_to_right' }
    case 'right_to_left':
      return { vertical: null, horizontal: 'right_to_left' }
    case 'straight':
      return { vertical: null, horizontal: 'straight' }
    case 'left':
      return { vertical: null, horizontal: 'right_to_left' }
    case 'right':
      return { vertical: null, horizontal: 'left_to_right' }
    default:
      return { vertical: null, horizontal: null }
  }
}

export interface SGBreakdown {
  offTee: number
  approach: number
  aroundGreen: number
  putting: number
  total: number
}

export interface FocusArea {
  category: ShotCategory
  priority: number
  sgValue: number
  insight: string
}

export interface PlanDrill {
  drillId: string
  name: string
  durationMin: number
  facility: string
  category: string
  description: string
  reason: string
}

export interface PracticePlan {
  id: string
  userId: string
  generatedAt: string
  validUntil: string
  basedOnRounds: number
  focusAreas: FocusArea[]
  drills: PlanDrill[]
  aiInsight: string
  completedDrillIds: string[]
}

export interface Drill {
  id: string
  name: string
  description: string
  durationMin: number
  category: string
  facility: string[]
  skillLevels: SkillLevel[]
  instructions: string
}
