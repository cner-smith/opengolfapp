// The aim drag's magnifier (#1356): a small circular second map over the main
// one while the aim is dragged, showing what the thumb covers, zoomed in, with
// a crosshair where the aim lands. Its own file for HoleMap's 1,000-line cap.
//
// A second MapView takes ~0.5 s to draw its first tiles, so it mounts hidden on
// the first touch-down while aiming and stays mounted (hidden) until the aim
// step ends. It shows only once the drag has started AND its map has drawn a
// full frame, so it never appears as a blank disc. Imperative (warm / show /
// move / hide) so a drag move re-renders only the loupe, not HoleMap.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type RefObject } from 'react'
import { View } from 'react-native'
import Mapbox from '@rnmapbox/maps'
import { placeLoupe, type ScreenBox, type ScreenPt } from '@oga/core'
import type { LatLng } from './HoleMap.types'
import { P } from '../paper/tokens'

const LOUPE = 130
const R = LOUPE / 2
const ZOOM_UP = 1.5
// Mapbox's terms want the logo and attribution visible: their corners (logo
// 8 dp in, ~83 × 19 dp), with room.
const ORNAMENT_W = 100
const ORNAMENT_H = 36
const INFO_W = 48
// The remaining-distance tag, from its tick on the aim→pin line outward.
const TAG_W = 150
const TAG_H = 64

export interface MagnifierHandle {
  /** A touch-down while aiming: mount the loupe's map hidden, on the aim. */
  warm: (aim: LatLng) => void
  show: (at: LatLng, x: number, y: number) => void
  move: (at: LatLng, x: number, y: number) => void
  hide: () => void
}

/** The drag payload's coordinate and its screen point (dp). */
export function dragPoint(e: unknown): { at: LatLng; x: number; y: number } | null {
  const f = e as { geometry?: { coordinates?: number[] }; properties?: { screenPointX?: number; screenPointY?: number } }
  const [lng, lat] = f.geometry?.coordinates ?? []
  const x = f.properties?.screenPointX
  const y = f.properties?.screenPointY
  if (![lng, lat, x, y].every((n) => typeof n === 'number' && Number.isFinite(n))) return null
  return { at: { lat: lat!, lng: lng! }, x: x!, y: y! }
}

export const Magnifier = forwardRef<
  MagnifierHandle,
  {
    /** The aim step: false unmounts the loupe's map. */
    live: boolean
    map: RefObject<Mapbox.MapView | null>
    /** The main camera's heading (the hole runs up the screen). */
    heading: () => number
    size: { w: number; h: number } | null
    pin: LatLng | null
    lefty: boolean
    /** Logo and attribution at the map's top corners (else bottom-left). */
    ornamentsTop: boolean
  }
>(function Magnifier({ live, map, heading, size, pin, lefty, ornamentsTop }, ref) {
  const [start, setStart] = useState<{ center: [number, number]; zoom: number; heading: number } | null>(null)
  const [ready, setReady] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [pos, setPos] = useState<ScreenPt>([0, 0])
  const camera = useRef<Mapbox.Camera>(null)
  const zoom = useRef(17)
  const pinPt = useRef<ScreenPt | null>(null)

  const keepOut = (finger: ScreenPt): ScreenBox[] => {
    if (!size) return []
    const boxes: ScreenBox[] = ornamentsTop
      ? [
          { left: 0, top: 0, right: ORNAMENT_W, bottom: ORNAMENT_H },
          { left: size.w - INFO_W, top: 0, right: size.w, bottom: ORNAMENT_H },
        ]
      : [{ left: 0, top: size.h - ORNAMENT_H, right: ORNAMENT_W + INFO_W, bottom: size.h }]
    const p = pinPt.current
    if (p) {
      // The tag sits at the aim→pin midpoint, right of the line (left for lefty).
      const mx = (p[0] + finger[0]) / 2
      const my = (p[1] + finger[1]) / 2
      const [left, right] = lefty ? [mx - TAG_W, mx] : [mx, mx + TAG_W]
      boxes.push({ left, top: my - TAG_H / 2, right, bottom: my + TAG_H / 2 })
    }
    return boxes
  }
  const place = (x: number, y: number) => {
    if (!size) return
    setPos(placeLoupe({ finger: [x, y], r: R, size, keepOut: keepOut([x, y]), away: lefty ? 1 : -1 }))
  }
  const centre = (at: LatLng) =>
    camera.current?.setCamera({ centerCoordinate: [at.lng, at.lat], zoomLevel: zoom.current + ZOOM_UP, heading: heading(), animationDuration: 0 })

  useImperativeHandle(ref, () => ({
    warm: (aim) => {
      if (start) return
      void map.current?.getZoom().then((z) => {
        zoom.current = z
        setStart({ center: [aim.lng, aim.lat], zoom: z + ZOOM_UP, heading: heading() })
      })
    },
    show: (at, x, y) => {
      setDragging(true)
      place(x, y)
      pinPt.current = null
      if (pin) {
        // Mapbox answers (-1, -1) for a pin off the screen: no tag to dodge then.
        void map.current?.getPointInView([pin.lng, pin.lat]).then(([px = -1, py = -1]) => {
          if (px >= 0 && py >= 0) pinPt.current = [px, py]
        })
      }
      // No touch-down reached us first: mount now (it shows once drawn).
      if (!start) setStart({ center: [at.lng, at.lat], zoom: zoom.current + ZOOM_UP, heading: heading() })
      centre(at)
      // The player may have zoomed since the touch-down.
      void map.current?.getZoom().then((z) => {
        zoom.current = z
        centre(at)
      })
    },
    move: (at, x, y) => {
      place(x, y)
      centre(at)
    },
    hide: () => setDragging(false),
  }))

  // Out of the aim step: drop the second map until the next touch-down.
  useEffect(() => {
    if (live) return
    setStart(null)
    setReady(false)
    setDragging(false)
  }, [live])

  if (!live || !start) return null
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: pos[0] - R,
        top: pos[1] - R,
        width: LOUPE,
        height: LOUPE,
        borderRadius: R,
        borderWidth: 2,
        borderColor: P.ink,
        backgroundColor: P.chrome,
        overflow: 'hidden',
        opacity: dragging && ready ? 1 : 0,
      }}
    >
      <Mapbox.MapView
        style={{ flex: 1 }}
        styleURL={Mapbox.StyleURL.Satellite}
        // TextureView, so the circle clips it (a GLSurfaceView ignores the parent's radius).
        surfaceView={false}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        scaleBarEnabled={false}
        compassEnabled={false}
        // The main map shows both; this one is a detail of it.
        logoEnabled={false}
        attributionEnabled={false}
        onDidFinishRenderingFrameFully={ready ? undefined : () => setReady(true)}
      >
        <Mapbox.Camera
          ref={camera}
          defaultSettings={{ centerCoordinate: start.center, zoomLevel: start.zoom, heading: start.heading }}
        />
      </Mapbox.MapView>
      {/* The crosshair: where the aim lands. */}
      <View style={{ position: 'absolute', left: R - 1, top: R - 14, width: 2, height: 28, backgroundColor: P.ink }} />
      <View style={{ position: 'absolute', top: R - 1, left: R - 14, height: 2, width: 28, backgroundColor: P.ink }} />
      <View
        style={{ position: 'absolute', left: R - 3, top: R - 3, width: 6, height: 6, borderRadius: 3, backgroundColor: P.warn, borderWidth: 1, borderColor: P.raised }}
      />
    </View>
  )
})
