import { useEffect, useRef } from 'react'
import Mapbox from '@rnmapbox/maps'
import { bearingDegrees } from '@oga/core'
import { distanceYards } from '../../../lib/maps'
import type { HoleMapPhase, LatLng } from '../HoleMap.types'

function toCoord(l: LatLng): [number, number] {
  return [l.lng, l.lat]
}

// Camera heading (deg CW from N) that puts direction-of-play — origin
// (tee/ball) → target (pin) — toward the top of the screen ("up the hole").
// Falls back to north-up (0) with no usable target or when the two points
// are effectively coincident (synthetic holes with no real pin geometry).
function headingUpTheHole(
  origin: LatLng,
  target: LatLng | null | undefined,
): number {
  if (!target) return 0
  if (distanceYards(origin, target) < 5) return 0
  return bearingDegrees(origin.lat, origin.lng, target.lat, target.lng)
}

interface UseHoleCameraOpts {
  center: LatLng
  ball?: LatLng | null
  pin?: LatLng | null
  roundPin?: LatLng | null
  phase: HoleMapPhase
  styleLoaded: boolean
  /**
   * Latest smoothed GPS position from useHoleState. When present AND
   * the player is within ~1000 m of the course centroid, the camera
   * auto-centers on it once after the initial hole frame. Testing
   * from the user's house won't trigger because the gating distance
   * fails.
   */
  gpsPosition?: LatLng | null
  /**
   * Course centroid (courses.lat/lng). Required for the auto-center
   * proximity check; absent → auto-center is skipped.
   */
  courseCenter?: LatLng | null
}

// 1000 m gating threshold for auto-center, expressed as yards because
// the only haversine helper imported here returns yards. 1000 m / 0.9144.
const AUTO_CENTER_GATE_YARDS = 1094

// Owns every camera positioning side-effect for HoleMap. The hook
// returns the camera ref so HoleMap can mount it on the Mapbox.Camera
// instance; all flyTo / setCamera scheduling is internal.
export function useHoleCamera({
  center,
  ball,
  pin,
  roundPin,
  phase,
  styleLoaded,
  gpsPosition,
  courseCenter,
}: UseHoleCameraOpts) {
  const cameraRef = useRef<Mapbox.Camera>(null)
  const cameraInitialized = useRef(false)
  const isPinMode = phase === 'PIN'
  const isAimPhase = phase === 'SET_AIM'

  // Center the camera once on first valid coords. Subsequent center changes
  // (e.g. GPS deltas while standing on the tee) should not retrigger
  // setCamera — the style was reloading and the satellite tiles would flash
  // back to a black canvas every time.
  //
  // PLACE_BALL is flat top-down (pitch 0) — tilt only happens on the
  // SET_AIM transition below. A tilted tee-box camera was disorienting
  // on the device because it framed grass at an angle before the player
  // had even decided what they were aiming at.
  useEffect(() => {
    if (!styleLoaded) return
    if (cameraInitialized.current) return
    if (!cameraRef.current) return
    // setCamera throws on Android when the native camera handle has
    // been released (e.g. hole transition mid-animation); the JS ref
    // can stay truthy through teardown in @rnmapbox/maps 10.1.x.
    try {
      cameraRef.current.setCamera({
        centerCoordinate: toCoord(center),
        zoomLevel: 17,
        pitch: 0,
        heading: headingUpTheHole(center, roundPin ?? pin),
        animationDuration: 400,
      })
      cameraInitialized.current = true
    } catch {
      // native camera released — retry on next dep change
    }
  }, [styleLoaded, center.lat, center.lng])

  // Hole change: when the resident MapView's `center` prop moves to a
  // new hole's tee (live-round screen no longer remounts per hole, see
  // #264), explicitly fly the camera to the new center. Skips the
  // first-frame case (covered by cameraInitialized above) and no-op
  // transitions where center didn't actually change.
  const lastHoleCenterRef = useRef<LatLng | null>(null)
  useEffect(() => {
    if (!styleLoaded) return
    if (!cameraInitialized.current) {
      lastHoleCenterRef.current = center
      return
    }
    if (!cameraRef.current) return
    const prev = lastHoleCenterRef.current
    if (
      prev &&
      Math.abs(prev.lat - center.lat) < 1e-7 &&
      Math.abs(prev.lng - center.lng) < 1e-7
    ) {
      return
    }
    try {
      cameraRef.current.setCamera({
        centerCoordinate: toCoord(center),
        zoomLevel: 17,
        pitch: 0,
        heading: headingUpTheHole(center, roundPin ?? pin),
        animationDuration: 800,
      })
      lastHoleCenterRef.current = center
    } catch {
      // native camera released — retry on next center change
    }
  }, [styleLoaded, center.lat, center.lng])

  // Auto-center on the player's GPS position once per hole, when (a) the
  // initial hole frame has already shown and (b) the player is actually
  // at this course. Gated by distance to course centroid so testing from
  // home doesn't yank the camera to a parking lot 50 mi away.
  const autoCenteredRef = useRef(false)
  // Pin coords the arriving PLACE_BALL heading was last applied to, so a
  // late-loading pin re-frames the map exactly once (effect below) and GPS
  // ticks don't re-rotate. Reset per hole alongside the auto-center latch.
  const headingAppliedPinRef = useRef<string | null>(null)
  useEffect(() => {
    // Reset on hole change (center prop moves to new tee/centroid). When
    // the per-hole route is collapsed to one component (issue #264 fix),
    // this is still the right reset signal.
    autoCenteredRef.current = false
    headingAppliedPinRef.current = null
  }, [center.lat, center.lng])

  // The initial / hole-change frames compute the up-the-hole heading from
  // roundPin ?? pin, which can be null when the tee/center resolves first —
  // on synthetic holes the round pin loads from a separate fetch than the
  // tee. Those two effects are latched (cameraInitialized / center-equality)
  // so they won't re-fire when the pin arrives, leaving the map stuck north.
  // Re-frame the arriving PLACE_BALL view once the pin resolves; SET_AIM and
  // PIN own the camera in their own phases, so this is gated to PLACE_BALL.
  // Keyed on the pin coords so it fires once per hole, not on every GPS tick.
  useEffect(() => {
    if (!styleLoaded) return
    // NB: do NOT gate on cameraInitialized here. When the pin resolves
    // BEFORE the first-frame init runs (its deps are style+center, not pin),
    // an early bail on !cameraInitialized left this effect never re-firing —
    // its own deps hadn't changed — so the map stayed stuck north-up. That's
    // the "first hole opens with the pin not at the top" bug. The init effect
    // is defined first, so on the common path it still frames first; this is
    // the safety net that guarantees the up-the-hole heading lands once the
    // pin is known, whatever the load order. (A redundant re-frame to the same
    // heading is a visual no-op — the camera is already there.)
    if (phase !== 'PLACE_BALL') return
    if (!cameraRef.current) return
    const target = roundPin ?? pin ?? null
    if (!target) return
    const key = `${target.lat},${target.lng}`
    if (headingAppliedPinRef.current === key) return
    try {
      cameraRef.current.setCamera({
        centerCoordinate: toCoord(center),
        zoomLevel: 17,
        pitch: 0,
        heading: headingUpTheHole(center, target),
        animationDuration: 500,
      })
      headingAppliedPinRef.current = key
    } catch {
      // native camera released — retry on next change
    }
  }, [
    styleLoaded,
    phase,
    center.lat,
    center.lng,
    roundPin?.lat,
    roundPin?.lng,
    pin?.lat,
    pin?.lng,
  ])
  useEffect(() => {
    if (!styleLoaded) return
    if (!cameraInitialized.current) return
    if (autoCenteredRef.current) return
    if (!gpsPosition || !courseCenter) return
    if (distanceYards(gpsPosition, courseCenter) > AUTO_CENTER_GATE_YARDS) return
    if (!cameraRef.current) return
    try {
      cameraRef.current.setCamera({
        centerCoordinate: toCoord(gpsPosition),
        zoomLevel: 17,
        pitch: 0,
        animationDuration: 800,
      })
      autoCenteredRef.current = true
    } catch {
      // native camera released — try again on next GPS tick
    }
  }, [
    styleLoaded,
    gpsPosition?.lat,
    gpsPosition?.lng,
    courseCenter?.lat,
    courseCenter?.lng,
  ])

  // When entering pin mode, zoom in on the stored pin so the user is
  // looking at the green. Fires ONCE per PIN session — re-snapping on
  // every pin drag wiped out the player's pinch-zoom.
  const pinSnappedRef = useRef(false)
  useEffect(() => {
    if (!isPinMode) {
      pinSnappedRef.current = false
      return
    }
    if (pinSnappedRef.current) return
    if (!cameraRef.current) return
    // Most prod courses are synthetic (no stored pin geometry), so
    // roundPin/pin are null — without a fallback the effect early-returned
    // and never framed the green. Fall back to where the player is (ball,
    // else GPS) so tapping the pin tool zooms IN rather than doing nothing (#642).
    const target = roundPin ?? pin ?? ball ?? gpsPosition ?? null
    if (!target) return
    try {
      cameraRef.current.setCamera({
        centerCoordinate: toCoord(target),
        zoomLevel: 19,
        animationDuration: 400,
      })
      pinSnappedRef.current = true
    } catch {
      // native camera released — retry on next pin change
    }
  }, [
    isPinMode,
    roundPin?.lat,
    roundPin?.lng,
    pin?.lat,
    pin?.lng,
    ball?.lat,
    ball?.lng,
    gpsPosition?.lat,
    gpsPosition?.lng,
  ])

  // Mark whether we owe the camera a PLACE_BALL re-frame on the next
  // ball update. Set on phase transitions INTO PLACE_BALL (e.g. after
  // saving a shot) so the camera flies back to the closer tee-style view
  // once GPS settles on the new ball position.
  const prevPhaseRef = useRef<HoleMapPhase>(phase)
  const reframePlaceBallRef = useRef(false)
  useEffect(() => {
    if (
      phase === 'PLACE_BALL' &&
      prevPhaseRef.current !== 'PLACE_BALL' &&
      prevPhaseRef.current !== 'PIN'
    ) {
      reframePlaceBallRef.current = true
    }
    prevPhaseRef.current = phase
  }, [phase])

  useEffect(() => {
    if (!reframePlaceBallRef.current) return
    if (phase !== 'PLACE_BALL') return
    if (!cameraRef.current) return
    if (!ball) return
    // Tighten the frame near the green so marking a ball on/around the green
    // stays a green close-up. A flat zoom 17 (fairway-approach framing) read
    // as a jarring zoom-out when marking a greenside/putt shot. Remaining
    // distance (ball→pin) is the signal — same one SET_AIM uses. Capped at 17
    // on the loose end so ≥80-yd approaches keep the existing framing; only
    // the short end tightens. No pin resolvable → keep 17.
    const target = roundPin ?? pin ?? null
    const distYd = target ? distanceYards(ball, target) : null
    const zoom =
      distYd == null ? 17
      : distYd >= 80 ? 17
      : distYd >= 60 ? 17.5
      : distYd >= 30 ? 18
      : 19
    try {
      cameraRef.current.setCamera({
        centerCoordinate: toCoord(ball),
        zoomLevel: zoom,
        pitch: 0,
        heading: headingUpTheHole(ball, target),
        animationDuration: 800,
      })
      reframePlaceBallRef.current = false
    } catch {
      // native camera released — retry on next ball update
    }
  }, [ball?.lat, ball?.lng, phase])

  // SET_AIM: rotate the camera so direction-of-play (ball → pin) is
  // toward the top of the screen, add a subtle 20° tilt, and pick zoom
  // by ball→pin distance so a wedge frames the green tightly while a
  // par-5 still shows fairway + green. Fixed zoom 15 was too loose for
  // short approaches (≤120 yd compressed the shot into a tiny band).
  //
  // Fires ONCE per SET_AIM session — re-snapping on every aim drag or
  // pin nudge wiped out the player's pinch-zoom.
  const aimSnappedRef = useRef(false)
  useEffect(() => {
    if (!isAimPhase) {
      aimSnappedRef.current = false
      return
    }
    if (aimSnappedRef.current) return
    if (!cameraRef.current) return
    if (!ball) return
    const target = roundPin ?? pin ?? null
    const focus = target
      ? {
          lat: (ball.lat + target.lat) / 2,
          lng: (ball.lng + target.lng) / 2,
        }
      : ball
    const bearing = headingUpTheHole(ball, target)
    const distYd = target ? distanceYards(ball, target) : null
    // Short-game shots need a tighter frame — flatlining at 17 for
    // anything under 80 yd made a 10-yd chip frame like an 80-yd
    // approach, a jarring zoom-out from a green close-up (#642).
    const zoom =
      distYd == null ? 16
      : distYd >= 300 ? 16
      : distYd >= 150 ? 16.5
      : distYd >= 80 ? 17
      : distYd >= 60 ? 17.5
      : distYd >= 30 ? 18
      : 19
    try {
      cameraRef.current.setCamera({
        centerCoordinate: toCoord(focus),
        zoomLevel: zoom,
        pitch: 20,
        heading: bearing,
        animationDuration: 1200,
      })
      aimSnappedRef.current = true
    } catch {
      // native camera released — retry on next aim/pin change
    }
  }, [
    isAimPhase,
    ball?.lat,
    ball?.lng,
    roundPin?.lat,
    roundPin?.lng,
    pin?.lat,
    pin?.lng,
  ])

  return cameraRef
}
