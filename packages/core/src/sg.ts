import { calculateRoundSG } from './sg-calculator'
import type { ShotWithContext } from './sg-calculator'
import type { SGBreakdown, Shot } from './types'
import type { Database } from '@oga/supabase'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']
type ShotRow = Database['public']['Tables']['shots']['Row']

export interface RoundSGResult {
  round: SGBreakdown
  perHoleScore: Record<string, SGBreakdown>
  totals: {
    totalScore: number
    totalPutts: number
    fairwaysHit: number
    fairwaysTotal: number
    gir: number
  }
}

// DB-string → narrow-union casts. Postgres CHECK constraints (migrations
// 0001 / 0003 / 0009) keep these columns inside their union vocabularies,
// but the regenerated Supabase types surface them as plain `string | null`.
// Issue #209 tracks promoting these CHECKs to real Postgres enums so the
// regen produces narrow types directly.
function shotRowToShot(s: ShotRow): Shot {
  return {
    id: s.id,
    holeScoreId: s.hole_score_id,
    userId: s.user_id,
    shotNumber: s.shot_number,
    aimLat: s.aim_lat ?? undefined,
    aimLng: s.aim_lng ?? undefined,
    endLat: s.end_lat ?? undefined,
    endLng: s.end_lng ?? undefined,
    startLat: s.start_lat ?? undefined,
    startLng: s.start_lng ?? undefined,
    distanceToTarget: s.distance_to_target ?? undefined,
    club: (s.club as Shot['club']) ?? undefined,
    lieType: (s.lie_type as Shot['lieType']) ?? undefined,
    lieSlope: (s.lie_slope as Shot['lieSlope']) ?? undefined,
    lieSlopeForward: (s.lie_slope_forward as Shot['lieSlopeForward']) ?? undefined,
    lieSlopeSide: (s.lie_slope_side as Shot['lieSlopeSide']) ?? undefined,
    shotResult: (s.shot_result as Shot['shotResult']) ?? undefined,
    penalty: s.penalty,
    ob: s.ob,
    aimOffsetYards: s.aim_offset_yards ?? undefined,
    breakDirection: (s.break_direction as Shot['breakDirection']) ?? undefined,
    puttResult: (s.putt_result as Shot['puttResult']) ?? undefined,
    puttDistanceFt: s.putt_distance_ft ?? undefined,
    notes: s.notes ?? undefined,
  }
}

export function computeRoundSG(args: {
  holes: HoleRow[]
  holeScores: HoleScoreRow[]
  shots: ShotRow[]
  handicap: number
}): RoundSGResult {
  const { holes, holeScores, shots, handicap } = args
  const holesById = new Map(holes.map((h) => [h.id, h]))
  const perHoleScore: Record<string, SGBreakdown> = {}
  const round: SGBreakdown = {
    offTee: 0,
    approach: 0,
    aroundGreen: 0,
    putting: 0,
    total: 0,
  }

  for (const hs of holeScores) {
    const hole = holesById.get(hs.hole_id)
    if (!hole) continue
    const holeShots = shots
      .filter((s) => s.hole_score_id === hs.id)
      .sort((a, b) => a.shot_number - b.shot_number)
    if (holeShots.length === 0) continue

    const ctxList: ShotWithContext[] = holeShots.map((s, idx) => ({
      ...shotRowToShot(s),
      par: hole.par,
      isLastShot: idx === holeShots.length - 1,
    }))
    const sg = calculateRoundSG(ctxList, handicap)
    perHoleScore[hs.id] = sg
    round.offTee += sg.offTee
    round.approach += sg.approach
    round.aroundGreen += sg.aroundGreen
    round.putting += sg.putting
  }
  round.total = round.offTee + round.approach + round.aroundGreen + round.putting

  let totalScore = 0
  let totalPutts = 0
  let fairwaysHit = 0
  let fairwaysTotal = 0
  let gir = 0
  for (const hs of holeScores) {
    totalScore += hs.score
    totalPutts += hs.putts ?? 0
    if (hs.gir === true) gir += 1
    const hole = holesById.get(hs.hole_id)
    if (hole && hole.par > 3) {
      fairwaysTotal += 1
      if (hs.fairway_hit === true) fairwaysHit += 1
    }
  }

  return {
    round,
    perHoleScore,
    totals: { totalScore, totalPutts, fairwaysHit, fairwaysTotal, gir },
  }
}
