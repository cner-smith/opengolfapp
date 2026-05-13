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
