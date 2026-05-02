import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  computeDispersion,
  computeDispersionStats,
  filterDispersionByLie,
  type LieSlopeForward,
  type LieSlopeSide,
  type LieType,
  type Shot,
} from '@oga/core'
import { getShotsByClub } from '@oga/supabase'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

interface UseShotPatternsArgs {
  club: string
  lieType?: LieType
  lieSlopeForward?: LieSlopeForward
  lieSlopeSide?: LieSlopeSide
}

function rowToShot(row: Record<string, unknown>): Shot {
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
    lieSlopeForward:
      (row.lie_slope_forward as Shot['lieSlopeForward']) ?? undefined,
    lieSlopeSide:
      (row.lie_slope_side as Shot['lieSlopeSide']) ?? undefined,
    shotResult: (row.shot_result as Shot['shotResult']) ?? undefined,
    penalty: (row.penalty as boolean) ?? false,
    ob: (row.ob as boolean) ?? false,
  }
}

export function useShotPatterns({
  club,
  lieType,
  lieSlopeForward,
  lieSlopeSide,
}: UseShotPatternsArgs) {
  const { user } = useAuth()
  // Cache the dispersion for (user, club) once. Lie filters apply
  // client-side from the cached result so toggling a chip doesn't
  // refetch — and doesn't invalidate the cached series for the
  // un-filtered base view.
  const query = useQuery({
    queryKey: ['patterns', user?.id, club],
    enabled: !!user && !!club,
    queryFn: async () => {
      const { data, error } = await getShotsByClub(supabase, user!.id, club)
      if (error) throw error
      const shots = (data ?? []).map(rowToShot)
      return computeDispersion(shots)
    },
  })

  const filtered = useMemo(() => {
    if (!query.data) return undefined
    const points =
      lieType || lieSlopeForward || lieSlopeSide
        ? filterDispersionByLie(query.data, {
            lieType,
            lieSlopeForward,
            lieSlopeSide,
          })
        : query.data
    return { points, stats: computeDispersionStats(points) }
  }, [query.data, lieType, lieSlopeForward, lieSlopeSide])

  return { ...query, data: filtered }
}
