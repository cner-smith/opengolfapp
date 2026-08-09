// Constants + low-level helpers shared by every crawler module.

export const OPENGOLFAPI_BASE = 'https://api.opengolfapi.org/v1'
export const OPENGOLFAPI_DELAY_MS = 1100 // ~1 req/sec with buffer
export const OSM_DELAY_MS = 2100

export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

export const ALL_STATES = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
] as const

// [south, west, north, east] in degrees. Approximate state bounding boxes
// for OSM Overpass queries. Alaska + Hawaii skipped (no contiguous bbox /
// non-meaningful golf coverage). Add states here as needed.
export const STATE_BBOX: Record<string, [number, number, number, number]> = {
  AL: [30.14, -88.47, 35.01, -84.89],
  AZ: [31.33, -114.82, 37.0, -109.04],
  AR: [33.0, -94.62, 36.5, -89.64],
  CA: [32.53, -124.41, 42.01, -114.13],
  CO: [36.99, -109.06, 41.0, -102.04],
  CT: [40.98, -73.73, 42.05, -71.79],
  DE: [38.45, -75.79, 39.84, -75.05],
  FL: [24.52, -87.63, 31.0, -80.03],
  GA: [30.36, -85.61, 35.0, -80.84],
  ID: [42.0, -117.24, 49.0, -111.04],
  IL: [36.97, -91.51, 42.51, -87.02],
  IN: [37.77, -88.1, 41.76, -84.78],
  IA: [40.38, -96.64, 43.5, -90.14],
  KS: [36.99, -102.05, 40.0, -94.59],
  KY: [36.5, -89.57, 39.15, -81.96],
  LA: [28.93, -94.04, 33.02, -88.82],
  ME: [43.06, -71.08, 47.46, -66.95],
  MD: [37.91, -79.49, 39.72, -75.05],
  MA: [41.24, -73.51, 42.89, -69.93],
  MI: [41.7, -90.42, 48.31, -82.41],
  MN: [43.5, -97.24, 49.38, -89.49],
  MS: [30.17, -91.66, 35.01, -88.1],
  MO: [35.99, -95.77, 40.61, -89.1],
  MT: [44.36, -116.05, 49.0, -104.04],
  NE: [40.0, -104.05, 43.0, -95.31],
  NV: [35.0, -120.01, 42.0, -114.04],
  NH: [42.7, -72.56, 45.31, -70.56],
  NJ: [38.93, -75.56, 41.36, -73.89],
  NM: [31.33, -109.05, 37.0, -103.0],
  NY: [40.5, -79.76, 45.02, -71.86],
  NC: [33.84, -84.32, 36.59, -75.46],
  ND: [45.94, -104.05, 49.0, -96.55],
  OH: [38.4, -84.82, 42.0, -80.52],
  OK: [33.62, -103.0, 37.0, -94.43],
  OR: [42.0, -124.57, 46.3, -116.46],
  PA: [39.72, -80.52, 42.27, -74.69],
  RI: [41.15, -71.91, 42.02, -71.12],
  SC: [32.03, -83.35, 35.22, -78.54],
  SD: [42.48, -104.06, 45.95, -96.44],
  TN: [34.98, -90.31, 36.68, -81.65],
  TX: [25.84, -106.65, 36.5, -93.51],
  UT: [37.0, -114.05, 42.0, -109.04],
  VT: [42.73, -73.44, 45.02, -71.46],
  VA: [36.54, -83.68, 39.47, -75.24],
  WA: [45.54, -124.85, 49.0, -116.92],
  WV: [37.2, -82.65, 40.64, -77.72],
  WI: [42.49, -92.89, 47.08, -86.25],
  WY: [40.99, -111.06, 45.01, -104.05],
  // British Isles fetch tiles (opt-in via --states, NOT in ALL_STATES so the
  // US default/cron is untouched). Keys double as the rough courses.state
  // label at fetch time; label-uk-ie.cjs then PIP-corrects each course to its
  // true constituent country (Scotland/England/Wales/Northern Ireland/Ireland)
  // via Natural Earth admin-1 `geonunit`. Tiles deliberately OVERLAP at the
  // borders (Scotland↔England-North, England↔Wales, Ireland island covers NI) —
  // upsert-on-external_id dedups and the PIP pass is authoritative, so overlap
  // is harmless. England is split N/S purely to keep each Overpass query under
  // the 90s timeout (England alone is ~1,900 courses). If a tile times out on
  // re-run, split its bbox further — same pattern.
  // ponytail: 5 hand-tuned tiles, not a general grid — split a tile if it times out.
  Scotland: [54.6, -8.7, 60.9, -0.7],
  Wales: [51.3, -5.4, 53.5, -2.6],
  Ireland: [51.3, -10.7, 55.5, -5.3], // whole island (ROI + NI); PIP splits them
  'England-South': [49.9, -6.5, 52.9, 1.8],
  'England-North': [52.9, -3.7, 55.9, 0.3],
}

// Convenience list for the British Isles discovery run — pass as the --states
// comma value to the osm + osm-holes passes. Not wired into ALL_STATES (opt-in).
export const UK_IE_TILES = [
  'Scotland',
  'Wales',
  'Ireland',
  'England-South',
  'England-North',
] as const

export const MATCH_THRESHOLD = 0.7

// The crawler's fallback names are exactly "Golf Course" or "Golf Course (City)".
// Anchor the match so real names beginning with "Golf Course" (e.g. "Golf Course
// at the Bluffs") are NOT treated as fallbacks.
export const isFallbackName = (name: string): boolean =>
  name === 'Golf Course' || /^Golf Course \(.+\)$/.test(name)

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function asInt(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v)
  if (typeof v === 'string') {
    const n = parseInt(v, 10)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

export function asNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = parseFloat(v)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

// Ray-casting point-in-polygon test. ring is the polygon's ordered vertices
// ({lat,lng}); returns true if the point lies inside. Used by the completion
// pass to assign each OSM hole to the course polygon that actually contains it
// (exact), instead of the nearest centroid (a guess that bleeds holes between
// adjacent courses).
export function pointInPolygon(
  pt: { lat: number; lng: number },
  ring: { lat: number; lng: number }[],
): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i].lat
    const xi = ring[i].lng
    const yj = ring[j].lat
    const xj = ring[j].lng
    // Casts a ray in +lat at x=pt.lng; the xi>lng!==xj>lng test excludes
    // vertical edges (and guards the divide), so horizontal edges must NOT be
    // skipped — they're resolved by the formula. Matches the validated variant.
    if (xi > pt.lng !== xj > pt.lng && pt.lat < ((yj - yi) * (pt.lng - xi)) / (xj - xi) + yi) {
      inside = !inside
    }
  }
  return inside
}

// Great-circle distance in metres. Used by the osm-holes pass to assign each
// OSM hole way to its nearest course centroid and to snap tee/green endpoints.
export function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const la1 = toRad(aLat)
  const la2 = toRad(bLat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
