// OSM Nominatim reverse geocoding — derive a course's city from its centroid.
// Most OSM golf_course ways carry no addr:city, so osm-fetcher can only give
// them a bare "Golf Course" fallback name. This pass reverse-geocodes those
// coordinates to a real city so courses become locatable without hand-editing.
import { sleep } from './util'
import { fetchCitylessCourses, updateCourseCity } from './db-writer'

const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse'
// Nominatim usage policy: absolute max 1 req/sec, identifying User-Agent required.
const NOMINATIM_DELAY_MS = 1100
const USER_AGENT = 'oga-course-crawler/0.1 (https://github.com/cner-smith/opengolfapp)'

// Reverse-geocode a coordinate to its city name. Returns null when Nominatim
// has no populated place for the point (or on repeated failure). Prefers the
// most specific place field; county is intentionally skipped as too coarse for
// a useful course label.
export async function reverseGeocodeCity(lat: number, lng: number): Promise<string | null> {
  // No zoom override: zoom=10 collapses to county-level and drops the city.
  const url = `${NOMINATIM_REVERSE}?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`
  let attempts = 0
  const MAX_ATTEMPTS = 2
  while (true) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      })
      if (res.status === 429) {
        console.warn('[geocode] rate limited — waiting 30s')
        await sleep(30000)
        continue
      }
      if (!res.ok) {
        attempts++
        if (attempts < MAX_ATTEMPTS) {
          console.warn(`[geocode] HTTP ${res.status} — retrying in 5s`)
          await sleep(5000)
          continue
        }
        return null
      }
      const data = (await res.json()) as { address?: Record<string, string> }
      const a = data.address ?? {}
      return a.city || a.town || a.village || a.hamlet || a.municipality || null
    } catch (err) {
      attempts++
      if (attempts < MAX_ATTEMPTS) {
        console.warn(`[geocode] ${(err as Error).message} — retrying in 5s`)
        await sleep(5000)
        continue
      }
      return null
    }
  }
}

// Backfill city for every course that has coordinates but no city. Rewrites the
// bare "Golf Course" fallback name to "Golf Course (City)" so nameless courses
// gain a location label; leaves real names untouched. --limit caps a run
// (Nominatim is ~1 req/sec, so a full national backfill takes hours).
export async function crawlGeocode(limit: number | null): Promise<void> {
  const courses = await fetchCitylessCourses(limit)
  console.log(`Geocode: ${courses.length} course(s) with coords but no city`)
  let filled = 0
  let missed = 0
  for (let i = 0; i < courses.length; i++) {
    const c = courses[i]
    if (!c) continue
    const city = await reverseGeocodeCity(c.lat, c.lng)
    if (city) {
      const name = c.name.startsWith('Golf Course') ? `Golf Course (${city})` : undefined
      await updateCourseCity(c.id, city, name)
      filled++
    } else {
      missed++
    }
    if ((i + 1) % 25 === 0 || i === courses.length - 1) {
      console.log(`[geocode] ${i + 1}/${courses.length} — filled ${filled}, no-match ${missed}`)
    }
    await sleep(NOMINATIM_DELAY_MS)
  }
  console.log(`\nGeocode complete: ${filled} cities filled, ${missed} without a match`)
}
