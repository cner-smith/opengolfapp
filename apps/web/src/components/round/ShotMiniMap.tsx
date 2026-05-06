import { useEffect, useRef, useState } from 'react'
import { mapboxgl, MAPBOX_TOKEN_PRESENT } from '../../lib/mapbox'

export interface ShotMiniMapProps {
  shotNumber: number
  startLat: number | null
  startLng: number | null
  /** Either the next shot's start or the pin — used purely to fit the
   *  camera so the player sees the shot's path. Null hides nothing; the
   *  marker still drops at the start coord and the camera frames it. */
  endLat?: number | null
  endLng?: number | null
  /** Aim coord for this shot, when set. Drawn as a dashed line + ghost
   *  marker so the player sees where they were aiming. Not draggable
   *  here — the round map is the place to retarget aim. */
  aimLat?: number | null
  aimLng?: number | null
  /** Drag-end on the start marker. Returns the new lat/lng. */
  onChangeStart: (point: { lat: number; lng: number }) => void
  height?: number
}

// Auto-fit padding + zoom cap. Without the cap a shot whose start and
// end are within a couple feet would zoom in past the satellite tile
// resolution; 18 keeps the imagery sharp.
const FIT_PADDING = 24
const MAX_ZOOM = 18

export function ShotMiniMap({
  shotNumber,
  startLat,
  startLng,
  endLat,
  endLng,
  aimLat,
  aimLng,
  onChangeStart,
  height = 200,
}: ShotMiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const startMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const aimMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  const hasStart = startLat != null && startLng != null

  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN_PRESENT) return
    if (mapRef.current) return
    if (!hasStart) return
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [startLng!, startLat!],
      zoom: 17,
      attributionControl: false,
    })
    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      'bottom-right',
    )
    map.on('load', () => setMapLoaded(true))
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      startMarkerRef.current = null
      aimMarkerRef.current = null
      setMapLoaded(false)
    }
    // hasStart gate; coords change reactively in the next effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStart])

  // Fit camera to start + end (or aim) so the shot's path frames cleanly.
  // Falls back to a tight zoom on the start coord when no companion
  // point is available.
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !hasStart) return
    const map = mapRef.current
    const points: [number, number][] = [[startLng!, startLat!]]
    if (endLat != null && endLng != null) points.push([endLng, endLat])
    if (aimLat != null && aimLng != null) points.push([aimLng, aimLat])
    if (points.length === 1) {
      map.jumpTo({ center: points[0]!, zoom: 17 })
      return
    }
    const bounds = points.reduce(
      (b, p) => b.extend(p),
      new mapboxgl.LngLatBounds(points[0]!, points[0]!),
    )
    map.fitBounds(bounds, {
      padding: FIT_PADDING,
      maxZoom: MAX_ZOOM,
      duration: 0,
    })
  }, [mapLoaded, hasStart, startLat, startLng, endLat, endLng, aimLat, aimLng])

  // Draggable start marker. Recreated when coords change so the
  // mapbox-internal position matches React-side state without a manual
  // setLngLat dance.
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !hasStart) return
    if (startMarkerRef.current) {
      startMarkerRef.current.setLngLat([startLng!, startLat!])
      // Refresh the badge text when the panel switches to a different
      // shot — without this, the marker DOM element keeps the number
      // it was created with and every shot reads as "1".
      const el = startMarkerRef.current.getElement()
      if (el.textContent !== String(shotNumber)) {
        el.textContent = String(shotNumber)
      }
      return
    }
    const el = makeMiniNumberedMarker(shotNumber)
    const marker = new mapboxgl.Marker({ element: el, draggable: true })
      .setLngLat([startLng!, startLat!])
      .addTo(mapRef.current)
    el.style.cursor = 'grab'
    marker.on('dragstart', () => {
      el.style.cursor = 'grabbing'
    })
    marker.on('dragend', () => {
      el.style.cursor = 'grab'
      const ll = marker.getLngLat()
      onChangeStart({ lat: ll.lat, lng: ll.lng })
    })
    startMarkerRef.current = marker
  }, [mapLoaded, hasStart, startLat, startLng, shotNumber, onChangeStart])

  // Aim ghost (read-only).
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return
    const map = mapRef.current
    if (aimLat == null || aimLng == null) {
      if (aimMarkerRef.current) {
        aimMarkerRef.current.remove()
        aimMarkerRef.current = null
      }
      return
    }
    if (aimMarkerRef.current) {
      aimMarkerRef.current.setLngLat([aimLng, aimLat])
      return
    }
    const el = document.createElement('div')
    el.style.cssText = [
      'width:10px',
      'height:10px',
      'border-radius:999px',
      'background:#A66A1F',
      'border:2px solid #FBF8F1',
      'pointer-events:none',
    ].join(';')
    aimMarkerRef.current = new mapboxgl.Marker({ element: el })
      .setLngLat([aimLng, aimLat])
      .addTo(map)
  }, [mapLoaded, aimLat, aimLng])

  if (!hasStart) {
    return (
      <div
        className="text-caddie-ink-mute"
        style={{
          height,
          background: '#EBE5D6',
          border: '1px solid #D9D2BF',
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
        }}
      >
        No position data
      </div>
    )
  }

  if (!MAPBOX_TOKEN_PRESENT) {
    return (
      <div
        className="text-caddie-ink-mute"
        style={{
          height,
          background: '#EBE5D6',
          border: '1px solid #D9D2BF',
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          padding: 14,
          textAlign: 'center',
        }}
      >
        Map unavailable
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{
        height,
        width: '100%',
        background: '#1C211C',
        borderRadius: 2,
        border: '1px solid #D9D2BF',
        overflow: 'hidden',
      }}
    />
  )
}

function makeMiniNumberedMarker(n: number): HTMLElement {
  const el = document.createElement('div')
  el.style.cssText = [
    'width:22px',
    'height:22px',
    'border-radius:999px',
    'background:#1F3D2C',
    'color:#FBF8F1',
    'font-family:Inter, sans-serif',
    'font-weight:600',
    'font-size:11px',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'border:2px solid #FBF8F1',
  ].join(';')
  el.textContent = String(n)
  return el
}
