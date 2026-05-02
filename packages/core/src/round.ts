// Shared post-round map-tap logic. Mobile's aim-point flow needs the
// same buildInitialRows call as the web review sheet — keeping both
// behind one function avoids the inevitable drift.

import { inferShot, type InferredShot, type PlacedShot } from './shotInference'
import type { Club, LieType } from './constants'
import type { PuttDirectionResult, PuttDistanceResult } from './types'

export interface PlacedPoint {
  lat: number
  lng: number
}

export interface ReviewedShotRow {
  shotNumber: number
  club: Club
  lieType: LieType
  startLat: number | null
  startLng: number | null
  endLat: number
  endLng: number
  distanceYards: number
  distanceToPin: number
  isLastShot: boolean
  /** Set when the user toggles "Made it ✓" on a putt row.
   *  Stored as putt_result='made' on save. */
  puttMade?: boolean
  /** Distance miss axis — independent of direction. Stored as
   *  putt_distance_result. */
  puttDistanceResult?: PuttDistanceResult
  /** Direction miss axis — independent of distance. Stored as
   *  putt_direction_result. */
  puttDirectionResult?: PuttDirectionResult
}

export function buildInitialRows(
  points: PlacedPoint[],
  par: number,
  pinLat: number,
  pinLng: number,
): ReviewedShotRow[] {
  const total = points.length
  const rows: ReviewedShotRow[] = []
  points.forEach((p, idx) => {
    const isLast = idx === total - 1
    // End of shot N is the next marker. The final shot ends at the pin
    // (the player holed it; the "Made it" toggle below lets them say
    // otherwise but the on-map ending stays at the cup either way).
    const next = isLast
      ? { lat: pinLat, lng: pinLng }
      : points[idx + 1]!
    const placed: PlacedShot = {
      shotNumber: idx + 1,
      startLat: p.lat,
      startLng: p.lng,
      endLat: next.lat,
      endLng: next.lng,
      pinLat,
      pinLng,
      totalShotsOnHole: total,
      par,
    }
    const inferred: InferredShot = inferShot(placed)
    rows.push({
      shotNumber: idx + 1,
      club: inferred.suggestedClub,
      lieType: inferred.suggestedLieType,
      startLat: p.lat,
      startLng: p.lng,
      endLat: next.lat,
      endLng: next.lng,
      distanceYards: inferred.distanceYards,
      distanceToPin: inferred.distanceToPin,
      isLastShot: inferred.isLastShot,
      // Default the last-putt to "made" because the player completed the
      // hole — they almost always did make it. They can toggle off if not.
      puttMade:
        inferred.isLastShot && inferred.suggestedLieType === 'green'
          ? true
          : undefined,
    })
  })
  return rows
}

// Move legacy lie_slope (single-axis) onto the new forward + side axes
// so post-split editors can still display pre-split rows. Returns
// undefined for both axes when the legacy value is null/unknown.
export function legacySlopeToAxes(
  legacy: 'level' | 'uphill' | 'downhill' | 'ball_above' | 'ball_below' | null,
): {
  forward?: 'uphill' | 'level' | 'downhill'
  side?: 'ball_above' | 'ball_below'
} {
  if (legacy === 'uphill' || legacy === 'level' || legacy === 'downhill') {
    return { forward: legacy }
  }
  if (legacy === 'ball_above' || legacy === 'ball_below') {
    return { side: legacy }
  }
  return {}
}
