import type { Database } from '@oga/supabase'
import { destinationYards } from './shot-dispersion-geo'
import { aimOffsetInchesToYards, bearingDegrees, haversineYards } from './units'
import { isPuttShot, type DraftShot } from './round'
import { combinedBreakDirection, combinedPuttResult, legacyShotResult } from './types'

type ShotInsert = Database['public']['Tables']['shots']['Insert']

export interface ShotMoveProjection {
  startLat: number
  startLng: number
  /** number = set it; null = clear it (putt); undefined = leave the column unchanged
   *  (no pin). */
  distanceToTarget: number | null | undefined
  /** A putt's length, start → pin in whole feet (#1096). null = clear it (over 999 ft, a
   *  mis-mark, as reviewedPuttLengthFt); undefined = leave it (full shot, or no pin). */
  puttDistanceFt: number | null | undefined
}

/**
 * Pure projection of moving a shot's start position. A putt carries no
 * start→pin target (null); a full shot with a pin recomputes the yardage; a
 * full shot with no pin leaves the prior distance untouched (undefined) so a
 * pin-less hole never nulls a valid distance (#662). A putt's length is its
 * start → pin distance (#1092), so a moved putt gets a new one (#1096). SG
 * keys on these two columns.
 */
export function projectShotMove(args: {
  newStart: { lat: number; lng: number }
  pin: { lat: number; lng: number } | null
  isPutt: boolean
}): ShotMoveProjection {
  const { newStart, pin, isPutt } = args
  const toPinYards = pin ? haversineYards(newStart.lat, newStart.lng, pin.lat, pin.lng) : undefined
  let distanceToTarget: number | null | undefined
  if (isPutt) {
    distanceToTarget = null
  } else if (toPinYards !== undefined) {
    distanceToTarget = Math.round(toPinYards)
  } else {
    distanceToTarget = undefined
  }
  const feet = isPutt && toPinYards !== undefined ? Math.round(toPinYards * 3) : undefined
  const puttDistanceFt = feet !== undefined && feet > 999 ? null : feet
  return { startLat: newStart.lat, startLng: newStart.lng, distanceToTarget, puttDistanceFt }
}

type Spot = { lat: number; lng: number }

/**
 * Where a shot inserted after `prev` starts before the player drags it into
 * place (#1114): halfway to the next shot, else 20 yd toward the pin (at most
 * halfway there), else 20 yd north.
 */
export function insertedShotStart(prev: Spot, next: Spot | null, pin: Spot | null): Spot {
  if (next) return { lat: (prev.lat + next.lat) / 2, lng: (prev.lng + next.lng) / 2 }
  if (!pin) return destinationYards(prev, 0, 20)
  const toPin = haversineYards(prev.lat, prev.lng, pin.lat, pin.lng)
  return destinationYards(prev, bearingDegrees(prev.lat, prev.lng, pin.lat, pin.lng), Math.min(20, toPin / 2))
}

// The `shots` columns the shot editor owns (web ShotEntryModal, mobile
// PastHoleShotsSheet). Required, like ReviewedShotFields, so every column is
// written: one the editor leaves out goes stale when the shot changes between
// a putt and a full shot.
export type DraftShotFields = Required<
  Pick<
    ShotInsert,
    | 'club'
    | 'lie_type'
    | 'lie_slope'
    | 'lie_slope_forward'
    | 'lie_slope_side'
    | 'shot_result'
    | 'contact'
    | 'shape'
    | 'start_line'
    | 'distance_to_target'
    | 'putt_distance_ft'
    | 'putt_result'
    | 'putt_distance_result'
    | 'putt_direction_result'
    | 'putt_slope_pct'
    | 'green_speed'
    | 'break_direction'
    | 'break_direction_vertical'
    | 'break_direction_horizontal'
    | 'aim_offset_yards'
    | 'penalty'
    | 'ob'
    | 'notes'
  >
>

// The inverse of shotRowToDraft: an edited draft → its `shots` columns. Ids,
// the hole score, the user and the shot number stay with the caller. A putt
// (green lie) clears every full-shot column and a full shot clears every putt
// column. The legacy single-axis columns (lie_slope, shot_result, putt_result,
// break_direction) are rebuilt from the axes; lie_slope is retired (null).
export function draftToShotUpdate(draft: DraftShot): DraftShotFields {
  const isPutt = isPuttShot(draft.lieType)
  const distance = draft.puttMade ? null : draft.puttDistanceResult ?? null
  const direction = draft.puttMade ? null : draft.puttDirectionResult ?? null
  return {
    club: isPutt ? 'putter' : draft.club ?? null,
    lie_type: draft.lieType ?? null,
    lie_slope: null,
    lie_slope_forward: isPutt ? null : draft.lieSlopeForward ?? null,
    lie_slope_side: isPutt ? null : draft.lieSlopeSide ?? null,
    shot_result: isPutt ? null : legacyShotResult(draft),
    contact: isPutt ? null : draft.contact ?? null,
    shape: isPutt ? null : draft.shape ?? null,
    start_line: isPutt ? null : draft.startLine ?? null,
    // A putt's distance is putt_distance_ft, never this column.
    distance_to_target: isPutt ? null : draft.distanceToTarget ?? null,
    putt_distance_ft: isPutt ? draft.puttDistanceFt ?? null : null,
    putt_result: isPutt ? combinedPuttResult({ made: draft.puttMade, distance, direction }) : null,
    putt_distance_result: isPutt ? distance : null,
    putt_direction_result: isPutt ? direction : null,
    putt_slope_pct: isPutt ? draft.puttSlopePct ?? null : null,
    green_speed: isPutt ? draft.greenSpeed ?? null : null,
    break_direction: isPutt
      ? combinedBreakDirection({
          vertical: draft.breakDirectionVertical,
          horizontal: draft.breakDirectionHorizontal,
        })
      : null,
    break_direction_vertical: isPutt ? draft.breakDirectionVertical ?? null : null,
    break_direction_horizontal: isPutt ? draft.breakDirectionHorizontal ?? null : null,
    aim_offset_yards:
      isPutt && draft.aimOffsetInches != null ? aimOffsetInchesToYards(draft.aimOffsetInches) : null,
    // A putt cannot be out of bounds or a penalty (#839).
    penalty: !isPutt && !!draft.penalty,
    ob: !isPutt && !!draft.ob,
    notes: draft.notes ?? null,
  }
}
