import { useCallback, useMemo, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import Mapbox from '@rnmapbox/maps'
import {
  bearingDegrees,
  calculateShotSG,
  destinationYards,
  getExpectedStrokes,
  NEAR_GREEN_YARDS,
} from '@oga/core'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import { distanceYards, ensureMapboxInitialized } from '../../lib/maps'
import { useUnits } from '../../hooks/useUnits'
import { Marker } from './markers/Marker'
import { FlagMarker } from './markers/FlagMarker'
import { AimGhostLayers, useAimGhosts } from './markers/AimGhost'
import { BreadcrumbLayers } from './markers/BreadcrumbLayers'
import { AimDistancePill } from './markers/AimDistancePill'
import { useHoleCamera } from './hooks/useHoleCamera'
import {
  ExpStrokesPill,
  MissingLayoutBanner,
  PinFirstCta,
  TeeBadge,
  ToHolePill,
  TopHint,
} from './HoleMapOverlays'
import type { HoleMapPhase, LatLng } from './HoleMap.types'

ensureMapboxInitialized()

export type { HoleMapPhase, LatLng }

interface HoleMapProps {
  center: LatLng
  pin?: LatLng | null
  /**
   * Per-round pin position captured during live play. Renders as the
   * flag marker. Falls back visually to the `pin` (stored) coords when
   * absent.
   */
  roundPin?: LatLng | null
  tee?: LatLng | null
  aim?: LatLng | null
  ball?: LatLng | null
  /**
   * Aim-relative dispersion (yards) for the auto-selected club, drawn as a
   * 95% arc from `ball` (origin) through `aim` (target). `perp95` is the
   * lateral half-width; `perpMean` the player's lateral bias (+ = right).
   * Null when the player has too little data for the relevant club — the
   * overlay simply doesn't render.
   */
  dispersion?: { perp95: number; perpMean: number } | null
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
  phase?: HoleMapPhase
  /**
   * True when this hole has no tee or pin coordinates in the DB —
   * surfaces a small banner under the top hint so the player knows
   * the missing distance pill / no auto-putt switch is data-driven,
   * not a bug.
   */
  missingHoleLayout?: boolean
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
  onSetAim: (loc: LatLng) => void
  onSetBall: (loc: LatLng) => void
  onPlacePin?: (loc: LatLng) => void
  onPlaceTee?: (loc: LatLng) => void
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
}

function toCoord(l: LatLng): [number, number] {
  return [l.lng, l.lat]
}

// Half-length (yards) of the perpendicular crosshair tick drawn at the aim
// — a short geo segment across the aim line so the draggable midpoint
// handle reads as a crosshair (refs ux-09). Decorative; the transparent
// PointAnnotation owns the actual drag.
const CROSSHAIR_HALF_YARDS = 7

// How far past the aim the dotted aim-direction reference extends. Large
// enough to run off-screen at the live-round zoom so it reads as a line
// continuing "to infinity" in the direction you're aiming.
const AIM_EXTENSION_YARDS = 250

// Min gap between aim updates while dragging the handle. The native
// PointAnnotation drag fires onDrag every coalesced frame (≥60 Hz); each
// one calls setAim, which re-renders the controlled handle AND re-serializes
// every overlay ShapeSource across the bridge — the source of mid-tier
// Android drag jank. Gating to ~25 Hz cuts that storm while the readouts
// still track the finger; onDragEnd always applies the final position.
const AIM_DRAG_THROTTLE_MS = 40

function extractCoord(feature: unknown): LatLng | null {
  const geom = (feature as { geometry?: { coordinates?: unknown } } | null)?.geometry
  const coords = geom?.coordinates
  if (!Array.isArray(coords) || coords.length < 2) return null
  const [lng, lat] = coords as number[]
  if (typeof lat !== 'number' || typeof lng !== 'number') return null
  // @rnmapbox/maps fires onDragEnd with NaN coords on Android when a
  // PointAnnotation is dragged off the visible map. NaN passes typeof
  // 'number' and then poisons the Kalman filter + DB writes downstream.
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

export function HoleMap({
  center,
  pin,
  roundPin,
  tee,
  aim,
  ball,
  handicap,
  previousShots,
  phase = 'PLACE_BALL',
  missingHoleLayout = false,
  gpsPosition,
  courseCenter,
  holeNumber,
  onSetAim,
  onSetBall,
  onPlacePin,
  onPlaceTee,
  showLocationPuck,
}: HoleMapProps) {
  const { toDisplay } = useUnits()
  const mapViewRef = useRef<Mapbox.MapView>(null)
  // Native side fires "Source X is not in style" when a ShapeSource /
  // LineLayer mounts before the satellite style has finished loading.
  // Gate every source behind this flag so React never renders them
  // before native is ready to accept them.
  const [styleLoaded, setStyleLoaded] = useState(false)

  const isPinMode = phase === 'PIN'
  const isTeeMode = phase === 'TEE'
  const isAimPhase = phase === 'SET_AIM'
  const isPlaceBallPhase = phase === 'PLACE_BALL'

  const cameraRef = useHoleCamera({
    center,
    ball,
    pin,
    roundPin,
    phase,
    styleLoaded,
    gpsPosition,
    courseCenter,
  })

  const recenterOnGps = useCallback(() => {
    if (!gpsPosition || !cameraRef.current) return
    cameraRef.current.setCamera({
      centerCoordinate: toCoord(gpsPosition),
      zoomLevel: 17,
      pitch: 0,
      animationDuration: 600,
    })
  }, [gpsPosition, cameraRef])

  const { aimGhosts, aimGhostFeatures } = useAimGhosts({
    ball,
    aim,
    phase,
    holeNumber,
  })

  // Mapbox's onLongPress wasn't firing reliably on Android (single-tap
  // onPress works fine, but long-press never reaches JS). Detect it via
  // react-native-gesture-handler instead, then translate the screen
  // point to lat/lng with the map ref. Long-press is the aim mechanism;
  // gate it to the SET_AIM phase so the ball-placement step isn't noisy.
  const dropAimFromScreenPoint = useCallback(
    async (x: number, y: number) => {
      // Snapshot the ref before the await: if the user long-presses
      // during a hole transition the native MapView can tear down
      // mid-await and the post-await call lands on a released handle.
      // Re-checking ref identity after the await catches that race.
      const mapView = mapViewRef.current
      if (!mapView) return
      if (!isAimPhase) return
      try {
        const coord = await mapView.getCoordinateFromView([x, y])
        if (mapViewRef.current !== mapView) return
        if (coord && coord.length >= 2) {
          const lat = coord[1]
          const lng = coord[0]
          // NaN guard (#275). Long-press near Mapbox projection
          // singularities (extreme zoom, off-tile area) can return
          // non-finite coords; without this, aim flows to buildPayload
          // as aim_lat/aim_lng and the shot save fails on sync.
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
          onSetAim({ lat, lng })
        }
      } catch {
        // map not ready yet
      }
    },
    [isAimPhase, onSetAim],
  )

  // Gate the long-press gesture to SET_AIM only. Outside that phase the
  // GestureDetector still wraps the map but no longer captures touches,
  // which restores the PointAnnotation drag for the ball marker during
  // PLACE_BALL — Gesture.LongPress was claiming the initial touch and
  // the native annotation drag never fired.
  const longPress = useMemo(
    () =>
      Gesture.LongPress()
        .enabled(isAimPhase)
        .minDuration(400)
        .onStart((event) => {
          'worklet'
          runOnJS(dropAimFromScreenPoint)(event.x, event.y)
        }),
    [dropAimFromScreenPoint, isAimPhase],
  )

  const effectivePin = roundPin ?? pin ?? null
  const pinDistance = useMemo(() => {
    if (!effectivePin || !ball) return null
    return Math.round(distanceYards(ball, effectivePin))
  }, [effectivePin, ball])

  // Distance from the dragged target to the pin (Dt). Origin→pin is
  // pinDistance (Ds). Both feed the live SG readout.
  const aimToPinYards = useMemo(() => {
    if (!effectivePin || !aim) return null
    return Math.round(distanceYards(aim, effectivePin))
  }, [effectivePin, aim])

  // Live strokes readout: expected strokes to hole out from the ball, and
  // the best-case SG of advancing to the aim — expected(Ds) − expected(Dt)
  // − 1, i.e. calculateShotSG. Category is a distance band (no polygons):
  // within NEAR_GREEN_YARDS → around_green ("GRN"), else approach ("FWY").
  // HONEST: this is "value of reaching the target if struck clean", not a
  // dispersion-weighted SG. Null (→ "—") until a pin + baseline resolve.
  const liveStrokes = useMemo(() => {
    if (pinDistance == null) return { expected: null, sg: null, lieLabel: null }
    const startCat = pinDistance <= NEAR_GREEN_YARDS ? 'around_green' : 'approach'
    const expected = getExpectedStrokes(startCat, pinDistance, undefined, handicap)
    if (aimToPinYards == null || expected == null) {
      return { expected, sg: null, lieLabel: null }
    }
    const targetCat = aimToPinYards <= NEAR_GREEN_YARDS ? 'around_green' : 'approach'
    const targetExpected = getExpectedStrokes(targetCat, aimToPinYards, undefined, handicap)
    if (targetExpected == null) return { expected, sg: null, lieLabel: null }
    return {
      expected,
      sg: calculateShotSG(expected, targetExpected),
      lieLabel: targetCat === 'around_green' ? 'GRN' : 'FWY',
    }
  }, [pinDistance, aimToPinYards, handicap])

  // SG sub-line for the carry pill ("+0.3 · FWY"), pos/neg colored.
  const sgSublabel =
    liveStrokes.sg != null && liveStrokes.lieLabel != null
      ? `${liveStrokes.sg >= 0 ? '+' : ''}${liveStrokes.sg.toFixed(1)} · ${liveStrokes.lieLabel}`
      : null

  const showAim = isAimPhase || isPlaceBallPhase

  // Aim direction extended "to infinity" (dotted): a ray from the aim
  // continuing along the ball→aim bearing, past the target — the straight
  // line your shot points down, which is where the dispersion arc points.
  // Rotates with the aim as it's dragged; in a bent shot it diverges from
  // the solid ball→aim→pin path, contrasting "straight on" vs the real pin.
  const referenceLine = useMemo(() => {
    if (!showAim || !ball || !aim) return null
    if (distanceYards(ball, aim) < 1) return null
    const heading = bearingDegrees(ball.lat, ball.lng, aim.lat, aim.lng)
    if (!Number.isFinite(heading)) return null
    const far = destinationYards(aim, heading, AIM_EXTENSION_YARDS)
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: [toCoord(aim), toCoord(far)],
      },
    }
  }, [showAim, ball?.lat, ball?.lng, aim?.lat, aim?.lng])

  // Solid aim path origin → aim → pin (bends at the aim as it's dragged).
  // Falls back to ball→aim on no-pin holes.
  const aimLine = useMemo(() => {
    if (!showAim) return null
    if (!ball || !aim) return null
    const coordinates = [toCoord(ball), toCoord(aim)]
    if (effectivePin) coordinates.push(toCoord(effectivePin))
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates },
    }
  }, [ball, aim, effectivePin, showAim])

  // Perpendicular crosshair tick at the aim — the draggable handle's
  // visual. A short geo segment perpendicular to the ball→aim bearing, so
  // it rotates with the line. destinationYards/bearingDegrees share the
  // arc's great-circle model. Bound to live `aim` (2 points, cheap to
  // re-serialize — same cost class as the already-live aim line).
  const aimCrosshair = useMemo(() => {
    if (!showAim || !ball || !aim) return null
    // Degenerate guard: with the aim ~on the ball the bearing is
    // meaningless — bearingDegrees(p, p) returns 0 (finite, not NaN), so a
    // finite-check alone wouldn't catch it and the tick would point an
    // arbitrary direction. Suppress below ~1 yd, matching arcGeoJSON's
    // radius floor.
    if (distanceYards(ball, aim) < 1) return null
    const heading = bearingDegrees(ball.lat, ball.lng, aim.lat, aim.lng)
    if (!Number.isFinite(heading)) return null
    const left = destinationYards(aim, heading - 90, CROSSHAIR_HALF_YARDS)
    const right = destinationYards(aim, heading + 90, CROSSHAIR_HALF_YARDS)
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: [toCoord(left), toCoord(right)],
      },
    }
  }, [showAim, ball?.lat, ball?.lng, aim?.lat, aim?.lng])

  const aimDistanceYards = useMemo(() => {
    if (!showAim || !ball || !aim) return null
    return Math.round(distanceYards(ball, aim))
  }, [showAim, ball, aim])

  const aimMidpoint: LatLng | null = useMemo(() => {
    if (!showAim || !ball || !aim) return null
    return { lat: (ball.lat + aim.lat) / 2, lng: (ball.lng + aim.lng) / 2 }
  }, [showAim, ball, aim])

  // Midpoint of the aim→pin leg, where the subordinate "remaining" label
  // sits — mirrors the carry pill on the ball→aim leg.
  const remainingMidpoint: LatLng | null = useMemo(() => {
    if (!showAim || !aim || !effectivePin) return null
    return {
      lat: (aim.lat + effectivePin.lat) / 2,
      lng: (aim.lng + effectivePin.lng) / 2,
    }
  }, [showAim, aim?.lat, aim?.lng, effectivePin?.lat, effectivePin?.lng])

  // Wall-clock gate for the aim-drag throttle (see AIM_DRAG_THROTTLE_MS).
  const lastAimDragRef = useRef(0)

  // Breadcrumb line through every previous shot start, with a final
  // segment to the current ball so the most recent leg is visible too.
  // Filtered to require at least 2 points so the LineString geometry
  // is valid.
  const previousShotsLine = useMemo(() => {
    const pts: LatLng[] = previousShots ?? []
    const ordered = ball ? [...pts, ball] : pts
    if (ordered.length < 2) return null
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: ordered.map(toCoord),
      },
    }
  }, [previousShots, ball?.lat, ball?.lng])

  // Per-segment midpoint + distance for the small labels rendered along
  // the breadcrumb. Only segments between fully-resolved waypoint pairs
  // are kept (the current ball position is included as the final
  // waypoint so the latest leg also gets a label).
  const previousShotSegments = useMemo(() => {
    const pts: LatLng[] = [...(previousShots ?? [])]
    if (ball) pts.push(ball)
    const out: { id: string; midpoint: LatLng; yards: number }[] = []
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!
      const b = pts[i + 1]!
      out.push({
        id: `seg-${i}`,
        midpoint: { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 },
        yards: Math.round(distanceYards(a, b)),
      })
    }
    return out
  }, [previousShots, ball?.lat, ball?.lng])

  function handleTap(feature: unknown) {
    const c = extractCoord(feature)
    if (!c) return
    if (isPinMode) {
      onPlacePin?.(c)
      return
    }
    if (isTeeMode) {
      onPlaceTee?.(c)
      return
    }
    // Tap-to-place-ball is only meaningful in PLACE_BALL. In SET_AIM we
    // don't want stray taps moving the just-confirmed ball position.
    if (isPlaceBallPhase) {
      onSetBall(c)
    }
  }

  return (
    <GestureDetector gesture={longPress}>
      <View style={{ flex: 1, position: 'relative' }}>
        <Mapbox.MapView
          ref={mapViewRef}
          style={{ flex: 1 }}
          styleURL={Mapbox.StyleURL.Satellite}
          // Off by default it's on — the scale bar reads like a stray
          // overlay on the satellite HUD and gets mistaken for the
          // dispersion arc. Attribution/logo stay (Mapbox ToS).
          scaleBarEnabled={false}
          onPress={handleTap}
          onDidFinishLoadingStyle={() => setStyleLoaded(true)}
        >
          <Mapbox.Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: toCoord(center),
              zoomLevel: 17,
              pitch: 0,
            }}
          />

          {/* Bearing intentionally not enabled — drives the magnetometer
              continuously, which costs ~2-4 %/hr over a 4-hour round, and
              the player's facing direction isn't UX-meaningful here (no
              navigation, no panning relative to heading).
              Conditional mount (not visible={...}) is required to actually
              pause the native GPS subscription — see HoleMapProps.showLocationPuck. */}
          {showLocationPuck && <Mapbox.LocationPuck visible />}

          <BreadcrumbLayers
            previousShots={previousShots ?? []}
            previousShotsLine={previousShotsLine}
            segments={previousShotSegments}
            styleLoaded={styleLoaded}
            isPinMode={isPinMode}
            toDisplay={toDisplay}
          />

          <AimGhostLayers
            aimGhosts={aimGhosts}
            aimGhostFeatures={aimGhostFeatures}
            styleLoaded={styleLoaded}
            isPinMode={isPinMode}
          />

          {/* Straight ball→pin reference, dotted cream hairline — the
              neutral "up the hole" guide the solid amber aim path bends
              off. Drawn first so everything else reads on top. */}
          {styleLoaded && referenceLine && (
            <Mapbox.ShapeSource id="referenceLine" shape={referenceLine}>
              <Mapbox.LineLayer
                id="referenceLineLayer"
                style={{
                  lineColor: '#FBF8F1',
                  lineWidth: 1.5,
                  lineDasharray: [1, 3],
                  lineOpacity: 0.5,
                  lineCap: 'round',
                }}
              />
            </Mapbox.ShapeSource>
          )}

          {/* Solid aim path origin → aim → pin (white — reads against the
              green satellite where amber didn't). Bends at the aim as the
              player drags the handle. */}
          {styleLoaded && aimLine && (
            <Mapbox.ShapeSource id="aimLine" shape={aimLine}>
              <Mapbox.LineLayer
                id="aimLineLayer"
                style={{
                  lineColor: '#FBF8F1',
                  lineWidth: 2,
                  lineOpacity: 0.95,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            </Mapbox.ShapeSource>
          )}

          {/* Perpendicular crosshair tick at the aim — white, drawn over
              the aim line so the two cross. The transparent aim annotation
              below owns the drag. */}
          {styleLoaded && aimCrosshair && (
            <Mapbox.ShapeSource id="aimCrosshair" shape={aimCrosshair}>
              <Mapbox.LineLayer
                id="aimCrosshairLayer"
                style={{
                  lineColor: '#FBF8F1',
                  lineWidth: 2,
                  lineOpacity: 0.95,
                  lineCap: 'round',
                }}
              />
            </Mapbox.ShapeSource>
          )}

          {!isPinMode && tee && (
            <Mapbox.PointAnnotation id="tee" coordinate={toCoord(tee)}>
              <TeeBadge />
            </Mapbox.PointAnnotation>
          )}

          {/* Single flag at effectivePin (roundPin > pin). Strong tone
              when this round's pin is set, dim when only the stored
              hole pin is known. In PIN mode the annotation is draggable
              so the player can move it directly; tap-on-map (handled
              below in handleTap) still places a fresh flag if dragging
              isn't ergonomic. */}
          {effectivePin && (
            <Mapbox.PointAnnotation
              id="effectivePin"
              coordinate={toCoord(effectivePin)}
              anchor={{ x: 0.28, y: 0.91 }}
              draggable={isPinMode}
              onDragEnd={(e: unknown) => {
                if (!isPinMode) return
                const c = extractCoord(e)
                if (c) onPlacePin?.(c)
              }}
            >
              {/* 44pt transparent hit area in PIN mode so the flag is
                  comfortable to drag — matches the ball/aim marker
                  pattern (Apple HIG minimum target). Outside PIN mode
                  the visual flag is the entire annotation; the halo
                  has no behavioral effect. */}
              <View
                style={{
                  width: 44,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FlagMarker tone={roundPin ? 'strong' : 'dim'} />
              </View>
            </Mapbox.PointAnnotation>
          )}

          {showAim && aim && (
            <Mapbox.PointAnnotation
              id="aim"
              coordinate={toCoord(aim)}
              draggable={isAimPhase}
              onDrag={(e: unknown) => {
                // Drop intermediate frames closer than the throttle window;
                // the native marker still tracks the finger at full rate.
                const now = Date.now()
                if (now - lastAimDragRef.current < AIM_DRAG_THROTTLE_MS) return
                lastAimDragRef.current = now
                const c = extractCoord(e)
                if (c) onSetAim(c)
              }}
              onDragEnd={(e: unknown) => {
                // Final position is authoritative — bypass the gate so the
                // last drag frame is never dropped.
                lastAimDragRef.current = 0
                const c = extractCoord(e)
                if (c) onSetAim(c)
              }}
            >
              {/* 44pt transparent hit area around a small center grab-dot.
                  The perpendicular crosshair tick (drawn above) is the
                  handle's main visual; the dot just marks the grab point. */}
              <View
                style={{
                  width: 44,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Marker color="#A66A1F" border="#FBF8F1" size={9} />
              </View>
            </Mapbox.PointAnnotation>
          )}

          {aimMidpoint && aimDistanceYards !== null && (
            <AimDistancePill
              midpoint={aimMidpoint}
              display={toDisplay(aimDistanceYards)}
              sublabel={sgSublabel}
              sublabelTone={
                liveStrokes.sg != null && liveStrokes.sg < 0 ? 'neg' : 'pos'
              }
            />
          )}

          {/* Remaining (aim→pin) — subordinate to the hero carry pill: a
              smaller, dimmer label on the aim→pin leg. Uses the already-
              computed aimToPinYards, run through the units helper. */}
          {remainingMidpoint && aimToPinYards !== null && (
            <Mapbox.PointAnnotation
              id="remainingDistance"
              coordinate={toCoord(remainingMidpoint)}
            >
              <View
                style={{
                  backgroundColor: 'rgba(28,33,28,0.7)',
                  borderRadius: 9,
                  paddingHorizontal: 9,
                  paddingVertical: 3,
                }}
              >
                <Text
                  style={{
                    color: '#E8E2D4',
                    fontFamily: 'Fraunces-Medium',
                    fontSize: 14,
                    fontWeight: '600',
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {toDisplay(aimToPinYards)}
                </Text>
              </View>
            </Mapbox.PointAnnotation>
          )}

          {!isPinMode && ball && (
            <Mapbox.PointAnnotation
              id="ball"
              coordinate={toCoord(ball)}
              draggable={isPlaceBallPhase}
              onDragEnd={(e: unknown) => {
                const c = extractCoord(e)
                // Ignore micro-drags (< 5 yd) — finger tremor or an
                // accidental press-and-release would otherwise freeze
                // GPS tracking for the rest of this PLACE_BALL cycle.
                if (!c || distanceYards(ball, c) < 5) return
                onSetBall(c)
              }}
            >
              {/* 44pt transparent hit area so the marker is comfortable
                  to grab one-handed — Apple HIG minimum target size.
                  The visual marker stays small; the touchable area
                  extends well past it. */}
              <View
                style={{
                  width: 44,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Marker
                  color="#1F3D2C"
                  border="#FBF8F1"
                  size={isPlaceBallPhase ? 18 : 14}
                />
              </View>
            </Mapbox.PointAnnotation>
          )}
        </Mapbox.MapView>

        <TopHint isPinMode={isPinMode} isAimPhase={isAimPhase} isTeeMode={isTeeMode} />
        {missingHoleLayout && !isPinMode && !isTeeMode && <MissingLayoutBanner />}
        {!isPinMode && !isTeeMode && pinDistance !== null && (
          <>
            <ToHolePill display={toDisplay(pinDistance)} />
            <ExpStrokesPill value={liveStrokes.expected} />
          </>
        )}
        {/* Pin-first UX (Task 7): no pin yet → prompt for it, since distances,
            expected strokes, and the dispersion overlay all need one. Skipped
            when the whole hole layout is missing (MissingLayoutBanner covers
            that case). */}
        {!isPinMode && !isTeeMode && !effectivePin && !missingHoleLayout && (
          <PinFirstCta />
        )}
        {isPlaceBallPhase && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Center map on my location"
            disabled={!gpsPosition}
            onPress={recenterOnGps}
            hitSlop={8}
            style={{
              position: 'absolute',
              right: 12,
              bottom: 52,
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: '#FBF8F1',
              borderWidth: 1,
              borderColor: '#1F3D2C',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: gpsPosition ? 1 : 0.5,
            }}
          >
            <MaterialCommunityIcons
              name="crosshairs-gps"
              size={22}
              color="#1F3D2C"
            />
          </Pressable>
        )}
      </View>
    </GestureDetector>
  )
}
