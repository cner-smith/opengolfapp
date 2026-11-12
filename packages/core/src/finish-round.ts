import type { Database } from '@oga/supabase'
import { adjustedScore, calculateDifferential } from './handicap'
import { resolveCourseTee } from './hole-tees'
import { inferHoleStats } from './holeInference'
import { handicapHoleCount, obCount, playedRowsForDifferential } from './round'
import { computeRoundSG, type RoundSGResult } from './sg'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']
type ShotRow = Database['public']['Tables']['shots']['Row']
type CourseTeeRow = Database['public']['Tables']['course_tees']['Row']

// What finishing a round writes, worked out from what was read. Web and mobile
// both fetch, call finishRoundPlan, then write inferUpserts → sgRows →
// roundPatch (+ completed_at) and recompute the handicap index.

export interface HoleStatUpsert {
  id: string
  round_id: string
  hole_id: string
  score: number
  fairway_hit: boolean | null
  gir: boolean | null
}

export interface HoleSGUpsert {
  id: string
  round_id: string
  hole_id: string
  score: number
  sg_off_tee: number
  sg_approach: number
  sg_around_green: number
  sg_putting: number
}

export interface RoundSGPatch {
  sg_off_tee: number | null
  sg_approach: number | null
  sg_around_green: number | null
  sg_putting: number | null
  sg_total: number | null
}

export interface RoundFinishPatch extends RoundSGPatch {
  total_score: number | null
  total_putts: number | null
  fairways_hit: number | null
  fairways_total: number | null
  gir: number
  course_tee_id: string | null
  score_differential: number | null
}

export interface FinishRoundInput {
  holes: HoleRow[]
  /** The round's hole_scores rows, without the nested holes() join. */
  holeScores: HoleScoreRow[]
  shots: ShotRow[]
  tees: CourseTeeRow[]
  courseTeeId: string | null | undefined
  teeColor: string | null | undefined
  /** rounds.hole_count. */
  roundHoleCount: number | null | undefined
  handicap: number
}

export interface FinishRoundPlan {
  inferUpserts: HoleStatUpsert[]
  sgRows: HoleSGUpsert[]
  /** Everything the finish stamps on the round except completed_at. */
  roundPatch: RoundFinishPatch
  differential: number | null
}

export function finishRoundPlan(input: FinishRoundInput): FinishRoundPlan {
  const holes = applyParOverrides(input.holes, input.holeScores)
  const repaired = repairStampedZeros(input.holeScores, input.shots)
  const { holeScores, upserts } = inferHoleStatUpserts(repaired, holes, input.shots)
  const result = computeRoundSG({ holes, holeScores, shots: input.shots, handicap: input.handicap })
  const tee = resolveCourseTee(input.tees, input.courseTeeId, input.teeColor)
  const differential = roundDifferential({
    tee,
    roundHoleCount: input.roundHoleCount,
    holes,
    holeScores,
    handicap: input.handicap,
  })
  return {
    inferUpserts: upserts,
    sgRows: holeSGRows(result, holeScores),
    roundPatch: {
      ...roundSGPatch(result),
      // null when no scores were entered: total_score is the score, not a
      // lifecycle flag (completed_at is), so a scoreless round stays out of
      // score averages.
      total_score: result.totals.totalScore || null,
      total_putts: result.totals.totalPutts || null,
      fairways_hit: result.totals.fairwaysTotal > 0 ? result.totals.fairwaysHit : null,
      fairways_total: result.totals.fairwaysTotal || null,
      gir: result.totals.gir,
      // Stamp the resolved tee so later reads skip the colour fallback.
      course_tee_id: tee?.id ?? input.courseTeeId ?? null,
      score_differential: differential,
    },
    differential,
  }
}

// Per-round par override (#710): a hole_scores.par set during the round wins
// over the course hole's par for everything stamped at the finish. Unique
// (round_id, hole_id) means each hole has at most one override.
export function applyParOverrides(holes: HoleRow[], holeScores: HoleScoreRow[]): HoleRow[] {
  const overrides = new Map(
    holeScores.filter((hs) => hs.par != null).map((hs) => [hs.hole_id, hs.par as number]),
  )
  return holes.map((h) => {
    const par = overrides.get(h.id)
    return par != null && par !== h.par ? { ...h, par } : h
  })
}

// Stale stamped zeros (#711): round creation pre-inserts every hole with score
// 0 and live play writes the score online only, so an offline stretch loses it
// while the shots sync later. Live stamping defines score = struck rows +
// stroke-and-distance penalties (#839), so a score-0 hole with shots gets
// exactly what the online write would have stored.
export function repairStampedZeros(holeScores: HoleScoreRow[], shots: ShotRow[]): HoleScoreRow[] {
  return holeScores.map((hs) => {
    if (hs.score !== 0) return hs
    const own = shots.filter((s) => s.hole_score_id === hs.id)
    return own.length > 0 ? { ...hs, score: own.length + obCount(own) } : hs
  })
}

// Fairway and GIR from the shots wherever the player left them unset (live
// mode never writes them per shot). holedOut when the log accounts for every
// stroke, penalty strokes included, so an off-green hole-out counts GIR (#669)
// and an OB hole can still read as holed (#839). Returns the patched rows and
// the rows that changed, carrying round_id/hole_id/score so the upsert's
// insert path meets the NOT NULL columns.
export function inferHoleStatUpserts(
  holeScores: HoleScoreRow[],
  holes: HoleRow[],
  shots: ShotRow[],
): { holeScores: HoleScoreRow[]; upserts: HoleStatUpsert[] } {
  const holesById = new Map(holes.map((h) => [h.id, h]))
  const upserts: HoleStatUpsert[] = []
  const patched = holeScores.map((hs) => {
    const hole = holesById.get(hs.hole_id)
    if (!hole) return hs
    const own = shots.filter((s) => s.hole_score_id === hs.id)
    const holedOut = own.length + obCount(own) === hs.score
    const inferred = inferHoleStats(
      own.map((s) => ({ shot_number: s.shot_number, lie_type: s.lie_type, ob: s.ob })),
      hole.par,
      holedOut,
    )
    const fairway_hit = hs.fairway_hit ?? inferred.fairway
    const gir = hs.gir ?? inferred.gir
    if (fairway_hit === hs.fairway_hit && gir === hs.gir) return hs
    upserts.push({ id: hs.id, round_id: hs.round_id, hole_id: hs.hole_id, score: hs.score, fairway_hit, gir })
    return { ...hs, fairway_hit, gir }
  })
  return { holeScores: patched, upserts }
}

// WHS score differential from the net-double-bogey-adjusted gross, or null:
// no rated tee (most crawled courses), or not a complete 9- or 18-hole round
// (#711, #727; see playedRowsForDifferential).
export function roundDifferential(args: {
  tee: CourseTeeRow | null
  roundHoleCount: number | null | undefined
  holes: HoleRow[]
  holeScores: HoleScoreRow[]
  handicap: number
}): number | null {
  const { tee, holes, holeScores } = args
  if (!tee || tee.course_rating == null || tee.slope_rating == null || tee.slope_rating <= 0) return null
  const holesById = new Map(holes.map((h) => [h.id, h]))
  const rows = holeScores.flatMap((hs) => {
    const h = holesById.get(hs.hole_id)
    return h ? [{ score: hs.score, par: h.par, strokeIndex: h.stroke_index }] : []
  })
  const holeCount = handicapHoleCount(
    args.roundHoleCount,
    holes.filter((h) => !h.loop_of).map((h) => h.number),
  )
  const played = holeCount == null ? null : playedRowsForDifferential(rows, holeCount)
  if (!played) return null
  const adjusted = adjustedScore(played, args.handicap, {
    courseRating: tee.course_rating,
    slopeRating: tee.slope_rating,
  })
  return round2(calculateDifferential(adjusted, tee.course_rating, tee.slope_rating))
}

// The round's stored SG. A category with no valued shot this round is null, a
// gap, never 0 (owner rule, 2026-11-09, #1436); sg_total sums the categories
// that have shots and is null when none do.
export function roundSGPatch(result: Pick<RoundSGResult, 'round' | 'counted'>): RoundSGPatch {
  const { round, counted } = result
  const value = (k: keyof RoundSGResult['counted']) => (counted[k] ? round2(round[k]) : null)
  const any = counted.offTee || counted.approach || counted.aroundGreen || counted.putting
  return {
    sg_off_tee: value('offTee'),
    sg_approach: value('approach'),
    sg_around_green: value('aroundGreen'),
    sg_putting: value('putting'),
    sg_total: any ? round2(round.total) : null,
  }
}

function holeSGRows(result: RoundSGResult, holeScores: HoleScoreRow[]): HoleSGUpsert[] {
  const byId = new Map(holeScores.map((hs) => [hs.id, hs]))
  return Object.entries(result.perHoleScore).flatMap(([id, sg]) => {
    const hs = byId.get(id)
    if (!hs) return []
    return [
      {
        id,
        round_id: hs.round_id,
        hole_id: hs.hole_id,
        score: hs.score,
        sg_off_tee: round2(sg.offTee),
        sg_approach: round2(sg.approach),
        sg_around_green: round2(sg.aroundGreen),
        sg_putting: round2(sg.putting),
      },
    ]
  })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
