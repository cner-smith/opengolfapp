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

  it('smoothed RMSE beats raw RMSE by at least 30%, last point within 1.5 m', () => {
    // Deterministic zero-mean noise sequence (sums to 0). With Q=3,
    // R=25 the steady-state Kalman gain is ~0.3, so the filter
    // attenuates noise meaningfully. RMSE comparison is the right
    // measure here — the prior "last smoothed closer than last raw"
    // assertion passed for trivial reasons whenever the final raw
    // point happened to be far from truth.
    const offsetsM = [3, -2, 4, -3, 2, -4, 3, -1, 1, -3]
    const noisy: GPSPoint[] = offsetsM.map((m, i) => ({
      lat: OKC.lat + METRE_LAT * m,
      lng: OKC.lng + METRE_LNG * m,
      accuracy: 5,
      timestamp: i * 1000,
    }))
    const smoothed = smoothGPSTrack(noisy)

    const rmseMetres = (track: GPSPoint[]): number => {
      let sum = 0
      for (const p of track) {
        // Yards via haversine, converted back to metres.
        const distMetres = haversineYards(OKC.lat, OKC.lng, p.lat, p.lng) / 1.09361
        sum += distMetres * distMetres
      }
      return Math.sqrt(sum / track.length)
    }

    const rawRmse = rmseMetres(noisy)
    const smoothedRmse = rmseMetres(smoothed)
    expect(smoothedRmse).toBeLessThan(rawRmse * 0.7)

    const last = smoothed[smoothed.length - 1]!
    const lastDistMetres = haversineYards(OKC.lat, OKC.lng, last.lat, last.lng) / 1.09361
    expect(lastDistMetres).toBeLessThan(1.5)
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

describe('edge cases', () => {
  it('accuracy:0 falls back to default initial variance, filter does not collapse', () => {
    // Some Android GPS states report accuracy 0. Without the floor
    // this would seed variance=0 → K=1 → filter ignores every prior
    // and just passes raw readings through. Floor must reject 0.
    const s = createKalmanState({ lat: OKC.lat, lng: OKC.lng, accuracy: 0 })
    expect(s.variance).toBe(49)
  })

  it('updateKalman with accuracy:0 falls back to default R=25, not R=0', () => {
    const state = createKalmanState({ lat: OKC.lat, lng: OKC.lng, accuracy: 5 })
    const next = updateKalman(state, {
      lat: OKC.lat,
      lng: OKC.lng + METRE_LNG,
      accuracy: 0,
    })
    // With state variance 25, predV = 28, R fallback = 25, K = 28/53.
    // If R=0 leaked through, K=1 and drift would be exactly 1.0.
    const drift = (next.lng - OKC.lng) / METRE_LNG
    expect(drift).toBeCloseTo(28 / 53, 4)
  })

  it('accuracy:NaN treated as missing, uses default R', () => {
    const state = createKalmanState({ lat: OKC.lat, lng: OKC.lng, accuracy: 5 })
    const next = updateKalman(state, {
      lat: OKC.lat,
      lng: OKC.lng + METRE_LNG,
      accuracy: NaN,
    })
    expect(Number.isFinite(next.lat)).toBe(true)
    expect(Number.isFinite(next.lng)).toBe(true)
    expect(Number.isFinite(next.variance)).toBe(true)
    const drift = (next.lng - OKC.lng) / METRE_LNG
    expect(drift).toBeCloseTo(28 / 53, 4)
  })

  it('reading with NaN lat is ignored, state unchanged', () => {
    const state = createKalmanState({ lat: OKC.lat, lng: OKC.lng, accuracy: 5 })
    const next = updateKalman(state, { lat: NaN, lng: OKC.lng, accuracy: 5 })
    expect(next).toBe(state)
  })

  it('reading with NaN lng is ignored, state unchanged', () => {
    const state = createKalmanState({ lat: OKC.lat, lng: OKC.lng, accuracy: 5 })
    const next = updateKalman(state, { lat: OKC.lat, lng: NaN, accuracy: 5 })
    expect(next).toBe(state)
  })

  it('backward timestamp clamps dt to 0, filter freezes gracefully', () => {
    // dt < 0 must not push variance backward. Math.max(0, …) clamps
    // dt to 0 → Q*dt = 0 → predV = state.variance. With identical
    // accuracy on state and reading, K reduces to var/(var+R).
    const state = createKalmanState({
      lat: OKC.lat,
      lng: OKC.lng,
      accuracy: 5,
      timestamp: 5000,
    })
    const next = updateKalman(state, {
      lat: OKC.lat,
      lng: OKC.lng + METRE_LNG,
      accuracy: 5,
      timestamp: 1000,
    })
    expect(Number.isFinite(next.variance)).toBe(true)
    expect(next.variance).toBeGreaterThan(0)
    // Predicted variance = state.variance (25) + 0 = 25; K = 25/50.
    const drift = (next.lng - OKC.lng) / METRE_LNG
    expect(drift).toBeCloseTo(0.5, 4)
  })

  it('createKalmanState with NaN lat throws descriptive error', () => {
    expect(() =>
      createKalmanState({ lat: NaN, lng: OKC.lng, accuracy: 5 }),
    ).toThrow(/lat and lng must be finite/)
  })

  it('createKalmanState with NaN lng throws descriptive error', () => {
    expect(() =>
      createKalmanState({ lat: OKC.lat, lng: NaN, accuracy: 5 }),
    ).toThrow(/lat and lng must be finite/)
  })
})
