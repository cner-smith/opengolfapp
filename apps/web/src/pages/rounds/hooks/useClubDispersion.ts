import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  computeAimRelativeDispersion,
  haversineYards,
  type AimRelativeDispersion,
  type Club,
  type Shot,
} from '@oga/core'
import { getShotsForUser } from '@oga/supabase'
import { supabase } from '../../../lib/supabase'

// Web port of the mobile useClubDispersion hook (apps/mobile/components/round/
// hole/useClubDispersion.ts) — kept in sync by hand for now; the pure grouping
// + selection logic is a candidate for promotion into @oga/core (would let both
// platforms share it). Feeds the live-round map's single-color dispersion-dots
// overlay: pick a club via selectClub, scatter its history around the aim.

// One club's dispersion, derived from the player's own history. Only clubs with
// enough aim-relative samples (computeAimRelativeDispersion returns null below
// MIN_SAMPLES_FOR_STATS) appear — sparse clubs get no overlay.
export interface ClubDispersion {
  club: Club
  dispersion: AimRelativeDispersion
  /** Median start→end carry for this club, yards. Drives club auto-selection. */
  medianCarryYards: number | null
  sampleSize: number
}

export interface UseClubDispersionResult {
  loading: boolean
  byClub: Map<Club, ClubDispersion>
  /**
   * The club to overlay for a given origin→target distance. Matches by
   * |median carry − distance|. A null/non-finite distance (tee shot, no aim
   * yet) falls back to the longest-carry club. Null when no club has data.
   */
  selectClub: (distanceToTargetYards: number | null) => ClubDispersion | null
}

// Minimal row shape from getShotsForUser (a subset of SHOT_COLUMNS). Only the
// coords + club are read; the rest of the column list is ignored.
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

function median(xs: number[]): number | null {
  if (xs.length === 0) return null
  const sorted = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!
}

/**
 * Loads the player's shot history once (memoized on userId), groups by club,
 * and computes per-club aim-relative dispersion + median carry. getShotsForUser
 * caps at the most recent 1000 shots — accepted for v1 (see the mobile hook's
 * note); revisit if a club's overlay ever looks under-sampled.
 */
export function useClubDispersion(
  userId: string | undefined,
): UseClubDispersionResult {
  const [rows, setRows] = useState<ShotRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!userId) {
      setRows([])
      return
    }
    let active = true
    setLoading(true)
    getShotsForUser(supabase, userId).then(({ data, error }) => {
      if (!active) return
      if (error && import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('[useClubDispersion/getShotsForUser]', error.message)
      }
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
      const dispersion = computeAimRelativeDispersion(shots)
      if (!dispersion) continue // below MIN_SAMPLES_FOR_STATS — no overlay
      const carries: number[] = []
      for (const s of shots) {
        if (
          s.startLat != null &&
          s.startLng != null &&
          s.endLat != null &&
          s.endLng != null
        ) {
          carries.push(haversineYards(s.startLat, s.startLng, s.endLat, s.endLng))
        }
      }
      out.set(club, {
        club,
        dispersion,
        medianCarryYards: median(carries),
        sampleSize: dispersion.sampleSize,
      })
    }
    return out
  }, [rows])

  const selectClub = useCallback(
    (distanceToTargetYards: number | null): ClubDispersion | null => {
      const candidates = [...byClub.values()]
      if (candidates.length === 0) return null

      // Tee shot / no aim yet → the player's longest club.
      if (distanceToTargetYards == null || !Number.isFinite(distanceToTargetYards)) {
        return candidates.reduce((best, c) =>
          (c.medianCarryYards ?? -Infinity) > (best.medianCarryYards ?? -Infinity)
            ? c
            : best,
        )
      }

      // Otherwise the club whose median carry is closest to the distance.
      return candidates.reduce((best, c) => {
        const cDelta =
          c.medianCarryYards == null
            ? Infinity
            : Math.abs(c.medianCarryYards - distanceToTargetYards)
        const bestDelta =
          best.medianCarryYards == null
            ? Infinity
            : Math.abs(best.medianCarryYards - distanceToTargetYards)
        return cDelta < bestDelta ? c : best
      })
    },
    [byClub],
  )

  return { loading, byClub, selectClub }
}
