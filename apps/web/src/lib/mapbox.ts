import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined

if (TOKEN) {
  mapboxgl.accessToken = TOKEN
} else if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.warn('VITE_MAPBOX_TOKEN missing — map view will not render.')
}

export { mapboxgl }
export const MAPBOX_TOKEN_PRESENT = !!TOKEN
