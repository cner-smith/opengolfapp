import { useMemo, useRef, useState, type RefObject } from 'react'
import type Mapbox from '@rnmapbox/maps'
import type { MapState } from '@rnmapbox/maps'
import { viewPoint, wayfinder, type DistanceUnit, type MapCamera, type ScreenBox, type Wayfinder } from '@oga/core'
import type { LatLng } from '../HoleMap.types'
import { WAYFINDER_KEY } from '../markers/Callouts'

// The wayfinder (#1386), from the camera as of the last settle: no per-frame
// work. getPointInView answers (-1, -1) off the map (Mapbox's
// pixelForCoordinate), so the ball is projected from the camera instead; only
// the centre is measured, as padding moves it off the middle.
export function useWayfinder({
  mapViewRef,
  mapSize,
  bottom,
  ball,
  pin,
  hidden,
  drawer,
  unit,
}: {
  mapViewRef: RefObject<Mapbox.MapView | null>
  mapSize: { w: number; h: number } | null
  /** dp from the map bottom: `key` kept clear of the key, and a ball above
   *  `ball` counts as on screen. Unset, there is no wayfinder. */
  bottom: { key: number; ball: number } | undefined
  ball: LatLng | null | undefined
  pin: LatLng | null | undefined
  hidden: boolean
  /** The dock's open ruler drawer, in map dp. */
  drawer: ScreenBox | null
  unit: DistanceUnit
}): { wf: Wayfinder | null; onIdle: (s: MapState) => void } {
  const [cam, setCam] = useState<MapCamera | null>(null)
  // A settle answered after a newer one must not overwrite it.
  const seq = useRef(0)
  const onIdle = (s: MapState) => {
    const map = mapViewRef.current
    const [lng, lat] = s.properties.center
    if (bottom == null || !map || !mapSize || lng == null || lat == null) return
    const mine = ++seq.current
    const { zoom, heading, pitch } = s.properties
    const fallback: [number, number] = [mapSize.w / 2, mapSize.h / 2]
    void map
      .getPointInView([lng, lat])
      .then(([x, y]) => (x != null && y != null ? ([x, y] as [number, number]) : fallback))
      .catch(() => fallback) // not ready: frame from the middle
      .then((centerPx) => {
        if (mine === seq.current) setCam({ center: { lat, lng }, zoom, bearing: heading, pitch, centerPx, height: mapSize.h })
      })
  }
  const wf = useMemo(
    () =>
      bottom == null || !cam || !mapSize || hidden
        ? null
        : wayfinder({
            ball: ball ?? null,
            pin: pin ?? null,
            zoom: cam.zoom,
            project: (p) => viewPoint(p, cam),
            // Below the top ornaments, above the dock and its open drawer.
            area: { left: 6, top: 40, right: mapSize.w - 6, bottom: mapSize.h - bottom.key },
            seen: { left: 6, top: 40, right: mapSize.w - 6, bottom: mapSize.h - bottom.ball },
            key: WAYFINDER_KEY,
            avoid: drawer ? [drawer] : [],
            unit,
          }),
    [bottom?.key, bottom?.ball, cam, mapSize, hidden, ball?.lat, ball?.lng, pin?.lat, pin?.lng, drawer?.left, drawer?.top, drawer?.right, drawer?.bottom, unit],
  )
  return { wf, onIdle }
}
