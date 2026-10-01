import type {
  BreakDirectionHorizontal,
  BreakDirectionVertical,
  Club,
  GreenSpeed,
  LieSlopeForward,
  LieSlopeSide,
  LieType,
  PuttDirectionResult,
  PuttDistanceResult,
  ShotResult,
} from '@oga/core'

// Live-round state machine. Each shot loops through:
//   PLACE_BALL → SET_AIM → PLACE_BALL                  (off the green)
//   PLACE_BALL → PUTTING → PLACE_BALL                  (within ~30 yd of pin)
// PLACE_BALL: GPS auto-places ball, player drags to refine, confirms with
//   "Mark ball here →".
// SET_AIM: camera rotates so play direction is up; long-press drops aim.
// PUTTING: Made / Missed keys in the dock; save returns to PLACE_BALL
//   (player loops here for each successive putt).
// SUMMARY: end-of-hole review sheet (HoleReviewSheet) open — the player
//   confirms/annotates every placed shot's club/lie/result + putt read, then
//   save writes the metadata + hole_scores and advances. Shots are logged
//   location-only during play; their details are captured here (#791).
export type RoundState =
  | 'PLACE_BALL'
  | 'SET_AIM'
  | 'PUTTING'
  | 'SUMMARY'

// Mutually exclusive confirm dialog for the live-round screen. Only one
// can be on screen at a time by construction — solves the "back button
// only closes the topmost" race on Android (#293) and preempts iOS
// UIKit's "one presented modal per presenter" silent-failure (which
// drops the second modal with a console warning rather than crashing).
export type ActiveDialog =
  | 'delete'    // Delete round confirm
  | 'leave'     // Leave round confirm
  | 'end'       // End round confirm
  | 'unfinished' // Last hole to play, but others aren't finished (#940)
  | 'exit'      // Exit live mode (from error state) confirm
  | null

export const FALLBACK_CENTER = { lat: 40.0, lng: -75.0 } as const
export const PIN_PROMPT_RADIUS_YARDS = 80

// Distance threshold where the workflow asks about putting.
// 30 yards lines up with the SG "around-green" boundary; once a player
// is inside that radius they're on or chipping near the green.
export const PUTTING_RADIUS_YARDS = 30

export const KICKER: import('react-native').TextStyle = {
  fontSize: 10,
  fontWeight: '600',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

// Metadata persistShot attaches to a shot (null = location only).
export interface ShotLoggerValue {
  club?: Club
  lieType?: LieType
  lieSlopeForward?: LieSlopeForward
  lieSlopeSide?: LieSlopeSide
  shotResult?: ShotResult
  puttMade?: boolean
  puttDistanceResult?: 'short' | 'long'
  puttDirectionResult?: 'left' | 'right'
  puttDistanceFt?: number
  puttSlopePct?: number
  greenSpeed?: GreenSpeed
  breakDirectionVertical?: BreakDirectionVertical
  breakDirectionHorizontal?: BreakDirectionHorizontal
  aimOffsetInches?: number
  notes?: string
}

export interface PuttingValue {
  puttDistanceFt?: number
  puttMade?: boolean
  puttDistanceResult?: PuttDistanceResult
  puttDirectionResult?: PuttDirectionResult
  breakDirectionVertical?: BreakDirectionVertical
  breakDirectionHorizontal?: BreakDirectionHorizontal
  puttSlopePct?: number // 0-4 intensity bucket
  greenSpeed?: GreenSpeed
  aimOffsetInches?: number
  notes?: string
}
