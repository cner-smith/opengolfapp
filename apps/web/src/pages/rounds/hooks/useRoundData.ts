import { useMemo } from 'react'
import type { Database } from '@oga/supabase'
import {
  getShotMarkerCategory,
  resolveCourseTee,
  resolveHole,
  type LieType,
  type ResolvedHole,
} from '@oga/core'
import type {
  ExistingShot,
  HoleGeo,
  PlacedPoint,
} from '../../../components/round/RoundMap'
import { useRound, useRounds } from '../../../hooks/useRounds'
import {
  useCourse,
  useCourseTees,
  useHoleTeesForCourse,
  useHolesForCourse,
} from '../../../hooks/useCourses'
import { useHoleScores } from '../../../hooks/useHoleScores'
import { useShotsForRound } from '../../../hooks/useShots'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleTeeRow = Database['public']['Tables']['hole_tees']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']
type RoundRow = Database['public']['Tables']['rounds']['Row']
type ShotRow = Database['public']['Tables']['shots']['Row']

interface UseRoundDataInput {
  roundId: string | undefined
  activeHoleNumber: number
  pinOverride: PlacedPoint | null
  teeOverride: PlacedPoint | null
}

export interface UseRoundDataResult {
  round: ReturnType<typeof useRound>
  holesQuery: ReturnType<typeof useHolesForCourse>
  teesQuery: ReturnType<typeof useCourseTees>
  holeTeesQuery: ReturnType<typeof useHoleTeesForCourse>
  courseQuery: ReturnType<typeof useCourse>
  holeScoresQuery: ReturnType<typeof useHoleScores>
  shotsQuery: ReturnType<typeof useShotsForRound>
  allRounds: ReturnType<typeof useRounds>
  courseId: string | undefined
  expectedHoleCount: number
  holes: HoleRow[]
  rawScores: Array<HoleScoreRow & { holes?: HoleRow | null }>
  holeScores: HoleScoreRow[]
  scoresByHoleId: Map<string, HoleScoreRow>
  shotCountByHoleScore: Map<string, number>
  activeHole: HoleRow | null
  activeHoleScore: HoleScoreRow | null
  persistedRoundPin: PlacedPoint | null
  effectivePin: PlacedPoint | null
  effectiveTee: PlacedPoint | null
  // Tee-resolved par/yards/stroke_index for the active hole — hole_tees
  // override (if the round's selected tee has one) applied over the base
  // holes row, with the per-round hole_scores.par override on top. Null
  // only when there's no active hole. Prefer these over raw activeHole.par
  // /.yards/.stroke_index everywhere a tee-aware value is wanted.
  resolvedPar: number | null
  resolvedYards: number | null
  resolvedStrokeIndex: number | null
  // Same resolution, keyed by hole number, for every hole in the round —
  // for consumers that render/sum over all holes (ScorecardView, the
  // scorecard's total-par line) rather than just the active one.
  resolvedHoleByNumber: Map<number, ResolvedHole>
  courseFallbackLat: number | null
  courseFallbackLng: number | null
  activeHoleGeo: HoleGeo | null
  missingHoleLayout: boolean
  activeHoleShots: ExistingShot[]
}

type HSWithJoin = HoleScoreRow & {
  holes?: { number?: number | null; par?: number | null } | null
}

export function useRoundData({
  roundId,
  activeHoleNumber,
  pinOverride,
  teeOverride,
}: UseRoundDataInput): UseRoundDataResult {
  const round = useRound(roundId)
  const courseId = round.data?.course_id
  const holesQuery = useHolesForCourse(courseId)
  const teesQuery = useCourseTees(courseId)
  const holeTeesQuery = useHoleTeesForCourse(courseId)
  // Direct fetch — the joined courses(...) field on the round query has
  // been intermittently flat (no lat/lng) for reasons that haven't
  // panned out in PostgREST. A standalone course read is unambiguous.
  const courseQuery = useCourse(courseId)
  const holeScoresQuery = useHoleScores(roundId)
  const shotsQuery = useShotsForRound(roundId)
  const allRounds = useRounds(50)

  // Synthetic fallback when the course has no rows in the `holes` table
  // (typical for OSM-imported courses that never went through enrichment).
  // Without this, every downstream feature gates on `activeHole` being
  // non-null and the round detail page locks up.
  //
  // Detection is length-based — once any hole is materialized via
  // ensureRealHole, the query refetches with one row and the rest must
  // still be synthesized. Predicate-based detection (yards/tee_lat null)
  // breaks once `saveReviewedHole` seeds the new row with the player's
  // teeOverride — that single populated tee_lat made every "is this
  // synthetic?" check return false on the post-save refetch and holes
  // 2..18 disappeared from the array. Length is the unambiguous signal:
  // if fewer rows than the course expects, fill the gap.
  //
  // Expected count comes from `course_tees.par` when present (≤36 = 9,
  // else 18); falls back to 18 when no tees row exists. A 9-hole real
  // course with no course_tees row over-pads to 18 — accepted, because
  // the only alternative (inferring from the round's hole_scores) breaks
  // the common case: an in-progress 18-hole round that has only scored
  // holes 1–9 so far would wrongly collapse to 9 and strand 10–18 (#727
  // regression). There's no reliable 9-vs-18 signal for an unmapped
  // course mid-round, so 18 is the safe default. Revisit via a real
  // per-round hole_count captured at round creation.
  const expectedHoleCount = useMemo(() => {
    const tees = teesQuery.data ?? []
    const totalPar = tees[0]?.par
    if (totalPar != null && totalPar <= 36) return 9
    return 18
  }, [teesQuery.data])

  const holes = useMemo<HoleRow[]>(() => {
    const fetched = holesQuery.data ?? []
    const roundData = round.data
    if (fetched.length >= expectedHoleCount) return fetched
    if (!roundData) return fetched
    // Index real rows + score-derived rows by hole number for a 1..18
    // merge. Real wins over score-derived, score-derived wins over a
    // generic par-4 placeholder. score-derived carries the real hole_id
    // (FK already valid) so the upsert path doesn't need ensureRealHole.
    const realByNumber = new Map<number, HoleRow>()
    for (const h of fetched) realByNumber.set(h.number, h)
    const scores =
      (roundData as { hole_scores?: HSWithJoin[] }).hole_scores ?? []
    const scoredByNumber = new Map<
      number,
      { id: string; par: number | null }
    >()
    for (const hs of scores) {
      const num = hs.holes?.number ?? null
      if (num != null) {
        scoredByNumber.set(num, {
          id: hs.hole_id,
          par: hs.holes?.par ?? null,
        })
      }
    }
    return Array.from({ length: expectedHoleCount }, (_, i) => {
      const num = i + 1
      const real = realByNumber.get(num)
      if (real) return real
      const scored = scoredByNumber.get(num)
      if (scored) {
        return {
          id: scored.id,
          course_id: roundData.course_id,
          number: num,
          par: scored.par ?? 4,
          yards: null,
          stroke_index: num,
          tee_lat: null,
          tee_lng: null,
          pin_lat: null,
          pin_lng: null,
        }
      }
      return {
        id: `synthetic-${roundData.id}-hole-${num}`,
        course_id: roundData.course_id,
        number: num,
        par: 4,
        yards: null,
        stroke_index: num,
        tee_lat: null,
        tee_lng: null,
        pin_lat: null,
        pin_lng: null,
      }
    })
  }, [holesQuery.data, round.data, expectedHoleCount])

  const rawScores: Array<HoleScoreRow & { holes?: HoleRow | null }> = useMemo(
    () => holeScoresQuery.data ?? [],
    [holeScoresQuery.data],
  )
  const holeScores: HoleScoreRow[] = useMemo(
    () =>
      rawScores.map((row) => {
        const { holes: _h, ...rest } = row
        return rest
      }),
    [rawScores],
  )
  const scoresByHoleId = useMemo(() => {
    const m = new Map<string, HoleScoreRow>()
    for (const s of holeScores) m.set(s.hole_id, s)
    return m
  }, [holeScores])
  const shotCountByHoleScore = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of shotsQuery.data ?? []) {
      m.set(s.hole_score_id, (m.get(s.hole_score_id) ?? 0) + 1)
    }
    return m
  }, [shotsQuery.data])

  const activeHole = useMemo(
    () => holes.find((h) => h.number === activeHoleNumber) ?? null,
    [holes, activeHoleNumber],
  )
  const activeHoleScore = activeHole
    ? scoresByHoleId.get(activeHole.id) ?? null
    : null
  // Pull the round-specific pin off the hole_scores row when present so
  // it wins over the holes-table default.
  const persistedRoundPin: PlacedPoint | null =
    activeHoleScore?.pin_lat != null && activeHoleScore?.pin_lng != null
      ? { lat: activeHoleScore.pin_lat, lng: activeHoleScore.pin_lng }
      : null
  const effectivePin: PlacedPoint | null =
    pinOverride ??
    persistedRoundPin ??
    (activeHole?.pin_lat != null && activeHole?.pin_lng != null
      ? { lat: activeHole.pin_lat, lng: activeHole.pin_lng }
      : null)

  // Resolve which course_tees row this round is playing (id preferred,
  // tee_color as legacy fallback — same convention used to pick a
  // course_tees row for the handicap differential), then look up that
  // tee's hole_tees override (if any) for the active hole. hole_tees is
  // sparse by design — most courses have none yet, so this is a no-op for
  // the common case and everything falls straight through to the base
  // `holes` row, exactly as before this wiring landed.
  const resolvedCourseTee = useMemo(
    () => resolveCourseTee(teesQuery.data ?? [], round.data?.course_tee_id, round.data?.tee_color),
    [teesQuery.data, round.data?.course_tee_id, round.data?.tee_color],
  )
  const holeTeeByHoleId = useMemo(() => {
    const m = new Map<string, HoleTeeRow>()
    if (!resolvedCourseTee) return m
    for (const ht of holeTeesQuery.data ?? []) {
      if (ht.course_tee_id === resolvedCourseTee.id) m.set(ht.hole_id, ht)
    }
    return m
  }, [holeTeesQuery.data, resolvedCourseTee])
  // Resolved par/yards/stroke_index/tee-location for every hole (no live
  // drag override — that only ever applies to whichever hole is currently
  // being edited). ScorecardView/HoleReviewSheet render or sum over the
  // full holes array, not just the active one, so they need this rather
  // than a single-hole result.
  const resolvedHoleByNumber = useMemo(() => {
    const m = new Map<number, ResolvedHole>()
    for (const h of holes) {
      const teeOverrideRow = holeTeeByHoleId.get(h.id) ?? null
      m.set(h.number, resolveHole(h, teeOverrideRow, { par: scoresByHoleId.get(h.id)?.par }))
    }
    return m
  }, [holes, holeTeeByHoleId, scoresByHoleId])

  const resolvedActiveHole = activeHole
    ? resolveHole(
        activeHole,
        holeTeeByHoleId.get(activeHole.id) ?? null,
        { par: activeHoleScore?.par },
        teeOverride ? { tee_lat: teeOverride.lat, tee_lng: teeOverride.lng } : undefined,
      )
    : null
  const resolvedPar = resolvedActiveHole?.par ?? null
  const resolvedYards = resolvedActiveHole?.yards ?? null
  const resolvedStrokeIndex = resolvedActiveHole?.strokeIndex ?? null

  const effectiveTee: PlacedPoint | null =
    resolvedActiveHole?.teeLat != null && resolvedActiveHole?.teeLng != null
      ? { lat: resolvedActiveHole.teeLat, lng: resolvedActiveHole.teeLng }
      : null
  // Course-level lat/lng pulled from the dedicated course query. The
  // joined courses(...) field on the round query also exposes lat/lng,
  // but reading both lets us pick whichever is non-null first — useful
  // while the join shape stabilises across PostgREST behaviours.
  const joinedCourse = round.data?.courses ?? null
  const courseRow = courseQuery.data ?? null
  const courseFallbackLat = courseRow?.lat ?? joinedCourse?.lat ?? null
  const courseFallbackLng = courseRow?.lng ?? joinedCourse?.lng ?? null
  const activeHoleGeo: HoleGeo | null = activeHole
    ? {
        id: activeHole.id,
        number: activeHole.number,
        par: resolvedPar ?? activeHole.par,
        yards: resolvedYards,
        teeLat: effectiveTee?.lat ?? null,
        teeLng: effectiveTee?.lng ?? null,
        pinLat: effectivePin?.lat ?? null,
        pinLng: effectivePin?.lng ?? null,
        courseLat: courseFallbackLat,
        courseLng: courseFallbackLng,
      }
    : null
  // True when the active hole has no per-hole layout in the DB. Drives
  // the dismissable notice banner above the map and the "— yd to pin"
  // strip text so the player understands why distances are missing. Tee
  // half of the check reads the resolved (tee-override-aware) location —
  // a course with no base tee_lat but a tee-specific override now counts
  // as mapped. Pin stays on the base value; hole_tees never covers pin.
  const missingHoleLayout =
    activeHole != null &&
    resolvedActiveHole?.teeLat == null &&
    activeHole.pin_lat == null

  const activeHoleShots = useMemo<ExistingShot[]>(() => {
    if (!activeHoleScore) return []
    return (shotsQuery.data ?? [])
      .filter((s) => s.hole_score_id === activeHoleScore.id)
      .map((s) => ({
        id: s.id,
        shotNumber: s.shot_number,
        endLat: s.end_lat,
        endLng: s.end_lng,
        startLat: s.start_lat,
        startLng: s.start_lng,
        aimLat: s.aim_lat,
        aimLng: s.aim_lng,
        category: getShotMarkerCategory(
          {
            lieType: (s.lie_type ?? undefined) as LieType | undefined,
            distanceToTarget: s.distance_to_target ?? undefined,
          },
          resolvedPar ?? 4,
          s.shot_number,
        ),
      }))
      .sort((a, b) => a.shotNumber - b.shotNumber)
  }, [activeHoleScore, shotsQuery.data, resolvedPar])

  return {
    round,
    holesQuery,
    teesQuery,
    holeTeesQuery,
    courseQuery,
    holeScoresQuery,
    shotsQuery,
    allRounds,
    courseId,
    expectedHoleCount,
    holes,
    rawScores,
    holeScores,
    scoresByHoleId,
    shotCountByHoleScore,
    activeHole,
    activeHoleScore,
    persistedRoundPin,
    effectivePin,
    effectiveTee,
    resolvedPar,
    resolvedYards,
    resolvedStrokeIndex,
    resolvedHoleByNumber,
    courseFallbackLat,
    courseFallbackLng,
    activeHoleGeo,
    missingHoleLayout,
    activeHoleShots,
  }
}

export type { RoundRow }
