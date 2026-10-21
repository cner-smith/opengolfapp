import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  aimRelativeOffsets,
  computeDispersion,
  computeDispersionStats,
  filterDispersionByLie,
  haversineYards,
  type Club,
  type LieSlopeForward,
  type LieSlopeSide,
  type LieType,
  type Shot,
  type ShotContact,
} from '@oga/core'
import { getShotsByClub, getShotsForUser } from '@oga/supabase'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

interface UseShotPatternsArgs {
  club: string
  lieType?: LieType
  lieSlopeForward?: LieSlopeForward
  lieSlopeSide?: LieSlopeSide
}

/** What a pattern point doesn't carry but the shot readout shows. */
export interface ShotExtras {
  contact: ShotContact | null
  hole: number | null
}

type Row = Record<string, unknown>

function rowToShot(row: Row): Shot {
  const round = (row.hole_scores as { rounds?: { played_at?: string | null } | null } | undefined)?.rounds
  return {
    id: row.id as string,
    holeScoreId: row.hole_score_id as string,
    userId: row.user_id as string,
    shotNumber: row.shot_number as number,
    aimLat: (row.aim_lat as number | null) ?? undefined,
    aimLng: (row.aim_lng as number | null) ?? undefined,
    endLat: (row.end_lat as number | null) ?? undefined,
    endLng: (row.end_lng as number | null) ?? undefined,
    startLat: (row.start_lat as number | null) ?? undefined,
    startLng: (row.start_lng as number | null) ?? undefined,
    distanceToTarget: (row.distance_to_target as number | null) ?? undefined,
    club: (row.club as Shot['club']) ?? undefined,
    lieType: (row.lie_type as Shot['lieType']) ?? undefined,
    lieSlope: (row.lie_slope as Shot['lieSlope']) ?? undefined,
    lieSlopeForward: (row.lie_slope_forward as Shot['lieSlopeForward']) ?? undefined,
    lieSlopeSide: (row.lie_slope_side as Shot['lieSlopeSide']) ?? undefined,
    shotResult: (row.shot_result as Shot['shotResult']) ?? undefined,
    penalty: (row.penalty as boolean) ?? false,
    ob: (row.ob as boolean) ?? false,
    shape: (row.shape as Shot['shape']) ?? null,
    startLine: (row.start_line as Shot['startLine']) ?? null,
    playedAt: round?.played_at ?? undefined,
  }
}

export function useShotPatterns({ club, lieType, lieSlopeForward, lieSlopeSide }: UseShotPatternsArgs) {
  const { user } = useAuth()
  // Cache the dispersion for (user, club) once. Lie filters apply
  // client-side from the cached result so toggling a chip doesn't
  // refetch, and the unfiltered pattern stays at hand as the ghost ring.
  const query = useQuery({
    queryKey: ['patterns', user?.id, club],
    enabled: !!user && !!club,
    queryFn: async () => {
      const { data, error } = await getShotsByClub(supabase, user!.id, club)
      if (error) throw error
      const rows = (data ?? []) as Row[]
      const extras: Record<string, ShotExtras> = {}
      for (const r of rows) {
        const hole = (r.hole_scores as { holes?: { number?: number | null } | null } | undefined)?.holes
        extras[r.id as string] = {
          contact: (r.contact as ShotContact | null) ?? null,
          hole: hole?.number ?? null,
        }
      }
      const points = computeDispersion(rows.map(rowToShot))
      return { points, stats: computeDispersionStats(points), extras }
    },
  })

  const filtered = useMemo(() => {
    if (!query.data) return undefined
    const on = !!(lieType || lieSlopeForward || lieSlopeSide)
    const points = on
      ? filterDispersionByLie(query.data.points, { lieType, lieSlopeForward, lieSlopeSide })
      : query.data.points
    return {
      points,
      stats: on ? computeDispersionStats(points) : query.data.stats,
      extras: query.data.extras,
      allPoints: query.data.points,
      allStats: query.data.stats,
    }
  }, [query.data, lieType, lieSlopeForward, lieSlopeSide])

  // Unfiltered aimed-shot count: the 5-shot progress ignores lie filters (#1076).
  return { ...query, data: filtered, clubShots: query.data?.points.length ?? 0 }
}

export interface LadderClub {
  /** Shots with a start, an aim and a finish. */
  aimed: number
  /** Median start-to-finish distance, yards; null without a start and finish. */
  medianYards: number | null
}

// Every aimed shot in any club, in one fetch: the club ladder's numbers and
// counts, and whether the page has anything to show at all (#1076).
export function useClubLadder() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['patterns-ladder', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await getShotsForUser(supabase, user!.id)
      if (error) throw error
      const byClub = new Map<Club, { aimed: number; distances: number[] }>()
      for (const r of (data ?? []) as Row[]) {
        const s = rowToShot(r)
        if (!s.club || !aimRelativeOffsets(s)) continue
        const c = byClub.get(s.club) ?? { aimed: 0, distances: [] }
        c.aimed++
        c.distances.push(haversineYards(s.startLat!, s.startLng!, s.endLat!, s.endLng!))
        byClub.set(s.club, c)
      }
      const out = new Map<Club, LadderClub>()
      for (const [club, c] of byClub) out.set(club, { aimed: c.aimed, medianYards: median(c.distances) })
      return out
    },
  })
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!
}
