import { useEffect, useRef } from 'react'
import { mapboxgl, MAPBOX_TOKEN_PRESENT } from '../../lib/mapbox'

interface DemoShot {
  shotNumber: number
  lat: number
  lng: number
}

interface DemoMapProps {
  tee: { lat: number; lng: number }
  pin: { lat: number; lng: number }
  shots: DemoShot[]
}

// Read-only Mapbox view used in the landing-page hero. Renders the
// same satellite tiles + numbered shot markers + amber connecting line
// the live RoundMap does, but without any of the round-tracking state
// machinery — the goal is "looks like a real hole 7" with hardcoded
// data.
export function DemoMap({ tee, pin, shots }: DemoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN_PRESENT) return
    if (mapRef.current) return

    // Initialize centered on the tee at zoom 16 — wide enough to see
    // the full hole on a phone-sized viewport, tight enough that
    // satellite tiles read as fairway rather than rough/aerial.
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [tee.lng, tee.lat],
      zoom: 16,
      pitch: 0,
      bearing: 0,
      interactive: false,
      attributionControl: false,
    })
    mapRef.current = map

    map.on('load', () => {

      const lineCoords: [number, number][] = []
      for (const s of shots) lineCoords.push([s.lng, s.lat])
      lineCoords.push([pin.lng, pin.lat])

      const lineData: GeoJSON.Feature<GeoJSON.LineString> = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: lineCoords },
      }
      map.addSource('demo-line', { type: 'geojson', data: lineData })
      // Dark outline + amber line on top — same layering the live
      // RoundMap uses, so the colors land on satellite tiles the same
      // way they do in the real app.
      map.addLayer({
        id: 'demo-line-outline',
        type: 'line',
        source: 'demo-line',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#1C211C', 'line-width': 4, 'line-opacity': 0.55 },
      })
      map.addLayer({
        id: 'demo-line',
        type: 'line',
        source: 'demo-line',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#A66A1F', 'line-width': 2.5 },
      })

      for (const s of shots) {
        const el = makeNumberedMarker(s.shotNumber)
        new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([s.lng, s.lat])
          .addTo(map)
      }

      const pinEl = makePinMarker()
      new mapboxgl.Marker({ element: pinEl, anchor: 'bottom' })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map)
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [tee, pin, shots])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      {!MAPBOX_TOKEN_PRESENT && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#28482e',
            color: 'rgba(242,238,229,0.6)',
            fontSize: 12,
            padding: 16,
            textAlign: 'center',
            fontFamily: 'JetBrains Mono, monospace',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
          }}
        >
          Map unavailable
        </div>
      )}
    </div>
  )
}

// Mirrors the live RoundMap shot marker style. Sized to the
// landing-page spec (20px) — slightly tighter than the in-app 24px so
// the markers don't overwhelm the small phone-frame viewport.
function makeNumberedMarker(n: number): HTMLElement {
  const outer = document.createElement('div')
  outer.style.display = 'flex'
  outer.style.alignItems = 'center'
  outer.style.justifyContent = 'center'
  outer.style.pointerEvents = 'none'
  const inner = document.createElement('div')
  inner.style.cssText = [
    'width:20px',
    'height:20px',
    'border-radius:999px',
    'background:#A66A1F',
    'color:#FBF8F1',
    'font-family:Inter, sans-serif',
    'font-weight:600',
    'font-size:11px',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'border:2px solid #FBF8F1',
  ].join(';')
  inner.textContent = String(n)
  outer.appendChild(inner)
  return outer
}

// Inlined replica of makeFlagMarker in
// apps/web/src/components/round/map/markerFactories.ts — kept inline
// rather than imported so DemoMap stays a self-contained landing-page
// chunk (the real factories module would drag the round-map graph in).
function makePinMarker(): HTMLElement {
  const outer = document.createElement('div')
  outer.style.pointerEvents = 'none'
  const content = document.createElement('div')
  content.style.cssText = 'width:16px;height:24px;position:relative'
  const pole = document.createElement('div')
  pole.style.cssText =
    'position:absolute;left:6px;top:0;width:2px;height:24px;background:#FBF8F1'
  const flag = document.createElement('div')
  flag.style.cssText =
    'position:absolute;left:8px;top:1px;width:9px;height:7px;background:#A33A2A'
  const base = document.createElement('div')
  base.style.cssText =
    'position:absolute;left:5px;top:22px;width:4px;height:2px;border-radius:1px;background:#FBF8F1'
  content.appendChild(pole)
  content.appendChild(flag)
  content.appendChild(base)
  outer.appendChild(content)
  return outer
}
