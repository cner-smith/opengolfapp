import { useEffect, useRef, type MutableRefObject } from 'react'
import { gridCorners, gridPointGeo, hachureTriangle, type GeoPoint } from '@oga/core'
import { mapboxgl, fitHoleUpward } from '../../../lib/mapbox'
import { paintGreen, type GreenData, type GreenViewMode } from '../green/useGreenMap'

// The green at green zoom on the web map (#1380). Slope and Height paint
// through a canvas source (style spec: "a canvas source … provides an HTML5
// canvas element for display on the map"; GL JS CanvasSourceOptions:
// "`animate` should be set to `false` to improve performance"), a raster
// layer with `raster-resampling: linear` ("(Bi)linear filtering interpolates
// pixel values using the weighted average of the four closest original
// source pixels") so the 0.5 m cells read continuous. A canvas, not an image
// source, so no data: URL has to pass the CSP's connect-src. Hachures,
// contours, the outline and the pace lines are GeoJSON.

const OVERLAY_LAYERS = ['green-heat', 'green-marks', 'green-marks-edge', 'green-contours', 'green-outline']
const OVERLAY_SOURCES = ['green-heat', 'green-marks', 'green-contours', 'green-outline']
const INK = '#1C211C'
const CREAM = '#FBF8F1'

function clear(map: mapboxgl.Map, layers: string[], sources: string[]) {
  for (const id of layers) if (map.getLayer(id)) map.removeLayer(id)
  for (const id of sources) if (map.getSource(id)) map.removeSource(id)
}

function lines(coords: [number, number][][]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: coords.map((c) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: c } })),
  }
}

export function useGreenLayers({
  mapRef,
  mapLoaded,
  green,
  mode,
  show,
  paceLines,
  approachDeg,
  tee,
  pin,
}: {
  mapRef: MutableRefObject<mapboxgl.Map | null>
  mapLoaded: boolean
  green: GreenData | null
  mode: GreenViewMode
  /** The Green key is on: draw the green and fly to it. */
  show: boolean
  paceLines: GeoPoint[][]
  approachDeg: number
  tee: GeoPoint | null
  pin: GeoPoint | null
}) {
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    clear(map, OVERLAY_LAYERS, OVERLAY_SOURCES)
    if (!show || !green) return
    const s = green.survey
    const shown = green.lidar === 'ready' && s ? mode : 'plain'
    if (s && shown !== 'plain') {
      const canvas = document.createElement('canvas')
      paintGreen(canvas, s, shown)
      const corners = gridCorners(s.g.width, s.g.height).map(([e, so]) => {
        const q = gridPointGeo(s.lng0, s.lat0, e, so)
        return [q.lng, q.lat] as [number, number]
      })
      map.addSource('green-heat', {
        type: 'canvas',
        canvas,
        animate: false,
        coordinates: corners as [[number, number], [number, number], [number, number], [number, number]],
      })
      map.addLayer({
        id: 'green-heat',
        type: 'raster',
        source: 'green-heat',
        paint: { 'raster-resampling': 'linear', 'raster-fade-duration': 0, 'raster-opacity': 0.92 },
      })
      const geo = ([e, so]: [number, number]) => {
        const q = gridPointGeo(s.lng0, s.lat0, e, so)
        return [q.lng, q.lat] as [number, number]
      }
      if (shown === 'slope') {
        map.addSource('green-marks', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: s.hachures.map((h) => {
              const t = hachureTriangle(h).map(geo)
              return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...t, t[0]!]] } }
            }),
          },
        })
        map.addLayer({ id: 'green-marks', type: 'fill', source: 'green-marks', paint: { 'fill-color': CREAM } })
        map.addLayer({
          id: 'green-marks-edge',
          type: 'line',
          source: 'green-marks',
          paint: { 'line-color': INK, 'line-opacity': 0.65, 'line-width': 0.6 },
        })
      } else {
        map.addSource('green-contours', {
          type: 'geojson',
          data: lines(s.contours.levels.flatMap((l) => l.segments.map(([a, b, c, d]) => [geo([a, b]), geo([c, d])]))),
        })
        map.addLayer({
          id: 'green-contours',
          type: 'line',
          source: 'green-contours',
          paint: { 'line-color': '#ffffff', 'line-opacity': 0.6, 'line-width': 1 },
        })
      }
    }
    map.addSource('green-outline', { type: 'geojson', data: lines([green.outline.map((q) => [q.lng, q.lat])]) })
    map.addLayer({
      id: 'green-outline',
      type: 'line',
      source: 'green-outline',
      paint: { 'line-color': CREAM, 'line-width': 1.5 },
    })
    return () => {
      // The map may be gone already (unmount removes it first).
      if (mapRef.current === map) clear(map, OVERLAY_LAYERS, OVERLAY_SOURCES)
    }
  }, [mapRef, mapLoaded, green, mode, show])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    clear(map, ['green-pace'], ['green-pace'])
    if (paceLines.length === 0) return
    map.addSource('green-pace', { type: 'geojson', data: lines(paceLines.map((seg) => seg.map((q) => [q.lng, q.lat]))) })
    map.addLayer({
      id: 'green-pace',
      type: 'line',
      source: 'green-pace',
      paint: { 'line-color': CREAM, 'line-width': 1.2, 'line-dasharray': [3, 2] },
    })
    return () => {
      if (mapRef.current === map) clear(map, ['green-pace'], ['green-pace'])
    }
  }, [mapRef, mapLoaded, paceLines])

  // The key flies to the green, turned to the player's line, and back to the hole.
  const wasShown = useRef(false)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded || show === wasShown.current) return
    wasShown.current = show
    if (show && green) {
      const b = new mapboxgl.LngLatBounds()
      for (const q of green.outline) b.extend([q.lng, q.lat])
      map.fitBounds(b, { bearing: approachDeg, padding: 70, maxZoom: 21, duration: 600 })
    } else if (!show && tee && pin) {
      fitHoleUpward(map, tee, pin, { animate: true })
    }
    // Only the key moves the camera; a new pin or hole must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef, mapLoaded, show])
}
