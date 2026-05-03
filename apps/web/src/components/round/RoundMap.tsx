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
  /** Course-level fallback coordinates. Used as the camera target when
   *  the hole has no tee/pin coords (most courses pre-OSM-import). The
   *  map zooms out to ~15 in that case so the player sees the whole
   *  property and can still tap to place shots manually. */
  courseLat?: number | null
  courseLng?: number | null
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
  /** Aim point per placed shot, parallel to placedPoints. Null when the
   *  user hasn't set an aim for that shot. Required to feed dispersion
   *  analysis — captured rather than inferred. */
  placedAims?: (PlacedPoint | null)[]
  /** When true, the next map tap sets aim for the most recently placed
   *  shot instead of pushing a new shot start marker. */
  aimMode?: boolean
  /** Monotonic counter — when it increments, fly to the pin at zoom 18
   *  to frame the green for the next putt placement. */
  focusGreenSignal?: number
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
  onSetAim?: (index: number, point: PlacedPoint | null) => void
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
  placedAims,
  aimMode,
  focusGreenSignal,
  pinOverride,
  teeOverride,
  tapToPlaceDisabled,
  onPlace,
  onMovePoint,
  onMovePin,
  onMoveTee,
  onSetAim,
}: RoundMapProps) {
  // Top-of-component log so we can confirm RoundMap mounts at all and
  // see the props actually arriving — the previous in-effect log only
  // fires after the first render, and a missing log there couldn't tell
  // us whether the component never rendered or just rendered with the
  // wrong inputs.
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log('[RoundMap] component rendering, props:', {
      holeId: hole?.id ?? null,
      holeNumber: hole?.number ?? null,
      teeLat: hole?.teeLat ?? null,
      teeLng: hole?.teeLng ?? null,
      pinLat: hole?.pinLat ?? null,
      pinLng: hole?.pinLng ?? null,
      courseLat: hole?.courseLat ?? null,
      courseLng: hole?.courseLng ?? null,
      placedPointsCount: placedPoints.length,
      existingShotsCount: existingShots.length,
    })
  }
  const { toDisplay } = useUnits()
  // Memoized so downstream effects can dep on the object directly without
  // thrashing on every parent render — coords are the only meaningful
  // identity here.
  const effectivePin = useMemo<PlacedPoint | null>(() => {
    const lat = pinOverride?.lat ?? hole?.pinLat ?? null
    const lng = pinOverride?.lng ?? hole?.pinLng ?? null
    if (lat == null || lng == null) return null
    return { lat, lng }
  }, [pinOverride?.lat, pinOverride?.lng, hole?.pinLat, hole?.pinLng])
  const effectiveTee = useMemo<PlacedPoint | null>(() => {
    const lat = teeOverride?.lat ?? hole?.teeLat ?? null
    const lng = teeOverride?.lng ?? hole?.teeLng ?? null
    if (lat == null || lng == null) return null
    return { lat, lng }
  }, [teeOverride?.lat, teeOverride?.lng, hole?.teeLat, hole?.teeLng])
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markerRefs = useRef<mapboxgl.Marker[]>([])
  const lineSourceId = 'shot-line'
  const placedLineSourceId = 'placed-line'

  const hasExistingShots = existingShots.some(
    (s) => s.endLat != null && s.endLng != null,
  )
  // Prefer tee over pin so a fresh past-round map opens looking down the
  // hole (where shot 1 starts) rather than zoomed straight at the green.
  // Falls back to pin, then to course-level coordinates so a course
  // without per-hole layout data still shows the property — the player
  // can still tap to place shots manually.
  const courseFallback = useMemo<[number, number] | null>(() => {
    if (hole?.courseLat == null || hole?.courseLng == null) return null
    return [hole.courseLng, hole.courseLat]
  }, [hole?.courseLat, hole?.courseLng])
  const center = useMemo<[number, number] | null>(() => {
    if (effectiveTee) return [effectiveTee.lng, effectiveTee.lat]
    if (effectivePin) return [effectivePin.lng, effectivePin.lat]
    return courseFallback
  }, [effectivePin, effectiveTee, courseFallback])
  const hasHoleLayout = effectiveTee != null || effectivePin != null
  // Per-hole layout missing → zoom out so the whole course is visible;
  // with layout, frame the hole tightly.
  const targetZoom = hasHoleLayout ? 17 : 15

  // Initialize the map once on mount.
  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN_PRESENT) return
    if (mapRef.current) return
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[RoundMap] init center', {
        center,
        targetZoom,
        teeLat: hole?.teeLat,
        pinLat: hole?.pinLat,
        courseLat: hole?.courseLat,
        courseLng: hole?.courseLng,
      })
    }
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: center ?? [-97.5, 35.5],
      zoom: center ? targetZoom : 12,
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

  // Fly to the active hole when it changes. Zoom adapts to whether
  // per-hole layout data is available — when only the course centroid
  // is known, frame wider so the player can still see the property.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !center) return
    map.flyTo({ center, zoom: targetZoom, speed: 1.4 })
  }, [center?.[0], center?.[1], targetZoom])

  // After a non-holed putt save the parent bumps focusGreenSignal —
  // fly in tight on the green so the next putt placement lands on the
  // right surface. The ref starts at the prop's initial value so the
  // first render doesn't auto-fire (signal=0 matches; only later
  // increments trigger the flyTo).
  const lastSignalRef = useRef<number | undefined>(focusGreenSignal)
  useEffect(() => {
    if (focusGreenSignal == null) return
    if (lastSignalRef.current === focusGreenSignal) return
    lastSignalRef.current = focusGreenSignal
    const map = mapRef.current
    if (!map) return
    if (!effectivePin) return
    map.flyTo({
      center: [effectivePin.lng, effectivePin.lat],
      zoom: 18,
      pitch: 0,
      duration: 800,
    })
  }, [focusGreenSignal, effectivePin])

  // Wire a click handler for tap-to-place on holes that have no live shots.
  // When aimMode is on, the next click sets aim for the most recently
  // placed shot instead of pushing a new shot marker.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    function onClick(e: mapboxgl.MapMouseEvent) {
      if (hasExistingShots) return
      if (tapToPlaceDisabled) return
      if (aimMode && onSetAim) {
        const idx = placedPoints.length - 1
        if (idx >= 0) {
          onSetAim(idx, { lat: e.lngLat.lat, lng: e.lngLat.lng })
        }
        return
      }
      onPlace({ lat: e.lngLat.lat, lng: e.lngLat.lng })
    }
    map.on('click', onClick)
    return () => {
      map.off('click', onClick)
    }
  }, [
    onPlace,
    hasExistingShots,
    tapToPlaceDisabled,
    aimMode,
    onSetAim,
    placedPoints.length,
  ])

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
    // Marker N renders at the START of shot N — that's "where the player
    // stood for shot N", matching the post-round tap flow. Falling back
    // to end coords for legacy rows that pre-date start_lat/lng.
    const existingValid = existingShots.filter(
      (s) =>
        (s.startLat != null && s.startLng != null) ||
        (s.endLat != null && s.endLng != null),
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
      const lng = s.startLng ?? s.endLng!
      const lat = s.startLat ?? s.endLat!
      const marker = new mapboxgl.Marker({ element: parts.outer })
        .setLngLat([lng, lat])
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

    // Trajectory line (existing shots): connect each shot's start
    // position in order, then close to the pin so the final segment
    // shows the last leg.
    const existingCoords = buildLineCoords(existingValid, effectivePin)
    upsertLine(map, lineSourceId, existingCoords, '#A66A1F')

    // Trajectory line (placed points): each marker is the START position
    // of a shot, so segment N→N+1 is the path of shot N. Closing to the
    // pin renders the final leg from the last marker through the cup.
    const placedCoords: [number, number][] =
      placedPoints.length === 0
        ? []
        : [
            ...placedPoints.map((p) => [p.lng, p.lat] as [number, number]),
            ...(effectivePin
              ? ([[effectivePin.lng, effectivePin.lat]] as [number, number][])
              : []),
          ]
    upsertLine(map, placedLineSourceId, placedCoords, '#A66A1F')

    // Per-segment distance pills. Renders midpoint label between every
    // pair of consecutive line coords for both existing and placed lines
    // so the player can see each shot's distance at a glance.
    for (const coords of [existingCoords, placedCoords]) {
      for (let i = 0; i < coords.length - 1; i++) {
        const a = coords[i]!
        const b = coords[i + 1]!
        const yards = Math.round(haversineYards(a[1], a[0], b[1], b[0]))
        if (yards <= 0) continue
        const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
        const el = makeDistancePill(toDisplay(yards))
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat(mid)
          .addTo(map)
        markerRefs.current.push(marker)
      }
    }

    // Aim markers + dashed aim lines per placed shot. Aim color matches
    // the rest of the warn palette (#A66A1F) so it reads as "intent",
    // distinct from the accent ball/pin marker.
    const aimLineCoords: [number, number][][] = []
    placedPoints.forEach((p, idx) => {
      const aim = placedAims?.[idx] ?? null
      if (!aim) return
      const aimEl = makeAimMarker()
      const aimMarker = new mapboxgl.Marker({ element: aimEl })
        .setLngLat([aim.lng, aim.lat])
        .addTo(map)
      markerRefs.current.push(aimMarker)
      aimLineCoords.push([
        [p.lng, p.lat],
        [aim.lng, aim.lat],
      ])
      // Distance pill at midpoint of the aim line.
      const yards = Math.round(haversineYards(p.lat, p.lng, aim.lat, aim.lng))
      if (yards > 0) {
        const mid: [number, number] = [
          (p.lng + aim.lng) / 2,
          (p.lat + aim.lat) / 2,
        ]
        const el = makeDistancePill(`AIM ${toDisplay(yards)}`)
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat(mid)
          .addTo(map)
        markerRefs.current.push(marker)
      }
    })
    upsertDashedLines(map, 'aim-lines', aimLineCoords, '#A66A1F')
  }, [
    existingShots,
    hole,
    placedPoints,
    placedAims,
    onMovePoint,
    onMovePin,
    onMoveTee,
    effectivePin,
    effectiveTee,
    toDisplay,
  ])

  // Render markers + connecting line for either existing shots or placed points.
  // renderLayers is memoized; its identity tracks the inputs that determine
  // what's drawn, so deping on it is the correct trigger.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    // Wait for style.
    if (!map.isStyleLoaded()) {
      map.once('styledata', () => renderLayers())
      return
    }
    renderLayers()
  }, [renderLayers])

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
  /** False when this hole has no pin coordinates — drives the "— to
   *  pin" placeholder instead of just hiding the distance silently. */
  pinAvailable?: boolean
  /** Aim mode: next tap sets aim for the latest placed shot. */
  aimMode?: boolean
  /** Number of placed shots that already have an aim point. */
  aimsSet?: number
  onToggleAimMode?: (on: boolean) => void
  onClearLastAim?: () => void
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
  pinAvailable = true,
  aimMode = false,
  aimsSet = 0,
  onToggleAimMode,
  onClearLastAim,
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
        ) : aimMode ? (
          <>
            <div className="kicker" style={{ marginBottom: 2 }}>
              Aim point — shot {shotsPlaced}
            </div>
            <div className="text-caddie-ink" style={{ fontSize: 13 }}>
              Tap where you were aiming when you hit shot {shotsPlaced}.
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
                    aimsSet > 0 ? ` · ${aimsSet} aim${aimsSet === 1 ? '' : 's'} set` : ''
                  }${
                    remainingToPin != null
                      ? ` · ${toDisplay(remainingToPin)} to pin`
                      : pinAvailable
                        ? ''
                        : ' · — to pin'
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {onToggleAimMode && shotsPlaced > 0 && (
            <button
              type="button"
              onClick={() => onToggleAimMode(!aimMode)}
              aria-pressed={aimMode}
              style={{
                border: '1px solid #A66A1F',
                borderRadius: 2,
                padding: '6px 10px',
                fontSize: 12,
                background: aimMode ? '#A66A1F' : 'transparent',
                color: aimMode ? '#F2EEE5' : '#A66A1F',
                fontWeight: 600,
                letterSpacing: '0.02em',
              }}
            >
              {aimMode ? 'Cancel aim' : 'Set aim'}
            </button>
          )}
          {onClearLastAim && aimsSet > 0 && !aimMode && (
            <button
              type="button"
              onClick={onClearLastAim}
              className="text-caddie-ink-dim"
              style={{
                border: '1px solid #D9D2BF',
                borderRadius: 2,
                padding: '6px 10px',
                fontSize: 12,
                background: 'transparent',
              }}
            >
              Clear aim
            </button>
          )}
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
  existing: ExistingShot[],
  pin: PlacedPoint | null,
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

function upsertDashedLines(
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

function upsertLine(
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

function makeAimMarker(): HTMLElement {
  const outer = document.createElement('div')
  outer.style.display = 'flex'
  outer.style.alignItems = 'center'
  outer.style.justifyContent = 'center'
  const dot = document.createElement('div')
  dot.style.cssText = [
    'width:14px',
    'height:14px',
    'border-radius:999px',
    'background:#A66A1F',
    'border:2px solid #FBF8F1',
    'pointer-events:none',
  ].join(';')
  outer.appendChild(dot)
  outer.title = 'Aim point'
  return outer
}

function makeDistancePill(label: string): HTMLElement {
  const el = document.createElement('div')
  el.style.cssText = [
    'background:rgba(28,33,28,0.85)',
    'color:#F2EEE5',
    'font-family:JetBrains Mono, monospace',
    'font-size:11px',
    'font-weight:500',
    'letter-spacing:0.04em',
    'padding:3px 8px',
    'border-radius:999px',
    'pointer-events:none',
    'white-space:nowrap',
  ].join(';')
  el.textContent = label
  return el
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
