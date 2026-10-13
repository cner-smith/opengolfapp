// The live round's ball: where "Mark my ball" puts the next shot's start.
// One reducer owns the rule so every path (GPS, drag, OB, save, hole change)
// answers the same question the same way (#1107).
import { createKalmanState, updateKalman, type KalmanState } from './kalman'
import type { GeoPoint } from './shot-dispersion-geo'

type LatLng = GeoPoint

/** gps: the ball follows GPS. hand: the player placed it. replay: the OB shot's start. */
export type BallSource = 'gps' | 'hand' | 'replay'

export interface LiveBallState {
  ball: LatLng | null
  source: BallSource
  /** Latest fresh GPS fix, kept so GPS can take the ball back. */
  gps: LatLng | null
  kalman: KalmanState | null
}

export type LiveBallEvent =
  | { type: 'fix'; lat: number; lng: number; accuracy?: number }
  /** The player dragged or tapped the ball: it holds there until the shot is saved. */
  | { type: 'placed'; at: LatLng }
  /** Mark pins the start for the aim / putting step; it doesn't change where the ball comes from. */
  | { type: 'marked'; at: LatLng }
  | { type: 'shotSaved' }
  | { type: 'obSet'; start: LatLng }
  | { type: 'obUndone' }
  /** "Put the ball on my GPS spot": `at` is where the player's GPS dot is. */
  | { type: 'recenter'; at: LatLng }
  | { type: 'holeChanged' }
  /** Shot 1's starting spot before any fix arrives. */
  | { type: 'teeDefault'; tee: LatLng }

export const initialLiveBall: LiveBallState = { ball: null, source: 'gps', gps: null, kalman: null }

export function liveBall(state: LiveBallState, event: LiveBallEvent): LiveBallState {
  switch (event.type) {
    case 'fix': {
      const gps = { lat: event.lat, lng: event.lng }
      if (state.source !== 'gps') return { ...state, gps }
      const point = { ...gps, accuracy: event.accuracy }
      const kalman = state.kalman ? updateKalman(state.kalman, point) : createKalmanState(point)
      return { ...state, gps, kalman, ball: { lat: kalman.lat, lng: kalman.lng } }
    }
    case 'placed':
      return { ...state, ball: event.at, source: 'hand', kalman: null }
    case 'marked':
      return { ...state, ball: event.at, kalman: null }
    case 'shotSaved':
      return followGps(state)
    case 'obSet':
      // Stroke and distance: the replay is played from where the OB shot was.
      return { ...state, ball: event.start, source: 'replay', kalman: null }
    case 'obUndone':
      return followGps(state)
    case 'recenter':
      return followGps({ ...state, gps: event.at })
    case 'holeChanged':
      return initialLiveBall
    case 'teeDefault':
      return state.ball ? state : { ...state, ball: event.tee }
  }
}

// GPS takes the ball back: it moves to the latest fix now, and the filter
// starts fresh from the next one (seeding it here would drag later fixes back).
function followGps(state: LiveBallState): LiveBallState {
  return { ...state, source: 'gps', kalman: null, ball: state.gps ?? state.ball }
}

/** Where "Mark my ball" puts the shot's start: a held spot as placed, otherwise
 *  the latest GPS fix, never the smoothed ball that trails behind it. */
export function markSpot(state: LiveBallState): LatLng | null {
  return state.source === 'gps' ? (state.gps ?? state.ball) : state.ball
}
