import { useMemo } from 'react'
import Mapbox from '@rnmapbox/maps'
import type { LatLng } from '../HoleMap.types'

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

// Renders the orange breadcrumb line through prior shot starts, numbered
// waypoint discs at each start, and small midpoint distance labels per
// segment. Implemented as pure Mapbox GL layers (ShapeSource + Circle /
// SymbolLayer) — no PointAnnotations. Each PointAnnotation creates a
// native ViewAnnotation bridging a React tree; at >10 instances per map
// @rnmapbox/maps gets unhappy and a 5-shot par-5 hits 14 of them.
export function BreadcrumbLayers({
  previousShots,
  previousShotsLine,
  segments,
  styleLoaded,
  isPinMode,
  toDisplay,
}: BreadcrumbLayersProps) {
  const waypointFeatures = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({
      type: 'FeatureCollection',
      features: previousShots.map((p, i) => ({
        type: 'Feature',
        properties: { n: i + 1 },
        geometry: { type: 'Point', coordinates: toCoord(p) },
      })),
    }),
    [previousShots],
  )

  const segmentFeatures = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({
      type: 'FeatureCollection',
      features: segments.map((s) => ({
        type: 'Feature',
        properties: { label: toDisplay(s.yards) },
        geometry: { type: 'Point', coordinates: toCoord(s.midpoint) },
      })),
    }),
    [segments, toDisplay],
  )

  if (isPinMode) return null
  // ShapeSource / LineLayer / SymbolLayer all crash native with
  // "Source X is not in style" if mounted before the satellite style
  // finishes loading. Gate every layer behind this flag.
  if (!styleLoaded) return null

  return (
    <>
      <Mapbox.ShapeSource
        id="prevShotsLine"
        shape={previousShotsLine ?? { type: 'FeatureCollection', features: [] }}
      >
        <Mapbox.LineLayer
          id="prevShotsLineLayer"
          style={{
            lineColor: '#A66A1F',
            lineWidth: 1.5,
            lineOpacity: 0.7,
          }}
        />
      </Mapbox.ShapeSource>

      <Mapbox.ShapeSource id="prevShotsWaypoints" shape={waypointFeatures}>
        <Mapbox.CircleLayer
          id="prevShotsWaypointDisc"
          style={{
            circleRadius: 10,
            circleColor: '#A66A1F',
            circleStrokeColor: '#FBF8F1',
            circleStrokeWidth: 2,
          }}
        />
        <Mapbox.SymbolLayer
          id="prevShotsWaypointNumber"
          style={{
            textField: ['get', 'n'],
            textSize: 11,
            textColor: '#FBF8F1',
            textAllowOverlap: true,
            textIgnorePlacement: true,
          }}
        />
      </Mapbox.ShapeSource>

      <Mapbox.ShapeSource id="prevShotsSegments" shape={segmentFeatures}>
        <Mapbox.SymbolLayer
          id="prevShotsSegmentLabel"
          style={{
            textField: ['get', 'label'],
            textSize: 11,
            textColor: '#F2EEE5',
            textHaloColor: 'rgba(28,33,28,0.85)',
            textHaloWidth: 1.5,
            textAllowOverlap: true,
            textIgnorePlacement: true,
          }}
        />
      </Mapbox.ShapeSource>
    </>
  )
}
