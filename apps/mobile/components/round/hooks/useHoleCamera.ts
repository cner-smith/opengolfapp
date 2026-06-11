import { useEffect, useRef } from 'react'
import Mapbox from '@rnmapbox/maps'
import { distanceYards } from '../../../lib/maps'
import type { HoleMapPhase, LatLng } from '../HoleMap.types'

function toCoord(l: LatLng): [number, number] {
  return [l.lng, l.lat]
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
  useEffect(() => {
    // Reset on hole change (center prop moves to new tee/centroid). When
    // the per-hole route is collapsed to one component (issue #264 fix),
    // this is still the right reset signal.
    autoCenteredRef.current = false
  }, [center.lat, center.lng])
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
    const target = roundPin ?? pin ?? null
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
  }, [isPinMode, roundPin?.lat, roundPin?.lng, pin?.lat, pin?.lng])

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
    try {
      cameraRef.current.setCamera({
        centerCoordinate: toCoord(ball),
        zoomLevel: 17,
        pitch: 0,
        heading: 0,
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
    const bearing = target
      ? (Math.atan2(target.lng - ball.lng, target.lat - ball.lat) * 180) /
        Math.PI
      : 0
    const distYd = target ? distanceYards(ball, target) : null
    const zoom =
      distYd == null ? 16
      : distYd >= 300 ? 16
      : distYd >= 150 ? 16.5
      : distYd >= 80 ? 17
      : 17
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
