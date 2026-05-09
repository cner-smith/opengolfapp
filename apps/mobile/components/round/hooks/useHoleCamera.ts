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
}

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
    cameraRef.current.setCamera({
      centerCoordinate: toCoord(center),
      zoomLevel: 17,
      pitch: 0,
      animationDuration: 400,
    })
    cameraInitialized.current = true
  }, [styleLoaded, center.lat, center.lng])

  // When entering pin mode, zoom in on the stored pin so the user is
  // looking at the green.
  useEffect(() => {
    if (!isPinMode) return
    if (!cameraRef.current) return
    const target = roundPin ?? pin ?? null
    if (!target) return
    cameraRef.current.setCamera({
      centerCoordinate: toCoord(target),
      zoomLevel: 19,
      animationDuration: 400,
    })
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
      prevPhaseRef.current !== 'PIN' &&
      prevPhaseRef.current !== 'TEE'
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
    cameraRef.current.setCamera({
      centerCoordinate: toCoord(ball),
      zoomLevel: 17,
      pitch: 0,
      heading: 0,
      animationDuration: 800,
    })
    reframePlaceBallRef.current = false
  }, [ball?.lat, ball?.lng, phase])

  // SET_AIM: rotate the camera so direction-of-play (ball → pin) is
  // toward the top of the screen, add a subtle 20° tilt, and pick zoom
  // by ball→pin distance so a wedge frames the green tightly while a
  // par-5 still shows fairway + green. Fixed zoom 15 was too loose for
  // short approaches (≤120 yd compressed the shot into a tiny band).
  useEffect(() => {
    if (!isAimPhase) return
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
    cameraRef.current.setCamera({
      centerCoordinate: toCoord(focus),
      zoomLevel: zoom,
      pitch: 20,
      heading: bearing,
      animationDuration: 1200,
    })
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
