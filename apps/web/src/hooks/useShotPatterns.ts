import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  aimRelativeOffsets,
  computeDispersion,
  computeDispersionStats,
  filterDispersionByLie,
  haversineYards,
  median,
  patternRowToShot,
  type Club,
  type LieSlopeForward,
  type LieSlopeSide,
  type LieType,
  type PuttDirectionResult,
  type PuttDistanceResult,
  type ShotContact,
  type ShotExtras,
} from '@oga/core'
import { getMissedPutts, getShotsByClub, getShotsForUser } from '@oga/supabase'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

interface UseShotPatternsArgs {
  club: string
  lieType?: LieType
  lieSlopeForward?: LieSlopeForward
  lieSlopeSide?: LieSlopeSide
}

interface RowRound {
  round_id?: string | null
  rounds?: { played_at?: string | null; courses?: { name?: string | null } | null } | null
  holes?: { number?: number | null } | null
}

type Row = Record<string, unknown>

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
        const hs = r.hole_scores as RowRound | undefined
        extras[r.id as string] = {
          contact: (r.contact as ShotContact | null) ?? null,
          hole: hs?.holes?.number ?? null,
          course: hs?.rounds?.courses?.name ?? null,
          roundId: hs?.round_id ?? null,
        }
      }
      const points = computeDispersion((data ?? []).map(patternRowToShot))
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
      for (const r of data ?? []) {
        const s = patternRowToShot(r)
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

export interface MissedPutt {
  id: string
  puttDistanceResult?: PuttDistanceResult
  puttDirectionResult?: PuttDirectionResult
  puttDistanceFt?: number
  playedAt: string | null
  course: string | null
  hole: number | null
  roundId: string | null
}

// The player's latest missed putts, for the Putter stop on the ladder (#747).
export function useMissedPutts() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['patterns-putts', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<MissedPutt[]> => {
      const { data, error } = await getMissedPutts(supabase, user!.id)
      if (error) throw error
      return ((data ?? []) as Row[]).map((r) => {
        const hs = r.hole_scores as RowRound | undefined
        return {
          id: r.id as string,
          puttDistanceResult: (r.putt_distance_result as PuttDistanceResult | null) ?? undefined,
          puttDirectionResult: (r.putt_direction_result as PuttDirectionResult | null) ?? undefined,
          puttDistanceFt: (r.putt_distance_ft as number | null) ?? undefined,
          playedAt: hs?.rounds?.played_at ?? null,
          course: hs?.rounds?.courses?.name ?? null,
          hole: hs?.holes?.number ?? null,
          roundId: hs?.round_id ?? null,
        }
      })
    },
  })
}
