import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  aimRelativeOffsets,
  clubDistanceRange,
  computeAimRelativeDispersion,
  haversineYards,
  median,
  type AimRelativeDispersion,
  type Club,
  type DistanceRange,
  type Shot,
} from '@oga/core'
import { getShotsForUser } from '@oga/supabase'
import { supabase } from '../../../lib/supabase'

// One club's shot pattern from the player's own history. Every club with a
// shot appears; `dispersion` is null below MIN_SAMPLES_FOR_STATS (the wheel's
// "4 more" row), and only clubs with one can be the auto pick.
export interface ClubDispersion {
  club: Club
  dispersion: AimRelativeDispersion | null
  /** Aim-relative landings, most recent first (getShotsForUser is created_at desc). */
  points: { alongYards: number; perpYards: number }[]
  /** Median start→end distance for this club, yards. Drives club auto-selection.
   *  Null when no shot had both start+end coords. */
  medianDistanceYards: number | null
  /** Where two in three of its start→finish distances fall (core
   *  clubDistanceRange), yards; null below MIN_SAMPLES_FOR_STATS. */
  range: DistanceRange | null
}

export interface UseClubDispersionResult {
  loading: boolean
  /** The history fetch failed: byClub is empty, not "no shots". */
  error: boolean
  /** Every club with a logged shot, keyed by club. */
  byClub: Map<Club, ClubDispersion>
  /**
   * The club to overlay for a given origin→target distance. Matches by
   * |median distance − target|. A null/non-finite distance (tee shot, no aim
   * yet) falls back to the longest club. Only clubs with a dispersion
   * compete, and only those in `among` when given (the wheel's rows, so the
   * pick is always a club the wheel can show). Returns null when no club has
   * enough data.
   */
  selectClub: (distanceToTargetYards: number | null, among?: ReadonlySet<Club>) => ClubDispersion | null
}

// Minimal row shape from getShotsForUser (a subset of SHOT_COLUMNS). Only the
// coords + club are read here; the rest of the column list is ignored.
interface ShotRow {
  id: string
  hole_score_id: string
  user_id: string
  shot_number: number
  start_lat: number | null
  start_lng: number | null
  end_lat: number | null
  end_lng: number | null
  aim_lat: number | null
  aim_lng: number | null
  club: string | null
}

function rowToShot(r: ShotRow): Shot {
  return {
    id: r.id,
    holeScoreId: r.hole_score_id,
    userId: r.user_id,
    shotNumber: r.shot_number,
    startLat: r.start_lat ?? undefined,
    startLng: r.start_lng ?? undefined,
    endLat: r.end_lat ?? undefined,
    endLng: r.end_lng ?? undefined,
    aimLat: r.aim_lat ?? undefined,
    aimLng: r.aim_lng ?? undefined,
    club: (r.club as Club) ?? undefined,
  }
}

/**
 * Loads the player's shot history once, groups by club, and computes
 * per-club aim-relative dispersion + median distance. Feeds the live-round map
 * overlay: pick a club via `selectClub`, draw its dispersion against the
 * dragged aim. One query per session (memoized on userId), not per hole.
 * Every aimed shot counts: getShotsForUser pages past the 1000-row cap.
 */
export function useClubDispersion(
  userId: string | undefined,
): UseClubDispersionResult {
  const [rows, setRows] = useState<ShotRow[]>([])
  // True until the first fetch lands, so Patterns can't flash its no-shots
  // preview before the history arrives.
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!userId) {
      setRows([])
      return
    }
    let active = true
    setLoading(true)
    getShotsForUser(supabase, userId).then(({ data, error }) => {
      if (!active) return
      if (error) {
        // eslint-disable-next-line no-console -- dev diagnostic; mobile has no logger/toast primitive
        console.error('[useClubDispersion/getShotsForUser]', error.message)
      }
      setError(!!error)
      setRows((data as ShotRow[] | null) ?? [])
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [userId])

  const byClub = useMemo(() => {
    const grouped = new Map<Club, Shot[]>()
    for (const r of rows) {
      if (!r.club) continue
      const shot = rowToShot(r)
      const club = shot.club
      if (!club) continue
      const list = grouped.get(club)
      if (list) list.push(shot)
      else grouped.set(club, [shot])
    }

    const out = new Map<Club, ClubDispersion>()
    for (const [club, shots] of grouped) {
      const points: ClubDispersion['points'] = []
      for (const s of shots) {
        const o = aimRelativeOffsets(s)
        if (o) points.push(o)
      }
      const distances: number[] = []
      for (const s of shots) {
        if (
          s.startLat != null &&
          s.startLng != null &&
          s.endLat != null &&
          s.endLng != null
        ) {
          distances.push(haversineYards(s.startLat, s.startLng, s.endLat, s.endLng))
        }
      }
      out.set(club, {
        club,
        dispersion: computeAimRelativeDispersion(shots),
        points,
        medianDistanceYards: median(distances),
        range: clubDistanceRange(distances),
      })
    }
    return out
  }, [rows])

  const selectClub = useCallback(
    (distanceToTargetYards: number | null, among?: ReadonlySet<Club>): ClubDispersion | null => {
      const candidates = [...byClub.values()].filter((c) => c.dispersion && (!among || among.has(c.club)))
      if (candidates.length === 0) return null

      // Tee shot / no aim yet → the player's longest club.
      if (distanceToTargetYards == null || !Number.isFinite(distanceToTargetYards)) {
        return candidates.reduce((best, c) =>
          (c.medianDistanceYards ?? -Infinity) > (best.medianDistanceYards ?? -Infinity)
            ? c
            : best,
        )
      }

      // Otherwise the club whose median distance is closest to the distance.
      // Clubs without one can't be distance-matched — they sort last.
      return candidates.reduce((best, c) => {
        const cDelta =
          c.medianDistanceYards == null
            ? Infinity
            : Math.abs(c.medianDistanceYards - distanceToTargetYards)
        const bestDelta =
          best.medianDistanceYards == null
            ? Infinity
            : Math.abs(best.medianDistanceYards - distanceToTargetYards)
        return cDelta < bestDelta ? c : best
      })
    },
    [byClub],
  )

  return { loading, error, byClub, selectClub }
}
