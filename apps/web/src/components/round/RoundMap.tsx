import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { mapboxgl, MAPBOX_TOKEN_PRESENT } from '../../lib/mapbox'
import { haversineYards } from '@oga/core'
// useUnits stays imported for the strip (re-exported below).
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
  /** Suppress tap-to-place. Used in "Edit on map" mode so the user can
   *  drag existing markers without accidentally dropping new ones. */
  tapToPlaceDisabled?: boolean
  onPlace: (point: PlacedPoint) => void
  onMovePoint: (index: number, point: PlacedPoint) => void
  onMovePin?: (point: PlacedPoint) => void
  onMoveTee?: (point: PlacedPoint) => void
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
  tapToPlaceDisabled,
  onPlace,
  onMovePoint,
  onMovePin,
  onMoveTee,
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
      if (tapToPlaceDisabled) return
      onPlace({ lat: e.lngLat.lat, lng: e.lngLat.lng })
    }
    map.on('click', onClick)
    return () => {
      map.off('click', onClick)
    }
  }, [onPlace, hasExistingShots, tapToPlaceDisabled])

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
      const parts = makeIconMarker('TEE', '#FBF8F1', '#5C6356')
      const marker = new mapboxgl.Marker({
        element: parts.outer,
        draggable: !!onMoveTee,
      })
        .setLngLat([effectiveTee.lng, effectiveTee.lat])
        .addTo(map)
      if (onMoveTee) {
        attachDragFx({
          outer: parts.outer,
          content: parts.content,
          marker,
          tooltip: 'Drag to move tee',
        })
        marker.on('dragend', () => {
          const ll = marker.getLngLat()
          onMoveTee({ lat: ll.lat, lng: ll.lng })
        })
      } else {
        parts.outer.title = 'Tee box'
      }
      markerRefs.current.push(marker)
    }

    // Pin marker — draggable when a parent handler is wired in.
    if (effectivePin) {
      const parts = makeFlagMarker(MARKER_COLORS.pin)
      const marker = new mapboxgl.Marker({
        element: parts.outer,
        anchor: 'bottom',
        draggable: !!onMovePin,
      })
        .setLngLat([effectivePin.lng, effectivePin.lat])
        .addTo(map)
      if (onMovePin) {
        attachDragFx({
          outer: parts.outer,
          content: parts.content,
          marker,
          tooltip: 'Drag to move pin',
          // Pin tints to caddie-warn while dragging so the user can
          // tell "the flag is grabbed" from "the flag is just hovered."
          onDragColor: (active) => {
            parts.flag.style.background = active
              ? '#A66A1F'
              : MARKER_COLORS.pin
          },
        })
        marker.on('dragend', () => {
          const ll = marker.getLngLat()
          onMovePin({ lat: ll.lat, lng: ll.lng })
        })
      } else {
        parts.outer.title = 'Pin'
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
      const parts = makeNumberedMarker(s.shotNumber, color, '#FBF8F1')
      parts.outer.title = `Shot ${s.shotNumber}`
      const marker = new mapboxgl.Marker({ element: parts.outer })
        .setLngLat([s.endLng!, s.endLat!])
        .addTo(map)
      markerRefs.current.push(marker)
    }

    // Placed points (tap-to-place mode).
    placedPoints.forEach((p, idx) => {
      const parts = makeNumberedMarker(
        idx + 1,
        MARKER_COLORS.ball,
        '#FBF8F1',
      )
      const marker = new mapboxgl.Marker({
        element: parts.outer,
        draggable: true,
      })
        .setLngLat([p.lng, p.lat])
        .addTo(map)
      attachDragFx({
        outer: parts.outer,
        content: parts.content,
        marker,
        tooltip: 'Drag to adjust position',
      })
      marker.on('dragend', () => {
        const ll = marker.getLngLat()
        onMovePoint(idx, { lat: ll.lat, lng: ll.lng })
      })
      markerRefs.current.push(marker)
    })

    // Trajectory line (existing shots).
    const existingCoords = buildLineCoords(effectiveTee, existingValid)
    upsertLine(map, lineSourceId, existingCoords, '#FBF8F1')

    // Trajectory line (placed points): each marker is the START position
    // of a shot, so segment N→N+1 is the path of shot N. Drawing just
    // the markers in order without prepending the tee avoids a phantom
    // "tee → marker 1" segment, since marker 1 IS the tee position.
    const placedCoords =
      placedPoints.length === 0
        ? []
        : placedPoints.map((p) => [p.lng, p.lat] as [number, number])
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
    </div>
  )
}

interface RoundMapInstructionStripProps {
  hasExistingShots: boolean
  /** True while the user is dragging-to-correct from the review sheet. */
  editing?: boolean
  shotsPlaced: number
  remainingToPin: number | null
  onUndo: () => void
  onClear: () => void
  onDone: () => void
  onDoneEditing?: () => void
}

// Strip used to live inside the map as an absolute overlay, but the
// "Done" button kept colliding with Mapbox's zoom controls. It now
// renders as a separate full-width bar above the map. See MapView in
// RoundDetailPage for the layout.
export function RoundMapInstructionStrip({
  hasExistingShots,
  editing,
  shotsPlaced,
  remainingToPin,
  onUndo,
  onClear,
  onDone,
  onDoneEditing,
}: RoundMapInstructionStripProps) {
  const placingNumber = shotsPlaced + 1
  const { toDisplay } = useUnits()
  return (
    <div
      style={{
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
        {editing ? (
          <>
            <div className="kicker" style={{ marginBottom: 2 }}>
              Edit on map
            </div>
            <div className="text-caddie-ink" style={{ fontSize: 13 }}>
              Drag any marker to adjust where the shot was hit from.
            </div>
          </>
        ) : hasExistingShots ? (
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
              Tap where you hit shot {placingNumber} from
            </div>
            <div
              className="text-caddie-ink-dim"
              style={{ fontSize: 12 }}
            >
              {shotsPlaced === 0
                ? 'Start at the tee box.'
                : `${shotsPlaced} shot${shotsPlaced === 1 ? '' : 's'} placed${
                    remainingToPin != null
                      ? ` · ${toDisplay(remainingToPin)} to pin`
                      : ''
                  }.`}
            </div>
          </>
        )}
      </div>
      {editing ? (
        <button
          type="button"
          onClick={onDoneEditing}
          className="bg-caddie-accent text-caddie-accent-ink"
          style={{
            borderRadius: 2,
            padding: '6px 12px',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.02em',
          }}
        >
          Done editing →
        </button>
      ) : !hasExistingShots ? (
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
      ) : null}
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
//
// Mapbox writes inline `transform: translate3d(...)` on the marker's
// outer element to position it, so we can't put our own transform there
// (it would be wiped on the next pan). Each factory returns an outer
// (positioned by Mapbox) plus an inner `content` we own — that's where
// hover scale and drag glow are applied. See `attachDragFx`.
// ---------------------------------------------------------------------------

interface MarkerParts {
  outer: HTMLElement
  content: HTMLElement
}

function makeNumberedMarker(
  n: number,
  fill: string,
  text: string,
): MarkerParts {
  const outer = document.createElement('div')
  outer.style.display = 'flex'
  outer.style.alignItems = 'center'
  outer.style.justifyContent = 'center'
  const content = document.createElement('div')
  content.style.width = '24px'
  content.style.height = '24px'
  content.style.borderRadius = '999px'
  content.style.background = fill
  content.style.color = text
  content.style.fontFamily = 'Inter, sans-serif'
  content.style.fontWeight = '600'
  content.style.fontSize = '12px'
  content.style.display = 'flex'
  content.style.alignItems = 'center'
  content.style.justifyContent = 'center'
  content.style.border = '2px solid #FBF8F1'
  content.style.transition =
    'transform 120ms ease, box-shadow 120ms ease'
  content.textContent = String(n)
  outer.appendChild(content)
  return { outer, content }
}

function makeIconMarker(
  label: string,
  bg: string,
  fg: string,
): MarkerParts {
  const outer = document.createElement('div')
  const content = document.createElement('div')
  content.style.padding = '3px 6px'
  content.style.background = bg
  content.style.color = fg
  content.style.fontFamily = 'JetBrains Mono, monospace'
  content.style.fontSize = '9px'
  content.style.letterSpacing = '0.14em'
  content.style.fontWeight = '500'
  content.style.border = `1px solid ${fg}`
  content.style.borderRadius = '2px'
  content.style.transition =
    'transform 120ms ease, box-shadow 120ms ease'
  content.textContent = label
  outer.appendChild(content)
  return { outer, content }
}

interface FlagParts extends MarkerParts {
  flag: HTMLElement
}

function makeFlagMarker(color: string): FlagParts {
  const outer = document.createElement('div')
  const content = document.createElement('div')
  content.style.width = '16px'
  content.style.height = '24px'
  content.style.position = 'relative'
  content.style.transition =
    'transform 120ms ease, box-shadow 120ms ease'
  const pole = document.createElement('div')
  pole.style.cssText =
    'position:absolute;left:6px;top:0;width:2px;height:24px;background:#FBF8F1'
  const flag = document.createElement('div')
  flag.style.cssText = `position:absolute;left:8px;top:1px;width:9px;height:7px;background:${color};transition:background 120ms ease`
  const base = document.createElement('div')
  base.style.cssText =
    'position:absolute;left:5px;top:22px;width:4px;height:2px;border-radius:1px;background:#FBF8F1'
  content.appendChild(pole)
  content.appendChild(flag)
  content.appendChild(base)
  outer.appendChild(content)
  return { outer, content, flag }
}

function attachDragFx(opts: {
  outer: HTMLElement
  content: HTMLElement
  marker: mapboxgl.Marker
  tooltip: string
  onDragColor?: (active: boolean) => void
}) {
  const { outer, content, marker, tooltip, onDragColor } = opts
  outer.title = tooltip
  outer.style.cursor = 'grab'
  let dragging = false
  outer.addEventListener('mouseenter', () => {
    if (!dragging) content.style.transform = 'scale(1.2)'
  })
  outer.addEventListener('mouseleave', () => {
    if (!dragging) content.style.transform = ''
  })
  marker.on('dragstart', () => {
    dragging = true
    outer.style.cursor = 'grabbing'
    content.style.transform = 'scale(1.2)'
    content.style.boxShadow = '0 0 0 4px rgba(166,106,31,0.55)'
    onDragColor?.(true)
  })
  marker.on('dragend', () => {
    dragging = false
    outer.style.cursor = 'grab'
    content.style.transform = ''
    content.style.boxShadow = ''
    onDragColor?.(false)
  })
}
