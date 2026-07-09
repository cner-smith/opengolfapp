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
// completed_at + SG/score fields onto the round. completed_at is what
// marks the round finalized — it removes it from the home-screen Resume
// banner and routes it to the read-only summary (total_score may be null
// when no scores were entered).
export async function completeRound({
  roundId,
  courseId,
  userId,
  handicap,
}: CompleteArgs): Promise<void> {
  // Drain the pending queue before reading shots. syncPendingShots joins
  // an in-flight background run (#651), so this genuinely waits for the
  // final hole's shots instead of no-oping while a save-triggered sync
  // holds the lock. The caller (handleEndRound) has already drained,
  // re-checked pendingCount, and made the player acknowledge any rows
  // that still can't reach the server — so a failure here proceeds by
  // design: finalizing over what synced is the acknowledged fallback.
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

  const holeScoreRows = (holeScoresRes.data ?? []) as Array<
    HoleScoreRow & { holes?: HoleRow | null }
  >
  const holeScores: HoleScoreRow[] = holeScoreRows.map((row) => {
    const { holes: _h, ...rest } = row
    return rest
  })
  // Per-round par override (#710): a hole_scores.par set during the round
  // wins over the course hole's par for everything stamped at completion —
  // stat inference, SG categorization, and the differential. Patching the
  // holes array here is safe: unique (round_id, hole_id) means each hole
  // has at most one override in this round.
  const parOverrides = new Map(
    holeScores
      .filter((hs) => hs.par != null)
      .map((hs) => [hs.hole_id, hs.par as number]),
  )
  const holes: HoleRow[] = (holesRes.data ?? []).map((h) => {
    const par = parOverrides.get(h.id)
    return par != null && par !== h.par ? { ...h, par } : h
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
    // holedOut when the shot log fully accounts for the score: length === score
    // means every stroke was logged, so the last one holed. Incomplete logs
    // (length < score) stay conservative — never a false positive. This lets
    // off-green hole-outs (ace, holed approach, chip-in) count GIR (#669).
    const holedOut = holeShots.length === hs.score
    const inferred = inferHoleStats(
      holeShots.map((s) => ({
        shot_number: s.shot_number,
        lie_type: s.lie_type,
      })),
      hole.par,
      holedOut,
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
      // null when no scores were entered — total_score is the SCORE, not a
      // lifecycle flag. completed_at (set above) is the canonical "finalized"
      // signal for routing and the Resume banner, so a scoreless finalized
      // round stays null here and is correctly excluded from score averages
      // (computed stats null-filter total_score).
      total_score: result.totals.totalScore || null,
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
