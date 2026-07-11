import { useCallback, useEffect, useRef, type Dispatch, type RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@oga/supabase'
import { toBlob } from 'html-to-image'
import {
  combinedBreakDirection,
  combinedPuttResult,
  DEFAULT_HANDICAP,
  haversineYards,
  inferHoleStats,
  isPuttShot,
  NEAR_GREEN_YARDS,
} from '@oga/core'
import type { PlacedPoint } from '../../../components/round/RoundMap'
import type { ReviewedShotRow } from '../../../components/round/HoleReviewSheet'
import { useCreateShot, useUpdateShot } from '../../../hooks/useShots'
import { useUpsertHoleScore } from '../../../hooks/useHoleScores'
import { useCompleteRound } from '../../../hooks/useCompleteRound'
import { useDeleteRound } from '../../../hooks/useRounds'
import { useProfile } from '../../../hooks/useProfile'
import { supabase } from '../../../lib/supabase'
import { toUserMessage } from '../../../lib/errors'
import type { HoleViewAction } from '../state/holeViewReducer'
import type { UseRoundDataResult } from './useRoundData'

type HoleRow = Database['public']['Tables']['holes']['Row']

// Fraction of the start→pin line where a live-round shot's aim auto-spawns.
// Mirrors the mobile redesign (useHoleState `AIM_AUTOSPAWN_FRACTION`) so the
// aim line + carry/remaining readouts appear the moment a shot is placed —
// no extra tap. Past-round entry keeps the explicit "Set an aim point?" prompt.
const AIM_AUTOSPAWN_FRACTION = 0.65

// Last drag-edit on a saved shot. Surfaces the Undo button on the
// logged-hole strip for 5s after every drag, then clears itself.
// Holds the previous coords so the undo can restore them via the same
// mutation path the drag took. `field` is the column the drag
// touched ('start' = start_lat/lng + distance_to_target, 'aim' =
// aim_lat/lng).
export type ShotDragUndo = {
  shotId: string
  field: 'start' | 'aim'
  prev: {
    lat: number | null
    lng: number | null
    distanceToTarget?: number | null
  }
  label: string
}

interface UseRoundActionsInput {
  roundId: string | undefined
  user: User | null
  profile: ReturnType<typeof useProfile>
  data: UseRoundDataResult
  /** True when this session was opened as a live round (mode=live / the
   *  map view). Live entry auto-spawns the aim point; past-round review
   *  keeps the explicit aim prompt. Captured once at mount by the page. */
  isLiveEntry: boolean
  pinOverride: PlacedPoint | null
  teeOverride: PlacedPoint | null
  placedAims: (PlacedPoint | null)[]
  /** Parallel to placedAims — true while an aim is still the auto-spawned
   *  suggestion. Auto/untouched aims are NOT persisted on save. */
  placedAimAuto: boolean[]
  shotDragUndo: ShotDragUndo | null
  shareCardRef: RefObject<HTMLDivElement | null>
  sharing: boolean
  shareTone: 'light' | 'dark'
  dispatchHoleView: Dispatch<HoleViewAction>
  setShotDragUndo: (u: ShotDragUndo | null) => void
  setSavingHole: (b: boolean) => void
  setConfirmDelete: (b: boolean) => void
  setCompleteError: (s: string | null) => void
  setSharing: (b: boolean) => void
  setOnGreenPrompt: (p: PlacedPoint | null) => void
  setAimPromptOpen: (b: boolean) => void
}

export interface UseRoundActionsResult {
  ensureRealHole: (hole: HoleRow) => Promise<string>
  persistRoundPin: (point: PlacedPoint) => Promise<void>
  placeHandlers: {
    onPlace: (p: PlacedPoint) => void
    /** Push a confirmed non-putt shot (used by the on-green "No" branch)
     *  through the same auto-spawn / aim-prompt path as a fresh tap. */
    onConfirmNonPutt: (p: PlacedPoint) => void
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
  handleMoveExistingShot: (shotId: string, point: PlacedPoint) => Promise<void>
  handleMoveExistingShotAim: (shotId: string, point: PlacedPoint) => Promise<void>
  applyShotDragUndo: () => Promise<void>
  saveReviewedHole: (
    rows: ReviewedShotRow[],
    summary?: { score: number; putts: number; penalties: number },
  ) => Promise<void>
  handleDelete: () => Promise<void>
  handleComplete: () => Promise<void>
  handleShare: () => Promise<void>
  completeMutation: ReturnType<typeof useCompleteRound>
  deleteMutation: ReturnType<typeof useDeleteRound>
  upsertHoleScore: ReturnType<typeof useUpsertHoleScore>
  createShot: ReturnType<typeof useCreateShot>
  updateShot: ReturnType<typeof useUpdateShot>
}

export function useRoundActions(input: UseRoundActionsInput): UseRoundActionsResult {
  const {
    roundId,
    user,
    profile,
    data,
    isLiveEntry,
    pinOverride,
    teeOverride,
    placedAims,
    placedAimAuto,
    shotDragUndo,
    shareCardRef,
    sharing,
    shareTone,
    dispatchHoleView,
    setShotDragUndo,
    setSavingHole,
    setConfirmDelete,
    setCompleteError,
    setSharing,
    setOnGreenPrompt,
    setAimPromptOpen,
  } = input
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const upsertHoleScore = useUpsertHoleScore(roundId)
  const createShot = useCreateShot(roundId)
  const updateShot = useUpdateShot(roundId)
  const completeMutation = useCompleteRound()
  const deleteMutation = useDeleteRound()

  const {
    round,
    courseId,
    expectedHoleCount,
    activeHole,
    activeHoleScore,
    activeHoleShots,
    effectivePin,
    scoresByHoleId,
    shotsQuery,
  } = data

  // Materialize a synthetic hole into a real `holes` row before any
  // operation that writes to hole_scores. Synthetic ids (prefixed
  // 'synthetic-') come from the no-OSM-data fallback in the `holes`
  // memo; hole_scores.hole_id has a FK to holes.id, so without this an
  // upsert would fail.
  //
  // Routed through the `insert_synthetic_hole` RPC (migration 0026) —
  // the new holes INSERT policy disallows client-side inserts for
  // crawler-imported courses (`created_by IS NULL`), so this path goes
  // through a SECURITY DEFINER function that checks `auth.uid()` owns
  // the round before bypassing RLS. ON CONFLICT inside the RPC is
  // idempotent so concurrent calls converge on the same row.
  const ensureRealHole = useCallback(
    async (hole: HoleRow): Promise<string> => {
      if (!hole.id.startsWith('synthetic-')) return hole.id
      if (!roundId) throw new Error('roundId required to materialize hole')
      // supabase-js's generated types don't yet know about this RPC
      // (regen lands separately). Cast to the narrow shape we use here.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rpc = (supabase as any).rpc.bind(supabase) as (
        fn: 'insert_synthetic_hole',
        args: {
          p_course_id: string
          p_number: number
          p_par: number
          p_round_id: string
        },
      ) => Promise<{ data: string | null; error: { message: string } | null }>
      const { data: holeId, error } = await rpc('insert_synthetic_hole', {
        p_course_id: hole.course_id,
        p_number: hole.number,
        p_par: hole.par ?? 4,
        p_round_id: roundId,
      })
      if (error || !holeId) {
        throw new Error(error?.message ?? 'insert_synthetic_hole returned no id')
      }
      queryClient.invalidateQueries({ queryKey: ['holes', hole.course_id] })
      return holeId
    },
    [queryClient, roundId],
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
    [activeHoleScore, roundId, dispatchHoleView],
  )

  // Push a confirmed non-putt shot, then either auto-spawn its aim (live
  // entry) or prompt the player to set it (past-round review). The aim
  // seeds on the straight start→pin line so the aim path + carry/remaining
  // render immediately. SET_AIM targets the slot PUSH_POINT just appended
  // (`placedAims.length` before the push), so it always lands on the new
  // shot. Shared by onPlace and the on-green "No" branch.
  const pushShotWithAim = useCallback(
    (p: PlacedPoint) => {
      dispatchHoleView({ type: 'PUSH_POINT', point: p, openPuttSheet: false })
      if (isLiveEntry && effectivePin) {
        dispatchHoleView({
          type: 'SET_AIM',
          index: placedAims.length,
          point: {
            lat: p.lat + AIM_AUTOSPAWN_FRACTION * (effectivePin.lat - p.lat),
            lng: p.lng + AIM_AUTOSPAWN_FRACTION * (effectivePin.lng - p.lng),
          },
          // Visual suggestion only — flagged auto so it isn't persisted unless
          // the player drags/sets it (keeps inferred aims out of dispersion).
          auto: true,
        })
      } else {
        setAimPromptOpen(true)
      }
    },
    [isLiveEntry, effectivePin, placedAims.length, dispatchHoleView, setAimPromptOpen],
  )

  const placeHandlers = {
    onPlace: useCallback(
      (p: PlacedPoint) => {
        // Within ~30 yd of the pin, ask before opening the putting
        // sheet — the prior auto-switch was wrong on chips, bunkers,
        // and fringe lies, and forced the player to back out and re-
        // place to log a non-putt. The point goes into a holding cell
        // until the prompt resolves.
        const nearGreen =
          effectivePin != null &&
          haversineYards(p.lat, p.lng, effectivePin.lat, effectivePin.lng) <=
            NEAR_GREEN_YARDS
        if (nearGreen) {
          setOnGreenPrompt(p)
          return
        }
        pushShotWithAim(p)
      },
      [effectivePin, setOnGreenPrompt, pushShotWithAim],
    ),
    onConfirmNonPutt: pushShotWithAim,
    onMovePoint: useCallback(
      (idx: number, p: PlacedPoint) =>
        dispatchHoleView({ type: 'MOVE_POINT', index: idx, point: p }),
      [dispatchHoleView],
    ),
    onMovePin: useCallback(
      (p: PlacedPoint) => {
        void persistRoundPin(p)
      },
      [persistRoundPin],
    ),
    onMoveTee: useCallback(
      (p: PlacedPoint) =>
        dispatchHoleView({ type: 'TEE_OVERRIDE', point: p }),
      [dispatchHoleView],
    ),
    onClearPoints: useCallback(
      () => dispatchHoleView({ type: 'CLEAR_POINTS' }),
      [dispatchHoleView],
    ),
    onUndoPoint: useCallback(
      () => dispatchHoleView({ type: 'POP_POINT' }),
      [dispatchHoleView],
    ),
    onSetAim: useCallback(
      (idx: number, point: PlacedPoint | null) =>
        dispatchHoleView({ type: 'SET_AIM', index: idx, point }),
      [dispatchHoleView],
    ),
    onToggleAimMode: useCallback(
      (on: boolean) => dispatchHoleView({ type: 'AIM_MODE', on }),
      [dispatchHoleView],
    ),
    onStartPlaceTee: useCallback(
      () => dispatchHoleView({ type: 'PLACEMENT_MODE', mode: 'tee' }),
      [dispatchHoleView],
    ),
    onStartPlacePin: useCallback(
      () => dispatchHoleView({ type: 'PLACEMENT_MODE', mode: 'pin' }),
      [dispatchHoleView],
    ),
    onCancelPlacement: useCallback(
      () => dispatchHoleView({ type: 'PLACEMENT_MODE', mode: null }),
      [dispatchHoleView],
    ),
    onDoneWithHole: useCallback(
      () => dispatchHoleView({ type: 'OPEN_REVIEW' }),
      [dispatchHoleView],
    ),
    onDoneEditing: useCallback(() => {
      dispatchHoleView({ type: 'EDIT_ON_MAP', editing: false })
      dispatchHoleView({ type: 'OPEN_REVIEW' })
    }, [dispatchHoleView]),
  }

  // Drag end on a saved shot's start marker. Persists the new coord and
  // recalculates distance_to_target against the current pin (skipped for
  // putts — putt distance lives on putt_distance_ft and tracking start-
  // to-pin yardage there would corrupt it). Stashes prev coords for the
  // 5s undo button.
  const handleMoveExistingShot = useCallback(
    async (shotId: string, point: PlacedPoint) => {
      const shot = activeHoleShots.find((s) => s.id === shotId)
      if (!shot) return
      // distance_to_target lives on the raw row — pull it for the undo
      // snapshot. ExistingShot only exposes coords + numbering.
      const rawShot = (shotsQuery.data ?? []).find((s) => s.id === shotId)
      const isPutt = shot.category === 'putt'
      const newDistance =
        !isPutt && effectivePin
          ? Math.round(
              haversineYards(
                point.lat,
                point.lng,
                effectivePin.lat,
                effectivePin.lng,
              ),
            )
          : null
      // Stash prev for undo BEFORE the mutation — if the user immediately
      // drags again the second drag's prev should reflect the first
      // drag's end position, not what was on screen before either edit.
      setShotDragUndo({
        shotId,
        field: 'start',
        prev: {
          lat: shot.startLat,
          lng: shot.startLng,
          distanceToTarget: isPutt
            ? undefined
            : rawShot?.distance_to_target ?? null,
        },
        label: `Shot ${shot.shotNumber} position`,
      })
      try {
        await updateShot.mutateAsync({
          id: shotId,
          updates: {
            start_lat: point.lat,
            start_lng: point.lng,
            // Only rewrite distance when a pin actually resolves. Without
            // this guard, dragging a shot on an unmapped/pin-less hole wrote
            // distance_to_target: null and destroyed a previously valid
            // stored distance (#662).
            ...(!isPutt && effectivePin
              ? { distance_to_target: newDistance }
              : {}),
          },
        })
      } catch (err) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.error('[RoundDetailPage/moveExistingShot]', err)
        }
        setShotDragUndo(null)
      }
    },
    [activeHoleShots, shotsQuery.data, effectivePin, updateShot, setShotDragUndo],
  )

  const handleMoveExistingShotAim = useCallback(
    async (shotId: string, point: PlacedPoint) => {
      const shot = activeHoleShots.find((s) => s.id === shotId)
      if (!shot) return
      setShotDragUndo({
        shotId,
        field: 'aim',
        prev: {
          lat: shot.aimLat ?? null,
          lng: shot.aimLng ?? null,
        },
        label: `Shot ${shot.shotNumber} aim`,
      })
      try {
        await updateShot.mutateAsync({
          id: shotId,
          updates: { aim_lat: point.lat, aim_lng: point.lng },
        })
      } catch (err) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.error('[RoundDetailPage/moveExistingShotAim]', err)
        }
        setShotDragUndo(null)
      }
    },
    [activeHoleShots, updateShot, setShotDragUndo],
  )

  const applyShotDragUndo = useCallback(async () => {
    const u = shotDragUndo
    if (!u) return
    setShotDragUndo(null)
    try {
      if (u.field === 'start') {
        await updateShot.mutateAsync({
          id: u.shotId,
          updates: {
            start_lat: u.prev.lat,
            start_lng: u.prev.lng,
            ...(u.prev.distanceToTarget !== undefined
              ? { distance_to_target: u.prev.distanceToTarget }
              : {}),
          },
        })
      } else {
        await updateShot.mutateAsync({
          id: u.shotId,
          updates: { aim_lat: u.prev.lat, aim_lng: u.prev.lng },
        })
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('[RoundDetailPage/applyShotDragUndo]', err)
      }
    }
  }, [shotDragUndo, updateShot, setShotDragUndo])

  const handleDelete = useCallback(async () => {
    if (!round.data) return
    try {
      await deleteMutation.mutateAsync(round.data.id)
      setConfirmDelete(false)
      navigate('/rounds')
    } catch (err) {
      setCompleteError(toUserMessage(err))
      setConfirmDelete(false)
    }
  }, [round.data, deleteMutation, navigate, setConfirmDelete, setCompleteError])

  const handleComplete = useCallback(async () => {
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
  }, [round.data, courseId, user, profile.data?.handicap_index, completeMutation, setCompleteError])

  // Pre-rasterise the off-screen ShareableScorecardCard to a Blob so the
  // share handler can hand `navigator.share()` a ready file with NO
  // awaited work between the click and the share() call: the Web Share
  // API needs a live user-activation token, and an `await` inside the
  // click handler expires that token on iOS Safari. 2x pixel ratio keeps
  // it crisp on retina without ballooning the file for group-chat shares.
  const shareBlobRef = useRef<Blob | null>(null)
  useEffect(() => {
    const node = shareCardRef.current
    if (!node || !round.data) return
    let cancelled = false
    toBlob(node, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: shareTone === 'dark' ? '#1C211C' : '#FBF8F1',
    })
      .then((blob) => {
        if (!cancelled) shareBlobRef.current = blob
      })
      .catch(() => {
        if (!cancelled) shareBlobRef.current = null
      })
    return () => {
      cancelled = true
    }
  }, [round.data, shareTone])

  // Open the native share sheet (Web Share API) with the scorecard PNG,
  // falling back to a download where file-sharing isn't supported (most
  // desktop Firefox, older browsers) or if share() fails for any reason
  // other than the user dismissing the sheet.
  const handleShare = useCallback(async () => {
    if (sharing) return
    setSharing(true)
    try {
      const courseSlug = (round.data?.courses?.name ?? 'round')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
      const date = round.data?.played_at ?? 'unknown-date'
      const filename = `${courseSlug}-${date}-scorecard.png`

      // Prefer the pre-captured Blob (keeps the gesture token alive). Only
      // fall back to a fresh capture if the effect hasn't produced one yet.
      let blob = shareBlobRef.current
      if (!blob && shareCardRef.current) {
        blob = await toBlob(shareCardRef.current, {
          pixelRatio: 2,
          cacheBust: true,
          backgroundColor: shareTone === 'dark' ? '#1C211C' : '#FBF8F1',
        })
      }
      // toBlob resolves null (rather than throwing) when rasterisation
      // fails — surface it through the same path as other share errors
      // instead of a silent no-op.
      if (!blob) throw new Error('Could not render the scorecard image.')

      const file = new File([blob], filename, { type: 'image/png' })
      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'OGA Scorecard' })
          return
        } catch (err) {
          // User dismissed the sheet — not an error worth surfacing.
          if ((err as Error).name === 'AbortError') return
          // Any other share failure → fall through to the download path.
        }
      }

      // Download fallback. Build the object URL from the same Blob and
      // revoke it once the download has had a tick to start.
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setCompleteError(toUserMessage(err))
    } finally {
      setSharing(false)
    }
  }, [shareCardRef, sharing, shareTone, round.data, setSharing, setCompleteError])

  const saveReviewedHole = useCallback(
    async (
      rows: ReviewedShotRow[],
      summary?: { score: number; putts: number; penalties: number },
    ) => {
      if (!user || !activeHole || !round.data) return
      setSavingHole(true)
      dispatchHoleView({ type: 'SAVE_ERROR', message: null })
      try {
        // Ensure a hole_score row exists; the score equals the placed
        // shot count, which is what the player just confirmed. Putts is
        // derived from the rows so the scorecard reflects what was placed
        // without needing a manual entry.
        const existing = scoresByHoleId.get(activeHole.id)
        // Match HoleReviewSheet's isPutt — putt-ness is the green lie (set
        // when a putt is placed), never club or raw distance (a near-green
        // chip isn't a putt; unmapped rows read 0).
        const puttCount = rows.filter((r) => isPuttShot(r.lieType)).length
        // Materialize the synthetic hole if needed before upserting the
        // hole_score (FK to holes.id). The RPC inserts only (course_id,
        // number, par, stroke_index) — per-round tee/pin overrides
        // continue to live on hole_scores.pin_lat/lng (the round-pin
        // path). Course-level tee/pin seeding from the review save was
        // dropped in #220; track re-adding via a separate "course
        // curation from completed rounds" issue.
        const realHoleId = await ensureRealHole(activeHole)
        // Infer fairway_hit + gir from the placed shot lies. Existing
        // manual entries from HoleScoreCard win via the ?? — re-saving
        // the map review never silently overwrites a value the player
        // explicitly toggled on the scorecard.
        // holedOut=true: this flow is holed-out by construction — the final
        // marker's end is the pin and `score: rows.length` below asserts the
        // placed shots ARE the whole hole. Lets aces / holed approaches count
        // as GIR (#669).
        const inferred = inferHoleStats(
          rows.map((r) => ({
            shot_number: r.shotNumber,
            lie_type: r.lieType,
          })),
          activeHole.par,
          true,
        )
        const hsResult = await upsertHoleScore.mutateAsync({
          id: existing?.id,
          round_id: round.data.id,
          hole_id: realHoleId,
          score: summary?.score ?? rows.length,
          putts: summary?.putts ?? puttCount,
          penalties: summary?.penalties ?? 0,
          fairway_hit: existing?.fairway_hit ?? inferred.fairway,
          gir: existing?.gir ?? inferred.gir,
          // Persist a manually placed pin. On unmapped courses no hole_scores
          // row exists until this upsert, so persistRoundPin's update no-ops
          // and the pin lived only in pinOverride state — lost on reload and
          // then nulling shot distances on drag (#662). This is the write.
          ...(pinOverride
            ? { pin_lat: pinOverride.lat, pin_lng: pinOverride.lng }
            : {}),
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
          const isPuttRow = isPuttShot(row.lieType)
          // Persist the aim only if the player actually set/dragged it — an
          // untouched auto-spawn suggestion is dropped so it can't enter the
          // dispersion dataset (aim must be explicit to count).
          const aimIdx = row.shotNumber - 1
          const aim = placedAimAuto[aimIdx] ? null : placedAims[aimIdx] ?? null
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
            lie_slope_forward: isPuttRow ? null : row.lieSlopeForward ?? null,
            lie_slope_side: isPuttRow ? null : row.lieSlopeSide ?? null,
            shot_result: isPuttRow ? null : row.shotResult ?? null,
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
            // Green read — persisted regardless of make/miss. Mirrors the
            // ShotEntryModal (past-round) writer so both surfaces store the
            // same columns. aim_offset_yards = inches / 36 (1dp).
            putt_slope_pct: isPuttRow ? row.puttSlopePct ?? null : null,
            green_speed: isPuttRow ? row.greenSpeed ?? null : null,
            break_direction: isPuttRow
              ? combinedBreakDirection({
                  vertical: row.breakDirectionVertical,
                  horizontal: row.breakDirectionHorizontal,
                })
              : null,
            break_direction_vertical: isPuttRow
              ? row.breakDirectionVertical ?? null
              : null,
            break_direction_horizontal: isPuttRow
              ? row.breakDirectionHorizontal ?? null
              : null,
            aim_offset_yards:
              isPuttRow && row.aimOffsetInches != null
                ? Math.round((row.aimOffsetInches / 36) * 10) / 10
                : null,
            notes: row.notes ?? null,
          })
        }
        // Cap auto-advance to the course's expected hole count — passing
        // null on the last hole keeps the player put with a cleared state.
        const nextHole =
          activeHole.number + 1 <= expectedHoleCount
            ? activeHole.number + 1
            : null
        dispatchHoleView({ type: 'AFTER_SAVE', nextHoleNumber: nextHole })
      } catch (err) {
        dispatchHoleView({ type: 'SAVE_ERROR', message: toUserMessage(err) })
      } finally {
        setSavingHole(false)
      }
    },
    [
      user,
      activeHole,
      round.data,
      scoresByHoleId,
      ensureRealHole,
      teeOverride,
      pinOverride,
      placedAims,
      placedAimAuto,
      expectedHoleCount,
      upsertHoleScore,
      createShot,
      dispatchHoleView,
      setSavingHole,
    ],
  )

  return {
    ensureRealHole,
    persistRoundPin,
    placeHandlers,
    handleMoveExistingShot,
    handleMoveExistingShotAim,
    applyShotDragUndo,
    saveReviewedHole,
    handleDelete,
    handleComplete,
    handleShare,
    completeMutation,
    deleteMutation,
    upsertHoleScore,
    createShot,
    updateShot,
  }
}
