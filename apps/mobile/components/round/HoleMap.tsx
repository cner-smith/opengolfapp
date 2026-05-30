import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import Mapbox from '@rnmapbox/maps'
import { arcGeoJSON } from '@oga/core'
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
  MissingLayoutBanner,
  PinDistancePill,
  TeeBadge,
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

// The dispersion arc recomputes against the dragged aim. @rnmapbox/maps
// forwards every native onAnnotationDrag straight to JS, and the drag
// event inherits canCoalesce()=true (PointAnnotationDragEvent →
// MapClickEvent → AbstractEvent), so RN frame-coalesces it to ~one per
// frame — ≥60 Hz, higher on 90/120 Hz panels. Re-serializing the arc
// ShapeSource across the bridge that fast janks mid-tier Android. Gate
// the geometry recompute to ~12.5 Hz (leading + trailing, wall-clock so
// it's refresh-independent) — the final release position is always drawn,
// intermediate frames are dropped.
const ARC_THROTTLE_MS = 80

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
  dispersion,
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

  const showAim = isAimPhase || isPlaceBallPhase

  const aimLine = useMemo(() => {
    if (!showAim) return null
    if (!ball || !aim) return null
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: [toCoord(ball), toCoord(aim)],
      },
    }
  }, [ball, aim, showAim])

  const aimDistanceYards = useMemo(() => {
    if (!showAim || !ball || !aim) return null
    return Math.round(distanceYards(ball, aim))
  }, [showAim, ball, aim])

  const aimMidpoint: LatLng | null = useMemo(() => {
    if (!showAim || !ball || !aim) return null
    return { lat: (ball.lat + aim.lat) / 2, lng: (ball.lng + aim.lng) / 2 }
  }, [showAim, ball, aim])

  // Throttled copy of `aim` that drives the dispersion arc. The raw aim
  // updates every drag frame; this trails it at ARC_THROTTLE_MS so the
  // arc geometry recomputes ~12 Hz, not 60.
  const [throttledAim, setThrottledAim] = useState<LatLng | null>(aim ?? null)
  const lastArcTickRef = useRef(0)
  useEffect(() => {
    const next = aim ?? null
    const now = Date.now()
    const elapsed = now - lastArcTickRef.current
    if (elapsed >= ARC_THROTTLE_MS) {
      lastArcTickRef.current = now
      setThrottledAim(next)
      return
    }
    const t = setTimeout(() => {
      lastArcTickRef.current = Date.now()
      setThrottledAim(next)
    }, ARC_THROTTLE_MS - elapsed)
    return () => clearTimeout(t)
  }, [aim?.lat, aim?.lng])

  // 95% dispersion arc for the selected club, anchored at the ball and
  // spanning the lateral spread at the target's carry distance. arcGeoJSON
  // returns null when the target sits on top of the ball (radius floor),
  // so a degenerate drag never throws.
  const dispersionArc = useMemo(() => {
    if (!showAim || !ball || !throttledAim || !dispersion) return null
    return arcGeoJSON(ball, throttledAim, dispersion.perp95, {
      biasYards: dispersion.perpMean,
    })
  }, [
    showAim,
    ball?.lat,
    ball?.lng,
    throttledAim?.lat,
    throttledAim?.lng,
    dispersion?.perp95,
    dispersion?.perpMean,
  ])

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

          {/* 95% dispersion arc — drawn under the aim line so the solid
              aim line reads on top. Amber dashed hairline per DESIGN.md
              (aim family); no new colors. */}
          {styleLoaded && dispersionArc && (
            <Mapbox.ShapeSource id="dispersionArc" shape={dispersionArc}>
              <Mapbox.LineLayer
                id="dispersionArcLayer"
                style={{
                  lineColor: '#A66A1F',
                  lineWidth: 2,
                  lineDasharray: [2, 3],
                  lineOpacity: 0.65,
                  lineCap: 'round',
                }}
              />
            </Mapbox.ShapeSource>
          )}

          {styleLoaded && aimLine && (
            <Mapbox.ShapeSource id="aimLine" shape={aimLine}>
              <Mapbox.LineLayer
                id="aimLineLayer"
                style={{
                  lineColor: '#A66A1F',
                  lineWidth: 1.5,
                  lineDasharray: [4, 3],
                  lineOpacity: 0.8,
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
                const c = extractCoord(e)
                if (c) onSetAim(c)
              }}
              onDragEnd={(e: unknown) => {
                const c = extractCoord(e)
                if (c) onSetAim(c)
              }}
            >
              {/* 44pt transparent hit area around the visual marker so the
                  drag handle is comfortably reachable mid-round. */}
              <View
                style={{
                  width: 44,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Marker color="#A66A1F" border="#FBF8F1" size={14} />
              </View>
            </Mapbox.PointAnnotation>
          )}

          {aimMidpoint && aimDistanceYards !== null && (
            <AimDistancePill
              midpoint={aimMidpoint}
              display={toDisplay(aimDistanceYards)}
            />
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
        {!isPinMode && pinDistance !== null && (
          <PinDistancePill display={toDisplay(pinDistance)} />
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
