// 2D Kalman filter for GPS smoothing during the live-round PLACE_BALL
// phase. Raw phone GPS is ±3-10 m; at golf distances that translates to
// 6-20 yd of shot-distance error, which corrupts SG. Filter runs in pure
// state form so web (future) and mobile share the same smoother — apps
// wire it to their own Location subscription.
//
// Standard 1D Kalman update applied independently to lat and lng. Lat
// and lng aren't truly independent over large distances (longitude
// scales with cos(lat)) but at golf-hole scale the error is well under
// a yard, and decoupling keeps the math trivial.

export interface GPSPoint {
  lat: number
  lng: number
  // Reported GPS accuracy in metres (the standard deviation, per
  // expo-location and most platform docs). Optional — falls back to
  // a 5 m default measurement noise.
  accuracy?: number
  timestamp?: number
}

export interface KalmanState {
  lat: number
  lng: number
  // Position uncertainty in metres². Combined for both axes since
  // accuracy is reported as a single radial value.
  variance: number
  timestamp?: number
}

// Default initial variance when no accuracy is reported. 49 m² ≈ 7 m σ
// — slightly worse than typical phone GPS, so the first real reading
// pulls the state toward truth.
const DEFAULT_INIT_VARIANCE = 49

// Default measurement noise (R) when a reading lacks accuracy. 25 m²
// ≈ 5 m σ — a reasonable mid-range phone GPS estimate.
const DEFAULT_MEASUREMENT_VARIANCE = 25

// Default process noise (Q) in m² per second. Player walks ~1.5 m/s
// and updates fire every 1-2 s, so 3 m²/s lets the filter follow a
// walking player without lagging.
const DEFAULT_PROCESS_NOISE = 3

export function createKalmanState(point: GPSPoint): KalmanState {
  // Refuse to seed from a malformed coordinate. NaN here would
  // permanently corrupt every subsequent updateKalman result, so fail
  // loud at the boundary rather than silently produce NaN positions.
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
    throw new Error('createKalmanState: lat and lng must be finite numbers')
  }
  // accuracy must be a finite, positive number to be meaningful. A
  // reported 0 (some Android GPS states) would seed the filter with
  // zero variance and cause it to ignore every subsequent reading;
  // NaN would propagate. Either case falls back to the 7 m default.
  const safeAccuracy =
    point.accuracy != null && Number.isFinite(point.accuracy) && point.accuracy > 0
      ? point.accuracy
      : null
  const variance = safeAccuracy != null ? safeAccuracy ** 2 : DEFAULT_INIT_VARIANCE
  return {
    lat: point.lat,
    lng: point.lng,
    variance,
    timestamp: point.timestamp,
  }
}

export interface KalmanOptions {
  processNoise?: number
}

export function updateKalman(
  state: KalmanState,
  point: GPSPoint,
  options?: KalmanOptions,
): KalmanState {
  // Drop corrupt readings outright — a single NaN measurement would
  // poison the filter for the rest of the session.
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
    return state
  }
  const Q = options?.processNoise ?? DEFAULT_PROCESS_NOISE
  const dt =
    point.timestamp != null && state.timestamp != null
      ? Math.max(0, (point.timestamp - state.timestamp) / 1000)
      : 1

  const predictedVariance = state.variance + Q * dt
  // Same accuracy guard as createKalmanState — accuracy:0 would set
  // R=0 and force K=1 (raw passthrough); NaN would propagate.
  const safeAccuracy =
    point.accuracy != null && Number.isFinite(point.accuracy) && point.accuracy > 0
      ? point.accuracy
      : null
  const R = safeAccuracy != null ? safeAccuracy ** 2 : DEFAULT_MEASUREMENT_VARIANCE
  const K = predictedVariance / (predictedVariance + R)

  return {
    lat: state.lat + K * (point.lat - state.lat),
    lng: state.lng + K * (point.lng - state.lng),
    variance: (1 - K) * predictedVariance,
    timestamp: point.timestamp,
  }
}

export function smoothGPSTrack(points: GPSPoint[]): GPSPoint[] {
  const first = points[0]
  if (!first) return []
  let state = createKalmanState(first)
  const out: GPSPoint[] = [first]
  for (let i = 1; i < points.length; i++) {
    const p = points[i]
    if (!p) continue
    state = updateKalman(state, p)
    out.push({
      lat: state.lat,
      lng: state.lng,
      accuracy: p.accuracy,
      timestamp: p.timestamp,
    })
  }
  return out
}
