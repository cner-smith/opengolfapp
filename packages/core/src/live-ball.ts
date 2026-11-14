// The live round's ball: where "Mark my ball" puts the next shot's start.
// One reducer owns the rule so every path (GPS, drag, OB, save, hole change)
// answers the same question the same way (#1107).
import type { GeoPoint } from './shot-dispersion-geo'
import { isPuttShot, type CapturedShot } from './round'
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

// ---------------------------------------------------------------------------
// The live hole's shots: the server's rows and the phone's queue as one list.

/** A `shots` row as the live hole screen reads it (from the server or the offline cache). */
export interface LiveShotRow {
  id: string
  club: string | null
  lie_type: string | null
  start_lat: number | null
  start_lng: number | null
  ob: boolean | null
  putt_result: string | null
}

/** A shot on the live hole: where it was played from and what the round stored for it. */
export interface LiveHoleShot {
  id: string
  start: LatLng
  ob: boolean
  captured: CapturedShot
}

export interface LiveHoleShots {
  /** Shots with a start and an id: server rows (in shot_number order), then queued ones
   *  (in queue order). The map, the stepper, the OB key and the review all index this
   *  one list, so a shot's start, id and OB flag can't drift apart (#839). */
  shots: LiveHoleShot[]
  /** Every stored row, with a start or not: the next shot is numbered `count + 1`. */
  count: number
  putts: number
  /** The hole's latest row (the last queued one, else the last server one) is a made putt. */
  lastHoled: boolean
  /** The hole's latest row was played from the green. */
  lastPutt: boolean
}

/**
 * One list of the hole's shots, built from the server rows loaded for a hole score and
 * the phone's queued payloads (JSON, already without the ones the server returned).
 * Only rows of `holeScoreId` count: on a hole switch the screen renders the new hole
 * once before the old hole's shots are cleared, and they must not show under it.
 */
export function liveHoleShots(
  holeScoreId: string | null,
  remote: { holeScoreId: string; rows: readonly LiveShotRow[] } | null,
  queued: readonly string[],
): LiveHoleShots {
  const rows: LiveShotRow[] = remote?.holeScoreId === holeScoreId ? [...remote.rows] : []
  for (const raw of queued) {
    const p = parseQueued(raw)
    if (p?.hole_score_id !== holeScoreId) continue
    rows.push({
      id: p.id ?? '',
      club: p.club ?? null,
      lie_type: p.lie_type ?? null,
      start_lat: p.start_lat ?? null,
      start_lng: p.start_lng ?? null,
      ob: p.ob ?? null,
      putt_result: p.putt_result ?? null,
    })
  }
  const shots = rows.flatMap((r): LiveHoleShot[] =>
    r.id && r.start_lat != null && r.start_lng != null
      ? [{
          id: r.id,
          start: { lat: r.start_lat, lng: r.start_lng },
          ob: r.ob === true,
          captured: { club: r.club, lie_type: r.lie_type, putt_result: r.putt_result },
        }]
      : [],
  )
  const last = rows[rows.length - 1]
  return {
    shots,
    count: rows.length,
    putts: rows.filter((r) => isPuttShot(r.lie_type)).length,
    lastHoled: last?.putt_result === 'made',
    lastPutt: !!last && isPuttShot(last.lie_type),
  }
}

type QueuedPayload = Partial<LiveShotRow> & { hole_score_id?: string; id?: string }

function parseQueued(raw: string): QueuedPayload | null {
  try {
    const p: unknown = JSON.parse(raw)
    return p && typeof p === 'object' ? (p as QueuedPayload) : null
  } catch {
    return null
  }
}
