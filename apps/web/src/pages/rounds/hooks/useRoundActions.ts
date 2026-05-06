import { useCallback, type Dispatch, type RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@oga/supabase'
import { toPng } from 'html-to-image'
import {
  combinedPuttResult,
  DEFAULT_HANDICAP,
  haversineYards,
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

interface EnsureRealHoleOpts {
  teeLat?: number | null
  teeLng?: number | null
  pinLat?: number | null
  pinLng?: number | null
}

interface UseRoundActionsInput {
  roundId: string | undefined
  user: User | null
  profile: ReturnType<typeof useProfile>
  data: UseRoundDataResult
  pinOverride: PlacedPoint | null
  teeOverride: PlacedPoint | null
  placedAims: (PlacedPoint | null)[]
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
  ensureRealHole: (hole: HoleRow, opts?: EnsureRealHoleOpts) => Promise<string>
  persistRoundPin: (point: PlacedPoint) => Promise<void>
  placeHandlers: {
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
  handleMoveExistingShot: (shotId: string, point: PlacedPoint) => Promise<void>
  handleMoveExistingShotAim: (shotId: string, point: PlacedPoint) => Promise<void>
  applyShotDragUndo: () => Promise<void>
  saveReviewedHole: (rows: ReviewedShotRow[]) => Promise<void>
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
    pinOverride,
    teeOverride,
    placedAims,
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
  // memo above; hole_scores.hole_id has a FK to holes.id, so without
  // this an upsert would fail. On insert, invalidate the holes query
  // so the synthetic placeholder gets replaced with the real row on
  // the next read. On unique-violation (course_id,number race), look
  // up the existing row instead of clobbering it.
  const ensureRealHole = useCallback(
    async (hole: HoleRow, opts?: EnsureRealHoleOpts): Promise<string> => {
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
    [activeHoleScore, roundId, dispatchHoleView],
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
        dispatchHoleView({
          type: 'PUSH_POINT',
          point: p,
          openPuttSheet: false,
        })
        setAimPromptOpen(true)
      },
      [effectivePin, dispatchHoleView, setOnGreenPrompt, setAimPromptOpen],
    ),
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
            ...(isPutt ? {} : { distance_to_target: newDistance }),
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

  // Capture the off-screen ShareableScorecardCard via html-to-image and
  // trigger a browser download. The card is rendered absolutely-
  // positioned far off the left edge so the user never sees it; it
  // exists only to hand a real DOM node to the rasteriser. 2x pixel
  // ratio gives crisp output on retina screens without ballooning the
  // file size for group-chat shares.
  const handleShare = useCallback(async () => {
    if (!shareCardRef.current || sharing) return
    setSharing(true)
    try {
      const dataUrl = await toPng(shareCardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: shareTone === 'dark' ? '#1C211C' : '#FBF8F1',
      })
      const courseSlug = (round.data?.courses?.name ?? 'round')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
      const date = round.data?.played_at ?? 'unknown-date'
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `${courseSlug}-${date}-scorecard.png`
      link.click()
    } catch (err) {
      setCompleteError(toUserMessage(err))
    } finally {
      setSharing(false)
    }
  }, [shareCardRef, sharing, shareTone, round.data, setSharing, setCompleteError])

  const saveReviewedHole = useCallback(
    async (rows: ReviewedShotRow[]) => {
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
