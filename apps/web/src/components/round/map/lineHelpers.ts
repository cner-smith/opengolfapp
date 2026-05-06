import { mapboxgl } from '../../../lib/mapbox'

export interface MinimalShot {
  startLat: number | null
  startLng: number | null
  endLat: number | null
  endLng: number | null
}

export interface MinimalPoint {
  lat: number
  lng: number
}

export function buildLineCoords(
  existing: MinimalShot[],
  pin: MinimalPoint | null,
): [number, number][] {
  const coords: [number, number][] = []
  for (const s of existing) {
    const lng = s.startLng ?? s.endLng
    const lat = s.startLat ?? s.endLat
    if (lat == null || lng == null) continue
    coords.push([lng, lat])
  }
  if (pin && coords.length > 0) coords.push([pin.lng, pin.lat])
  return coords
}

export function upsertDashedLines(
  map: mapboxgl.Map,
  sourceId: string,
  segments: [number, number][][],
  color: string,
) {
  const layerId = `${sourceId}-layer`
  const data: GeoJSON.Feature<GeoJSON.MultiLineString> = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'MultiLineString', coordinates: segments },
  }
  const src = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined
  if (src) {
    src.setData(data)
    return
  }
  map.addSource(sourceId, { type: 'geojson', data })
  map.addLayer({
    id: layerId,
    type: 'line',
    source: sourceId,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': color,
      'line-width': 1.5,
      'line-dasharray': [4, 3],
      'line-opacity': 0.85,
    },
  })
}

export function upsertLine(
  map: mapboxgl.Map,
  sourceId: string,
  coords: [number, number][],
  color: string,
) {
  const layerId = `${sourceId}-layer`
  const outlineLayerId = `${sourceId}-outline`
  const data: GeoJSON.Feature<GeoJSON.LineString> = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: coords },
  }
  const src = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined
  if (src) {
    src.setData(data)
    return
  }
  map.addSource(sourceId, { type: 'geojson', data })
  // Dark outline first so the amber line reads against both bright
  // satellite (sand) and dark areas (rough/water). Without the outline
  // the warn amber disappeared into fall fairway tiles.
  map.addLayer({
    id: outlineLayerId,
    type: 'line',
    source: sourceId,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': '#1C211C',
      'line-width': 4,
      'line-opacity': 0.55,
    },
  })
  map.addLayer({
    id: layerId,
    type: 'line',
    source: sourceId,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': color,
      'line-width': 2.5,
      'line-opacity': 1,
    },
  })
}
