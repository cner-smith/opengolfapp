import { useEffect, useMemo, useRef } from 'react'
import { Text, View } from 'react-native'
import Mapbox from '@rnmapbox/maps'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import { distanceYards, ensureMapboxInitialized } from '../../lib/maps'

ensureMapboxInitialized()

export interface LatLng {
  lat: number
  lng: number
}

export type HoleMapMode = 'shot' | 'pin'

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
  mode?: HoleMapMode
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
  mode = 'shot',
  onSetAim,
  onSetBall,
  onPlacePin,
}: HoleMapProps) {
  const cameraRef = useRef<Mapbox.Camera>(null)
  const mapViewRef = useRef<Mapbox.MapView>(null)
  const cameraInitialized = useRef(false)

  const isPinMode = mode === 'pin'

  // Mapbox's onLongPress wasn't firing reliably on Android (single-tap
  // onPress works fine, but long-press never reaches JS). Detect it via
  // react-native-gesture-handler instead, then translate the screen
  // point to lat/lng with the map ref.
  async function dropAimFromScreenPoint(x: number, y: number) {
    if (!mapViewRef.current) return
    if (isPinMode) return
    try {
      const coord = await mapViewRef.current.getCoordinateFromView([x, y])
      if (coord && coord.length >= 2) {
        onSetAim({ lat: coord[1], lng: coord[0] })
      }
    } catch {
      // map not ready yet
    }
  }

  const longPress = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(400)
        .onStart((event) => {
          'worklet'
          runOnJS(dropAimFromScreenPoint)(event.x, event.y)
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onSetAim, isPinMode],
  )

  // Center the camera once on first valid coords. Subsequent center changes
  // (e.g. GPS deltas while standing on the tee) should not retrigger
  // setCamera — the style was reloading and the satellite tiles would flash
  // back to a black canvas every time.
  useEffect(() => {
    if (cameraInitialized.current) return
    if (!cameraRef.current) return
    cameraRef.current.setCamera({
      centerCoordinate: toCoord(center),
      zoomLevel: 16,
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

  const effectivePin = roundPin ?? pin ?? null
  const pinDistance = useMemo(() => {
    if (!effectivePin || !ball) return null
    return Math.round(distanceYards(ball, effectivePin))
  }, [effectivePin, ball])

  const aimLine = useMemo(() => {
    if (isPinMode) return null
    if (!ball || !aim) return null
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: [toCoord(ball), toCoord(aim)],
      },
    }
  }, [ball, aim, isPinMode])

  function handleTap(feature: unknown) {
    const c = extractCoord(feature)
    if (!c) return
    if (isPinMode) {
      onPlacePin?.(c)
    } else {
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
        >
          <Mapbox.Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: toCoord(center),
              zoomLevel: 16,
            }}
          />

          {aimLine && (
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

          {/* Stored hole pin: dim flag, only when no per-round pin. */}
          {!roundPin && pin && (
            <Mapbox.PointAnnotation id="pin" coordinate={toCoord(pin)}>
              <Flag tone="dim" />
            </Mapbox.PointAnnotation>
          )}

          {/* Per-round pin: prominent flag. */}
          {roundPin && (
            <Mapbox.PointAnnotation id="roundPin" coordinate={toCoord(roundPin)}>
              <Flag tone="strong" />
            </Mapbox.PointAnnotation>
          )}

          {!isPinMode && aim && (
            <Mapbox.PointAnnotation id="aim" coordinate={toCoord(aim)}>
              <Marker color="#A66A1F" border="#FBF8F1" size={12} />
            </Mapbox.PointAnnotation>
          )}

          {!isPinMode && ball && (
            <Mapbox.PointAnnotation
              id="ball"
              coordinate={toCoord(ball)}
              draggable
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
              : 'Long-press: aim · Tap: ball · Drag the green marker'}
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
              {pinDistance} yd to pin
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
