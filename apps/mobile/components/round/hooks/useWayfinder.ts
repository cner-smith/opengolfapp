import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type Mapbox from '@rnmapbox/maps'
import type { MapState } from '@rnmapbox/maps'
import { viewPoint, wayfinder, type DistanceUnit, type MapCamera, type ScreenBox, type Wayfinder } from '@oga/core'
import type { KeyColumn, LatLng, MapPlate } from '../HoleMap.types'

/** Half the arrow's box, dp: what it keeps clear of the keys and the flag. */
export const WAYFINDER_ARROW = 20
/** dp the arrow's ellipse keeps in from the map's open edges. */
export const WAYFINDER_INSET = 24

/** How the map feeds the wayfinder its camera: a settle (measures the centre),
 *  a moving frame (reuses that centre), and "the camera has been still a
 *  moment" for when a settle never fires (#1018). */
export type WayfinderFeed = { idle: (s: MapState) => void; move: (s: MapState) => void; settle: () => void }

// The wayfinder (#1386), re-projected on every camera frame (at most once a
// frame) and on each settle. getPointInView answers (-1, -1) off the map
// (Mapbox's pixelForCoordinate), so the ball is projected from the camera
// instead; only the centre is measured, on settle, as padding moves it off
// the middle.
export function useWayfinder({
  feed,
  mapViewRef,
  mapSize,
  bottom,
  ball,
  pin,
  hidden,
  avoid,
  plates,
  ornamentsTop,
  unit,
}: {
  feed: RefObject<WayfinderFeed | null>
  mapViewRef: RefObject<Mapbox.MapView | null>
  mapSize: { w: number; h: number } | null
  /** dp of solid chrome along the map bottom, and the key columns standing on
   *  it. Unset, there is no wayfinder. */
  bottom: { clear: number; columns?: KeyColumn[] } | undefined
  ball: LatLng | null | undefined
  pin: LatLng | null | undefined
  hidden: boolean
  /** Chrome over the map the arrow keeps off (the open ruler drawer), in map dp. */
  avoid: ScreenBox[]
  /** Tags pinned to the map (the aim plate): projected with the camera, so
   *  the arrow keeps off them while the map moves. */
  plates: MapPlate[]
  /** The Mapbox logo and attribution sit in the map's top corners. */
  ornamentsTop: boolean
  unit: DistanceUnit
}): Wayfinder | null {
  const [cam, setCam] = useState<MapCamera | null>(null)
  // A settle answered after a newer one must not overwrite it.
  const seq = useRef(0)
  const centerPx = useRef<[number, number] | null>(null)
  const last = useRef<MapState | null>(null)
  const frame = useRef(0)
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const camOf = (s: MapState, px: [number, number]): MapCamera | null => {
    const [lng, lat] = s.properties.center
    if (!mapSize || lng == null || lat == null) return null
    const { zoom, heading, pitch } = s.properties
    return { center: { lat, lng }, zoom, bearing: heading, pitch, centerPx: px, height: mapSize.h }
  }
  const idle = (s: MapState) => {
    last.current = s
    const map = mapViewRef.current
    const [lng, lat] = s.properties.center
    if (bottom == null || !map || !mapSize || lng == null || lat == null) return
    const mine = ++seq.current
    const fallback: [number, number] = [mapSize.w / 2, mapSize.h / 2]
    void map
      .getPointInView([lng, lat])
      .then(([x, y]) => (x != null && y != null ? ([x, y] as [number, number]) : fallback))
      .catch(() => fallback) // not ready: frame from the middle
      .then((px) => {
        if (mine !== seq.current) return
        centerPx.current = px
        setCam(camOf(s, px))
      })
  }
  const move = (s: MapState) => {
    last.current = s
    if (bottom == null || !centerPx.current || frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      if (last.current && centerPx.current) setCam(camOf(last.current, centerPx.current))
    })
  }
  const settle = () => {
    if (last.current) idle(last.current)
  }
  // Fresh closures each render, so a feed call sees the current props.
  feed.current = { idle, move, settle }

  const avoidKey = JSON.stringify(avoid)
  const platesKey = JSON.stringify(plates.map((t) => [t.at, t.offset, t.width, t.height, t.lefty]))
  return useMemo(() => {
    if (bottom == null || !cam || !mapSize || hidden) return null
    const floor = mapSize.h - bottom.clear
    const columns = (bottom.columns ?? []).map((c) => ({ left: c.left, top: floor - c.above, right: c.right, bottom: floor }))
    // The logo (about 92 × 24) and the attribution button, 8 in from the corners.
    const ornaments = ornamentsTop
      ? [
          { left: 8, top: 8, right: 100, bottom: 32 },
          { left: mapSize.w - 36, top: 8, right: mapSize.w - 8, bottom: 36 },
        ]
      : []
    // Each plate where it is drawn now and where it is springing to.
    const pinned = plates.flatMap((t) => {
      const [ax, ay] = viewPoint(t.at, cam)
      const offsets: [number, number][] = [t.offset, [t.live.x.value, t.live.y.value]]
      return offsets.map(([dx, dy]) => {
        const x = ax + dx
        const y = ay + dy
        // 6 dp of air: the arrow chases its target for a moment while the map moves.
        const left = (t.lefty ? x - t.width : x) - 6
        const right = (t.lefty ? x : x + t.width) + 6
        return { left, top: y - t.height / 2 - 6, right, bottom: y + t.height / 2 + 6 }
      })
    })
    return wayfinder({
      ball: ball ?? null,
      pin: pin ?? null,
      zoom: cam.zoom,
      project: (p) => viewPoint(p, cam),
      // The whole map down to the solid chrome: a ball anywhere in it is in
      // view. Floating chrome only moves the arrow.
      area: { left: 0, top: 0, right: mapSize.w, bottom: floor },
      inset: WAYFINDER_INSET,
      arrow: WAYFINDER_ARROW,
      avoid: [...avoid, ...pinned, ...columns, ...ornaments],
      unit,
    })
  }, [bottom?.clear, bottom?.columns, cam, mapSize, hidden, ball?.lat, ball?.lng, pin?.lat, pin?.lng, avoidKey, platesKey, ornamentsTop, unit])
}
