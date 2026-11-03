import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { bearingDegrees } from '@oga/core'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined

if (TOKEN) {
  mapboxgl.accessToken = TOKEN
} else {
  // Every build: a deploy without the token must be diagnosable.
  console.error('VITE_MAPBOX_TOKEN missing — map view will not render.')
}

export { mapboxgl }
export const MAPBOX_TOKEN_PRESENT = !!TOKEN

const STYLE_TIMEOUT_MS = 15_000

/** A map that can fail at runtime calls onFail (#1225). From mapbox-gl 3.23's
 *  source: `new Map` throws when WebGL can't start; a blocked or offline style
 *  fetch fires `error` with no `sourceId` before `load`, while tile and source
 *  errors carry a `sourceId` and leave the map usable. A style request that
 *  never answers fires nothing, so `load` gets a deadline. */
export function createMap(options: mapboxgl.MapOptions, onFail: () => void): mapboxgl.Map | null {
  let map: mapboxgl.Map
  try {
    map = new mapboxgl.Map(options)
  } catch (err) {
    console.error(err)
    onFail()
    return null
  }
  let loaded = false
  const timer = setTimeout(() => {
    if (!loaded) onFail()
  }, STYLE_TIMEOUT_MS)
  map.once('load', () => {
    loaded = true
    clearTimeout(timer)
  })
  map.once('remove', () => clearTimeout(timer))
  map.on('error', (e) => {
    // A bound listener stops Mapbox printing the error itself.
    console.error(e.error)
    if (loaded || 'sourceId' in e) return
    clearTimeout(timer)
    onFail()
  })
  return map
}

/** Frame a hole "up-the-hole": rotate the camera so the tee→pin line runs
 *  bottom→top, then fitBounds so both endpoints sit in view. Shared by the
 *  planner map (HoleStrategyMap), the round-detail map (useMapSetup), and the
 *  shot mini-map. Pure bearing math lives in @oga/core; this only composes the
 *  Mapbox fitBounds call. `animate:false` (default) snaps; pass true to fly. */
export function fitHoleUpward(
  map: mapboxgl.Map,
  tee: { lat: number; lng: number },
  pin: { lat: number; lng: number },
  opts: {
    padding?: mapboxgl.PaddingOptions | number
    maxZoom?: number
    animate?: boolean
    duration?: number
  } = {},
): void {
  const bounds = new mapboxgl.LngLatBounds([tee.lng, tee.lat], [tee.lng, tee.lat])
  bounds.extend([pin.lng, pin.lat])
  map.fitBounds(bounds, {
    bearing: bearingDegrees(tee.lat, tee.lng, pin.lat, pin.lng),
    // Generous top/bottom keeps tee + pin off the edges; the sides give a
    // dispersion cone room since a 2-point bounds is near-zero-width.
    padding: opts.padding ?? { top: 80, bottom: 80, left: 90, right: 90 },
    maxZoom: opts.maxZoom ?? 17.5,
    animate: opts.animate ?? false,
    duration: opts.duration ?? 600,
  })
}
