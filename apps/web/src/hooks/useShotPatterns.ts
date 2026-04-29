import { useQuery } from '@tanstack/react-query'
import {
  computeDispersion,
  computeDispersionStats,
  filterDispersionByLie,
  type LieSlope,
  type LieType,
  type Shot,
} from '@oga/core'
import { getShotsByClub } from '@oga/supabase'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

interface UseShotPatternsArgs {
  club: string
  lieSlope?: LieSlope
  lieType?: LieType
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
    shotResult: (row.shot_result as Shot['shotResult']) ?? undefined,
    penalty: (row.penalty as boolean) ?? false,
    ob: (row.ob as boolean) ?? false,
  }
}

export function useShotPatterns({ club, lieSlope, lieType }: UseShotPatternsArgs) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['patterns', user?.id, club, lieSlope, lieType],
    enabled: !!user && !!club,
    queryFn: async () => {
      const { data, error } = await getShotsByClub(supabase, user!.id, club)
      if (error) throw error
      const shots = (data ?? []).map(rowToShot)
      let points = computeDispersion(shots)
      if (lieSlope || lieType) points = filterDispersionByLie(points, lieSlope, lieType)
      const stats = computeDispersionStats(points)
      return { points, stats }
    },
  })
}
