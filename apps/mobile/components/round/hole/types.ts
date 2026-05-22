// Live-round state machine. Each shot loops through:
//   PLACE_BALL → SET_AIM → SHOT_DETAIL → PLACE_BALL    (off the green)
//   PLACE_BALL → PUTTING → PLACE_BALL                  (within ~30 yd of pin)
// PLACE_BALL: GPS auto-places ball, player drags to refine, confirms with
//   "Mark ball here →".
// SET_AIM: camera rotates so play direction is up; long-press drops aim.
// SHOT_DETAIL: ShotLogger sheet open; save returns to PLACE_BALL.
// PUTTING: PuttingSheet open with green diagram; save returns to PLACE_BALL
//   (player loops here for each successive putt).
export type RoundState = 'PLACE_BALL' | 'SET_AIM' | 'SHOT_DETAIL' | 'PUTTING'

// Mutually exclusive confirm dialog for the live-round screen. Only one
// can be on screen at a time by construction — solves the "back button
// only closes the topmost" race on Android (#293) and preempts iOS
// UIKit's "one presented modal per presenter" silent-failure (which
// drops the second modal with a console warning rather than crashing).
export type ActiveDialog =
  | 'delete'    // Delete round confirm
  | 'leave'     // Leave round confirm
  | 'end'       // End round confirm
  | 'exit'      // Exit live mode (from error state) confirm
  | 'onGreen'   // "On the green?" prompt
  | 'aim'       // "Set aim point?" prompt
  | null

// Subset cleared on hole change. The other members are session-level —
// a delete/leave/end/exit confirm mid-navigation stays open. Named so
// the per-hole reset effect and the union stay in sync if a future
// dialog is added.
export const HOLE_SCOPED_DIALOGS: ReadonlySet<ActiveDialog> = new Set([
  'onGreen',
  'aim',
])

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
