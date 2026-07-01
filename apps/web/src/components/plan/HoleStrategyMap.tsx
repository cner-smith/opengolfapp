import { useEffect, useMemo, useRef, useState } from 'react'
import { bearingDegrees, coneRingGeoJSON, scatterGeoJSON, type GeoPoint } from '@oga/core'
import { mapboxgl, MAPBOX_TOKEN_PRESENT } from '../../lib/mapbox'
import type { ClubDispersion } from '../../pages/rounds/hooks/useClubDispersion'

export interface Leg {
  origin: GeoPoint
  aim: GeoPoint
  club: ClubDispersion | null
}

export interface HoleStrategyMapProps {
  tee: GeoPoint
  pin: GeoPoint
  legs: Leg[]
  focusedLeg: number
  onAimChange: (legIndex: number, aim: GeoPoint) => void
}

// Fresh map for the course planner — deliberately NOT built on top of
// useMapSetup/useMapLayers (round/map/*), which are welded to live/past round
// editing state (existingShots, placedPoints, aimMode, etc). This component
// only ever renders a read-only, precomputed multi-leg plan.

// ---------------------------------------------------------------------------
// Local upsert helper (per the task brief — do not import useMapLayers.ts).
// Mirrors its add-source-once/setData-after shape, but focus dimming is
// carried as a per-feature `opacity` property (paint reads it via a `['get',
// 'opacity']` expression) rather than baked into the layer's static paint —
// that way re-focusing a leg only ever calls setData, never touches the
// layer/paint, matching "add source+layer if absent, else setData".
// ---------------------------------------------------------------------------
interface LayerSpec {
  type: 'circle' | 'fill' | 'line'
  paint?: Record<string, unknown>
  layout?: Record<string, unknown>
}

function upsert(
  map: mapboxgl.Map,
  id: string,
  data: GeoJSON.Feature | GeoJSON.FeatureCollection,
  layerSpec: LayerSpec,
): void {
  const existing = map.getSource(id) as mapboxgl.GeoJSONSource | undefined
  if (existing) {
    existing.setData(data)
    return
  }
  map.addSource(id, { type: 'geojson', data })
  map.addLayer({ id, source: id, ...layerSpec } as mapboxgl.AnyLayer)
}

// Focused vs. dimmed opacity per overlay type — baked into feature
// properties (see upsert comment above), not layer paint.
const DOTS_OPACITY = { focused: 0.6, dimmed: 0.18 }
const CONE_OPACITY = { focused: 0.16, dimmed: 0.05 }
const AIM_MARKER_OPACITY = { focused: 1, dimmed: 0.4 }

// Colors follow DESIGN.md's "Map screens" spec (aim marker = caddie-warn fill
// / white border) plus the shot-pattern-redesign convention for overlay fills
// (white reads better than amber against fairway/rough satellite tiles — see
// useMapLayers.ts's AIM_COLOR).
const ROUTE_COLOR = '#FBF8F1'
const OVERLAY_COLOR = '#FBF8F1'
const AIM_FILL = '#A66A1F'
const AIM_BORDER = '#FBF8F1'
const PIN_COLOR = '#A33A2A'

function makeTeeDotEl(): HTMLElement {
  const el = document.createElement('div')
  el.style.cssText = [
    'width:9px',
    'height:9px',
    'border-radius:999px',
    'background:#FBF8F1',
    'border:1.5px solid rgba(28,33,28,0.55)',
    'box-shadow:0 0 0 1px rgba(255,255,255,0.25)',
    'pointer-events:none',
  ].join(';')
  el.title = 'Tee'
  return el
}

function makePinFlagEl(): HTMLElement {
  const el = document.createElement('div')
  el.style.cssText = 'width:10px;height:16px;position:relative'
  const pole = document.createElement('div')
  pole.style.cssText =
    'position:absolute;left:4px;top:0;width:2px;height:16px;background:#FBF8F1'
  const flag = document.createElement('div')
  flag.style.cssText = `position:absolute;left:6px;top:1px;width:8px;height:6px;background:${PIN_COLOR}`
  el.appendChild(pole)
  el.appendChild(flag)
  el.title = 'Pin'
  return el
}

function makeAimMarkerEl(focused: boolean): HTMLElement {
  const el = document.createElement('div')
  const opacity = focused ? AIM_MARKER_OPACITY.focused : AIM_MARKER_OPACITY.dimmed
  el.style.cssText = [
    'width:14px',
    'height:14px',
    'border-radius:999px',
    `background:${AIM_FILL}`,
    `border:2px solid ${AIM_BORDER}`,
    `opacity:${opacity}`,
    'cursor:grab',
  ].join(';')
  el.title = 'Aim — drag to adjust'
  return el
}

export default function HoleStrategyMap({
  tee,
  pin,
  legs,
  focusedLeg,
  onAimChange,
}: HoleStrategyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const [mapLoaded, setMapLoaded] = useState(false)
  const initialPositionDoneRef = useRef(false)
  // Highest number of legs rendered so far. `upsert` only ever
  // adds/updates sources; when the consumer shrinks `legs.length` (e.g.
  // "remove last shot") the dropped legs' `leg-dots-{i}` / `leg-cone-{i}`
  // sources+layers would otherwise linger with stale geometry. We track the
  // max so the render effect can tear those orphans down. (Per-leg aim
  // markers don't need this — every render clears and rebuilds all markers.)
  const renderedLegCountRef = useRef(0)

  // Init the map once, at a neutral world view — matches RoundMap's pattern
  // (apps/web/src/components/round/RoundMap.tsx): style loads async, camera
  // positioning waits for the `load` event below rather than passing initial
  // center/zoom straight into the constructor.
  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN_PRESENT) return
    if (mapRef.current) return
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [0, 0],
      zoom: 1,
      attributionControl: false,
    })
    map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      'bottom-right',
    )
    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      'bottom-right',
    )
    map.on('load', () => setMapLoaded(true))
    mapRef.current = map
    return () => {
      for (const m of markersRef.current) m.remove()
      markersRef.current = []
      map.remove()
      mapRef.current = null
      setMapLoaded(false)
    }
    // Init runs exactly once per mount — container/token don't change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Camera: frame the hole "up-the-hole" — rotate so the tee→pin line runs
  // bottom→top (like the mobile live-round map) and fitBounds so tee + pin are
  // both in view with padding. Re-fits when the hole changes (snap on the first
  // paint, animate on later prev/next-hole navigation).
  const bearing = useMemo(
    () => bearingDegrees(tee.lat, tee.lng, pin.lat, pin.lng),
    [tee.lat, tee.lng, pin.lat, pin.lng],
  )
  useEffect(() => {
    if (!mapLoaded) return
    const map = mapRef.current
    if (!map) return
    const bounds = new mapboxgl.LngLatBounds([tee.lng, tee.lat], [tee.lng, tee.lat])
    bounds.extend([pin.lng, pin.lat])
    map.fitBounds(bounds, {
      bearing,
      // Generous top/bottom keeps tee + pin off the edges; the sides give the
      // dispersion cone room since a 2-point bounds is near-zero-width.
      padding: { top: 80, bottom: 80, left: 90, right: 90 },
      maxZoom: 17.5,
      animate: initialPositionDoneRef.current,
      duration: 600,
    })
    initialPositionDoneRef.current = true
  }, [mapLoaded, bearing, tee.lat, tee.lng, pin.lat, pin.lng])

  // Per-leg overlays (dots, cone, aim marker) + the tee→…→pin route line +
  // the static tee/pin markers. Keyed on [legs, focusedLeg] per the brief;
  // tee/pin are included too since the route + static markers read them
  // directly (they're stable for a given hole, so this rarely re-fires).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    function render() {
      if (!map) return

      for (const m of markersRef.current) m.remove()
      markersRef.current = []

      // Tear down orphaned per-leg sources+layers for legs that no longer
      // exist (leg count shrank). In `upsert`, layer id === source id, so
      // removing the layer then the source by that id clears both. Existence
      // guards keep removeLayer/removeSource from throwing when absent.
      for (let i = legs.length; i < renderedLegCountRef.current; i++) {
        for (const id of [`leg-dots-${i}`, `leg-cone-${i}`]) {
          if (map.getLayer(id)) map.removeLayer(id)
          if (map.getSource(id)) map.removeSource(id)
        }
      }
      renderedLegCountRef.current = legs.length

      markersRef.current.push(
        new mapboxgl.Marker({ element: makeTeeDotEl() })
          .setLngLat([tee.lng, tee.lat])
          .addTo(map),
      )
      markersRef.current.push(
        new mapboxgl.Marker({ element: makePinFlagEl(), anchor: 'bottom' })
          .setLngLat([pin.lng, pin.lat])
          .addTo(map),
      )

      legs.forEach((leg, index) => {
        const focused = index === focusedLeg

        const scatter = scatterGeoJSON(
          leg.origin,
          leg.aim,
          leg.club?.dispersion.points ?? [],
        )
        const dotsData: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: scatter.features.map((f) => ({
            ...f,
            properties: {
              opacity: focused ? DOTS_OPACITY.focused : DOTS_OPACITY.dimmed,
            },
          })),
        }
        upsert(map, `leg-dots-${index}`, dotsData, {
          type: 'circle',
          paint: {
            'circle-radius': 3,
            'circle-color': OVERLAY_COLOR,
            'circle-opacity': ['get', 'opacity'],
            'circle-stroke-width': 0.5,
            'circle-stroke-color': '#1C211C',
          },
        })

        const cone = leg.club
          ? coneRingGeoJSON(
              leg.origin,
              leg.aim,
              leg.club.dispersion.along95,
              leg.club.dispersion.perp95,
              {
                alongMeanYards: leg.club.dispersion.alongMean,
                perpMeanYards: leg.club.dispersion.perpMean,
              },
            )
          : null
        // When there's no club (no cone), clear the source with an empty
        // FeatureCollection — a Polygon with an empty `coordinates` ring is
        // invalid GeoJSON. An empty collection is valid and renders nothing.
        const coneData: GeoJSON.Feature | GeoJSON.FeatureCollection = cone
          ? {
              ...cone,
              properties: {
                opacity: focused ? CONE_OPACITY.focused : CONE_OPACITY.dimmed,
              },
            }
          : { type: 'FeatureCollection', features: [] }
        upsert(map, `leg-cone-${index}`, coneData, {
          type: 'fill',
          paint: {
            'fill-color': OVERLAY_COLOR,
            'fill-opacity': ['get', 'opacity'],
          },
        })

        const aimMarker = new mapboxgl.Marker({
          element: makeAimMarkerEl(focused),
          draggable: true,
        })
          .setLngLat([leg.aim.lng, leg.aim.lat])
          .addTo(map)
        aimMarker.on('dragend', () => {
          const ll = aimMarker.getLngLat()
          onAimChange(index, { lat: ll.lat, lng: ll.lng })
        })
        markersRef.current.push(aimMarker)
      })

      const routeCoords: [number, number][] = [
        [tee.lng, tee.lat],
        ...legs.map((l) => [l.aim.lng, l.aim.lat] as [number, number]),
        [pin.lng, pin.lat],
      ]
      upsert(
        map,
        'route',
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: routeCoords },
        },
        {
          type: 'line',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': ROUTE_COLOR,
            'line-width': 2,
            'line-opacity': 0.75,
          },
        },
      )
    }

    if (!map.isStyleLoaded()) {
      map.once('styledata', render)
      return
    }
    render()
  }, [legs, focusedLeg, tee, pin, onAimChange])

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
