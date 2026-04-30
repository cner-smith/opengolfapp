import { useEffect, useMemo, useRef } from 'react'
import { Text, View } from 'react-native'
import Mapbox from '@rnmapbox/maps'
import { distanceYards, ensureMapboxInitialized } from '../../lib/maps'

ensureMapboxInitialized()

export interface LatLng {
  lat: number
  lng: number
}

interface HoleMapProps {
  center: LatLng
  pin?: LatLng | null
  tee?: LatLng | null
  aim?: LatLng | null
  ball?: LatLng | null
  onSetAim: (loc: LatLng) => void
  onSetBall: (loc: LatLng) => void
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
  tee,
  aim,
  ball,
  onSetAim,
  onSetBall,
}: HoleMapProps) {
  const cameraRef = useRef<Mapbox.Camera>(null)
  const cameraInitialized = useRef(false)

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

  const pinDistance = useMemo(() => {
    if (!pin || !ball) return null
    return Math.round(distanceYards(ball, pin))
  }, [pin, ball])

  function handleTap(feature: unknown) {
    const c = extractCoord(feature)
    if (c) onSetBall(c)
  }

  function handleLongPress(feature: unknown) {
    const c = extractCoord(feature)
    if (c) onSetAim(c)
  }

  return (
    <View className="relative flex-1">
      <Mapbox.MapView
        style={{ flex: 1 }}
        styleURL={Mapbox.StyleURL.Satellite}
        onPress={handleTap}
        onLongPress={handleLongPress}
      >
        <Mapbox.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: toCoord(center),
            zoomLevel: 16,
          }}
        />

        {tee && (
          <Mapbox.PointAnnotation id="tee" coordinate={toCoord(tee)}>
            <Marker color="#FFFFFF" border="#888880" size={10} />
          </Mapbox.PointAnnotation>
        )}

        {pin && (
          <Mapbox.PointAnnotation id="pin" coordinate={toCoord(pin)}>
            <Marker color="#E24B4A" border="#FFFFFF" size={10} />
          </Mapbox.PointAnnotation>
        )}

        {aim && (
          <Mapbox.PointAnnotation id="aim" coordinate={toCoord(aim)}>
            <Marker color="#EF9F27" border="#FFFFFF" size={12} />
          </Mapbox.PointAnnotation>
        )}

        {ball && (
          <Mapbox.PointAnnotation
            id="ball"
            coordinate={toCoord(ball)}
            draggable
            onDragEnd={(e: unknown) => {
              const c = extractCoord(e)
              if (c) onSetBall(c)
            }}
          >
            <Marker color="#1D9E75" border="#FFFFFF" size={14} />
          </Mapbox.PointAnnotation>
        )}
      </Mapbox.MapView>

      <View
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          backgroundColor: 'rgba(17,17,17,0.7)',
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 6,
        }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 10 }}>
          Long-press: aim · Tap: ball · Drag the green marker
        </Text>
      </View>

      {pinDistance !== null && (
        <View
          style={{
            position: 'absolute',
            right: 12,
            bottom: 12,
            backgroundColor: 'rgba(17,17,17,0.7)',
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 6,
          }}
        >
          <Text
            style={{
              color: '#FFFFFF',
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
  )
}

function Marker({ color, border, size }: { color: string; border: string; size: number }) {
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
