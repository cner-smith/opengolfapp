import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { mapboxgl, MAPBOX_TOKEN_PRESENT } from '../../lib/mapbox'
import { haversineYards } from '@oga/core'
import { useUnits } from '../../hooks/useUnits'

export interface HoleGeo {
  id: string
  number: number
  par: number
  yards: number | null
  teeLat: number | null
  teeLng: number | null
  pinLat: number | null
  pinLng: number | null
}

export interface ExistingShot {
  id: string
  shotNumber: number
  endLat: number | null
  endLng: number | null
  startLat: number | null
  startLng: number | null
  category?: 'tee' | 'approach' | 'around-green' | 'putt' | null
}

export interface PlacedPoint {
  lat: number
  lng: number
}

interface RoundMapProps {
  hole: HoleGeo | null
  /** Pre-existing shots (live-tracked or previously saved). */
  existingShots: ExistingShot[]
  /** Tap-placed points for the active hole when no existing shots are
   *  logged. The parent owns this state so it can persist across
   *  re-renders and feed the review sheet. */
  placedPoints: PlacedPoint[]
  /** Local override for the pin and tee positions while the user is
   *  reviewing a hole. When set, these win over the values inside
   *  `hole.pinLat/pinLng` / `hole.teeLat/teeLng`. */
  pinOverride?: PlacedPoint | null
  teeOverride?: PlacedPoint | null
  onPlace: (point: PlacedPoint) => void
  onMovePoint: (index: number, point: PlacedPoint) => void
  onMovePin?: (point: PlacedPoint) => void
  onMoveTee?: (point: PlacedPoint) => void
  onClearPoints: () => void
  onUndoPoint: () => void
  onDoneWithHole: () => void
}

const MARKER_COLORS = {
  tee: '#1C211C',
  approach: '#A66A1F',
  green: '#1F3D2C',
  putt: '#1F3D2C',
  ball: '#1F3D2C',
  pin: '#A33A2A',
} as const

export function RoundMap({
  hole,
  existingShots,
  placedPoints,
  pinOverride,
  teeOverride,
  onPlace,
  onMovePoint,
  onMovePin,
  onMoveTee,
  onClearPoints,
  onUndoPoint,
  onDoneWithHole,
}: RoundMapProps) {
  const effectivePin =
    pinOverride ??
    (hole && hole.pinLat != null && hole.pinLng != null
      ? { lat: hole.pinLat, lng: hole.pinLng }
      : null)
  const effectiveTee =
    teeOverride ??
    (hole && hole.teeLat != null && hole.teeLng != null
      ? { lat: hole.teeLat, lng: hole.teeLng }
      : null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markerRefs = useRef<mapboxgl.Marker[]>([])
  const lineSourceId = 'shot-line'
  const placedLineSourceId = 'placed-line'

  const hasExistingShots = existingShots.some(
    (s) => s.endLat != null && s.endLng != null,
  )
  const center = useMemo<[number, number] | null>(() => {
    if (effectivePin) return [effectivePin.lng, effectivePin.lat]
    if (effectiveTee) return [effectiveTee.lng, effectiveTee.lat]
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hole?.id])

  // Initialize the map once on mount.
  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN_PRESENT) return
    if (mapRef.current) return
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: center ?? [-97.5, 35.5],
      zoom: center ? 17 : 12,
      attributionControl: false,
    })
    map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      'bottom-right',
    )
    // Zoom + / – live in the bottom-right corner so they don't fight the
    // instruction strip across the top of the map.
    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      'bottom-right',
    )
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Fly to the active hole when it changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !center) return
    map.flyTo({ center, zoom: 17, speed: 1.4 })
  }, [center?.[0], center?.[1]])

  // Wire a click handler for tap-to-place on holes that have no live shots.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    function onClick(e: mapboxgl.MapMouseEvent) {
      if (hasExistingShots) return
      onPlace({ lat: e.lngLat.lat, lng: e.lngLat.lng })
    }
    map.on('click', onClick)
    return () => {
      map.off('click', onClick)
    }
  }, [onPlace, hasExistingShots])

  // Render markers + connecting line for either existing shots or placed points.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    // Wait for style.
    if (!map.isStyleLoaded()) {
      map.once('styledata', () => renderLayers())
      return
    }
    renderLayers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hole?.id, hasExistingShots, placedPoints, existingShots])

  const renderLayers = useCallback(() => {
    const map = mapRef.current
    if (!map || !hole) return

    // Clear old markers.
    for (const m of markerRefs.current) m.remove()
    markerRefs.current = []

    // Tee marker — draggable when a parent handler is wired in.
    if (effectiveTee) {
      const el = makeIconMarker('TEE', '#FBF8F1', '#5C6356')
      el.title = onMoveTee
        ? 'Drag to move the tee for this hole'
        : 'Tee box'
      const marker = new mapboxgl.Marker({
        element: el,
        draggable: !!onMoveTee,
      })
        .setLngLat([effectiveTee.lng, effectiveTee.lat])
        .addTo(map)
      if (onMoveTee) {
        marker.on('dragend', () => {
          const ll = marker.getLngLat()
          onMoveTee({ lat: ll.lat, lng: ll.lng })
        })
      }
      markerRefs.current.push(marker)
    }

    // Pin marker — draggable when a parent handler is wired in.
    if (effectivePin) {
      const el = makeFlagMarker(MARKER_COLORS.pin)
      el.title = onMovePin
        ? 'Drag to set pin position'
        : 'Pin'
      const marker = new mapboxgl.Marker({
        element: el,
        anchor: 'bottom',
        draggable: !!onMovePin,
      })
        .setLngLat([effectivePin.lng, effectivePin.lat])
        .addTo(map)
      if (onMovePin) {
        marker.on('dragend', () => {
          const ll = marker.getLngLat()
          onMovePin({ lat: ll.lat, lng: ll.lng })
        })
      }
      markerRefs.current.push(marker)
    }

    // Existing shots: numbered markers + dashed trajectory.
    const existingValid = existingShots.filter(
      (s) => s.endLat != null && s.endLng != null,
    )
    for (const s of existingValid) {
      const color =
        s.category === 'tee'
          ? MARKER_COLORS.tee
          : s.category === 'approach'
            ? MARKER_COLORS.approach
            : s.category === 'around-green'
              ? MARKER_COLORS.approach
              : MARKER_COLORS.green
      const el = makeNumberedMarker(s.shotNumber, color, '#FBF8F1')
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([s.endLng!, s.endLat!])
        .addTo(map)
      markerRefs.current.push(marker)
    }

    // Placed points (tap-to-place mode).
    placedPoints.forEach((p, idx) => {
      const el = makeNumberedMarker(idx + 1, MARKER_COLORS.ball, '#FBF8F1')
      const marker = new mapboxgl.Marker({ element: el, draggable: true })
        .setLngLat([p.lng, p.lat])
        .addTo(map)
      marker.on('dragend', () => {
        const ll = marker.getLngLat()
        onMovePoint(idx, { lat: ll.lat, lng: ll.lng })
      })
      markerRefs.current.push(marker)
    })

    // Trajectory line (existing shots).
    const existingCoords = buildLineCoords(effectiveTee, existingValid)
    upsertLine(map, lineSourceId, existingCoords, '#FBF8F1')

    // Trajectory line (placed points): tee → placed[0] → ... → placed[n-1].
    const placedCoords =
      placedPoints.length === 0
        ? []
        : [
            ...(effectiveTee
              ? [[effectiveTee.lng, effectiveTee.lat] as [number, number]]
              : []),
            ...placedPoints.map((p) => [p.lng, p.lat] as [number, number]),
          ]
    upsertLine(map, placedLineSourceId, placedCoords, '#A66A1F')
  }, [
    existingShots,
    hole,
    placedPoints,
    onMovePoint,
    onMovePin,
    onMoveTee,
    effectivePin?.lat,
    effectivePin?.lng,
    effectiveTee?.lat,
    effectiveTee?.lng,
  ])

  const lastPoint = placedPoints[placedPoints.length - 1] ?? null
  const remainingToPin =
    lastPoint && effectivePin
      ? Math.round(
          haversineYards(
            lastPoint.lat,
            lastPoint.lng,
            effectivePin.lat,
            effectivePin.lng,
          ),
        )
      : null

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          inset: 0,
          background: '#1C211C',
        }}
      />
      {!MAPBOX_TOKEN_PRESENT && (
        <div
          className="absolute inset-0 flex items-center justify-center text-caddie-ink-mute"
          style={{ background: '#FBF8F1', fontSize: 13, padding: 22 }}
        >
          Map unavailable — set <code style={{ marginInline: 4 }}>VITE_MAPBOX_TOKEN</code> in your env to enable the map view.
        </div>
      )}

      {hole && (
        <InstructionStrip
          hasExistingShots={hasExistingShots}
          shotsPlaced={placedPoints.length}
          remainingToPin={remainingToPin}
          onUndo={onUndoPoint}
          onClear={onClearPoints}
          onDone={onDoneWithHole}
        />
      )}
    </div>
  )
}

function InstructionStrip({
  hasExistingShots,
  shotsPlaced,
  remainingToPin,
  onUndo,
  onClear,
  onDone,
}: {
  hasExistingShots: boolean
  shotsPlaced: number
  remainingToPin: number | null
  onUndo: () => void
  onClear: () => void
  onDone: () => void
}) {
  const placingNumber = shotsPlaced + 1
  const { toDisplay } = useUnits()
  return (
    <div
      className="absolute"
      style={{
        top: 12,
        left: 12,
        right: 12,
        background: '#FBF8F1',
        border: '1px solid #D9D2BF',
        borderRadius: 2,
        padding: '10px 14px',
        display: 'flex',
        gap: 14,
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ minWidth: 200 }}>
        {hasExistingShots ? (
          <>
            <div className="kicker" style={{ marginBottom: 2 }}>
              Logged hole
            </div>
            <div className="text-caddie-ink" style={{ fontSize: 13 }}>
              Drag any marker to refine its position.
            </div>
          </>
        ) : (
          <>
            <div className="kicker" style={{ marginBottom: 2 }}>
              Tap to place shot {placingNumber}
            </div>
            <div
              className="text-caddie-ink-dim"
              style={{ fontSize: 12 }}
            >
              {shotsPlaced === 0
                ? 'Anywhere on the map.'
                : `${shotsPlaced} shot${shotsPlaced === 1 ? '' : 's'} placed${
                    remainingToPin != null
                      ? ` · ${toDisplay(remainingToPin)} to pin`
                      : ''
                  }.`}
            </div>
          </>
        )}
      </div>
      {!hasExistingShots && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            disabled={shotsPlaced === 0}
            onClick={onUndo}
            className="text-caddie-ink-dim disabled:opacity-40"
            style={{
              border: '1px solid #D9D2BF',
              borderRadius: 2,
              padding: '6px 10px',
              fontSize: 12,
              background: 'transparent',
            }}
          >
            Undo
          </button>
          <button
            type="button"
            disabled={shotsPlaced === 0}
            onClick={onClear}
            className="text-caddie-ink-dim disabled:opacity-40"
            style={{
              border: '1px solid #D9D2BF',
              borderRadius: 2,
              padding: '6px 10px',
              fontSize: 12,
              background: 'transparent',
            }}
          >
            Clear
          </button>
          <button
            type="button"
            disabled={shotsPlaced === 0}
            onClick={onDone}
            className="bg-caddie-accent text-caddie-accent-ink disabled:opacity-40"
            style={{
              borderRadius: 2,
              padding: '6px 12px',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.02em',
            }}
          >
            Done with hole →
          </button>
        </div>
      )}
    </div>
  )
}

function buildLineCoords(
  tee: PlacedPoint | null,
  existing: ExistingShot[],
): [number, number][] {
  const coords: [number, number][] = []
  if (tee) coords.push([tee.lng, tee.lat])
  for (const s of existing) {
    if (s.endLat == null || s.endLng == null) continue
    coords.push([s.endLng, s.endLat])
  }
  return coords
}

function upsertLine(
  map: mapboxgl.Map,
  sourceId: string,
  coords: [number, number][],
  color: string,
) {
  const layerId = `${sourceId}-layer`
  const data: GeoJSON.Feature<GeoJSON.LineString> = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: coords },
  }
  const src = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined
  if (src) {
    src.setData(data)
  } else {
    map.addSource(sourceId, { type: 'geojson', data })
    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': color,
        'line-width': 1.5,
        'line-dasharray': [3, 2],
        'line-opacity': 0.85,
      },
    })
  }
}

// ---------------------------------------------------------------------------
// DOM marker factories — keep them lightweight, no React per marker.
// ---------------------------------------------------------------------------

function makeNumberedMarker(n: number, fill: string, text: string): HTMLElement {
  const el = document.createElement('div')
  el.style.width = '24px'
  el.style.height = '24px'
  el.style.borderRadius = '999px'
  el.style.background = fill
  el.style.color = text
  el.style.fontFamily = 'Inter, sans-serif'
  el.style.fontWeight = '600'
  el.style.fontSize = '12px'
  el.style.display = 'flex'
  el.style.alignItems = 'center'
  el.style.justifyContent = 'center'
  el.style.border = '2px solid #FBF8F1'
  el.style.cursor = 'grab'
  el.textContent = String(n)
  return el
}

function makeIconMarker(label: string, bg: string, fg: string): HTMLElement {
  const el = document.createElement('div')
  el.style.padding = '3px 6px'
  el.style.background = bg
  el.style.color = fg
  el.style.fontFamily = 'JetBrains Mono, monospace'
  el.style.fontSize = '9px'
  el.style.letterSpacing = '0.14em'
  el.style.fontWeight = '500'
  el.style.border = `1px solid ${fg}`
  el.style.borderRadius = '2px'
  el.textContent = label
  return el
}

function makeFlagMarker(color: string): HTMLElement {
  const el = document.createElement('div')
  el.style.width = '16px'
  el.style.height = '24px'
  el.style.position = 'relative'
  el.innerHTML = `
    <div style="position:absolute;left:6px;top:0;width:2px;height:24px;background:#FBF8F1"></div>
    <div style="position:absolute;left:8px;top:1px;width:9px;height:7px;background:${color}"></div>
    <div style="position:absolute;left:5px;top:22px;width:4px;height:2px;border-radius:1px;background:#FBF8F1"></div>
  `
  return el
}
