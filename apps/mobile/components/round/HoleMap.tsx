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

  useEffect(() => {
    cameraRef.current?.setCamera({
      centerCoordinate: toCoord(center),
      zoomLevel: 16,
      animationDuration: 400,
    })
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
            <View className="h-3 w-3 rounded-full border-2 border-white bg-blue-500" />
          </Mapbox.PointAnnotation>
        )}

        {pin && (
          <Mapbox.PointAnnotation id="pin" coordinate={toCoord(pin)}>
            <View className="h-3 w-3 rounded-full border-2 border-white bg-red-500" />
          </Mapbox.PointAnnotation>
        )}

        {aim && (
          <Mapbox.PointAnnotation id="aim" coordinate={toCoord(aim)}>
            <View className="h-4 w-4 rounded-full border-2 border-white bg-orange-500" />
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
            <View className="h-5 w-5 rounded-full border-2 border-white bg-emerald-500" />
          </Mapbox.PointAnnotation>
        )}
      </Mapbox.MapView>

      <View className="absolute left-3 top-3 rounded-md bg-black/60 px-3 py-1.5">
        <Text className="text-xs text-white">
          Long-press: aim · Tap: ball · Drag the green marker
        </Text>
      </View>

      {pinDistance !== null && (
        <View className="absolute right-3 top-3 rounded-md bg-black/60 px-3 py-1.5">
          <Text className="text-xs font-semibold text-white">{pinDistance} yd to pin</Text>
        </View>
      )}
    </View>
  )
}
