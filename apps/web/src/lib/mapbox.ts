import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { bearingDegrees } from '@oga/core'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined

if (TOKEN) {
  mapboxgl.accessToken = TOKEN
} else if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.warn('VITE_MAPBOX_TOKEN missing — map view will not render.')
}

export { mapboxgl }
export const MAPBOX_TOKEN_PRESENT = !!TOKEN

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
