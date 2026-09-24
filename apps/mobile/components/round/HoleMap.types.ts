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
  /**
   * Single-color historical-shot dots, toggled by the left-toolbar dispersion
   * button. The selected club's aim-relative offsets; placed around the aim
   * and shown only when `dotsVisible`. Null / empty → no dots (sparse data).
   */
  dotsVisible: boolean
  dispersionPoints?: { alongYards: number; perpYards: number }[] | null
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
  /**
   * Whether to render the bottom-right "center on my GPS" button during
   * PLACE_BALL. Defaults true. The played-hole edit-mode stepper passes
   * false — recentering on live GPS while browsing/editing a past shot
   * would yank the camera away from the shot being edited.
   */
  showRecenterButton?: boolean
  /** Live OB prompt (#895 B2) for the most recent shot: drawn on its marker
   *  while that marker is on-screen. Null when the prompt isn't offered. */
  obCallout?: { isOb: boolean; onPress: () => void } | null
  /** Reports where the most recent shot's marker is when it's off-screen
   *  (null = in view, or no shot), so the chrome can show the edge tab. */
  onLastShotOffscreen?: (arrow: OffscreenArrow | null) => void
}
