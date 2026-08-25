import { haversineYards } from './units'

export interface ShotMoveProjection {
  startLat: number
  startLng: number
  /** number = set it; null = clear it (putt); undefined = leave the column unchanged (no pin). */
  distanceToTarget: number | null | undefined
}

/**
 * Pure projection of moving a shot's start position. A putt carries no
 * start→pin target (null); a full shot with a pin recomputes the yardage; a
 * full shot with no pin leaves the prior distance untouched (undefined) so a
 * pin-less hole never nulls a valid distance (#662). SG keys on the stored
 * distance_to_target, so this is the single SG-affecting value on a move.
 */
export function projectShotMove(args: {
  newStart: { lat: number; lng: number }
  pin: { lat: number; lng: number } | null
  isPutt: boolean
}): ShotMoveProjection {
  const { newStart, pin, isPutt } = args
  let distanceToTarget: number | null | undefined
  if (isPutt) {
    distanceToTarget = null
  } else if (pin) {
    distanceToTarget = Math.round(
      haversineYards(newStart.lat, newStart.lng, pin.lat, pin.lng),
    )
  } else {
    distanceToTarget = undefined
  }
  return { startLat: newStart.lat, startLng: newStart.lng, distanceToTarget }
}
