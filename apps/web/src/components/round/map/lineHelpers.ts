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

// Shot-pattern dispersion ARC (tee mode). `coords` is the arc LineString from
// arcGeoJSON — its lateral SPAN encodes the dispersion width; the stroke is
// decorative. Drawn as a wide translucent "band" plus a thin solid core so it
// reads as a band rather than a flat line (mirrors the mobile overlay). Pass
// [] to clear. Always upserts so stale geometry vanishes on the next render.
export function upsertArcBand(
  map: mapboxgl.Map,
  sourceId: string,
  coords: [number, number][],
  color: string,
) {
  const bandLayerId = `${sourceId}-band`
  const coreLayerId = `${sourceId}-core`
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
  map.addLayer({
    id: bandLayerId,
    type: 'line',
    source: sourceId,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': color, 'line-width': 14, 'line-opacity': 0.18 },
  })
  map.addLayer({
    id: coreLayerId,
    type: 'line',
    source: sourceId,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': color, 'line-width': 2, 'line-opacity': 0.9 },
  })
}

// Shot-pattern approach CIRCLE (appr mode). `ring` is the Polygon coordinate
// array from circleGeoJSON (array-of-rings). Translucent fill + thin outline.
// Pass [] to clear.
export function upsertCircleFill(
  map: mapboxgl.Map,
  sourceId: string,
  ring: [number, number][][],
  color: string,
) {
  const fillLayerId = `${sourceId}-fill`
  const outlineLayerId = `${sourceId}-outline`
  const data: GeoJSON.Feature<GeoJSON.Polygon> = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: ring },
  }
  const src = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined
  if (src) {
    src.setData(data)
    return
  }
  map.addSource(sourceId, { type: 'geojson', data })
  map.addLayer({
    id: fillLayerId,
    type: 'fill',
    source: sourceId,
    paint: { 'fill-color': color, 'fill-opacity': 0.12 },
  })
  map.addLayer({
    id: outlineLayerId,
    type: 'line',
    source: sourceId,
    layout: { 'line-join': 'round' },
    paint: { 'line-color': color, 'line-width': 1.5, 'line-opacity': 0.9 },
  })
}

// Single-color dispersion DOTS (the player's aim-relative shot history scattered
// around the target). `points` is the projected [lng, lat] list from
// scatterGeoJSON; rendered as a CircleLayer (one small dot each, dark hairline
// for contrast on satellite). Pass [] to clear.
export function upsertScatter(
  map: mapboxgl.Map,
  sourceId: string,
  points: [number, number][],
  color: string,
) {
  const layerId = `${sourceId}-layer`
  const data: GeoJSON.Feature<GeoJSON.MultiPoint> = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'MultiPoint', coordinates: points },
  }
  const src = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined
  if (src) {
    src.setData(data)
    return
  }
  map.addSource(sourceId, { type: 'geojson', data })
  map.addLayer({
    id: layerId,
    type: 'circle',
    source: sourceId,
    paint: {
      'circle-radius': 3,
      'circle-color': color,
      'circle-opacity': 0.55,
      'circle-stroke-width': 0.5,
      'circle-stroke-color': '#1C211C',
    },
  })
}
