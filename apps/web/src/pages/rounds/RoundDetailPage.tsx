import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import type { Database } from '@oga/supabase'
import { HoleScoreCard } from '../../components/rounds/HoleScoreCard'
import { ShotEntryModal } from '../../components/rounds/ShotEntryModal'
import { RoundSummary } from '../../components/rounds/RoundSummary'
import type {
  ExistingShot,
  HoleGeo,
  PlacedPoint,
} from '../../components/round/RoundMap'
import { RoundMapInstructionStrip } from '../../components/round/RoundMap'
import {
  combinedPuttResult,
  DEFAULT_HANDICAP,
  getShotCategory,
  haversineYards,
  NEAR_GREEN_YARDS,
} from '@oga/core'
import { toUserMessage } from '../../lib/errors'

// Lazy-load Mapbox GL JS only when the map tab is opened. Cuts ~2 MB off
// the initial bundle for users who never leave the scorecard.
const RoundMap = lazy(() =>
  import('../../components/round/RoundMap').then((m) => ({
    default: m.RoundMap,
  })),
)
import {
  HoleReviewSheet,
  type ReviewedShotRow,
} from '../../components/round/HoleReviewSheet'
import {
  WebPuttingSheet,
  type WebPuttData,
} from '../../components/round/WebPuttingSheet'
import { useDeleteRound, useRound, useRounds } from '../../hooks/useRounds'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import {
  useCourse,
  useCourseTees,
  useHolesForCourse,
} from '../../hooks/useCourses'
import { useHoleScores, useUpsertHoleScore } from '../../hooks/useHoleScores'
import { useCreateShot, useShotsForRound } from '../../hooks/useShots'
import { useCompleteRound } from '../../hooks/useCompleteRound'
import { useProfile } from '../../hooks/useProfile'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']

type ViewMode = 'scorecard' | 'map'

// Hole-coupled view state. These seven fields used to live as
// individual useState hooks and were reset together in switchHole —
// every new piece of hole-scoped state was a fresh chance to forget a
// reset and leave stale data on screen. Bundling them in a reducer
// makes SWITCH_HOLE one atomic transition.
interface HoleViewState {
  activeHoleNumber: number
  placedPoints: PlacedPoint[]
  /** Aim point per placed shot. Parallel to placedPoints — index N is
   *  the aim for shot N. Null when the user hasn't placed an aim for
   *  that shot. Aim point is what the player was aiming at when they
   *  hit shot N; required for meaningful dispersion analysis. */
  placedAims: (PlacedPoint | null)[]
  /** Putt metadata per placed shot. Parallel to placedPoints. Set when
   *  a tap landed within 30 yd of the pin and the user filled the
   *  putting sheet. Null for non-putts. The data flows straight through
   *  to saveReviewedHole so the player doesn't re-enter putt details
   *  in the end-of-hole review. */
  placedPutts: (WebPuttData | null)[]
  /** When true, the next map tap sets the aim point for the latest
   *  placed shot instead of dropping a new shot start marker. */
  aimMode: boolean
  /** Index of the placed shot whose putting sheet is currently open;
   *  null when the sheet is closed. */
  puttingSheetForIdx: number | null
  /** Monotonic counter the map watches to fly to the green after a
   *  saved putt. Bumped when the user saves a non-holed putt so
   *  RoundMap can flyTo the pin at zoom 18 to frame the green for the
   *  next putt placement. */
  focusGreenSignal: number
  pinOverride: PlacedPoint | null
  teeOverride: PlacedPoint | null
  /** Manual tee/pin placement flow — when set, the next map tap drops
   *  the corresponding marker instead of starting a shot. Used for
   *  courses with no hole layout in the DB so the player can mark the
   *  tee box and pin themselves. */
  placementMode: 'tee' | 'pin' | null
  reviewOpen: boolean
  editingOnMap: boolean
  saveError: string | null
}

type HoleViewAction =
  | { type: 'SWITCH_HOLE'; holeNumber: number }
  | { type: 'PUSH_POINT'; point: PlacedPoint; openPuttSheet?: boolean }
  | { type: 'MOVE_POINT'; index: number; point: PlacedPoint }
  | { type: 'CLEAR_POINTS' }
  | { type: 'POP_POINT' }
  | { type: 'SET_AIM'; index: number; point: PlacedPoint | null }
  | { type: 'AIM_MODE'; on: boolean }
  | { type: 'OPEN_PUTT_SHEET'; index: number }
  | { type: 'CLOSE_PUTT_SHEET' }
  | { type: 'SET_PUTT'; index: number; data: WebPuttData }
  | { type: 'PIN_OVERRIDE'; point: PlacedPoint | null }
  | { type: 'TEE_OVERRIDE'; point: PlacedPoint | null }
  | { type: 'PLACEMENT_MODE'; mode: 'tee' | 'pin' | null }
  | { type: 'OPEN_REVIEW' }
  | { type: 'CLOSE_REVIEW' }
  | { type: 'EDIT_ON_MAP'; editing: boolean }
  | { type: 'SAVE_ERROR'; message: string | null }
  | { type: 'AFTER_SAVE' }

const HOLE_VIEW_INITIAL: HoleViewState = {
  activeHoleNumber: 1,
  placedPoints: [],
  placedAims: [],
  placedPutts: [],
  aimMode: false,
  puttingSheetForIdx: null,
  focusGreenSignal: 0,
  pinOverride: null,
  teeOverride: null,
  placementMode: null,
  reviewOpen: false,
  editingOnMap: false,
  saveError: null,
}

function holeViewReducer(state: HoleViewState, action: HoleViewAction): HoleViewState {
  switch (action.type) {
    case 'SWITCH_HOLE':
      return {
        ...HOLE_VIEW_INITIAL,
        activeHoleNumber: action.holeNumber,
        // Keep the focus-green counter monotonic across hole switches —
        // resetting to 0 mid-session would re-fire RoundMap's flyTo
        // effect (it watches the counter for changes).
        focusGreenSignal: state.focusGreenSignal,
      }
    case 'PUSH_POINT': {
      const newIdx = state.placedPoints.length
      return {
        ...state,
        placedPoints: [...state.placedPoints, action.point],
        placedAims: [...state.placedAims, null],
        placedPutts: [...state.placedPutts, null],
        // Drop aim mode after placing a new shot — aim mode is sticky to
        // a specific shot, and pushing a new shot moves the cursor.
        aimMode: false,
        // Auto-open the putting sheet for the new shot when this push
        // landed within 30 yd of the pin (caller-controlled flag).
        puttingSheetForIdx: action.openPuttSheet ? newIdx : state.puttingSheetForIdx,
      }
    }
    case 'MOVE_POINT': {
      const next = state.placedPoints.slice()
      next[action.index] = action.point
      return { ...state, placedPoints: next }
    }
    case 'CLEAR_POINTS':
      return {
        ...state,
        placedPoints: [],
        placedAims: [],
        placedPutts: [],
        aimMode: false,
        puttingSheetForIdx: null,
      }
    case 'POP_POINT':
      return {
        ...state,
        placedPoints: state.placedPoints.slice(0, -1),
        placedAims: state.placedAims.slice(0, -1),
        placedPutts: state.placedPutts.slice(0, -1),
        aimMode: false,
        puttingSheetForIdx: null,
      }
    case 'SET_AIM': {
      const next = state.placedAims.slice()
      next[action.index] = action.point
      return { ...state, placedAims: next, aimMode: false }
    }
    case 'AIM_MODE':
      return { ...state, aimMode: action.on }
    case 'OPEN_PUTT_SHEET':
      return { ...state, puttingSheetForIdx: action.index }
    case 'CLOSE_PUTT_SHEET':
      return { ...state, puttingSheetForIdx: null }
    case 'SET_PUTT': {
      const next = state.placedPutts.slice()
      next[action.index] = action.data
      return {
        ...state,
        placedPutts: next,
        puttingSheetForIdx: null,
        // A miss → frame the green for the follow-up putt. A holed
        // putt ends the hole, so leave the camera where it is and let
        // the player tap "Done with hole".
        focusGreenSignal: action.data.puttMade
          ? state.focusGreenSignal
          : state.focusGreenSignal + 1,
      }
    }
    case 'PIN_OVERRIDE':
      // A pin write also exits placement mode so the next tap goes back
      // to dropping shot markers instead of re-placing the pin.
      return { ...state, pinOverride: action.point, placementMode: null }
    case 'TEE_OVERRIDE':
      return { ...state, teeOverride: action.point, placementMode: null }
    case 'PLACEMENT_MODE':
      return { ...state, placementMode: action.mode }
    case 'OPEN_REVIEW':
      return { ...state, reviewOpen: true }
    case 'CLOSE_REVIEW':
      return { ...state, reviewOpen: false }
    case 'EDIT_ON_MAP':
      return { ...state, editingOnMap: action.editing }
    case 'SAVE_ERROR':
      return { ...state, saveError: action.message }
    case 'AFTER_SAVE':
      return {
        ...state,
        reviewOpen: false,
        placedPoints: [],
        placedAims: [],
        placedPutts: [],
        aimMode: false,
        puttingSheetForIdx: null,
      }
  }
}

export function RoundDetailPage() {
  const { id: roundId } = useParams()
  const navigate = useNavigate()
  const round = useRound(roundId)
  const profile = useProfile()
  const { user } = useAuth()
  const courseId = round.data?.course_id
  const holesQuery = useHolesForCourse(courseId)
  const teesQuery = useCourseTees(courseId)
  // Direct fetch — the joined courses(...) field on the round query has
  // been intermittently flat (no lat/lng) for reasons that haven't
  // panned out in PostgREST. A standalone course read is unambiguous.
  const courseQuery = useCourse(courseId)
  const holeScoresQuery = useHoleScores(roundId)
  const shotsQuery = useShotsForRound(roundId)
  const upsertHoleScore = useUpsertHoleScore(roundId)
  const createShot = useCreateShot(roundId)
  const completeMutation = useCompleteRound()
  const deleteMutation = useDeleteRound()
  const allRounds = useRounds(50)
  const queryClient = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [shotsModalFor, setShotsModalFor] = useState<{
    holeScoreId: string
    holeNumber: number
    holePar: number
  } | null>(null)
  const [completeError, setCompleteError] = useState<string | null>(null)
  const [searchParams] = useSearchParams()
  // Live-round entries land on the map view directly so the user can
  // start dropping shots; everything else opens on the scorecard.
  const [view, setView] = useState<ViewMode>(() =>
    searchParams.get('view') === 'map' ? 'map' : 'scorecard',
  )
  const [holeView, dispatchHoleView] = useReducer(holeViewReducer, HOLE_VIEW_INITIAL)
  const {
    activeHoleNumber,
    placedPoints,
    placedAims,
    placedPutts,
    aimMode,
    puttingSheetForIdx,
    focusGreenSignal,
    pinOverride,
    teeOverride,
    placementMode,
    reviewOpen,
    editingOnMap,
    saveError,
  } = holeView
  const [savingHole, setSavingHole] = useState(false)

  // Synthetic fallback when the course has no rows in the `holes` table
  // (typical for OSM-imported courses that never went through enrichment).
  // Without this, every downstream feature gates on `activeHole` being
  // non-null and the round detail page locks up: scorecard renders no
  // rows, map placement buttons hide, review sheet can't open. Synthesize
  // either from hole_scores (real hole_ids + joined par survive a
  // refresh) or as 18 par-4 placeholders so the UI is at least usable.
  type HSWithJoin = HoleScoreRow & { holes?: { par?: number | null } | null }
  const holes = useMemo<HoleRow[]>(() => {
    const fetched = holesQuery.data ?? []
    if (fetched.length > 0) return fetched
    const roundData = round.data
    if (!roundData) return []
    const scores = (roundData as { hole_scores?: HSWithJoin[] }).hole_scores
    if (scores && scores.length > 0) {
      return scores.map((hs, i) => ({
        id: hs.hole_id,
        course_id: roundData.course_id,
        number: i + 1,
        par: hs.holes?.par ?? 4,
        yards: null,
        stroke_index: i + 1,
        tee_lat: null,
        tee_lng: null,
        pin_lat: null,
        pin_lng: null,
      }))
    }
    return Array.from({ length: 18 }, (_, i) => ({
      id: `synthetic-${roundData.id}-hole-${i + 1}`,
      course_id: roundData.course_id,
      number: i + 1,
      par: 4,
      yards: null,
      stroke_index: i + 1,
      tee_lat: null,
      tee_lng: null,
      pin_lat: null,
      pin_lng: null,
    }))
  }, [holesQuery.data, round.data])
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
        category: categorizeShot(s, activeHole?.par ?? 4),
      }))
      .sort((a, b) => a.shotNumber - b.shotNumber)
  }, [activeHoleScore, shotsQuery.data])

  // Materialize a synthetic hole into a real `holes` row before any
  // operation that writes to hole_scores. Synthetic ids (prefixed
  // 'synthetic-') come from the no-OSM-data fallback in the `holes`
  // memo above; hole_scores.hole_id has a FK to holes.id, so without
  // this an upsert would fail. On insert, invalidate the holes query
  // so the synthetic placeholder gets replaced with the real row on
  // the next read. On unique-violation (course_id,number race), look
  // up the existing row instead of clobbering it.
  const ensureRealHole = useCallback(
    async (
      hole: HoleRow,
      opts?: {
        teeLat?: number | null
        teeLng?: number | null
        pinLat?: number | null
        pinLng?: number | null
      },
    ): Promise<string> => {
      if (!hole.id.startsWith('synthetic-')) return hole.id
      const { data: inserted, error: insertErr } = await supabase
        .from('holes')
        .insert({
          course_id: hole.course_id,
          number: hole.number,
          par: hole.par,
          yards: null,
          stroke_index: hole.number,
          tee_lat: opts?.teeLat ?? null,
          tee_lng: opts?.teeLng ?? null,
          pin_lat: opts?.pinLat ?? null,
          pin_lng: opts?.pinLng ?? null,
        })
        .select('id')
        .single()
      if (!insertErr && inserted) {
        queryClient.invalidateQueries({ queryKey: ['holes', hole.course_id] })
        return inserted.id
      }
      if (insertErr?.code === '23505') {
        const { data: existing, error: selectErr } = await supabase
          .from('holes')
          .select('id')
          .eq('course_id', hole.course_id)
          .eq('number', hole.number)
          .single()
        if (selectErr || !existing) throw selectErr ?? insertErr
        queryClient.invalidateQueries({ queryKey: ['holes', hole.course_id] })
        return existing.id
      }
      throw insertErr ?? new Error('hole insert failed')
    },
    [queryClient],
  )

  // The round-pin write is best-effort — we update local state synchronously
  // so the map + review sheet update immediately, then persist to
  // hole_scores.pin_lat/lng if we have a row to attach it to.
  const persistRoundPin = useCallback(
    async (point: PlacedPoint) => {
      dispatchHoleView({ type: 'PIN_OVERRIDE', point })
      const hs = activeHoleScore
      if (!hs || !roundId) return
      // Belt-and-suspenders: constrain by round_id alongside row id, so a
      // misconfigured RLS policy can't let a stray UUID write another
      // user's pin.
      const { error } = await supabase
        .from('hole_scores')
        .update({ pin_lat: point.lat, pin_lng: point.lng })
        .eq('id', hs.id)
        .eq('round_id', roundId)
      if (error && import.meta.env.DEV) {
        // Don't roll back the local override — the user's intent stays
        // visible while they retry. Surface the error for diagnostics.
        // eslint-disable-next-line no-console
        console.error('[RoundDetailPage/updatePin]', error)
      }
    },
    [activeHoleScore, roundId],
  )

  const placeHandlers = useMemo(
    () => ({
      onPlace: (p: PlacedPoint) => {
        // Auto-open the putting sheet for any tap within 30 yd of the
        // pin so the user lands straight on putt entry instead of the
        // generic shot detail row.
        const isPutt =
          effectivePin != null &&
          haversineYards(p.lat, p.lng, effectivePin.lat, effectivePin.lng) <=
            NEAR_GREEN_YARDS
        dispatchHoleView({
          type: 'PUSH_POINT',
          point: p,
          openPuttSheet: isPutt,
        })
      },
      onMovePoint: (idx: number, p: PlacedPoint) =>
        dispatchHoleView({ type: 'MOVE_POINT', index: idx, point: p }),
      onMovePin: (p: PlacedPoint) => {
        void persistRoundPin(p)
      },
      onMoveTee: (p: PlacedPoint) =>
        dispatchHoleView({ type: 'TEE_OVERRIDE', point: p }),
      onClearPoints: () => dispatchHoleView({ type: 'CLEAR_POINTS' }),
      onUndoPoint: () => dispatchHoleView({ type: 'POP_POINT' }),
      onSetAim: (idx: number, point: PlacedPoint | null) =>
        dispatchHoleView({ type: 'SET_AIM', index: idx, point }),
      onToggleAimMode: (on: boolean) =>
        dispatchHoleView({ type: 'AIM_MODE', on }),
      onStartPlaceTee: () =>
        dispatchHoleView({ type: 'PLACEMENT_MODE', mode: 'tee' }),
      onStartPlacePin: () =>
        dispatchHoleView({ type: 'PLACEMENT_MODE', mode: 'pin' }),
      onCancelPlacement: () =>
        dispatchHoleView({ type: 'PLACEMENT_MODE', mode: null }),
      onDoneWithHole: () => dispatchHoleView({ type: 'OPEN_REVIEW' }),
      onDoneEditing: () => {
        dispatchHoleView({ type: 'EDIT_ON_MAP', editing: false })
        dispatchHoleView({ type: 'OPEN_REVIEW' })
      },
    }),
    [persistRoundPin, effectivePin],
  )

  const switchHole = useCallback((n: number) => {
    dispatchHoleView({ type: 'SWITCH_HOLE', holeNumber: n })
  }, [])

  if (round.isLoading || holesQuery.isLoading) {
    return (
      <div className="text-caddie-ink-mute" style={{ fontSize: 13 }}>
        Loading round…
      </div>
    )
  }
  if (round.error) {
    return (
      <div
        className="text-caddie-neg"
        style={{
          border: '1px solid #A33A2A',
          borderRadius: 4,
          padding: '14px 18px',
          fontSize: 13,
        }}
      >
        Error: {toUserMessage(round.error)}
      </div>
    )
  }
  if (!round.data) {
    return <div style={{ fontSize: 13 }}>Round not found.</div>
  }

  const holesPlayed = holeScores.length
  const totalRoundsLogged = allRounds.data?.length ?? 0

  async function handleComplete() {
    if (!round.data || !courseId || !user) return
    setCompleteError(null)
    try {
      const handicap = profile.data?.handicap_index ?? DEFAULT_HANDICAP
      await completeMutation.mutateAsync({
        roundId: round.data.id,
        courseId,
        handicap,
        courseTeeId: round.data.course_tee_id,
        teeColor: round.data.tee_color,
        userId: user.id,
      })
    } catch (err) {
      setCompleteError(toUserMessage(err))
    }
  }

  async function handleDelete() {
    if (!round.data) return
    try {
      await deleteMutation.mutateAsync(round.data.id)
      setConfirmDelete(false)
      navigate('/rounds')
    } catch (err) {
      setCompleteError(toUserMessage(err))
      setConfirmDelete(false)
    }
  }

  async function saveReviewedHole(rows: ReviewedShotRow[]) {
    if (!user || !activeHole || !round.data) return
    setSavingHole(true)
    dispatchHoleView({ type: 'SAVE_ERROR', message: null })
    try {
      // Ensure a hole_score row exists; the score equals the placed
      // shot count, which is what the player just confirmed. Putts is
      // derived from the rows so the scorecard reflects what was placed
      // without needing a manual entry.
      const existing = scoresByHoleId.get(activeHole.id)
      // Match HoleReviewSheet's isPutt — any shot starting within 30 yd
      // of the pin counts as a putt for the scorecard's putt total.
      const puttCount = rows.filter(
        (r) =>
          r.lieType === 'green' ||
          r.club === 'putter' ||
          r.distanceToPin <= NEAR_GREEN_YARDS,
      ).length
      // Materialize the synthetic hole if needed before upserting the
      // hole_score (FK to holes.id). Seeds the new holes row with any
      // session tee/pin overrides so manual placements persist as the
      // course's first real layout data — every save curates the course.
      const realHoleId = await ensureRealHole(activeHole, {
        teeLat: teeOverride?.lat ?? null,
        teeLng: teeOverride?.lng ?? null,
        pinLat: pinOverride?.lat ?? null,
        pinLng: pinOverride?.lng ?? null,
      })
      const hsResult = await upsertHoleScore.mutateAsync({
        id: existing?.id,
        round_id: round.data.id,
        hole_id: realHoleId,
        score: rows.length,
        putts: puttCount,
        fairway_hit: existing?.fairway_hit ?? null,
        gir: existing?.gir ?? null,
      })
      const hs = hsResult ?? existing
      if (!hs) throw new Error('hole_score upsert returned no row')

      // Replace-all save: drop any shots already attached to this
      // hole_score before inserting the freshly reviewed rows. Without
      // this, a re-save (e.g. after a partial-success error retry, or
      // after editing the hole on the map) duplicated rows in the DB
      // and surfaced as phantom shot markers + shifted shot numbers.
      const { error: delErr } = await supabase
        .from('shots')
        .delete()
        .eq('hole_score_id', hs.id)
        .eq('user_id', user.id)
      if (delErr) throw delErr

      for (const row of rows) {
        const isPuttRow =
          row.lieType === 'green' ||
          row.club === 'putter' ||
          row.distanceToPin <= NEAR_GREEN_YARDS
        const aim = placedAims[row.shotNumber - 1] ?? null
        await createShot.mutateAsync({
          hole_score_id: hs.id,
          user_id: user.id,
          shot_number: row.shotNumber,
          start_lat: row.startLat,
          start_lng: row.startLng,
          end_lat: row.endLat,
          end_lng: row.endLng,
          aim_lat: aim?.lat ?? null,
          aim_lng: aim?.lng ?? null,
          distance_to_target: isPuttRow ? null : Math.round(row.distanceToPin),
          club: row.club,
          lie_type: row.lieType,
          shot_result: null,
          penalty: false,
          ob: false,
          // Putt-specific fields. distanceYards on a putt row is the
          // tap-to-tap distance in yards; * 3 = feet (US convention),
          // and putt_distance_ft is what the rest of the app reads.
          putt_distance_ft: isPuttRow
            ? Math.round(row.distanceYards * 3)
            : null,
          // Distance + direction are independent axes; legacy putt_result
          // is reconstructed for back-compat readers.
          putt_result: !isPuttRow
            ? null
            : combinedPuttResult({
                made: row.puttMade,
                distance: row.puttDistanceResult ?? null,
                direction: row.puttDirectionResult ?? null,
              }),
          putt_distance_result:
            !isPuttRow || row.puttMade ? null : row.puttDistanceResult ?? null,
          putt_direction_result:
            !isPuttRow || row.puttMade ? null : row.puttDirectionResult ?? null,
          notes: null,
        })
      }
      dispatchHoleView({ type: 'AFTER_SAVE' })
    } catch (err) {
      dispatchHoleView({ type: 'SAVE_ERROR', message: toUserMessage(err) })
    } finally {
      setSavingHole(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/rounds')}
        className="font-mono uppercase text-caddie-ink-mute hover:text-caddie-ink"
        style={{
          fontSize: 10,
          letterSpacing: '0.14em',
          marginBottom: 18,
        }}
      >
        ← All rounds
      </button>

      <div
        className="flex flex-col sm:flex-row sm:items-end sm:justify-between"
        style={{ marginBottom: 28, gap: 14 }}
      >
        <div>
          <div className="kicker" style={{ marginBottom: 8 }}>
            Round detail
          </div>
          <h1
            className="font-serif text-caddie-ink"
            style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.15 }}
          >
            {round.data.courses?.name ?? 'Round'}
          </h1>
          <div
            className="font-mono uppercase tabular text-caddie-ink-mute"
            style={{
              fontSize: 10,
              letterSpacing: '0.14em',
              marginTop: 6,
            }}
          >
            {round.data.played_at}
            {round.data.tee_color ? ` · ${round.data.tee_color} tees` : ''} ·{' '}
            {holesPlayed}/18 holes scored
          </div>
          <RoundRatingLine
            round={round.data as unknown as RoundRow}
            tees={teesQuery.data ?? []}
          />
        </div>
        <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={deleteMutation.isPending}
            className="text-caddie-neg hover:bg-caddie-neg/10 disabled:opacity-40"
            style={{
              background: 'transparent',
              border: '1px solid #A33A2A',
              borderRadius: 2,
              padding: '12px 14px',
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: '0.02em',
            }}
          >
            Delete round
          </button>
          <button
            type="button"
            onClick={handleComplete}
            disabled={completeMutation.isPending || holesPlayed === 0}
            className="bg-caddie-accent text-caddie-accent-ink hover:opacity-90 disabled:opacity-40"
            style={{
              borderRadius: 2,
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.02em',
            }}
          >
            {completeMutation.isPending ? 'Calculating…' : 'Save SG + finalize'}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this round?"
        message="This cannot be undone. Hole scores and shots are removed too."
        confirmLabel="Delete"
        destructive
        busy={deleteMutation.isPending}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      {completeError && (
        <div
          className="text-caddie-neg"
          style={{
            border: '1px solid #A33A2A',
            borderRadius: 4,
            padding: '14px 18px',
            fontSize: 13,
            marginBottom: 18,
          }}
        >
          {completeError}
        </div>
      )}

      {round.data.sg_total !== null && (
        <div style={{ marginBottom: 28 }}>
          <RoundSummary
            round={round.data as unknown as RoundRow}
            holes={holes}
            holeScores={holeScores}
            totalRoundsLogged={totalRoundsLogged}
          />
        </div>
      )}

      <ViewTabs value={view} onChange={setView} />

      {view === 'scorecard' ? (
        <ScorecardView
          holes={holes}
          scoresByHoleId={scoresByHoleId}
          shotCountByHoleScore={shotCountByHoleScore}
          roundId={round.data.id}
          ensureRealHole={ensureRealHole}
          onEditShots={(args) => setShotsModalFor(args)}
        />
      ) : (
        <MapView
          holes={holes}
          activeHoleNumber={activeHoleNumber}
          onSwitchHole={switchHole}
          activeHoleGeo={activeHoleGeo}
          courseLat={courseFallbackLat}
          courseLng={courseFallbackLng}
          existingShots={activeHoleShots}
          placedPoints={placedPoints}
          placedAims={placedAims}
          aimMode={aimMode}
          missingHoleLayout={missingHoleLayout}
          focusGreenSignal={focusGreenSignal}
          puttingOpen={puttingSheetForIdx != null}
          pinOverride={pinOverride}
          teeOverride={teeOverride}
          placementMode={placementMode}
          handlers={placeHandlers}
          saveError={saveError}
          editingOnMap={editingOnMap}
          reviewSheet={
            activeHole ? (
              <>
                <HoleReviewSheet
                  open={reviewOpen}
                  holeNumber={activeHole.number}
                  par={activeHole.par}
                  totalPar={holes.reduce((s, h) => s + h.par, 0)}
                  pinLat={effectivePin?.lat ?? null}
                  pinLng={effectivePin?.lng ?? null}
                  placedPoints={placedPoints}
                  placedPutts={placedPutts}
                  saving={savingHole}
                  onEditOnMap={() => {
                    dispatchHoleView({ type: 'CLOSE_REVIEW' })
                    dispatchHoleView({ type: 'EDIT_ON_MAP', editing: true })
                  }}
                  onSave={saveReviewedHole}
                />
                {puttingSheetForIdx != null &&
                  placedPoints[puttingSheetForIdx] &&
                  effectivePin && (
                    <WebPuttingSheet
                      open
                      shotNumber={puttingSheetForIdx + 1}
                      initialDistanceFt={Math.round(
                        haversineYards(
                          placedPoints[puttingSheetForIdx]!.lat,
                          placedPoints[puttingSheetForIdx]!.lng,
                          effectivePin.lat,
                          effectivePin.lng,
                        ) * 3,
                      )}
                      initial={placedPutts[puttingSheetForIdx] ?? null}
                      onSave={(data) =>
                        dispatchHoleView({
                          type: 'SET_PUTT',
                          index: puttingSheetForIdx,
                          data,
                        })
                      }
                      onClose={() =>
                        dispatchHoleView({ type: 'CLOSE_PUTT_SHEET' })
                      }
                    />
                  )}
              </>
            ) : null
          }
        />
      )}

      {shotsModalFor && round.data && (
        <ShotEntryModal
          roundId={round.data.id}
          holeScoreId={shotsModalFor.holeScoreId}
          holeNumber={shotsModalFor.holeNumber}
          holePar={shotsModalFor.holePar}
          onClose={() => setShotsModalFor(null)}
        />
      )}
    </div>
  )
}

function ViewTabs({
  value,
  onChange,
}: {
  value: ViewMode
  onChange: (v: ViewMode) => void
}) {
  const tabs: { key: ViewMode; label: string }[] = [
    { key: 'scorecard', label: 'Scorecard' },
    { key: 'map', label: 'Map' },
  ]
  return (
    <div
      style={{
        display: 'flex',
        gap: 0,
        borderBottom: '1px solid #D9D2BF',
        marginBottom: 18,
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className="font-mono uppercase"
          style={{
            background: 'transparent',
            border: 'none',
            padding: '10px 18px',
            fontSize: 10,
            letterSpacing: '0.14em',
            color: value === t.key ? '#1C211C' : '#8A8B7E',
            borderBottom:
              value === t.key
                ? '2px solid #1F3D2C'
                : '2px solid transparent',
            marginBottom: -1,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

interface ScorecardViewProps {
  holes: HoleRow[]
  scoresByHoleId: Map<string, HoleScoreRow>
  shotCountByHoleScore: Map<string, number>
  roundId: string
  /** Materialize a synthetic-id hole into a real `holes` row before
   *  any hole_scores write. No-op for real holes. */
  ensureRealHole: (hole: HoleRow) => Promise<string>
  onEditShots: (args: {
    holeScoreId: string
    holeNumber: number
    holePar: number
  }) => void
}

function ScorecardView({
  holes,
  scoresByHoleId,
  shotCountByHoleScore,
  roundId,
  ensureRealHole,
  onEditShots,
}: ScorecardViewProps) {
  const hasSyntheticHoles = holes.some(
    (h) => !h.yards && h.tee_lat == null,
  )
  const [hintDismissed, setHintDismissed] = useState(false)
  return (
    <div style={{ borderTop: '1px solid #D9D2BF', paddingTop: 14 }}>
      <div className="kicker" style={{ marginBottom: 14 }}>
        Scorecard
      </div>
      {hasSyntheticHoles && !hintDismissed && (
        <div
          role="status"
          style={{
            marginBottom: 14,
            padding: '10px 14px',
            background: '#FBF8F1',
            border: '1px solid #D9D2BF',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 14,
          }}
        >
          <div
            className="text-caddie-ink-dim"
            style={{ flex: 1, fontSize: 13, lineHeight: 1.4 }}
          >
            No course layout found. Par defaults to 4 — tap to edit.
          </div>
          <button
            type="button"
            onClick={() => setHintDismissed(true)}
            aria-label="Dismiss notice"
            className="font-mono uppercase text-caddie-ink-mute hover:text-caddie-ink"
            style={{
              fontSize: 10,
              letterSpacing: '0.14em',
              background: 'transparent',
              border: 'none',
              padding: 4,
            }}
          >
            Dismiss
          </button>
        </div>
      )}
      <div
        style={{
          borderTop: '1px solid #D9D2BF',
          overflowX: 'auto',
        }}
      >
        <div style={{ minWidth: 720 }}>
        <div
          className="grid grid-cols-12 items-center font-mono uppercase text-caddie-ink-mute"
          style={{
            padding: '10px 0',
            fontSize: 10,
            letterSpacing: '0.14em',
            gap: 12,
            borderBottom: '1px solid #D9D2BF',
          }}
        >
          <div className="col-span-2">Hole</div>
          <div className="col-span-1 text-center">Score</div>
          <div className="col-span-1" />
          <div className="col-span-2 text-center">Putts</div>
          <div className="col-span-2 text-center">Fairway</div>
          <div className="col-span-1 text-center">GIR</div>
          <div className="col-span-3 text-right">Shots</div>
        </div>
        {holes.map((h) => {
          const hs = scoresByHoleId.get(h.id)
          return (
            <HoleScoreCard
              key={h.id}
              roundId={roundId}
              hole={h}
              holeScore={hs}
              shotCount={hs ? (shotCountByHoleScore.get(hs.id) ?? 0) : 0}
              ensureRealHole={ensureRealHole}
              onEditShots={(holeScoreId) =>
                onEditShots({
                  holeScoreId,
                  holeNumber: h.number,
                  holePar: h.par,
                })
              }
            />
          )
        })}
        </div>
      </div>
    </div>
  )
}

interface MapViewProps {
  holes: HoleRow[]
  activeHoleNumber: number
  onSwitchHole: (n: number) => void
  activeHoleGeo: HoleGeo | null
  /** Course-level lat/lng — passed to RoundMap as a direct prop so the
   *  camera can fall back to the course centroid even when activeHoleGeo
   *  is null (course rows with no entries in the holes table). */
  courseLat: number | null
  courseLng: number | null
  existingShots: ExistingShot[]
  placedPoints: PlacedPoint[]
  placedAims: (PlacedPoint | null)[]
  aimMode: boolean
  /** True when the active hole has neither tee nor pin coordinates in
   *  the DB — drives the dismissable notice banner above the map. */
  missingHoleLayout: boolean
  /** True while the putting sheet is open — suppresses tap-to-place so
   *  taps that hit the map under the sheet don't drop new shots. */
  puttingOpen: boolean
  /** Bumped after a non-holed putt save so RoundMap zooms to the green
   *  for the next putt placement. */
  focusGreenSignal: number
  pinOverride: PlacedPoint | null
  teeOverride: PlacedPoint | null
  /** Active manual-placement mode for courses missing hole layout. */
  placementMode: 'tee' | 'pin' | null
  handlers: {
    onPlace: (p: PlacedPoint) => void
    onMovePoint: (idx: number, p: PlacedPoint) => void
    onMovePin: (p: PlacedPoint) => void
    onMoveTee: (p: PlacedPoint) => void
    onClearPoints: () => void
    onUndoPoint: () => void
    onSetAim: (idx: number, p: PlacedPoint | null) => void
    onToggleAimMode: (on: boolean) => void
    onStartPlaceTee: () => void
    onStartPlacePin: () => void
    onCancelPlacement: () => void
    onDoneWithHole: () => void
    onDoneEditing: () => void
  }
  saveError: string | null
  editingOnMap: boolean
  reviewSheet?: ReactNode
}

function MapView({
  holes,
  activeHoleNumber,
  onSwitchHole,
  activeHoleGeo,
  courseLat,
  courseLng,
  existingShots,
  placedPoints,
  placedAims,
  aimMode,
  missingHoleLayout,
  puttingOpen,
  focusGreenSignal,
  pinOverride,
  teeOverride,
  placementMode,
  handlers,
  saveError,
  editingOnMap,
  reviewSheet,
}: MapViewProps) {
  // Notice banner sits above the map when the active hole has no tee
  // or pin coords. Dismiss state resets on every hole switch so the
  // player isn't surprised by a missing-data hole later in the round.
  const [noticeDismissed, setNoticeDismissed] = useState(false)
  useEffect(() => {
    setNoticeDismissed(false)
  }, [activeHoleNumber])
  const hasExistingShots = existingShots.some(
    (s) => s.endLat != null && s.endLng != null,
  )
  const lastPoint = placedPoints[placedPoints.length - 1] ?? null
  const effectivePin =
    pinOverride ??
    (activeHoleGeo?.pinLat != null && activeHoleGeo?.pinLng != null
      ? { lat: activeHoleGeo.pinLat, lng: activeHoleGeo.pinLng }
      : null)
  const effectiveTee =
    teeOverride ??
    (activeHoleGeo?.teeLat != null && activeHoleGeo?.teeLng != null
      ? { lat: activeHoleGeo.teeLat, lng: activeHoleGeo.teeLng }
      : null)
  // Manual placement entry points only render when the active hole has
  // no coord for that target. Tee/pin both null = course w/o hole layout.
  const needsTee = activeHoleGeo != null && effectiveTee == null
  const needsPin = activeHoleGeo != null && effectivePin == null
  const remainingToPin =
    lastPoint && effectivePin
      ? Math.round(
          haversineYards(
            lastPoint.lat,
            lastPoint.lng,
            effectivePin.lat,
            effectivePin.lng,
          ),
        )
      : null

  return (
    <div>
      <HoleSelector
        holes={holes}
        activeNumber={activeHoleNumber}
        onSelect={onSwitchHole}
      />
      {missingHoleLayout && !noticeDismissed && (
        <div
          role="status"
          style={{
            marginTop: 14,
            padding: '10px 14px',
            background: '#FBF8F1',
            border: '1px solid #D9D2BF',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 14,
          }}
        >
          <div style={{ flex: 1 }}>
            <div className="kicker" style={{ marginBottom: 4 }}>
              No hole layout
            </div>
            <div
              className="text-caddie-ink-dim"
              style={{ fontSize: 13, lineHeight: 1.4 }}
            >
              No hole layout data for this course. You can still place
              shots manually.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setNoticeDismissed(true)}
            aria-label="Dismiss notice"
            className="font-mono uppercase text-caddie-ink-mute hover:text-caddie-ink"
            style={{
              fontSize: 10,
              letterSpacing: '0.14em',
              background: 'transparent',
              border: 'none',
              padding: 4,
            }}
          >
            Dismiss
          </button>
        </div>
      )}
      <div style={{ marginTop: 14 }}>
        <RoundMapInstructionStrip
          hasExistingShots={hasExistingShots}
          editing={editingOnMap}
          shotsPlaced={placedPoints.length}
          remainingToPin={remainingToPin}
          pinAvailable={effectivePin != null}
          aimMode={aimMode}
          aimsSet={placedAims.filter((a) => a != null).length}
          holeNumber={activeHoleNumber}
          needsTee={needsTee}
          needsPin={needsPin}
          placementMode={placementMode}
          onStartPlaceTee={handlers.onStartPlaceTee}
          onStartPlacePin={handlers.onStartPlacePin}
          onCancelPlacement={handlers.onCancelPlacement}
          onToggleAimMode={handlers.onToggleAimMode}
          onClearLastAim={() => {
            const idx = placedAims.length - 1
            if (idx >= 0) handlers.onSetAim(idx, null)
          }}
          onUndo={handlers.onUndoPoint}
          onClear={handlers.onClearPoints}
          onDone={handlers.onDoneWithHole}
          onDoneEditing={handlers.onDoneEditing}
        />
      </div>
      <div
        style={{
          marginTop: 10,
          height: 540,
          border: '1px solid #D9D2BF',
          borderRadius: 4,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <Suspense fallback={<MapLoading />}>
          <RoundMap
            hole={activeHoleGeo}
            courseLat={courseLat}
            courseLng={courseLng}
            existingShots={existingShots}
            placedPoints={placedPoints}
            placedAims={placedAims}
            aimMode={aimMode}
            focusGreenSignal={focusGreenSignal}
            pinOverride={pinOverride}
            teeOverride={teeOverride}
            tapToPlaceDisabled={editingOnMap || puttingOpen}
            placementMode={placementMode}
            onPlace={handlers.onPlace}
            onMovePoint={handlers.onMovePoint}
            onMovePin={handlers.onMovePin}
            onMoveTee={handlers.onMoveTee}
            onSetAim={handlers.onSetAim}
          />
        </Suspense>
        {reviewSheet}
      </div>
      {saveError && (
        <div
          className="text-caddie-neg"
          style={{
            border: '1px solid #A33A2A',
            borderRadius: 4,
            padding: '12px 14px',
            fontSize: 13,
            marginTop: 14,
          }}
        >
          {saveError}
        </div>
      )}
    </div>
  )
}

function MapLoading() {
  return (
    <div
      className="flex items-center justify-center text-caddie-ink-mute"
      style={{ height: '100%', width: '100%', fontSize: 13 }}
    >
      Loading map…
    </div>
  )
}

function HoleSelector({
  holes,
  activeNumber,
  onSelect,
}: {
  holes: HoleRow[]
  activeNumber: number
  onSelect: (n: number) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
      }}
    >
      {holes.map((h) => {
        const active = h.number === activeNumber
        return (
          <button
            key={h.id}
            type="button"
            onClick={() => onSelect(h.number)}
            className="font-mono tabular"
            style={{
              minWidth: 36,
              height: 36,
              padding: '0 10px',
              borderRadius: 2,
              background: active ? '#1F3D2C' : '#EBE5D6',
              color: active ? '#F2EEE5' : '#1C211C',
              border: 'none',
              fontSize: 12,
              fontWeight: active ? 600 : 500,
              letterSpacing: '0.04em',
              cursor: 'pointer',
            }}
            title={`Hole ${h.number} · Par ${h.par}`}
          >
            {h.number}
          </button>
        )
      })}
    </div>
  )
}

// Categorize a shot row for marker coloring on the map.
type RoundRow = Database['public']['Tables']['rounds']['Row']
type CourseTeeRow = Database['public']['Tables']['course_tees']['Row']

function RoundRatingLine({
  round,
  tees,
}: {
  round: RoundRow
  tees: CourseTeeRow[]
}) {
  const teeColor = round.tee_color?.toLowerCase()
  const tee =
    tees.find((t) => t.id === round.course_tee_id) ??
    (teeColor ? tees.find((t) => t.tee_color === teeColor) : null) ??
    null
  const hasRating =
    tee && tee.course_rating != null && tee.slope_rating != null
  const diff = round.score_differential

  if (!tee && diff == null) return null

  return (
    <div
      className="font-mono uppercase tabular text-caddie-ink-mute"
      style={{
        fontSize: 10,
        letterSpacing: '0.14em',
        marginTop: 4,
      }}
    >
      {hasRating
        ? `Rating ${tee.course_rating?.toFixed(1)} · slope ${tee.slope_rating}`
        : tee
          ? 'No course rating on file'
          : 'Add course rating to calculate handicap differential'}
      {diff != null
        ? ` · diff ${diff >= 0 ? '+' : ''}${diff.toFixed(1)}`
        : ''}
    </div>
  )
}

function categorizeShot(
  s: {
    shot_number: number
    lie_type: string | null
    distance_to_target: number | null
  },
  par: number,
): ExistingShot['category'] {
  // Visual override: any tee-lie shot (incl. par 3) renders as a tee
  // marker even though SG-wise par 3 tee shots count as approach.
  if (s.lie_type === 'tee') return 'tee'
  const cat = getShotCategory(
    {
      lieType:
        (s.lie_type as
          | 'tee'
          | 'fairway'
          | 'rough'
          | 'sand'
          | 'fringe'
          | 'recovery'
          | 'green'
          | null) ?? undefined,
      distanceToTarget: s.distance_to_target ?? undefined,
    },
    par,
    s.shot_number,
  )
  if (cat === 'putting') return 'putt'
  if (cat === 'around_green') return 'around-green'
  if (cat === 'off_tee') return 'tee'
  return 'approach'
}
