import {
  legacySlopeToAxes,
  type BreakDirection,
  type Club,
  type GreenSpeed,
  type LieSlope,
  type LieSlopeForward,
  type LieSlopeSide,
  type LieType,
  type PuttDirectionResult,
  type PuttDistanceResult,
  type ShotResult,
} from '@oga/core'
import type { Database } from '@oga/supabase'

// Mirrors the legacy `putt_result` CHECK vocabulary (migration 0001).
// Inlined here because @oga/core's `LegacyPuttResult` type isn't exported.
type LegacyPuttResultStr =
  | 'made'
  | 'short'
  | 'long'
  | 'missed_left'
  | 'missed_right'

type ShotRow = Database['public']['Tables']['shots']['Row']

// DB-string → narrow-union casts. Postgres CHECK constraints (migrations
// 0001 / 0003 / 0005 / 0006 / 0007 / 0009) keep the columns inside their
// union vocabularies, but the regenerated Supabase types surface them
// as plain `string | null`. Issue #209 tracks promoting these CHECKs to
// real Postgres enums so the regen produces narrow types directly.

export interface DraftShot {
  id?: string
  shotNumber: number
  club?: Club
  lieType?: LieType
  lieSlopeForward?: LieSlopeForward
  lieSlopeSide?: LieSlopeSide
  shotResult?: ShotResult
  distanceToTarget?: number
  puttDistanceFt?: number
  puttMade?: boolean
  puttDistanceResult?: PuttDistanceResult
  puttDirectionResult?: PuttDirectionResult
  puttSlopePct?: number
  greenSpeed?: GreenSpeed
  breakDirection?: Exclude<BreakDirection, 'left' | 'right'>
  aimOffsetInches?: number
  notes?: string
}

export function shotRowToDraft(s: ShotRow): DraftShot {
  let shotResult: ShotResult | undefined = (s.shot_result as ShotResult | null) ?? undefined
  if (!shotResult && s.ob) shotResult = 'ob'
  else if (!shotResult && s.penalty) shotResult = 'penalty'
  const legacy = legacySlopeToAxes(s.lie_slope as LieSlope | null)
  const puttResult = s.putt_result as LegacyPuttResultStr | null
  return {
    id: s.id,
    shotNumber: s.shot_number,
    club: (s.club as Club | null) ?? undefined,
    lieType: (s.lie_type as LieType | null) ?? undefined,
    lieSlopeForward: (s.lie_slope_forward as LieSlopeForward | null) ?? legacy.forward,
    lieSlopeSide: (s.lie_slope_side as LieSlopeSide | null) ?? legacy.side,
    shotResult,
    distanceToTarget: s.distance_to_target ?? undefined,
    puttDistanceFt: s.putt_distance_ft ?? undefined,
    puttMade: puttResult === 'made' ? true : undefined,
    puttDistanceResult:
      ((s.putt_distance_result as PuttDistanceResult | null) ?? undefined) ??
      (puttResult === 'short'
        ? 'short'
        : puttResult === 'long'
          ? 'long'
          : undefined),
    puttDirectionResult:
      ((s.putt_direction_result as PuttDirectionResult | null) ?? undefined) ??
      (puttResult === 'missed_left'
        ? 'left'
        : puttResult === 'missed_right'
          ? 'right'
          : undefined),
    puttSlopePct: s.putt_slope_pct ?? undefined,
    greenSpeed: (s.green_speed as GreenSpeed | null) ?? undefined,
    breakDirection: mapBreakDirection(s.break_direction),
    aimOffsetInches:
      s.aim_offset_yards != null ? Math.round(s.aim_offset_yards * 36) : 0,
    notes: s.notes ?? undefined,
  }
}

function mapBreakDirection(
  v: ShotRow['break_direction'],
): DraftShot['breakDirection'] {
  if (
    v === 'left_to_right' ||
    v === 'right_to_left' ||
    v === 'uphill' ||
    v === 'downhill' ||
    v === 'straight'
  ) {
    return v
  }
  // Legacy left/right values map onto the new break-from→to vocabulary.
  if (v === 'left') return 'right_to_left'
  if (v === 'right') return 'left_to_right'
  return 'straight'
}

export function emptyDraft(shotNumber: number, isFirstShot: boolean): DraftShot {
  return {
    shotNumber,
    lieType: isFirstShot ? 'tee' : undefined,
    lieSlopeForward: 'level',
  }
}
