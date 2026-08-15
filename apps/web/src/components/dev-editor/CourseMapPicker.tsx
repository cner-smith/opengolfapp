import { useEffect, useRef } from 'react'
import { mapboxgl, MAPBOX_TOKEN_PRESENT, fitHoleUpward } from '../../lib/mapbox'

export interface MapMarkerSpec {
  id: string
  lat: number
  lng: number
  color?: string
}

interface CourseMapPickerProps {
  markers: MapMarkerSpec[]
  /** `source` distinguishes a fresh click-to-place from fine-tuning an
   *  existing marker by drag — callers that auto-advance to the next
   *  marker (e.g. tee → pin) after a placement should only do so for
   *  'click', not every drag adjustment. */
  onMarkerMove: (id: string, point: { lat: number; lng: number }, source: 'click' | 'drag') => void
  fallbackCenter?: { lat: number; lng: number }
  height?: number
  /** When set, clicking anywhere on the map places/moves the marker with
   *  this id — the only way to set a *first* position, since a marker has
   *  to already exist to be draggable. Course mode passes 'course'; the
   *  two-marker hole picker leaves this unset (a stray click shouldn't
   *  silently relocate tee or pin — dragging an existing marker is the
   *  only way to move those). */
  clickToPlaceId?: string
}

// Generic draggable-marker picker reused for two shapes: a single course
// lat/lng marker, or a two-marker tee+pin pair for a hole (fitHoleUpward
// kicks in automatically when exactly 2 markers are passed). Markers are
// controlled — dragend calls onMarkerMove, the caller updates its state,
// and the new position flows back in via the markers prop.
export function CourseMapPicker({
  markers,
  onMarkerMove,
  fallbackCenter,
  height = 320,
  clickToPlaceId,
}: CourseMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markerRefs = useRef<Map<string, mapboxgl.Marker>>(new Map())
  const fittedRef = useRef(false)
  // Latest-ref pattern: the init effect below registers the click listener
  // exactly once, so it reads these refs (updated every render) rather than
  // closing over stale props.
  const onMarkerMoveRef = useRef(onMarkerMove)
  onMarkerMoveRef.current = onMarkerMove
  const clickToPlaceIdRef = useRef(clickToPlaceId)
  clickToPlaceIdRef.current = clickToPlaceId

  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN_PRESENT) return
    if (mapRef.current) return
    const center = markers[0] ?? fallbackCenter ?? { lat: 0, lng: 0 }
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [center.lng, center.lat],
      zoom: markers.length > 0 || fallbackCenter ? 15 : 1,
      attributionControl: false,
    })
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right')
    map.on('click', (e) => {
      const id = clickToPlaceIdRef.current
      if (!id) return
      onMarkerMoveRef.current(id, { lat: e.lngLat.lat, lng: e.lngLat.lng }, 'click')
    })
    mapRef.current = map
    return () => {
      for (const m of markerRefs.current.values()) m.remove()
      markerRefs.current.clear()
      map.remove()
      mapRef.current = null
    }
    // Init runs exactly once per mount — container/token don't change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const seen = new Set<string>()
    for (const spec of markers) {
      seen.add(spec.id)
      const existing = markerRefs.current.get(spec.id)
      if (!existing) {
        const marker = new mapboxgl.Marker({ color: spec.color ?? '#1F3D2C', draggable: true })
          .setLngLat([spec.lng, spec.lat])
          .addTo(map)
        marker.on('dragend', () => {
          const ll = marker.getLngLat()
          onMarkerMoveRef.current(spec.id, { lat: ll.lat, lng: ll.lng }, 'drag')
        })
        markerRefs.current.set(spec.id, marker)
      } else {
        existing.setLngLat([spec.lng, spec.lat])
      }
    }
    for (const [id, marker] of markerRefs.current) {
      if (!seen.has(id)) {
        marker.remove()
        markerRefs.current.delete(id)
      }
    }

    if (!fittedRef.current && markers.length > 0) {
      if (markers.length === 2) {
        fitHoleUpward(map, markers[0]!, markers[1]!, { animate: false })
      } else {
        map.jumpTo({ center: [markers[0]!.lng, markers[0]!.lat], zoom: 16 })
      }
      fittedRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.getCanvas().style.cursor = clickToPlaceId ? 'crosshair' : ''
  }, [clickToPlaceId])

  if (!MAPBOX_TOKEN_PRESENT) {
    return (
      <div
        className="text-caddie-ink-mute"
        style={{ padding: 14, fontSize: 12, border: '1px solid #D9D2BF', borderRadius: 2 }}
      >
        Mapbox token missing — map picker unavailable. Enter coordinates manually.
      </div>
    )
  }

  return <div ref={containerRef} style={{ height, borderRadius: 2, overflow: 'hidden' }} />
}
