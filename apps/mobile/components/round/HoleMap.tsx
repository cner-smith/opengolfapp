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
  /**
   * True when this hole has no tee or pin coordinates in the DB —
   * surfaces a small banner under the top hint so the player knows
   * the missing distance pill / no auto-putt switch is data-driven,
   * not a bug.
   */
  missingHoleLayout?: boolean
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
  missingHoleLayout = false,
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

  // Aim ghosts: prior shots' aim point + ball-start, retained as faded
  // markers + dotted lines so the player can see intended direction vs
  // actual result across the whole hole. Captured locally in HoleMap so
  // the parent doesn't have to thread historical aim coords through.
  const [aimGhosts, setAimGhosts] = useState<{ ball: LatLng; aim: LatLng }[]>(
    [],
  )
  const lastAimSnapshotRef = useRef<{ ball: LatLng; aim: LatLng } | null>(null)
  // While in SET_AIM, snapshot the current ball + aim pair so we can
  // promote it to a ghost the moment the phase exits SET_AIM (i.e. shot
  // was saved or aim was abandoned for ball placement again).
  useEffect(() => {
    if (isAimPhase && ball && aim) {
      lastAimSnapshotRef.current = { ball, aim }
    }
  }, [isAimPhase, ball?.lat, ball?.lng, aim?.lat, aim?.lng])
  const ghostPhaseRef = useRef<HoleMapPhase>(phase)
  useEffect(() => {
    if (ghostPhaseRef.current === 'SET_AIM' && phase !== 'SET_AIM') {
      const snap = lastAimSnapshotRef.current
      if (snap) {
        setAimGhosts((prev) => [...prev, snap])
        lastAimSnapshotRef.current = null
      }
    }
    ghostPhaseRef.current = phase
  }, [phase])
  // Hole change is signalled by previousShots resetting to empty (the
  // parent re-mounts a new hole with no prior shot starts). Clear ghosts
  // so they don't bleed across holes.
  const prevShotsLen = previousShots?.length ?? 0
  useEffect(() => {
    if (prevShotsLen === 0) setAimGhosts([])
  }, [prevShotsLen])

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

  const aimGhostFeatures = useMemo(() => {
    if (aimGhosts.length === 0) return null
    return {
      type: 'FeatureCollection' as const,
      features: aimGhosts.map((g, i) => ({
        type: 'Feature' as const,
        properties: { id: i },
        geometry: {
          type: 'LineString' as const,
          coordinates: [toCoord(g.ball), toCoord(g.aim)],
        },
      })),
    }
  }, [aimGhosts])

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
  // the breadcrumb line. Excludes the trailing ball→nothing segment when
  // ball is the only point. Only segments between fully-resolved waypoint
  // pairs are kept (the current ball position is included as the final
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
                <NumberedMarker
                  color="#A66A1F"
                  border="#FBF8F1"
                  size={20}
                  number={i + 1}
                />
              </Mapbox.PointAnnotation>
            ))}

          {/* Small distance label between every pair of consecutive
              waypoints on the breadcrumb. Smaller / more muted than the
              aim distance pill so it reads as supporting info, not the
              primary callout. */}
          {!isPinMode &&
            previousShotSegments.map((seg) => (
              <Mapbox.PointAnnotation
                key={seg.id}
                id={seg.id}
                coordinate={toCoord(seg.midpoint)}
              >
                <View
                  style={{
                    backgroundColor: 'rgba(28,33,28,0.65)',
                    borderRadius: 999,
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                  }}
                >
                  <Text
                    style={{
                      color: '#F2EEE5',
                      fontSize: 10,
                      fontWeight: '500',
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {toDisplay(seg.yards)}
                  </Text>
                </View>
              </Mapbox.PointAnnotation>
            ))}

          {styleLoaded && !isPinMode && aimGhostFeatures && (
            <Mapbox.ShapeSource id="aimGhostsLine" shape={aimGhostFeatures}>
              <Mapbox.LineLayer
                id="aimGhostsLineLayer"
                style={{
                  lineColor: '#A66A1F',
                  lineWidth: 1.2,
                  lineDasharray: [3, 3],
                  lineOpacity: 0.4,
                }}
              />
            </Mapbox.ShapeSource>
          )}

          {!isPinMode &&
            aimGhosts.map((g, i) => (
              <Mapbox.PointAnnotation
                key={`aim-ghost-${i}`}
                id={`aim-ghost-${i}`}
                coordinate={toCoord(g.aim)}
              >
                <View style={{ opacity: 0.4 }}>
                  <Marker color="#A66A1F" border="#FBF8F1" size={9} />
                </View>
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
              draggable={isPinMode}
              onDragEnd={(e: unknown) => {
                if (!isPinMode) return
                const c = extractCoord(e)
                if (c) onPlacePin?.(c)
              }}
            >
              <Flag tone={roundPin ? 'strong' : 'dim'} />
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

        {missingHoleLayout && !isPinMode && (
          <View
            style={{
              position: 'absolute',
              top: 48,
              left: 12,
              right: 12,
              backgroundColor: 'rgba(28,33,28,0.78)',
              borderWidth: 1,
              borderColor: 'rgba(217,210,191,0.4)',
              borderRadius: 2,
              paddingHorizontal: 10,
              paddingVertical: 6,
            }}
          >
            <Text
              style={{
                color: '#F2EEE5',
                fontSize: 11,
                lineHeight: 14,
              }}
            >
              No hole layout for this course. Place shots manually — the
              distance pill and putting auto-switch stay off until tee /
              pin coords land.
            </Text>
          </View>
        )}

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

// Small "TEE" pill — kept visually identical to the web map's tee
// marker so the satellite view reads the same on both platforms. The
// previous bare cream circle was indistinguishable from a ball at the
// same zoom.
function TeeBadge() {
  return (
    <View
      style={{
        backgroundColor: '#FBF8F1',
        borderWidth: 1,
        borderColor: '#5C6356',
        borderRadius: 2,
        paddingHorizontal: 6,
        paddingVertical: 3,
      }}
    >
      <Text
        style={{
          color: '#5C6356',
          fontSize: 9,
          fontWeight: '500',
          letterSpacing: 1.4,
        }}
      >
        TEE
      </Text>
    </View>
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

type NumberedMarkerProps = MarkerProps & { number: number; opacity?: number }

function NumberedMarker({
  color,
  border,
  size,
  number,
  opacity = 1,
}: NumberedMarkerProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        borderWidth: 2,
        borderColor: border,
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
      }}
    >
      <Text
        style={{
          color: '#FBF8F1',
          fontSize: size * 0.55,
          fontWeight: '700',
          fontVariant: ['tabular-nums'],
          lineHeight: size,
          textAlign: 'center',
        }}
      >
        {number}
      </Text>
    </View>
  )
}

// Simple flag glyph: vertical pole with a rectangular cloth at the top
// and a small base disk. PointAnnotation measures children via normal
// flex layout — the previous absolutely-positioned version sometimes
// rendered as a zero-size annotation on Android, leaving no visible
// flag at all. This version uses an explicit-size column so the
// annotation always has positive bounds.
function Flag({ tone }: { tone: 'dim' | 'strong' }) {
  const flagColor = tone === 'strong' ? '#A33A2A' : 'rgba(163,58,42,0.85)'
  const poleColor = '#FBF8F1'
  return (
    <View
      style={{
        width: 28,
        height: 38,
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
      }}
    >
      {/* Cloth + pole top section */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View
          style={{
            width: 3,
            height: 12,
            backgroundColor: poleColor,
          }}
        />
        <View
          style={{
            width: 15,
            height: 11,
            backgroundColor: flagColor,
            borderTopRightRadius: 1,
          }}
        />
      </View>
      {/* Pole shaft */}
      <View
        style={{
          width: 3,
          height: 22,
          backgroundColor: poleColor,
        }}
      />
      {/* Base disk */}
      <View
        style={{
          width: 9,
          height: 3,
          marginLeft: -3,
          borderRadius: 1.5,
          backgroundColor: poleColor,
        }}
      />
    </View>
  )
}
