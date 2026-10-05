import type { PlacedPoint } from '../../../components/round/RoundMap'

// Hole-coupled view state. These seven fields used to live as
// individual useState hooks and were reset together in switchHole —
// every new piece of hole-scoped state was a fresh chance to forget a
// reset and leave stale data on screen. Bundling them in a reducer
// makes SWITCH_HOLE one atomic transition.
export interface HoleViewState {
  activeHoleNumber: number
  placedPoints: PlacedPoint[]
  /** Aim point per placed shot. Parallel to placedPoints — index N is
   *  the aim for shot N. Null when the user hasn't placed an aim for
   *  that shot. Aim point is what the player was aiming at when they
   *  hit shot N; required for meaningful dispersion analysis. */
  placedAims: (PlacedPoint | null)[]
  /** Whether each placed aim is still the auto-spawned suggestion (true) vs
   *  user-touched (false). Parallel to placedAims. An untouched auto-spawn is
   *  a system guess — NOT persisted to shots.aim_lat/lng on save, so it can't
   *  pollute the dispersion dataset (aim must be explicit to count). Any drag
   *  or explicit set flips it to false. */
  placedAimAuto: boolean[]
  /** When true, the next map tap sets the aim point for the latest
   *  placed shot instead of dropping a new shot start marker. */
  aimMode: boolean
  pinOverride: PlacedPoint | null
  teeOverride: PlacedPoint | null
  /** Manual tee/pin placement flow — when set, the next map tap drops
   *  the corresponding marker instead of starting a shot. Used for
   *  courses with no hole layout in the DB so the player can mark the
   *  tee box and pin themselves. */
  placementMode: 'tee' | 'pin' | null
  reviewOpen: boolean
  editingOnMap: boolean
  saveError: string | null
}

export type HoleViewAction =
  | { type: 'SWITCH_HOLE'; holeNumber: number }
  | { type: 'PUSH_POINT'; point: PlacedPoint }
  | { type: 'MOVE_POINT'; index: number; point: PlacedPoint }
  | { type: 'CLEAR_POINTS' }
  | { type: 'POP_POINT' }
  | { type: 'SET_AIM'; index: number; point: PlacedPoint | null; auto?: boolean }
  | { type: 'AIM_MODE'; on: boolean }
  | { type: 'PIN_OVERRIDE'; point: PlacedPoint | null }
  | { type: 'TEE_OVERRIDE'; point: PlacedPoint | null }
  | { type: 'PLACEMENT_MODE'; mode: 'tee' | 'pin' | null }
  | { type: 'OPEN_REVIEW' }
  | { type: 'CLOSE_REVIEW' }
  | { type: 'EDIT_ON_MAP'; editing: boolean }
  | { type: 'SAVE_ERROR'; message: string | null }
  | { type: 'AFTER_SAVE'; nextHoleNumber: number | null }

export const HOLE_VIEW_INITIAL: HoleViewState = {
  activeHoleNumber: 1,
  placedPoints: [],
  placedAims: [],
  placedAimAuto: [],
  aimMode: false,
  pinOverride: null,
  teeOverride: null,
  placementMode: null,
  reviewOpen: false,
  editingOnMap: false,
  saveError: null,
}

export function holeViewReducer(state: HoleViewState, action: HoleViewAction): HoleViewState {
  switch (action.type) {
    case 'SWITCH_HOLE':
      return { ...HOLE_VIEW_INITIAL, activeHoleNumber: action.holeNumber }
    case 'PUSH_POINT':
      return {
        ...state,
        placedPoints: [...state.placedPoints, action.point],
        placedAims: [...state.placedAims, null],
        placedAimAuto: [...state.placedAimAuto, false],
        // Drop aim mode after placing a new shot — aim mode is sticky to
        // a specific shot, and pushing a new shot moves the cursor.
        aimMode: false,
      }
    case 'MOVE_POINT': {
      const next = state.placedPoints.slice()
      next[action.index] = action.point
      return { ...state, placedPoints: next }
    }
    case 'CLEAR_POINTS':
      return {
        ...state,
        placedPoints: [],
        placedAims: [],
        placedAimAuto: [],
        aimMode: false,
      }
    case 'POP_POINT':
      return {
        ...state,
        placedPoints: state.placedPoints.slice(0, -1),
        placedAims: state.placedAims.slice(0, -1),
        placedAimAuto: state.placedAimAuto.slice(0, -1),
        aimMode: false,
      }
    case 'SET_AIM': {
      const next = state.placedAims.slice()
      next[action.index] = action.point
      // Track whether this is the auto-spawned suggestion (auto:true) or a
      // user-driven set/drag (auto omitted → false). Only the latter persists.
      const nextAuto = state.placedAimAuto.slice()
      nextAuto[action.index] = action.auto ?? false
      return { ...state, placedAims: next, placedAimAuto: nextAuto, aimMode: false }
    }
    case 'AIM_MODE':
      return { ...state, aimMode: action.on }
    case 'PIN_OVERRIDE':
      // A pin write also exits placement mode so the next tap goes back
      // to dropping shot markers instead of re-placing the pin.
      return { ...state, pinOverride: action.point, placementMode: null }
    case 'TEE_OVERRIDE':
      return { ...state, teeOverride: action.point, placementMode: null }
    case 'PLACEMENT_MODE':
      return { ...state, placementMode: action.mode }
    case 'OPEN_REVIEW':
      return { ...state, reviewOpen: true }
    case 'CLOSE_REVIEW':
      return { ...state, reviewOpen: false }
    case 'EDIT_ON_MAP':
      return { ...state, editingOnMap: action.editing }
    case 'SAVE_ERROR':
      return { ...state, saveError: action.message }
    case 'AFTER_SAVE': {
      // Auto-advance to the next hole on save so the player isn't stuck
      // re-tapping the hole selector after every Done with hole. Caller
      // decides how far we can advance — `nextHoleNumber == null` means
      // we just saved the last hole on the course (caller compared
      // against the course's expected hole count). In that case stay put
      // and just clear the placed-shot state so the player can review.
      if (action.nextHoleNumber == null) {
        return {
          ...state,
          reviewOpen: false,
          placedPoints: [],
          placedAims: [],
          placedAimAuto: [],
          aimMode: false,
        }
      }
      return { ...HOLE_VIEW_INITIAL, activeHoleNumber: action.nextHoleNumber }
    }
  }
}
