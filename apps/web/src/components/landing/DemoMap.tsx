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

    const bounds = new mapboxgl.LngLatBounds(
      [tee.lng, tee.lat],
      [pin.lng, pin.lat],
    )
    for (const s of shots) bounds.extend([s.lng, s.lat])

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: bounds.getCenter(),
      zoom: 17,
      interactive: false,
      attributionControl: false,
    })
    mapRef.current = map

    map.on('load', () => {
      map.fitBounds(bounds, { padding: 28, animate: false, maxZoom: 18 })

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

// Match the live RoundMap shot marker (apps/web/src/components/round/map/markerFactories.ts):
// 24px amber circle with a cream border and the shot number in Inter 600.
function makeNumberedMarker(n: number): HTMLElement {
  const outer = document.createElement('div')
  outer.style.display = 'flex'
  outer.style.alignItems = 'center'
  outer.style.justifyContent = 'center'
  outer.style.pointerEvents = 'none'
  const inner = document.createElement('div')
  inner.style.cssText = [
    'width:22px',
    'height:22px',
    'border-radius:999px',
    'background:#A66A1F',
    'color:#F2EEE5',
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

function makePinMarker(): HTMLElement {
  const outer = document.createElement('div')
  outer.style.pointerEvents = 'none'
  outer.innerHTML = `
    <svg width="20" height="28" viewBox="0 0 20 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="10" y1="2" x2="10" y2="22" stroke="#FBF8F1" stroke-width="1.5" />
      <path d="M10 3 L17 6 L10 9 Z" fill="#A33A2A" stroke="#FBF8F1" stroke-width="0.75" stroke-linejoin="round"/>
      <circle cx="10" cy="22" r="3" fill="#A33A2A" stroke="#FBF8F1" stroke-width="1.5" />
    </svg>
  `
  return outer
}
