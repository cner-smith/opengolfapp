import { computeRoundSG } from '@oga/core'
import {
  getHoleScoresForRound,
  getHolesForCourse,
  getShotsForRound,
  updateRound,
} from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { supabase } from './supabase'
import { syncPendingShots } from './sync'

type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']
type ShotRow = Database['public']['Tables']['shots']['Row']
type HoleRow = Database['public']['Tables']['holes']['Row']

interface CompleteArgs {
  roundId: string
  courseId: string
  userId: string
  handicap: number | null
}

// Mobile equivalent of apps/web/src/hooks/useCompleteRound (sans the
// react-query / handicap-index recalc plumbing). Drains the pending
// shot queue, runs computeRoundSG over the persisted shots, and stamps
// total_score / SG fields onto the round so total_score IS NOT NULL —
// which removes the round from the home-screen Resume banner.
export async function completeRound({
  roundId,
  courseId,
  userId,
  handicap,
}: CompleteArgs): Promise<void> {
  await syncPendingShots().catch(() => undefined)

  const [holesRes, holeScoresRes, shotsRes] = await Promise.all([
    getHolesForCourse(supabase, courseId),
    getHoleScoresForRound(supabase, roundId),
    getShotsForRound(supabase, roundId, userId),
  ])
  if (holesRes.error) throw holesRes.error
  if (holeScoresRes.error) throw holeScoresRes.error
  if (shotsRes.error) throw shotsRes.error

  const holes: HoleRow[] = holesRes.data ?? []
  const holeScoreRows = (holeScoresRes.data ?? []) as Array<
    HoleScoreRow & { holes?: HoleRow | null }
  >
  const holeScores: HoleScoreRow[] = holeScoreRows.map((row) => {
    const { holes: _h, ...rest } = row
    return rest
  })
  const shots = (shotsRes.data ?? []) as unknown as ShotRow[]

  const result = computeRoundSG({
    holes,
    holeScores,
    shots,
    handicap: handicap ?? 18,
  })

  // Per-hole SG upsert. Mirrors useCompleteRound.ts: carry round_id /
  // hole_id / score forward so the underlying INSERT path of the upsert
  // satisfies NOT NULL columns; the conflict on `id` then refreshes
  // the SG fields only.
  const holeScoresById = new Map(holeScores.map((hs) => [hs.id, hs]))
  const sgRows = Object.entries(result.perHoleScore)
    .map(([holeScoreId, sg]) => {
      const existing = holeScoresById.get(holeScoreId)
      if (!existing) return null
      return {
        id: holeScoreId,
        round_id: existing.round_id,
        hole_id: existing.hole_id,
        score: existing.score,
        sg_off_tee: round2(sg.offTee),
        sg_approach: round2(sg.approach),
        sg_around_green: round2(sg.aroundGreen),
        sg_putting: round2(sg.putting),
      }
    })
    .filter((r): r is NonNullable<typeof r> => r != null)
  if (sgRows.length > 0) {
    const { error: sgError } = await supabase
      .from('hole_scores')
      .upsert(sgRows, { onConflict: 'id' })
    if (sgError) throw sgError
  }

  const { error: roundError } = await updateRound(
    supabase,
    roundId,
    {
      sg_off_tee: round2(result.round.offTee),
      sg_approach: round2(result.round.approach),
      sg_around_green: round2(result.round.aroundGreen),
      sg_putting: round2(result.round.putting),
      sg_total: round2(result.round.total),
      total_score: result.totals.totalScore || null,
      total_putts: result.totals.totalPutts || null,
      fairways_hit:
        result.totals.fairwaysTotal > 0 ? result.totals.fairwaysHit : null,
      fairways_total: result.totals.fairwaysTotal || null,
      gir: result.totals.gir,
    },
    userId,
  )
  if (roundError) throw roundError
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
