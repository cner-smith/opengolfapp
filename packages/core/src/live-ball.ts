// The live round's ball: where "Mark my ball" puts the next shot's start.
// One reducer owns the rule so every path (GPS, drag, OB, save, hole change)
// answers the same question the same way (#1107).
import type { GeoPoint } from './shot-dispersion-geo'
import { haversineYards } from './units'

type LatLng = GeoPoint

/** gps: the ball follows GPS. hand: the player placed it. replay: the OB shot's start. */
export type BallSource = 'gps' | 'hand' | 'replay'

export interface LiveBallState {
  ball: LatLng | null
  source: BallSource
  /** Latest fresh GPS fix, kept so GPS can take the ball back. */
  gps: LatLng | null
  /** The start of the last shot saved on this hole. */
  savedStart: LatLng | null
}

export type LiveBallEvent =
  | { type: 'fix'; lat: number; lng: number }
  /** The player dragged or tapped the ball: it holds there until the shot is saved. */
  | { type: 'placed'; at: LatLng }
  /** Mark pins the start for the aim / putting step; it doesn't change where the ball comes from. */
  | { type: 'marked'; at: LatLng }
  | { type: 'shotSaved'; start: LatLng }
  | { type: 'obSet'; start: LatLng }
  | { type: 'obUndone' }
  /** "Put the ball on my GPS spot": `at` is where the player's GPS dot is. */
  | { type: 'recenter'; at: LatLng }
  | { type: 'holeChanged' }
  /** Shot 1's starting spot before any fix arrives. */
  | { type: 'teeDefault'; tee: LatLng }

export const initialLiveBall: LiveBallState = { ball: null, source: 'gps', gps: null, savedStart: null }

export function liveBall(state: LiveBallState, event: LiveBallEvent): LiveBallState {
  switch (event.type) {
    case 'fix': {
      // The ball is the raw fix, not a smoothed one: it shows where Mark will save.
      const gps = { lat: event.lat, lng: event.lng }
      return { ...state, gps, ball: state.source === 'gps' ? gps : state.ball }
    }
    case 'placed':
      return { ...state, ball: event.at, source: 'hand' }
    case 'marked':
      return { ...state, ball: event.at }
    case 'shotSaved':
      return { ...followGps(state), savedStart: event.start }
    case 'obSet':
      // Stroke and distance: the replay is played from where the OB shot was.
      return { ...state, ball: event.start, source: 'replay' }
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

// The app's GPS filter (setMinDisplacement(1), useHoleState): a smaller move never arrives.
const MOVED_YD = 1.094 // 1 m

function followGps(state: LiveBallState): LiveBallState {
  return { ...state, source: 'gps', ball: state.gps ?? state.ball }
}

/** After a save, GPS still reads the saved start (or nothing): it restarts
 *  after each save and re-sends the spot the player stands on (#1108). */
export function awaitingNewSpot(state: LiveBallState): boolean {
  const { source, savedStart: s, gps } = state
  if (source !== 'gps' || !s) return false
  return !gps || haversineYards(s.lat, s.lng, gps.lat, gps.lng) < MOVED_YD
}

/** Where "Mark my ball" puts the shot's start: a held spot as placed, otherwise
 *  the latest GPS fix; none while awaiting a new spot after a save. */
export function markSpot(state: LiveBallState): LatLng | null {
  if (state.source !== 'gps') return state.ball
  return awaitingNewSpot(state) ? null : (state.gps ?? state.ball)
}
