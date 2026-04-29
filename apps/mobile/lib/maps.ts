import Mapbox from '@rnmapbox/maps'

const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? ''

let initialized = false

export function ensureMapboxInitialized() {
  if (initialized) return
  if (!token) {
    console.warn('EXPO_PUBLIC_MAPBOX_TOKEN is missing — map will not render.')
    return
  }
  Mapbox.setAccessToken(token)
  initialized = true
}

export function distanceYards(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  const meters = 2 * R * Math.asin(Math.sqrt(h))
  return meters * 1.09361
}
