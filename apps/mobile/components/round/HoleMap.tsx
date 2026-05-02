import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import Mapbox from '@rnmapbox/maps'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import { distanceYards, ensureMapboxInitialized } from '../../lib/maps'
import { useUnits } from '../../hooks/useUnits'

ensureMapboxInitialized()

export interface LatLng {
  lat: number
  lng: number
}

/**
 * `PLACE_BALL` — ball draggable, tap places ball, no aim interaction.
 * `SET_AIM`    — ball locked, long-press drops aim, camera rotates so
 *                play direction is up.
 * `PIN`        — pin placement modality (orthogonal to the shot flow).
 * Kept lowercase ('shot') for back-compat but new callers use the
 * three-phase form.
 */
export type HoleMapPhase = 'PLACE_BALL' | 'SET_AIM' | 'PIN'

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
   * Previously-logged shot start positions, in shot order. Rendered as
   * small amber waypoints with a line connecting consecutive points
   * AND a final segment from the last waypoint to the current ball, so
   * the player has a visible breadcrumb of how they got to the
   * current position. Pass an empty array (or omit) on shot 1.
   */
  previousShots?: LatLng[]
  phase?: HoleMapPhase
  onSetAim: (loc: LatLng) => void
  onSetBall: (loc: LatLng) => void
  onPlacePin?: (loc: LatLng) => void
}

function toCoord(l: LatLng): [number, number] {
  return [l.lng, l.lat]
}

function extractCoord(feature: unknown): LatLng | null {
  const geom = (feature as { geometry?: { coordinates?: unknown } } | null)?.geometry
  const coords = geom?.coordinates
  if (!Array.isArray(coords) || coords.length < 2) return null
  const [lng, lat] = coords as number[]
  if (typeof lat !== 'number' || typeof lng !== 'number') return null
  return { lat, lng }
}

export function HoleMap({
  center,
  pin,
  roundPin,
  tee,
  aim,
  ball,
  previousShots,
  phase = 'PLACE_BALL',
  onSetAim,
  onSetBall,
  onPlacePin,
}: HoleMapProps) {
  const { toDisplay } = useUnits()
  const cameraRef = useRef<Mapbox.Camera>(null)
  const mapViewRef = useRef<Mapbox.MapView>(null)
  const cameraInitialized = useRef(false)
  // Native side fires "Source X is not in style" when a ShapeSource /
  // LineLayer mounts before the satellite style has finished loading.
  // Gate every source behind this flag so React never renders them
  // before native is ready to accept them.
  const [styleLoaded, setStyleLoaded] = useState(false)

  const isPinMode = phase === 'PIN'
  const isAimPhase = phase === 'SET_AIM'
  const isPlaceBallPhase = phase === 'PLACE_BALL'

  // Mapbox's onLongPress wasn't firing reliably on Android (single-tap
  // onPress works fine, but long-press never reaches JS). Detect it via
  // react-native-gesture-handler instead, then translate the screen
  // point to lat/lng with the map ref. Long-press is the aim mechanism;
  // gate it to the SET_AIM phase so the ball-placement step isn't noisy.
  const dropAimFromScreenPoint = useCallback(
    async (x: number, y: number) => {
      if (!mapViewRef.current) return
      if (!isAimPhase) return
      try {
        const coord = await mapViewRef.current.getCoordinateFromView([x, y])
        if (coord && coord.length >= 2) {
          onSetAim({ lat: coord[1], lng: coord[0] })
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

  // Center the camera once on first valid coords. Subsequent center changes
  // (e.g. GPS deltas while standing on the tee) should not retrigger
  // setCamera — the style was reloading and the satellite tiles would flash
  // back to a black canvas every time.
  //
  // PLACE_BALL is flat top-down (pitch 0) — tilt only happens on the
  // SET_AIM transition below. A tilted tee-box camera was disorienting
  // on the device because it framed grass at an angle before the player
  // had even decided what they were aiming at.
  useEffect(() => {
    if (cameraInitialized.current) return
    if (!cameraRef.current) return
    cameraRef.current.setCamera({
      centerCoordinate: toCoord(center),
      zoomLevel: 17,
      pitch: 0,
      animationDuration: 400,
    })
    cameraInitialized.current = true
  }, [center.lat, center.lng])

  // When entering pin mode, zoom in on the stored pin so the user is
  // looking at the green.
  useEffect(() => {
    if (!isPinMode) return
    if (!cameraRef.current) return
    const target = roundPin ?? pin ?? null
    if (!target) return
    cameraRef.current.setCamera({
      centerCoordinate: toCoord(target),
      zoomLevel: 19,
      animationDuration: 400,
    })
  }, [isPinMode, roundPin?.lat, roundPin?.lng, pin?.lat, pin?.lng])

  // Mark whether we owe the camera a PLACE_BALL re-frame on the next
  // ball update. Set on phase transitions INTO PLACE_BALL (e.g. after
  // saving a shot) so the camera flies back to the closer tee-style view
  // once GPS settles on the new ball position.
  const prevPhaseRef = useRef<HoleMapPhase>(phase)
  const reframePlaceBallRef = useRef(false)
  useEffect(() => {
    if (phase === 'PLACE_BALL' && prevPhaseRef.current !== 'PLACE_BALL') {
      reframePlaceBallRef.current = true
    }
    prevPhaseRef.current = phase
  }, [phase])

  useEffect(() => {
    if (!reframePlaceBallRef.current) return
    if (phase !== 'PLACE_BALL') return
    if (!cameraRef.current) return
    if (!ball) return
    cameraRef.current.setCamera({
      centerCoordinate: toCoord(ball),
      zoomLevel: 17,
      pitch: 0,
      heading: 0,
      animationDuration: 800,
    })
    reframePlaceBallRef.current = false
  }, [ball?.lat, ball?.lng, phase])

  // SET_AIM: rotate the camera so direction-of-play (ball → pin) is
  // toward the top of the screen, zoom to fit the shot ahead, and
  // tilt for a first-person-ish perspective. The 1.2s duration is
  // the satisfying UX moment that signals "now aim".
  //
  // Zoom adapts to ball→pin distance so a 90-yd wedge frames the
  // green tightly while a 380-yd par 5 still shows fairway + green.
  // Fixed zoom 15 was too far out for short approaches and too close
  // on long par 5s.
  useEffect(() => {
    if (!isAimPhase) return
    if (!cameraRef.current) return
    if (!ball) return
    const target = roundPin ?? pin ?? null
    const focus = target
      ? {
          lat: (ball.lat + target.lat) / 2,
          lng: (ball.lng + target.lng) / 2,
        }
      : ball
    const bearing = target
      ? (Math.atan2(target.lng - ball.lng, target.lat - ball.lat) * 180) /
        Math.PI
      : 0
    const distYd = target ? distanceYards(ball, target) : null
    const zoom =
      distYd == null
        ? 15
        : distYd < 150
          ? 16
          : distYd <= 300
            ? 15
            : 14
    cameraRef.current.setCamera({
      centerCoordinate: toCoord(focus),
      zoomLevel: zoom,
      pitch: 30,
      heading: bearing,
      animationDuration: 1200,
    })
  }, [
    isAimPhase,
    ball?.lat,
    ball?.lng,
    roundPin?.lat,
    roundPin?.lng,
    pin?.lat,
    pin?.lng,
  ])

  const effectivePin = roundPin ?? pin ?? null
  const pinDistance = useMemo(() => {
    if (!effectivePin || !ball) return null
    return Math.round(distanceYards(ball, effectivePin))
  }, [effectivePin, ball])

  const aimLine = useMemo(() => {
    if (!isAimPhase) return null
    if (!ball || !aim) return null
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: [toCoord(ball), toCoord(aim)],
      },
    }
  }, [ball, aim, isAimPhase])

  const aimDistanceYards = useMemo(() => {
    if (!isAimPhase || !ball || !aim) return null
    return Math.round(distanceYards(ball, aim))
  }, [isAimPhase, ball, aim])

  const aimMidpoint: LatLng | null = useMemo(() => {
    if (!isAimPhase || !ball || !aim) return null
    return { lat: (ball.lat + aim.lat) / 2, lng: (ball.lng + aim.lng) / 2 }
  }, [isAimPhase, ball, aim])

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

  function handleTap(feature: unknown) {
    const c = extractCoord(feature)
    if (!c) return
    if (isPinMode) {
      onPlacePin?.(c)
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

          {styleLoaded && !isPinMode && previousShotsLine && (
            <Mapbox.ShapeSource id="prevShotsLine" shape={previousShotsLine}>
              <Mapbox.LineLayer
                id="prevShotsLineLayer"
                style={{
                  lineColor: '#A66A1F',
                  lineWidth: 1.5,
                  lineOpacity: 0.7,
                }}
              />
            </Mapbox.ShapeSource>
          )}

          {!isPinMode &&
            (previousShots ?? []).map((p, i) => (
              <Mapbox.PointAnnotation
                key={`prev-shot-${i}`}
                id={`prev-shot-${i}`}
                coordinate={toCoord(p)}
              >
                <Marker color="#A66A1F" border="#FBF8F1" size={9} />
              </Mapbox.PointAnnotation>
            ))}

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
              <Marker color="#FBF8F1" border="#5C6356" size={10} />
            </Mapbox.PointAnnotation>
          )}

          {/* Stored hole pin: dim flag, only when no per-round pin.
              Hidden in PIN mode so the annotation doesn't intercept the
              tap that's supposed to place a new flag. */}
          {!isPinMode && !roundPin && pin && (
            <Mapbox.PointAnnotation id="pin" coordinate={toCoord(pin)}>
              <Flag tone="dim" />
            </Mapbox.PointAnnotation>
          )}

          {/* Per-round pin: prominent flag. Hidden in PIN mode for the
              same reason — taps need to reach the map below. */}
          {!isPinMode && roundPin && (
            <Mapbox.PointAnnotation id="roundPin" coordinate={toCoord(roundPin)}>
              <Flag tone="strong" />
            </Mapbox.PointAnnotation>
          )}

          {isAimPhase && aim && (
            <Mapbox.PointAnnotation
              id="aim"
              coordinate={toCoord(aim)}
              draggable
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

          {/* Distance pill at midpoint of the aim line. Sized + colored
              for outdoor readability — large white serif numerals on a
              dark, semi-opaque pill. */}
          {aimMidpoint && aimDistanceYards !== null && (
            <Mapbox.PointAnnotation
              id="aimDistance"
              coordinate={toCoord(aimMidpoint)}
            >
              <View
                style={{
                  backgroundColor: 'rgba(28,33,28,0.85)',
                  borderRadius: 999,
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                }}
              >
                <Text
                  style={{
                    color: '#F2EEE5',
                    fontFamily: 'Fraunces-Medium',
                    fontSize: 26,
                    fontWeight: '600',
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {toDisplay(aimDistanceYards)}
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
                if (c) onSetBall(c)
              }}
            >
              <Marker color="#1F3D2C" border="#FBF8F1" size={14} />
            </Mapbox.PointAnnotation>
          )}
        </Mapbox.MapView>

        <View
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            right: 12,
            backgroundColor: isPinMode
              ? 'rgba(166,106,31,0.92)'
              : 'rgba(28,33,28,0.78)',
            borderRadius: 2,
            paddingHorizontal: 10,
            paddingVertical: 6,
          }}
        >
          <Text
            style={{
              color: '#F2EEE5',
              fontSize: 10,
              fontWeight: '600',
              letterSpacing: 1.4,
              textTransform: 'uppercase',
            }}
          >
            {isPinMode
              ? 'Pin mode — tap to place flag'
              : isAimPhase
                ? 'Long-press to set aim point'
                : 'Drag the ball to refine, then tap Mark ball here'}
          </Text>
        </View>

        {!isPinMode && pinDistance !== null && (
          <View
            style={{
              position: 'absolute',
              right: 12,
              bottom: 12,
              backgroundColor: 'rgba(28,33,28,0.78)',
              borderRadius: 2,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <Text
              style={{
                color: '#F2EEE5',
                fontSize: 12,
                fontWeight: '500',
                fontVariant: ['tabular-nums'],
              }}
            >
              {toDisplay(pinDistance)} to pin
            </Text>
          </View>
        )}
      </View>
    </GestureDetector>
  )
}

type MarkerProps = { color: string; border: string; size: number }

function Marker({ color, border, size }: MarkerProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        borderWidth: 2,
        borderColor: border,
      }}
    />
  )
}

// Simple flag glyph: vertical pole with a triangular cloth at the top.
// "dim" = stored course pin (course default, may be wrong); "strong" =
// today's actual flag position captured this round.
function Flag({ tone }: { tone: 'dim' | 'strong' }) {
  const flagColor = tone === 'strong' ? '#A33A2A' : 'rgba(163,58,42,0.6)'
  const poleColor = tone === 'strong' ? '#FBF8F1' : 'rgba(251,248,241,0.7)'
  return (
    <View style={{ width: 16, height: 22, alignItems: 'flex-start' }}>
      <View
        style={{
          position: 'absolute',
          left: 4,
          top: 0,
          width: 2,
          height: 22,
          backgroundColor: poleColor,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 6,
          top: 1,
          width: 9,
          height: 7,
          backgroundColor: flagColor,
          borderTopRightRadius: 1,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 3,
          top: 21,
          width: 4,
          height: 2,
          borderRadius: 1,
          backgroundColor: poleColor,
        }}
      />
    </View>
  )
}
