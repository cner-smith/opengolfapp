import { describe, expect, it } from 'vitest'
import {
  createKalmanState,
  smoothGPSTrack,
  updateKalman,
  type GPSPoint,
} from '../kalman'
import { haversineYards } from '../units'

// Realistic OKC golf-course coordinates. Picking lat/lng pairs whose
// metre-scale offsets are easy to reason about: at lat 35.46°,
// 1° lat ≈ 111 km and 1° lng ≈ 90.6 km, so 1 m ≈ 9e-6° lat / 1.1e-5° lng.
const OKC = { lat: 35.4676, lng: -97.5164 }
const METRE_LAT = 1 / 111_000
const METRE_LNG = 1 / 90_600

describe('createKalmanState', () => {
  it('returns the input point with variance from accuracy²', () => {
    const s = createKalmanState({ lat: OKC.lat, lng: OKC.lng, accuracy: 4 })
    expect(s.lat).toBe(OKC.lat)
    expect(s.lng).toBe(OKC.lng)
    expect(s.variance).toBe(16)
  })

  it('falls back to 49 m² (7 m σ) when accuracy is missing', () => {
    const s = createKalmanState({ lat: OKC.lat, lng: OKC.lng })
    expect(s.variance).toBe(49)
  })

  it('preserves timestamp', () => {
    const s = createKalmanState({ lat: OKC.lat, lng: OKC.lng, timestamp: 1000 })
    expect(s.timestamp).toBe(1000)
  })
})

describe('updateKalman', () => {
  it('falls back to 5 m default measurement noise when accuracy missing', () => {
    // State seeded without accuracy → variance = DEFAULT_INIT (49).
    // Update with no accuracy on the reading → R = DEFAULT (25).
    // dt = 1, Q = 3 → predV = 52, K = 52 / 77.
    const state = createKalmanState({ lat: OKC.lat, lng: OKC.lng })
    const next = updateKalman(state, {
      lat: OKC.lat,
      lng: OKC.lng + METRE_LNG,
    })
    const expectedGain = 52 / (52 + 25)
    const drift = (next.lng - OKC.lng) / METRE_LNG
    expect(drift).toBeCloseTo(expectedGain, 4)
  })

  it('high-accuracy reading pulls state more than low-accuracy reading', () => {
    // Same starting state and same offset; only accuracy differs.
    const start = createKalmanState({ lat: OKC.lat, lng: OKC.lng, accuracy: 5 })
    const target: GPSPoint = { lat: OKC.lat, lng: OKC.lng + METRE_LNG * 10 }
    const sharp = updateKalman(start, { ...target, accuracy: 1 })
    const fuzzy = updateKalman(start, { ...target, accuracy: 20 })
    const sharpShift = sharp.lng - OKC.lng
    const fuzzyShift = fuzzy.lng - OKC.lng
    expect(sharpShift).toBeGreaterThan(fuzzyShift)
  })

  it('two identical points return the same position', () => {
    const state = createKalmanState({ lat: OKC.lat, lng: OKC.lng, accuracy: 3 })
    const next = updateKalman(state, { lat: OKC.lat, lng: OKC.lng, accuracy: 3 })
    expect(next.lat).toBe(OKC.lat)
    expect(next.lng).toBe(OKC.lng)
  })

  it('uses elapsed timestamp delta for process noise', () => {
    // Larger dt → larger predicted variance → larger gain → bigger update.
    const a = createKalmanState({ lat: OKC.lat, lng: OKC.lng, accuracy: 5, timestamp: 0 })
    const b = createKalmanState({ lat: OKC.lat, lng: OKC.lng, accuracy: 5, timestamp: 0 })
    const offset = { lat: OKC.lat, lng: OKC.lng + METRE_LNG * 10, accuracy: 5 }
    const fast = updateKalman(a, { ...offset, timestamp: 500 })
    const slow = updateKalman(b, { ...offset, timestamp: 5000 })
    expect(slow.lng - OKC.lng).toBeGreaterThan(fast.lng - OKC.lng)
  })
})

describe('smoothGPSTrack', () => {
  it('returns [] for empty input', () => {
    expect(smoothGPSTrack([])).toEqual([])
  })

  it('returns the single point unchanged', () => {
    const p = { lat: OKC.lat, lng: OKC.lng, accuracy: 5, timestamp: 1000 }
    const out = smoothGPSTrack([p])
    expect(out).toHaveLength(1)
    expect(out[0]).toEqual(p)
  })

  it('first point is unchanged (initializes filter)', () => {
    const points: GPSPoint[] = [
      { lat: OKC.lat, lng: OKC.lng, accuracy: 5 },
      { lat: OKC.lat + METRE_LAT, lng: OKC.lng, accuracy: 5 },
    ]
    const out = smoothGPSTrack(points)
    expect(out[0]?.lat).toBe(OKC.lat)
    expect(out[0]?.lng).toBe(OKC.lng)
  })

  it('noisy readings around a true position converge toward truth', () => {
    // Deterministic alternating noise around (OKC.lat, OKC.lng): each
    // reading is offset by ±5 m on each axis. Mean is exactly the
    // true point, so the smoothed track should drift toward it.
    const noisy: GPSPoint[] = []
    const offsets = [+5, -5, +5, -5, +5, -5, +5, -5, +5, -5, +5, -5]
    for (let i = 0; i < offsets.length; i++) {
      const off = offsets[i]!
      noisy.push({
        lat: OKC.lat + METRE_LAT * off,
        lng: OKC.lng + METRE_LNG * off,
        accuracy: 5,
        timestamp: i * 1000,
      })
    }
    const smoothed = smoothGPSTrack(noisy)
    const last = smoothed[smoothed.length - 1]!
    const lastRaw = noisy[noisy.length - 1]!
    const lastRawDist = haversineYards(OKC.lat, OKC.lng, lastRaw.lat, lastRaw.lng)
    const lastSmoothedDist = haversineYards(OKC.lat, OKC.lng, last.lat, last.lng)
    expect(lastSmoothedDist).toBeLessThan(lastRawDist)
  })

  it('smoothed straight-line walk has lower point-to-point variance than raw', () => {
    // Player walks 30 m east in 15 evenly-spaced steps with ±2 m
    // perpendicular GPS noise. Smoothed track should jitter less.
    const raw: GPSPoint[] = []
    const lateralNoise = [0, 1.5, -1.8, 0.7, -1.2, 1.9, -0.5, 1.1, -1.6, 0.3, -1.4, 1.8, -0.9, 1.0, -0.6]
    for (let i = 0; i < lateralNoise.length; i++) {
      const noise = lateralNoise[i]!
      raw.push({
        lat: OKC.lat + METRE_LAT * noise,
        lng: OKC.lng + METRE_LNG * 2 * i,
        accuracy: 5,
        timestamp: i * 1000,
      })
    }
    const smoothed = smoothGPSTrack(raw)
    const rawJitter = pointToPointVarianceMetres(raw)
    const smoothedJitter = pointToPointVarianceMetres(smoothed)
    expect(smoothedJitter).toBeLessThan(rawJitter)
  })
})

function pointToPointVarianceMetres(points: GPSPoint[]): number {
  // Sum of lateral deviations from the straight line east of OKC.
  // Higher = more jitter perpendicular to the walk.
  let sum = 0
  for (const p of points) {
    const latOffset = (p.lat - OKC.lat) / METRE_LAT
    sum += latOffset * latOffset
  }
  return sum
}
