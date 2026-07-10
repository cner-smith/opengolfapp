import { useMemo } from 'react'
import type { Database } from '@oga/supabase'
import { getShotMarkerCategory, inferHoleCount, type LieType } from '@oga/core'
import type {
  ExistingShot,
  HoleGeo,
  PlacedPoint,
} from '../../../components/round/RoundMap'
import { useRound, useRounds } from '../../../hooks/useRounds'
import {
  useCourse,
  useCourseTees,
  useHolesForCourse,
} from '../../../hooks/useCourses'
import { useHoleScores } from '../../../hooks/useHoleScores'
import { useShotsForRound } from '../../../hooks/useShots'

type HoleRow = Database['public']['Tables']['holes']['Row']
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
  // else 18). With no tees row, infer from the round's own hole_scores
  // hole numbers — the authoritative per-round set — instead of assuming
  // 18, so a 9-hole unmapped course doesn't get a phantom back nine
  // (#727). inferHoleCount returns 18 for an empty set AND for any hole
  // number > 9, so this can never strand holes 10–18 on an 18-hole round;
  // it only trims to 9 when every scored hole is ≤ 9.
  const expectedHoleCount = useMemo(() => {
    const tees = teesQuery.data ?? []
    const totalPar = tees[0]?.par
    if (totalPar != null) return totalPar <= 36 ? 9 : 18
    const scores =
      (round.data as { hole_scores?: HSWithJoin[] })?.hole_scores ?? []
    const nums = scores
      .map((hs) => hs.holes?.number)
      .filter((n): n is number => n != null)
    return inferHoleCount(nums)
  }, [teesQuery.data, round.data])

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
  const effectiveTee: PlacedPoint | null =
    teeOverride ??
    (activeHole?.tee_lat != null && activeHole?.tee_lng != null
      ? { lat: activeHole.tee_lat, lng: activeHole.tee_lng }
      : null)
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
        par: activeHole.par,
        yards: activeHole.yards,
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
  // strip text so the player understands why distances are missing.
  const missingHoleLayout =
    activeHole != null &&
    activeHole.tee_lat == null &&
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
          activeHole?.par ?? 4,
          s.shot_number,
        ),
      }))
      .sort((a, b) => a.shotNumber - b.shotNumber)
  }, [activeHoleScore, shotsQuery.data, activeHole?.par])

  return {
    round,
    holesQuery,
    teesQuery,
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
    courseFallbackLat,
    courseFallbackLng,
    activeHoleGeo,
    missingHoleLayout,
    activeHoleShots,
  }
}

export type { RoundRow }
