import {
  legacySlopeToAxes,
  type BreakDirection,
  type Club,
  type GreenSpeed,
  type LieSlopeForward,
  type LieSlopeSide,
  type LieType,
  type PuttDirectionResult,
  type PuttDistanceResult,
  type ShotResult,
} from '@oga/core'
import type { Database } from '@oga/supabase'

type ShotRow = Database['public']['Tables']['shots']['Row']

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
  const legacy = legacySlopeToAxes(s.lie_slope)
  return {
    id: s.id,
    shotNumber: s.shot_number,
    club: (s.club as Club | null) ?? undefined,
    lieType: s.lie_type ?? undefined,
    lieSlopeForward: s.lie_slope_forward ?? legacy.forward,
    lieSlopeSide: s.lie_slope_side ?? legacy.side,
    shotResult,
    distanceToTarget: s.distance_to_target ?? undefined,
    puttDistanceFt: s.putt_distance_ft ?? undefined,
    puttMade: s.putt_result === 'made' ? true : undefined,
    puttDistanceResult:
      s.putt_distance_result ??
      (s.putt_result === 'short'
        ? 'short'
        : s.putt_result === 'long'
          ? 'long'
          : undefined),
    puttDirectionResult:
      s.putt_direction_result ??
      (s.putt_result === 'missed_left'
        ? 'left'
        : s.putt_result === 'missed_right'
          ? 'right'
          : undefined),
    puttSlopePct: s.putt_slope_pct ?? undefined,
    greenSpeed: s.green_speed ?? undefined,
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
