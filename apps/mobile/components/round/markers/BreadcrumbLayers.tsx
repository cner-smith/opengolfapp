import { useMemo } from 'react'
import Mapbox from '@rnmapbox/maps'
import type { LatLng } from '../HoleMap.types'

// Pixel nudge for the OB disc when a re-hit covers it, matching web's
// [-20, 0] in useMapLayers.ts. `circle-translate` / `text-translate` are
// paint properties and are NOT data-driven, which is why the shifted and
// unshifted cases need separate layers rather than an expression (#839).
const OB_NUDGE: [number, number] = [-20, 0]

const OB_DISC_STYLE = {
  circleRadius: 10,
  // caddie-neg — matches the live chip / scorecard penalty colour.
  circleColor: '#A33A2A',
  circleStrokeColor: '#FBF8F1',
  circleStrokeWidth: 2,
} as const

const OB_NUMBER_STYLE = {
  textField: ['get', 'n'],
  textSize: 11,
  textColor: '#FBF8F1',
  textAllowOverlap: true,
  textIgnorePlacement: true,
} as const

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
  const waypointFeatures = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(() => {
    const coords = previousShots.map(toCoord)
    // Mirrors web's coincidence guard (useMapLayers.ts): the OB disc only
    // gets nudged aside when something else really is on the same
    // coordinate — a lone OB shot stays dead centre in its ring. Without
    // this the platforms disagree in exactly the case the guard exists for,
    // e.g. after tagging OB but before the re-hit is logged.
    const shareCount = new Map<string, number>()
    for (const c of coords) {
      const k = `${c[0]},${c[1]}`
      shareCount.set(k, (shareCount.get(k) ?? 0) + 1)
    }
    return {
      type: 'FeatureCollection',
      features: previousShots.map((_p, i) => {
        const c = coords[i]!
        const ob = obs?.[i] === true
        return {
          type: 'Feature',
          properties: {
            n: i + 1,
            ob,
            obShifted: ob && (shareCount.get(`${c[0]},${c[1]}`) ?? 0) > 1,
          },
          geometry: { type: 'Point', coordinates: c },
        }
      }),
    }
  }, [previousShots, obs])

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
        {/* Non-OB discs/numbers. The OB shot is split into its own pair of
            layers below so it can be nudged aside: the ring above marks the
            true origin, but the re-hit's disc lands on the exact same
            coordinate and was covering the OB shot's number entirely, so the
            map could show THAT a penalty happened but never WHICH shot took
            it. `circle-translate` / `text-translate` are pixel offsets and
            are NOT data-driven, which is why this needs separate layers
            rather than an expression (#839). */}
        <Mapbox.CircleLayer
          id="prevShotsWaypointDisc"
          filter={['!=', ['get', 'ob'], true]}
          style={{
            circleRadius: 10,
            circleColor: '#A66A1F',
            circleStrokeColor: '#FBF8F1',
            circleStrokeWidth: 2,
          }}
        />
        <Mapbox.SymbolLayer
          id="prevShotsWaypointNumber"
          filter={['!=', ['get', 'ob'], true]}
          style={{
            textField: ['get', 'n'],
            textSize: 11,
            textColor: '#FBF8F1',
            textAllowOverlap: true,
            textIgnorePlacement: true,
          }}
        />
        {/* Two pairs, not one: the nudge only applies when a re-hit really is
            on the same coordinate (obShifted). A lone OB shot renders dead
            centre in its ring, matching web. */}
        <Mapbox.CircleLayer
          id="prevShotsObDisc"
          filter={['all', ['==', ['get', 'ob'], true], ['!=', ['get', 'obShifted'], true]]}
          style={OB_DISC_STYLE}
        />
        <Mapbox.CircleLayer
          id="prevShotsObDiscShifted"
          filter={['all', ['==', ['get', 'ob'], true], ['==', ['get', 'obShifted'], true]]}
          style={{ ...OB_DISC_STYLE, circleTranslate: OB_NUDGE }}
        />
        <Mapbox.SymbolLayer
          id="prevShotsObNumber"
          filter={['all', ['==', ['get', 'ob'], true], ['!=', ['get', 'obShifted'], true]]}
          style={OB_NUMBER_STYLE}
        />
        <Mapbox.SymbolLayer
          id="prevShotsObNumberShifted"
          filter={['all', ['==', ['get', 'ob'], true], ['==', ['get', 'obShifted'], true]]}
          style={{ ...OB_NUMBER_STYLE, textTranslate: OB_NUDGE }}
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
