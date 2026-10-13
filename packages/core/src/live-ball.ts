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
  /** A shot was saved and GPS hasn't moved since: its fix is still the old spot. */
  awaitingFix: boolean
  /** Where GPS was when the shot was saved. */
  savedGps: LatLng | null
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

export const initialLiveBall: LiveBallState = { ball: null, source: 'gps', gps: null, awaitingFix: false, savedGps: null }

export function liveBall(state: LiveBallState, event: LiveBallEvent): LiveBallState {
  switch (event.type) {
    case 'fix': {
      // The ball is the raw fix, not a smoothed one: it shows where Mark will save.
      const gps = { lat: event.lat, lng: event.lng }
      // GPS restarts after each save and re-sends the spot the player still
      // stands on: only a move past the 1 m GPS filter is a new spot.
      const awaitingFix =
        state.awaitingFix && state.savedGps != null && moveYards(state.savedGps, gps) < MOVED_YD
      return { ...state, gps, awaitingFix, ball: state.source === 'gps' ? gps : state.ball }
    }
    case 'placed':
      return { ...state, ball: event.at, source: 'hand' }
    case 'marked':
      return { ...state, ball: event.at }
    case 'shotSaved':
      return { ...followGps(state), awaitingFix: true, savedGps: state.gps }
    case 'obSet':
      // Stroke and distance: the replay is played from where the OB shot was.
      return { ...state, ball: event.start, source: 'replay' }
    case 'obUndone':
      return followGps(state)
    case 'recenter':
      return followGps({ ...state, gps: event.at, awaitingFix: false })
    case 'holeChanged':
      return initialLiveBall
    case 'teeDefault':
      return state.ball ? state : { ...state, ball: event.tee }
  }
}

const MOVED_YD = 1.1 // 1 m

function moveYards(a: LatLng, b: LatLng): number {
  return haversineYards(a.lat, a.lng, b.lat, b.lng)
}

function followGps(state: LiveBallState): LiveBallState {
  return { ...state, source: 'gps', ball: state.gps ?? state.ball }
}

/** Where "Mark my ball" puts the shot's start: a held spot as placed, otherwise
 *  the latest GPS fix. None while awaiting a fix after a save (#1108). */
export function markSpot(state: LiveBallState): LatLng | null {
  if (state.source !== 'gps') return state.ball
  return state.awaitingFix ? null : (state.gps ?? state.ball)
}
