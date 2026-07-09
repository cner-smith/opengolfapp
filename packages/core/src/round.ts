// Shared post-round map-tap logic. Mobile's aim-point flow needs the
// same buildInitialRows call as the web review sheet — keeping both
// behind one function avoids the inevitable drift.

import { inferShot, type InferredShot, type PlacedShot } from './shotInference'
import type { Club, LieType, LieSlope, LieSlopeForward, LieSlopeSide, ShotResult } from './constants'
import type {
  BreakDirection,
  BreakDirectionHorizontal,
  BreakDirectionVertical,
  GreenSpeed,
  LegacyPuttResult,
  PuttDirectionResult,
  PuttDistanceResult,
} from './types'
import { decombinedBreakDirection } from './types'
import type { Database } from '@oga/supabase'

type ShotRow = Database['public']['Tables']['shots']['Row']

export interface PlacedPoint {
  lat: number
  lng: number
}

export interface ReviewedShotRow {
  shotNumber: number
  /** Canonical Club when inferred from the static table; arbitrary
   *  string when picked from a user-bag entry whose club_type isn't in
   *  CLUBS. The downstream `shots.club` column is text so callers don't
   *  need to narrow. */
  club: Club | string
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
  /** Aim/start-line offset in inches from the pin line (negative = left).
   *  Stored as aim_offset_yards (inches / 36). */
  aimOffsetInches?: number
  /** Break slope axis — uphill / flat / downhill. Stored as
   *  break_direction_vertical (+ combined break_direction). */
  breakDirectionVertical?: BreakDirectionVertical
  /** Break line axis — usually derived from the aim offset. Stored as
   *  break_direction_horizontal (+ combined break_direction). */
  breakDirectionHorizontal?: BreakDirectionHorizontal
  /** Slope intensity bucket 0-4 (Flat…Severe). Stored as putt_slope_pct. */
  puttSlopePct?: number
  /** Green speed — slow / medium / fast. Stored as green_speed. */
  greenSpeed?: GreenSpeed
  /** Free-text note on the putt. Stored as notes. */
  notes?: string
}

// Infer how many holes a course actually has from the hole NUMBERS we
// have rows for. Golf courses are 9 or 18; `course_tees.par` would be the
// authoritative signal but it's ~0% populated in our crawled data, so the
// hole numbers are all we have. Keyed on max (not count) because a course
// can have interior gaps (holes 1–4, 7–18 → still an 18) or start above 1
// (back-nine-only mapping). An empty set means an unmapped course — assume
// 18, the common case. A max ≤ 9 means a 9-hole course; this deliberately
// buckets a front-9-only mapping of an 18 as a 9 (data can't distinguish
// them, and stranding a real 9-hole player on phantom holes 10–18 is the
// worse failure). See #525.
export function inferHoleCount(holeNumbers: number[]): 9 | 18 {
  if (holeNumbers.length === 0) return 18
  return Math.max(...holeNumbers) <= 9 ? 9 : 18
}

// Gate for computing a WHS-style score differential: only a fully-played
// round qualifies. Returns the played (score > 0) rows when they cover every
// hole of the round, else null — a partial round must produce NO differential,
// because adjustedScore adds 0 strokes per unplayed hole and yields an
// impossible negative value that then dominates the last-20 handicap
// recompute (#711). Score 0 is the "not played" sentinel on both platforms.
// Implicit contract: callers pass holeCount = inferHoleCount(course hole
// numbers), and both materialization paths (mobile round creation's gap-fill,
// web's ensureRealHole) create holes rows up to that same inferred count — if
// a materialization path ever changes, this gate fails CLOSED (differential
// stays null on a fully-played round) rather than corrupting the index.
export function playedRowsForDifferential<T extends { score: number }>(
  holeRows: T[],
  holeCount: number,
): T[] | null {
  const played = holeRows.filter((r) => r.score > 0)
  return played.length === holeCount ? played : null
}

// Single source of truth for putt classification: a shot is a putt when its
// lie is the green or its club is the putter. Feeds putt counts, the putt-only
// persisted columns, and SG putting, so every surface must agree. Distance to
// the pin must NOT factor in — a near-green chip isn't a putt, and unmapped
// rows read distanceToPin 0 (#660, which was a drift between hand-copied
// predicates). Takes raw fields (not a shaped row) so camelCase ReviewedShotRow
// and snake_case DB rows share it.
export function isPuttShot(
  lieType: string | null | undefined,
  club: string | null | undefined,
): boolean {
  return lieType === 'green' || club === 'putter'
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
  /** @deprecated Use {@link DraftShot.breakDirectionVertical} and
   *  {@link DraftShot.breakDirectionHorizontal}. Computed from the two
   *  axes for back-compat with consumers (web `PuttFormFields`,
   *  `GreenDiagram`) that still read this single-axis field. */
  breakDirection?: Exclude<BreakDirection, 'left' | 'right'>
  breakDirectionVertical?: BreakDirectionVertical
  breakDirectionHorizontal?: BreakDirectionHorizontal
  aimOffsetInches?: number
  notes?: string
}

// DB-string → narrow-union casts. Postgres CHECK constraints (migrations
// 0001 / 0003 / 0005 / 0006 / 0007 / 0009) keep the columns inside their
// union vocabularies, but the regenerated Supabase types surface them as
// plain `string | null`. Issue #209 tracks promoting these CHECKs to real
// Postgres enums so the regen produces narrow types directly.
export function shotRowToDraft(s: ShotRow): DraftShot {
  let shotResult: ShotResult | undefined = (s.shot_result as ShotResult | null) ?? undefined
  if (!shotResult && s.ob) shotResult = 'ob'
  else if (!shotResult && s.penalty) shotResult = 'penalty'
  const legacy = legacySlopeToAxes(s.lie_slope as LieSlope | null)
  const puttResult = s.putt_result as LegacyPuttResult | null
  const breakAxes = decombinedBreakDirection(s.break_direction as BreakDirection | null)
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
    breakDirectionVertical:
      (s.break_direction_vertical as BreakDirectionVertical | null) ??
      breakAxes.vertical ??
      undefined,
    breakDirectionHorizontal:
      (s.break_direction_horizontal as BreakDirectionHorizontal | null) ??
      breakAxes.horizontal ??
      undefined,
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
