import { Text, View } from 'react-native'
import Mapbox from '@rnmapbox/maps'
import type { LatLng } from '../HoleMap.types'
import { NumberedMarker } from './NumberedMarker'

function toCoord(l: LatLng): [number, number] {
  return [l.lng, l.lat]
}

interface BreadcrumbLayersProps {
  previousShots: LatLng[]
  previousShotsLine: GeoJSON.Feature | null
  segments: { id: string; midpoint: LatLng; yards: number }[]
  styleLoaded: boolean
  isPinMode: boolean
  toDisplay: (yards: number) => string
}

// Renders the orange line through prior shot starts, numbered markers
// at each start, and small midpoint distance labels for each segment.
// Mounted as a child of Mapbox.MapView so all sources / annotations
// stay at the map level.
export function BreadcrumbLayers({
  previousShots,
  previousShotsLine,
  segments,
  styleLoaded,
  isPinMode,
  toDisplay,
}: BreadcrumbLayersProps) {
  if (isPinMode) return null
  return (
    <>
      {styleLoaded && previousShotsLine && (
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

      {previousShots.map((p, i) => (
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
      {segments.map((seg) => (
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
    </>
  )
}
