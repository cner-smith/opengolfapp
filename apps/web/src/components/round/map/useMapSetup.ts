import { useEffect, useRef, useState, type RefObject } from 'react'
import { mapboxgl, MAPBOX_TOKEN_PRESENT } from '../../../lib/mapbox'
import type { PlacedPoint } from '../RoundMap'

interface CameraTarget {
  center: [number, number]
  zoom: number
}

interface UseMapSetupInput {
  containerRef: RefObject<HTMLDivElement | null>
  cameraTarget: CameraTarget
  focusGreenSignal: number | undefined
  effectivePin: PlacedPoint | null
  // Click handler config
  placementMode: 'tee' | 'pin' | null | undefined
  hasExistingShots: boolean
  tapToPlaceDisabled: boolean | undefined
  aimMode: boolean | undefined
  placedPointsCount: number
  onPlace: (point: PlacedPoint) => void
  onSetAim: ((index: number, point: PlacedPoint | null) => void) | undefined
  onMovePin: ((point: PlacedPoint) => void) | undefined
  onMoveTee: ((point: PlacedPoint) => void) | undefined
}

export interface UseMapSetupResult {
  mapRef: React.MutableRefObject<mapboxgl.Map | null>
  mapLoaded: boolean
  /** Set true the moment the user places or drags the tee/pin. The
   *  camera effect skips one cameraTarget cycle when this is set, so
   *  the camera stays where the user was looking instead of snapping
   *  back up the priority chain. */
  userPlacedRef: React.MutableRefObject<boolean>
}

export function useMapSetup({
  containerRef,
  cameraTarget,
  focusGreenSignal,
  effectivePin,
  placementMode,
  hasExistingShots,
  tapToPlaceDisabled,
  aimMode,
  placedPointsCount,
  onPlace,
  onSetAim,
  onMovePin,
  onMoveTee,
}: UseMapSetupInput): UseMapSetupResult {
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const initialPositionDoneRef = useRef(false)
  const userPlacedRef = useRef(false)
  const [mapLoaded, setMapLoaded] = useState(false)

  // Initialize at a neutral world view. The camera positioning waits
  // for the 'load' event below — Mapbox happily queues jumpTo on a
  // mid-load map, but a load gate makes the timing explicit and
  // matches what production was actually doing under the hood.
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
    // Zoom + / – live in the bottom-right corner so they don't fight the
    // instruction strip across the top of the map.
    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      'bottom-right',
    )
    map.on('load', () => setMapLoaded(true))
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      setMapLoaded(false)
    }
  }, [containerRef])

  // Reactive camera positioning. Gated on `mapLoaded` so we never call
  // jumpTo against an instance whose style hasn't finished initializing
  // — which is the failure mode the OKC-stuck bug was hitting in
  // production. First valid target after load snaps (jumpTo, instant);
  // subsequent target changes (hole switch, course coords arriving
  // late, focus-on-green after a putt) animate via flyTo.
  useEffect(() => {
    if (!mapLoaded) return
    const map = mapRef.current
    if (!map) return
    if (!initialPositionDoneRef.current) {
      map.jumpTo({
        center: cameraTarget.center,
        zoom: cameraTarget.zoom,
      })
      initialPositionDoneRef.current = true
      return
    }
    if (userPlacedRef.current) {
      userPlacedRef.current = false
      return
    }
    map.flyTo({
      center: cameraTarget.center,
      zoom: cameraTarget.zoom,
      speed: 1.4,
    })
  }, [mapLoaded, cameraTarget])

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
      // Pin placement wins over every other click outcome — even when shots
      // already exist, the user explicitly entered placement mode from the
      // strip and the next tap should land the marker. (The tee is no longer
      // placed manually — it's derived from the first shot, mirroring mobile.)
      if (placementMode === 'pin' && onMovePin) {
        userPlacedRef.current = true
        onMovePin({ lat: e.lngLat.lat, lng: e.lngLat.lng })
        return
      }
      if (hasExistingShots) return
      if (tapToPlaceDisabled) return
      if (aimMode && onSetAim) {
        const idx = placedPointsCount - 1
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
    placedPointsCount,
    placementMode,
    onMoveTee,
    onMovePin,
  ])

  return { mapRef, mapLoaded, userPlacedRef }
}
