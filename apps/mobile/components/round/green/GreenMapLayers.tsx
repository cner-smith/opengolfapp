import { useMemo } from 'react'
import { Platform } from 'react-native'
import Mapbox from '@rnmapbox/maps'
import { greenFrame, gridCorners, gridPointGeo, hachureTriangle, paceLines, pinSheet, type GeoPoint } from '@oga/core'
import { P } from '../../paper/tokens'
import type { GreenMode } from './GreenDrawing'
import type { PreparedGreen } from './greenData'

// The green on the map (#1381): the view's Slope or Height picture as a
// georeferenced ImageSource + RasterLayer, its marks and contours as GeoJSON
// ShapeSources, and the optional pace lines. Only at green zoom, only once the
// player turns it on in the view, and always under the shot crumbs and aim.
const MIN_ZOOM = 17
const PACE_M = 0.9144
// Under the layer @rnmapbox draws every PointAnnotation into (the flag, the
// ball, the crumbs' plates), named per platform in its RNMBXMapView. Mounted
// layers wait for it; the live map always has the ball or tee on it.
const BELOW = Platform.OS === 'ios' ? 'RNMBX-mapview-point-annotations' : 'RNMBX-mapview-annotations'

const coord = (p: GeoPoint): [number, number] => [p.lng, p.lat]

export function GreenMapLayers({
  green,
  mode,
  approach,
  pin,
  paceLines: withPaces,
}: {
  green: PreparedGreen
  mode: GreenMode
  approach: number
  pin: GeoPoint | null
  paceLines: boolean
}) {
  const lidar = typeof green.lidar === 'object' ? green.lidar : null
  const shown = lidar ? mode : 'plain'

  const corners = useMemo(() => {
    if (!lidar) return null
    return gridCorners(lidar.grid.width, lidar.grid.height).map(([e, so]) =>
      coord(gridPointGeo(lidar.lng0, lidar.lat0, e, so)),
    ) as [[number, number], [number, number], [number, number], [number, number]]
  }, [lidar])

  const marks = useMemo((): GeoJSON.FeatureCollection => {
    if (!lidar || shown !== 'slope') return { type: 'FeatureCollection', features: [] }
    return {
      type: 'FeatureCollection',
      features: lidar.hachures.map((m) => {
        const w = hachureTriangle(m).map(([e, so]) => coord(gridPointGeo(lidar.lng0, lidar.lat0, e, so)))
        return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...w, w[0]!]] } }
      }),
    }
  }, [lidar, shown])

  const contours = useMemo((): GeoJSON.FeatureCollection => {
    if (!lidar || shown !== 'height') return { type: 'FeatureCollection', features: [] }
    const to = (e: number, so: number) => coord(gridPointGeo(lidar.lng0, lidar.lat0, e, so))
    const lines = lidar.contours.levels.flatMap((l) => l.segments.map(([e1, s1, e2, s2]) => [to(e1, s1), to(e2, s2)]))
    return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: lines } }] }
  }, [lidar, shown])

  const paces = useMemo((): GeoJSON.FeatureCollection => {
    const sheet = withPaces && pin ? pinSheet(green.ring, pin, approach) : null
    if (!sheet || !pin) return { type: 'FeatureCollection', features: [] }
    // Each piece's count: its distance forward of the pin, plus the pin's paces on.
    const f = greenFrame(pin, approach)
    const labelled = new Set<number>()
    return {
      type: 'FeatureCollection',
      features: paceLines(green.ring, pin, approach).flatMap(([a, b]) => {
        const count = Math.round(f.toLocal(a!).y / PACE_M + sheet.onPaces)
        const line = { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: [coord(a!), coord(b!)] } }
        if (labelled.has(count)) return [line]
        labelled.add(count)
        // The count at the line's left end.
        return [line, { type: 'Feature' as const, properties: { label: String(count) }, geometry: { type: 'Point' as const, coordinates: coord(a!) } }]
      }),
    }
  }, [green.ring, pin, approach, withPaces])

  const outline = useMemo(
    (): GeoJSON.Feature => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: green.ring.map(coord) } }),
    [green.ring],
  )

  return (
    <>
      {lidar && corners && shown !== 'plain' && (
        <Mapbox.ImageSource id="green-picture" url={shown === 'slope' ? lidar.slopeUri : lidar.heightUri} coordinates={corners}>
          <Mapbox.RasterLayer
            id="green-picture-layer"
            // Under the always-mounted contours, so a picture switched on later
            // still sits under the marks and lines.
            belowLayerID="green-contours-layer"
            minZoomLevel={MIN_ZOOM}
            style={{ rasterOpacity: 0.9, rasterResampling: 'linear', rasterFadeDuration: 0 }}
          />
        </Mapbox.ImageSource>
      )}
      <Mapbox.ShapeSource id="green-contours" shape={contours}>
        <Mapbox.LineLayer id="green-contours-layer" belowLayerID={BELOW} minZoomLevel={MIN_ZOOM} style={{ lineColor: P.ink, lineOpacity: 0.4, lineWidth: 1 }} />
      </Mapbox.ShapeSource>
      <Mapbox.ShapeSource id="green-marks" shape={marks}>
        <Mapbox.FillLayer id="green-marks-fill" belowLayerID={BELOW} minZoomLevel={MIN_ZOOM} style={{ fillColor: P.raised }} />
        <Mapbox.LineLayer id="green-marks-edge" belowLayerID={BELOW} minZoomLevel={MIN_ZOOM} style={{ lineColor: 'rgba(28,33,28,.65)', lineWidth: 0.8 }} />
      </Mapbox.ShapeSource>
      <Mapbox.ShapeSource id="green-outline" shape={outline}>
        <Mapbox.LineLayer id="green-outline-layer" belowLayerID={BELOW} minZoomLevel={MIN_ZOOM} style={{ lineColor: P.raised, lineWidth: 2, lineJoin: 'round' }} />
      </Mapbox.ShapeSource>
      <Mapbox.ShapeSource id="green-paces" shape={paces}>
        <Mapbox.LineLayer id="green-paces-layer" filter={['==', ['geometry-type'], 'LineString']} belowLayerID={BELOW} minZoomLevel={MIN_ZOOM} style={{ lineColor: P.raised, lineWidth: 1.2 }} />
        <Mapbox.SymbolLayer
          id="green-paces-label"
          belowLayerID={BELOW}
          minZoomLevel={MIN_ZOOM + 1}
          filter={['==', ['geometry-type'], 'Point']}
          style={{
            textField: ['get', 'label'],
            textSize: 12,
            textColor: '#F2EEE5',
            textHaloColor: 'rgba(28,33,28,0.85)',
            textHaloWidth: 1.5,
            textAnchor: 'right',
            textOffset: [-0.4, 0],
            textAllowOverlap: true,
            textIgnorePlacement: true,
          }}
        />
      </Mapbox.ShapeSource>
    </>
  )
}
