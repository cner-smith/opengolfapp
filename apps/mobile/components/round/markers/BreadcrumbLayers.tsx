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
  /**
   * Out-of-bounds flag per shot, index-aligned with `previousShots` (#839).
   * Optional/undefined-safe so callers that haven't threaded OB data yet
   * (there are none left, but keep this defensive) still render plain
   * waypoints.
   */
  obs?: boolean[]
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
  obs,
}: BreadcrumbLayersProps) {
  const waypointFeatures = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({
      type: 'FeatureCollection',
      features: previousShots.map((p, i) => ({
        type: 'Feature',
        properties: { n: i + 1, ob: obs?.[i] === true },
        geometry: { type: 'Point', coordinates: toCoord(p) },
      })),
    }),
    [previousShots, obs],
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
        {/* OB badge ring (#839). An OB shot's re-hit starts from the exact
            same coordinates (stroke-and-distance — no renumbering, the
            re-hit is just the next struck-shot number), so its waypoint
            disc lands directly on top of the OB shot's disc below. A same-
            radius recolor alone would just have one circle silently win the
            stacking order and look like a rendering glitch. This wider
            stroked ring is declared BELOW the disc/number layers (rendered
            first = underneath) and sized past the disc's radius, so its red
            edge always peeks out around whichever disc ends up on top —
            reading as an intentional "penalty happened here" badge rather
            than a double-render. Renders only for the OB shot's own
            feature; the covering re-hit disc has ob=false and gets no ring. */}
        <Mapbox.CircleLayer
          id="prevShotsObRing"
          filter={['==', ['get', 'ob'], true]}
          style={{
            circleRadius: 15,
            circleColor: 'rgba(0,0,0,0)',
            circleStrokeColor: '#A33A2A',
            circleStrokeWidth: 3,
          }}
        />
        <Mapbox.CircleLayer
          id="prevShotsWaypointDisc"
          style={{
            circleRadius: 10,
            // caddie-neg (#A33A2A) for the shot that went OB, matching the
            // live chip / scorecard penalty color; amber for everything else.
            circleColor: ['case', ['==', ['get', 'ob'], true], '#A33A2A', '#A66A1F'],
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
