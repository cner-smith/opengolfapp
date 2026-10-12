// The live round's ball: where "Mark my ball" puts the next shot's start.
// One reducer owns the rule so every path (GPS, drag, OB, save, hole change)
// answers the same question the same way (#1107).
import { createKalmanState, updateKalman, type KalmanState } from './kalman'

export interface LatLng {
  lat: number
  lng: number
}

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
  | { type: 'placed'; at: LatLng }
  | { type: 'shotSaved' }
  | { type: 'obSet'; start: LatLng }
  | { type: 'obUndone' }
  /** "Put the ball on my GPS spot"; `at` is the app's GPS position when no fresh fix has come in yet. */
  | { type: 'recenter'; at?: LatLng }
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
      return { ...state, ball: event.at, source: 'hand', kalman: { ...event.at, variance: 1 } }
    case 'shotSaved':
      return followGps(state)
    case 'obSet':
      // Stroke and distance: the replay is played from where the OB shot was.
      return { ...state, ball: event.start, source: 'replay', kalman: { ...event.start, variance: 1 } }
    case 'obUndone':
      return followGps(state)
    case 'recenter':
      return followGps({ ...state, gps: event.at ?? state.gps })
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
