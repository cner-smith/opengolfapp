import {
  adjustedScore,
  calculateDifferential,
  calculateHandicapIndex,
  computeRoundSG,
  inferHoleStats,
} from '@oga/core'
import {
  getCourseTees,
  getHoleScoresForRound,
  getHolesForCourse,
  getShotsForRound,
  updateProfile,
  updateRound,
} from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { supabase } from './supabase'
import { syncPendingShots } from './sync'

type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']
type ShotRow = Database['public']['Tables']['shots']['Row']
type HoleRow = Database['public']['Tables']['holes']['Row']
type CourseTeeRow = Database['public']['Tables']['course_tees']['Row']

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

  const [holesRes, holeScoresRes, shotsRes, teesRes, roundRes] = await Promise.all([
    getHolesForCourse(supabase, courseId),
    getHoleScoresForRound(supabase, roundId),
    getShotsForRound(supabase, roundId, userId),
    getCourseTees(supabase, courseId),
    supabase
      .from('rounds')
      .select('course_tee_id, tee_color')
      .eq('id', roundId)
      .single(),
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
  const tees: CourseTeeRow[] = teesRes.data ?? []
  const roundTee = roundRes.data ?? null

  // Infer fairway_hit + gir for any hole where the player didn't set
  // them manually. Mobile live mode never writes those columns
  // per-shot, so without this round-level fairwaysHit/gir totals stay
  // 0 even when the shot data clearly shows otherwise. Patches in
  // place so the subsequent computeRoundSG sees the inferred values.
  const inferUpserts: Array<{
    id: string
    round_id: string
    hole_id: string
    score: number
    fairway_hit: boolean | null
    gir: boolean | null
  }> = []
  const holesById = new Map(holes.map((h) => [h.id, h]))
  for (const hs of holeScores) {
    const hole = holesById.get(hs.hole_id)
    if (!hole) continue
    const holeShots = shots.filter((s) => s.hole_score_id === hs.id)
    const inferred = inferHoleStats(
      holeShots.map((s) => ({
        shot_number: s.shot_number,
        lie_type: s.lie_type,
        shot_result: s.shot_result,
      })),
      hole.par,
    )
    const nextFairway = hs.fairway_hit ?? inferred.fairway
    const nextGir = hs.gir ?? inferred.gir
    if (nextFairway !== hs.fairway_hit || nextGir !== hs.gir) {
      hs.fairway_hit = nextFairway
      hs.gir = nextGir
      inferUpserts.push({
        id: hs.id,
        round_id: hs.round_id,
        hole_id: hs.hole_id,
        score: hs.score,
        fairway_hit: nextFairway,
        gir: nextGir,
      })
    }
  }
  if (inferUpserts.length > 0) {
    const { error: inferError } = await supabase
      .from('hole_scores')
      .upsert(inferUpserts, { onConflict: 'id' })
    if (inferError) throw inferError
  }

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

  // ---- Handicap differential ------------------------------------------
  // Mirrors web's useCompleteRound: resolve the played tee (by id, else by
  // colour), and if it carries a course rating + slope, compute the WHS
  // score differential from the ESC-adjusted gross. Null when no rated tee
  // is on the round — common, since most crawled courses have no tee data.
  const tee =
    (roundTee?.course_tee_id
      ? tees.find((t) => t.id === roundTee.course_tee_id)
      : null) ??
    (roundTee?.tee_color
      ? tees.find((t) => t.tee_color === roundTee.tee_color!.toLowerCase())
      : null) ??
    null
  let differential: number | null = null
  if (
    tee &&
    tee.course_rating != null &&
    tee.slope_rating != null &&
    tee.slope_rating > 0
  ) {
    const holeRows = holeScores
      .map((hs) => {
        const h = holesById.get(hs.hole_id)
        if (!h) return null
        return { score: hs.score, par: h.par }
      })
      .filter((x): x is { score: number; par: number } => !!x)
    if (holeRows.length > 0) {
      const adjusted = adjustedScore(holeRows, handicap ?? 18)
      differential = round2(
        calculateDifferential(adjusted, tee.course_rating, tee.slope_rating),
      )
    }
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
      completed_at: new Date().toISOString(),
      // Store the real total (incl. 0 for a round finalized without scores) —
      // never coerce 0 → null. A null total_score is the "never finalized"
      // signal the round-entry screen routes on; nulling it here stranded
      // finalized rounds in the live map. completed_at is the canonical
      // finalized flag, but keeping total_score honest matters for any
      // total_score-null check (Resume banner, in-progress list).
      total_score: result.totals.totalScore,
      total_putts: result.totals.totalPutts || null,
      fairways_hit:
        result.totals.fairwaysTotal > 0 ? result.totals.fairwaysHit : null,
      fairways_total: result.totals.fairwaysTotal || null,
      gir: result.totals.gir,
      course_tee_id: tee?.id ?? roundTee?.course_tee_id ?? null,
      score_differential: differential,
    },
    userId,
  )
  if (roundError) throw roundError

  // ---- Handicap index recompute --------------------------------------
  // Once this round contributes a differential, re-derive the WHS index
  // from the most recent 20 and write it to the profile. Below 3 total
  // differentials calculateHandicapIndex returns null and the entered
  // value stands. Mirrors web; this is what makes a mobile player's index
  // become a calculated "WHS index" rather than staying "Provisional".
  if (differential != null) {
    const { data: recentDiffs, error: diffsError } = await supabase
      .from('rounds')
      .select('score_differential')
      .eq('user_id', userId)
      .not('score_differential', 'is', null)
      .order('played_at', { ascending: false })
      .limit(20)
    if (diffsError) throw diffsError
    const diffs = (recentDiffs ?? [])
      .map((r) => r.score_differential)
      .filter((d): d is number => d != null)
    const newIndex = calculateHandicapIndex(diffs)
    if (newIndex != null) {
      const { error: profileError } = await updateProfile(supabase, userId, {
        handicap_index: newIndex,
      })
      if (profileError) throw profileError
    }
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
