import type { PatternOverlay } from './markers/DispersionLayers'

export interface LatLng {
  lat: number
  lng: number
}

/**
 * `PLACE_BALL` — ball draggable, tap places ball, no aim interaction.
 * `SET_AIM`    — ball locked, long-press drops aim, camera rotates so
 *                play direction is up.
 * `PIN`        — pin placement modality (orthogonal to the shot flow).
 */
export type HoleMapPhase = 'PLACE_BALL' | 'SET_AIM' | 'PIN'

/** Direction to a map point that's outside the usable map area. */
export type OffscreenArrow = '↓' | '↑' | '←' | '→'

export interface HoleMapProps {
  center: LatLng
  pin?: LatLng | null
  /**
   * Per-round pin position captured during live play. Renders as the
   * flag marker. Falls back visually to the `pin` (stored) coords when
   * absent.
   */
  roundPin?: LatLng | null
  tee?: LatLng | null
  // Two dots framing the tee shot (perpendicular to the line of play), used
  // by the past-round logger in place of the single TeeBadge. The caller
  // (PastRoundMap) computes the positions; we only render them. When set,
  // it supersedes the `tee` badge.
  teeBox?: [LatLng, LatLng] | null
  aim?: LatLng | null
  ball?: LatLng | null
  /**
   * Fixed-geometry aim overlay (always on while aiming). Tee → an arc band
   * across the aim line; Appr → a circle ring on the pin. NOT data-driven —
   * the rail sizes it, the toggle shapes it.
   */
  overlayMode: 'tee' | 'appr'
  /** Tee arc TOTAL lateral width in yards (rail value); half each side of aim. */
  arcWidthYards: number
  /** Appr circle radius in yards (rail diameter ÷ 2, feet→yards). */
  circleRadiusYards: number
  /** A finger is dragging the ruler: the size follows it, no easing. */
  overlayLive?: boolean
  /** Shot-pattern overlay (Pattern key on) for the wheel's club, drawn around
   *  the aim while aiming. Null = off. */
  pattern?: PatternOverlay | null
  /**
   * Player handicap index, for the live expected-strokes / SG readouts.
   * Defaults handled by the caller (falls back to DEFAULT_HANDICAP).
   */
  handicap: number
  /**
   * Previously-logged shot start positions, in shot order. Rendered as
   * small amber waypoints with a line connecting consecutive points
   * AND a final segment from the last waypoint to the current ball, so
   * the player has a visible breadcrumb of how they got to the
   * current position. Pass an empty array (or omit) on shot 1.
   */
  previousShots?: LatLng[]
  /**
   * Out-of-bounds flag per shot, index-aligned with `previousShots` (#839).
   * Undefined/short arrays are treated as "not OB" — see BreadcrumbLayers.
   */
  previousShotObs?: boolean[]
  phase?: HoleMapPhase
  /**
   * Latest smoothed GPS position. Drives the recenter button (which
   * camera-jumps to it) and the camera hook's auto-center-once
   * behavior. Null until permission granted and a fix arrives.
   */
  gpsPosition?: LatLng | null
  /**
   * Course centroid (courses.lat/lng). Used as a proximity gate so
   * auto-center only fires when the player is actually at the course.
   */
  courseCenter?: LatLng | null
  /**
   * Active hole number, used as the hole-change signal for resident
   * children (aim ghosts, anything else that needs to reset per hole).
   * The map itself stays mounted across the whole round — see #264.
   */
  holeNumber: number
  /**
   * True when the current SET_AIM exit is a real shot commit (raw
   * roundState → SHOT_DETAIL / PUTTING) rather than a "Re-place ball"
   * backout. The `phase` prop collapses both to PLACE_BALL, so the aim-ghost
   * promotion needs this separate signal to record a ghost on commit without
   * leaving a stray one on re-place. Defaults false.
   */
  aimCommitted?: boolean
  onSetAim: (loc: LatLng) => void
  onSetBall: (loc: LatLng) => void
  /**
   * Called with the current GPS fix when the recenter button is tapped
   * during PLACE_BALL — a deliberate tap is explicit intent to put the
   * ball back on the player, unlike the silent GPS clobber the manual-
   * placement freeze exists to prevent (#713). Parent resumes GPS-driven
   * ball tracking. Optional: past-round review passes nothing.
   */
  onRecenterBall?: (loc: LatLng) => void
  onPlacePin?: (loc: LatLng) => void
  /**
   * Whether to mount the Mapbox LocationPuck. The puck owns its own
   * native GPS subscription that bypasses expo-location, and setting
   * `visible={false}` keeps that subscription alive (verified in
   * @rnmapbox/maps source — see PR notes for #330). Conditional
   * mount/unmount is the only way to actually pause the drain. Pass
   * true during PLACE_BALL and SET_AIM (player on course, puck is
   * meaningful) and false during SHOT_DETAIL / PUTTING (modals cover
   * the map).
   */
  showLocationPuck: boolean
  /**
   * Whether a map tap in PLACE_BALL places/moves the ball. Defaults true
   * (live round + adding a new past shot). The past-round review stepper
   * passes false so the selected shot's marker stays DRAGGABLE to
   * reposition, but stray taps while reviewing don't move it (#593).
   */
  tapToPlaceBall?: boolean
  /**
   * When set, the camera flies here whenever the point changes — independent
   * of `center`/GPS/phase, so it can't be fought by the auto-center-on-GPS
   * effect inside useHoleCamera. Used by the played-hole edit-mode stepper
   * (LiveRoundSession) to snap the camera to the active shot as the player
   * steps through a hole's history. Null/omitted → no-op.
   */
  focusOn?: LatLng | null
  /** Receives the recenter-on-GPS action; the recenter key lives in the
   *  caller's dock (#611 §5). */
  recenterRef?: { current: (() => void) | null }
  /** Frame the whole hole, first point at the bottom (past round: tee →
   *  pin). Re-frames when the points change (hole change). */
  fitHole?: [LatLng, LatLng] | null
  /** Left-hand layout (#611 §12): map tags sit left of the aim line. */
  lefty?: boolean
  /** Map-bottom → ball distance for the aim-view frame. Defaults to clearing
   *  the live round's floating SET_AIM controls; a map with nothing over its
   *  bottom edge (past round) passes a small value. */
  aimBallInset?: number
  /** Live OB prompt (#895 B2) for the most recent shot: drawn on its marker
   *  while that marker is on-screen. Null when the prompt isn't offered. */
  obCallout?: { onPress: () => void } | null
  /** Reports where the most recent shot's marker is when it's off-screen
   *  (null = in view, or no shot), so the chrome can show the edge tab. */
  onLastShotOffscreen?: (arrow: OffscreenArrow | null) => void
  /** Past-round breadcrumbs (#611 §19.3). When set, replaces the
   *  previousShots trail + segment labels + carry/remaining tags, and the
   *  ball draws as the selected crumb. */
  pastCrumbs?: PastCrumbs | null
  /** A map tap in SET_AIM sets the aim (the past round's Aim mode, §19.4). */
  tapToSetAim?: boolean
  /** Fires on every camera frame (screen-space overlays re-project). */
  onCameraChanged?: () => void
  /** Receives a projector: map coordinates → map-view points (dp), null
   *  where the map isn't ready. */
  projectRef?: { current: ((pts: LatLng[]) => Promise<[number, number][] | null>) | null }
  /** The putt-drop animation is drawing the ball (#611 §15). */
  hideBall?: boolean
}

export interface PastCrumbs {
  /** Every placed shot start except the selected one (that's `ball`). */
  crumbs: { at: LatLng; n: number; ob: boolean }[]
  /** All placed starts in shot order — the dotted path. */
  path: LatLng[]
  /** The selected shot's leg (start → next start, or the pin), drawn solid. */
  segment: [LatLng, LatLng] | null
  /** Numeral on the selected crumb (the ball). */
  selectedN: number | null
  /** Tapping a crumb selects it (index into `crumbs`). Omit = not tappable. */
  onSelect?: (i: number) => void
}
