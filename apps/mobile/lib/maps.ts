import Mapbox from '@rnmapbox/maps'
import { haversineYards } from '@oga/core'

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
  return haversineYards(a.lat, a.lng, b.lat, b.lng)
}
