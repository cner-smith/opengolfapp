import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { Alert } from 'react-native'
import { uuid } from 'expo-modules-core'
import type { User } from '@supabase/supabase-js'
import {
  combinedBreakDirection,
  combinedPuttResult,
  isPuttShot,
  type CaptureMode,
} from '@oga/core'
import { supabase } from '../../../lib/supabase'
import {
  enqueueHoleScorePatch,
  insertPendingShot,
  setPendingShotEnd,
  type ShotPayload,
} from '../../../lib/db'
import { syncPendingShots } from '../../../lib/sync'
import { distanceYards } from '../../../lib/maps'
import type { LatLng } from '../HoleMap'
import { PUTTING_RADIUS_YARDS, type ActiveDialog, type PuttingValue, type ShotLoggerValue } from './types'
import type { UseHoleDataResult } from './useHoleData'
import type { UseHoleStateResult } from './useHoleState'
import { writeHoleSummary, type ReviewedRowWithId } from './saveHoleSummary'
import { useRoundEnd, type UseRoundEndResult } from './useRoundEnd'
import { useShotEdits, type UseShotEditsResult } from './useShotEdits'

interface UseShotActionsInput {
  id: string | undefined
  user: User | null
  holeNumber: number
  // Live capture mode (rounds.capture_mode). In 'just_track', markBallHere
  // saves the location immediately and never enters SET_AIM; 'track_patterns'
  // keeps the aim step.
  captureMode: CaptureMode
  data: UseHoleDataResult
  state: UseHoleStateResult
  // Component-level UI state setters.
  setPinPlacementOpen: Dispatch<SetStateAction<boolean>>
  setActiveDialog: Dispatch<SetStateAction<ActiveDialog>>
  // The component's manual ball-placement path — the very handler a map
  // drag/tap goes through (freezes GPS tracking for this PLACE_BALL cycle,
  // re-anchors the Kalman filter, flips the CTA off its "at my GPS"
  // labelling). Passed in rather than reimplemented here because part of
  // that state (ballMoved) lives in LiveRoundSession. markLastShotOb uses
  // it to drop the ball back on the OB shot's origin.
  placeBallManually: (loc: LatLng) => void
  // Hole navigation is callback-driven so the parent (LiveRoundSession)
  // can keep the MapView resident across hole changes. Direct router.replace
  // would fully unmount + remount the screen — see #264.
  onHoleChange: (next: number) => void
  // Fires ONLY on a genuine finish-advance (advanceAfterHole — a hole was
  // completed/skipped and the round moves to the next one), never on a
  // peek/jump (navigateHole / scorecard hole-jump both go through
  // `onHoleChange` above, not this). LiveRoundSession uses this to ratchet
  // its `furthestHoleReached` high-water mark — the played-hole edit-mode
  // predicate's "active capture hole" signal (fix round 2, C1 residual):
  // only a real finish should ever make a hole editable, not a peek ahead.
  // `rewind` sets the mark TO `next` instead of ratcheting it (#940: going
  // back to an unfinished hole must open it for live capture, not edit mode).
  onAdvanceHole: (next: number, rewind?: boolean) => void
  // The round was just finalized (End early / last hole). The host swaps to
  // the completed-round summary. Not a router.replace: the host is that same
  // route, and a replace onto it is a tab JUMP_TO that keeps the mounted
  // screen, so the live session stayed up on a completed round (#909).
  onRoundCompleted: () => void
}

export interface UseShotActionsResult extends UseShotEditsResult, UseRoundEndResult {
  saving: boolean
  persistShot: (meta: ShotLoggerValue | null) => Promise<void>
  persistPutt: (v: PuttingValue) => Promise<void>
  persistRoundPin: (loc: LatLng) => Promise<void>
  clearRoundPin: () => Promise<void>
  markBallHere: (opts?: { toGreen?: boolean }) => Promise<void>
  notOnGreen: () => void
  confirmAim: () => void
  skipAim: () => void
  navigateHole: (delta: number) => void
  finishHole: () => void
  continueToHole: (n: number) => void
  unfinishedOthers: number[]
  finishesRound: boolean
  // End-of-hole review save: attach the confirmed metadata to every shot
  // logged live on this hole, write the hole_scores tallies, then advance.
  saveHoleSummary: (
    rows: ReviewedRowWithId[],
    summary: { score: number; putts: number; penalties: number },
  ) => Promise<void>
  // Dismiss the summary back to the live map so the player can fix ball
  // positions (add / re-place a shot) before reopening the review.
  editHoleOnMap: () => void
}

export function useShotActions(input: UseShotActionsInput): UseShotActionsResult {
  const {
    id,
    user,
    holeNumber,
    captureMode,
    data,
    state,
    setPinPlacementOpen,
    setActiveDialog,
    placeBallManually,
    onHoleChange,
    onAdvanceHole,
    onRoundCompleted,
  } = input
  const [saving, setSaving] = useState(false)
  // Ref-based in-flight gate. The `saving` state setter is async, so
  // a fast double-tap on the Save button can fire `persistShot` twice
  // before React commits the next render — both calls see `saving`
  // === false. The ref flips synchronously and blocks the second call.
  const persistShotInFlightRef = useRef(false)
  const edits = useShotEdits({ user, data, placeBallManually })
  const { shotObs } = edits
  const roundEnd = useRoundEnd({ user, round: data.round, setActiveDialog, onRoundCompleted })
  const { handleEndRound } = roundEnd

  const {
    round,
    currentHole,
    currentHoleScore,
    setHoles,
    setHoleScores,
    setPendingForHole,
    pendingForHole,
    storedPin,
    roundPin,
    remotePuttCount,
    localPuttCount,
    previousShots,
    previousShotIds,
    previousShotObs,
    shotNumber,
    holeCount,
    effectiveHoles,
    holeScores,
  } = data
  // Holes other than this one not yet finished (#940), by the one-way
  // finished_at mark (#902). A hole with no score row counts as unfinished.
  const unfinishedOthers = useMemo(() => {
    const finished = new Set(holeScores.filter((s) => s.finished_at).map((s) => s.hole_id))
    return effectiveHoles
      .filter((h) => h.number !== holeNumber && !finished.has(h.id))
      .map((h) => h.number)
      .sort((a, b) => a - b)
  }, [effectiveHoles, holeScores, holeNumber])
  const nextUnfinished = unfinishedOthers.find((n) => n > holeNumber)
  // Penalty strokes already recorded on THIS hole (scoped to one
  // hole_score_id — never round-wide). A stroke-and-distance OB has no shot
  // row of its own, so anywhere a struck-row count becomes hole_scores.score
  // has to add these back or the OB chip's bump is silently reverted (#839).
  const holeObStrokes = shotObs.filter(Boolean).length
  // Guards a double-fire of the end-of-hole save the same way persistShot
  // guards its own — the `saving` state setter commits a tick late.
  const saveSummaryInFlightRef = useRef(false)
  const {
    ball,
    setBall,
    aim,
    aimTouched,
    setAim,
    setAimTouched,
    setRoundState,
    manuallyPlacedRef,
    lastSavedShotLocalIdRef,
    gpsPosition,
    gpsFixAtRef,
    setAppendEngaged,
  } = state

  function buildPayload(
    meta: ShotLoggerValue | null,
    opts?: { forceAim?: boolean; ball?: LatLng },
  ): ShotPayload | null {
    // `ball` state is set async, so a caller that just placed the ball (e.g.
    // markBallHere in just-track mode) passes it explicitly to avoid reading
    // the pre-update value out of the closure.
    const effectiveBall = opts?.ball ?? ball
    if (!user || !currentHoleScore || !effectiveBall) return null
    const isPutt = isPuttShot(meta?.lieType)
    const pinTarget = roundPin ?? storedPin ?? null
    // Confirm-aim forces persist (the player accepted even an unadjusted
    // auto-spawn); skip-aim forces drop; anything else falls back to the
    // touched flag. `false ?? x === false`, so an explicit false wins.
    const persistAim = opts?.forceAim ?? aimTouched
    return {
      hole_score_id: currentHoleScore.id,
      user_id: user.id,
      shot_number: shotNumber,
      start_lat: effectiveBall.lat,
      start_lng: effectiveBall.lng,
      end_lat: null,
      end_lng: null,
      // Putts leave this null to match the web save path — a putt's
      // "distance to target" is putt_distance_ft, not this column.
      distance_to_target:
        !isPutt && pinTarget
          ? Math.round(distanceYards(effectiveBall, pinTarget))
          : null,
      // Persist aim only if the player set/dragged it (or explicitly confirmed);
      // an untouched auto-spawn suggestion is dropped so it can't enter the
      // dispersion dataset.
      aim_lat: persistAim ? aim?.lat ?? null : null,
      aim_lng: persistAim ? aim?.lng ?? null : null,
      club: meta?.club ?? null,
      lie_type: meta?.lieType ?? null,
      lie_slope: null,
      lie_slope_forward: meta?.lieSlopeForward ?? null,
      lie_slope_side: meta?.lieSlopeSide ?? null,
      shot_result: meta?.shotResult ?? null,
      penalty: meta?.shotResult === 'penalty',
      ob: meta?.shotResult === 'ob',
      // numeric(4,1): a "putt" from 333+ yd (On the green tapped off the green)
      // overflows, and the queue quarantines the shot (#994). Drop the length.
      putt_distance_ft: (meta?.puttDistanceFt ?? 0) > 999.9 ? null : meta?.puttDistanceFt ?? null,
      putt_result: combinedPuttResult({
        made: meta?.puttMade,
        distance: meta?.puttDistanceResult ?? null,
        direction: meta?.puttDirectionResult ?? null,
      }),
      putt_distance_result: meta?.puttMade
        ? null
        : meta?.puttDistanceResult ?? null,
      putt_direction_result: meta?.puttMade
        ? null
        : meta?.puttDirectionResult ?? null,
      putt_slope_pct: meta?.puttSlopePct ?? null,
      green_speed: meta?.greenSpeed ?? null,
      break_direction: combinedBreakDirection({
        vertical: meta?.breakDirectionVertical,
        horizontal: meta?.breakDirectionHorizontal,
      }),
      break_direction_vertical: meta?.breakDirectionVertical ?? null,
      break_direction_horizontal: meta?.breakDirectionHorizontal ?? null,
      aim_offset_yards:
        meta?.aimOffsetInches != null
          ? Math.round((meta.aimOffsetInches / 36) * 10) / 10
          : null,
      notes: meta?.notes ?? null,
    }
  }

  async function persistShot(
    meta: ShotLoggerValue | null,
    opts?: { forceAim?: boolean; ball?: LatLng },
  ) {
    if (persistShotInFlightRef.current) return
    const base = buildPayload(meta, opts)
    if (!base) return
    // Stamp the client id up front so the optimistic pending entry below carries
    // the SAME id that insertPendingShot persists to SQLite. Without it, the
    // in-memory payload has no `id`, so previousShotIds skips this shot (its
    // `&& p.id` guard) while previousShots keeps it — misaligning the summary's
    // row→shot map and leaving the delete affordance disabled until a refetch.
    const payload = base.id ? base : { ...base, id: uuid.v4() }
    persistShotInFlightRef.current = true
    setSaving(true)
    try {
      const localId = await insertPendingShot(payload)
      lastSavedShotLocalIdRef.current = localId
      const isPutt = isPuttShot(payload.lie_type)
      setPendingForHole((prev) => [
        ...prev,
        {
          local_id: localId,
          remote_id: null,
          status: 'pending',
          payload: JSON.stringify(payload),
          created_at: Date.now(),
        },
      ])
      setAim(null)
      setRoundState('PLACE_BALL')
      const newPutts = remotePuttCount + localPuttCount + (isPutt ? 1 : 0)
      // score = struck rows + penalty strokes. `shotNumber` IS the struck
      // count once this row lands, so without the OB term the very next shot
      // overwrites the chip's bump with the raw count. `payload.ob` covers
      // this row itself being saved OB — it isn't in shotObs yet, which is
      // built from the already-stored rows. Applied exactly once per save:
      // the score is written absolutely, never incremented.
      const newScore = shotNumber + holeObStrokes + (payload.ob ? 1 : 0)
      // Queued, not written directly, so an offline stretch can't lose it
      // (#226). Awaited before the sync kick so this run's drain picks it up —
      // a completeRound joining that run would otherwise finalize without it.
      if (currentHoleScore) {
        await enqueueHoleScorePatch(currentHoleScore, {
          score: newScore,
          putts: newPutts,
        }).catch(() => undefined)
      }
      // Background sync — don't await.
      syncPendingShots().catch(() => undefined)
      setHoleScores((prev) =>
        prev.map((hs) =>
          hs.id === payload.hole_score_id
            ? { ...hs, score: newScore, putts: newPutts }
            : hs,
        ),
      )
      // First shot on a hole with no course tee → the drive's start IS the
      // tee. Persist it so the tee box, camera, and distances have an anchor
      // (mapped holes keep their stored course tee). Background, not awaited.
      if (
        shotNumber === 1 &&
        currentHole &&
        currentHole.tee_lat == null &&
        payload.start_lat != null &&
        payload.start_lng != null
      ) {
        void writeTee({ lat: payload.start_lat, lng: payload.start_lng })
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('shot save failed', err, payload)
      Alert.alert('Save failed', (err as Error).message)
    } finally {
      persistShotInFlightRef.current = false
      setSaving(false)
    }
  }

  async function persistPutt(v: PuttingValue) {
    const meta: ShotLoggerValue = {
      club: 'putter',
      lieType: 'green',
      puttMade: v.puttMade,
      puttDistanceResult: v.puttDistanceResult,
      puttDirectionResult: v.puttDirectionResult,
      puttDistanceFt: v.puttDistanceFt,
      puttSlopePct: v.puttSlopePct,
      greenSpeed: v.greenSpeed,
      breakDirectionVertical: v.breakDirectionVertical,
      breakDirectionHorizontal: v.breakDirectionHorizontal,
      aimOffsetInches: v.aimOffsetInches,
      notes: v.notes,
    }
    await persistShot(meta)
    // Made IS the hole-out (#791 step 4): the putt that drops ends the hole,
    // so go straight to the end-of-hole summary rather than back to PLACE_BALL.
    // A miss falls through — persistShot already returned to PLACE_BALL for the
    // next putt. The "On the green" chip is gated on totalShotsThisHole > 0
    // (MapBottomChrome), so a putt is never the hole's first shot: previousShots
    // is ≥1 here and finishHole opens the summary, never the empty-hole advance.
    if (v.puttMade === true) finishHole()
  }

  async function persistRoundPin(loc: LatLng) {
    if (!currentHoleScore) return
    if (!Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return
    setHoleScores((prev) =>
      prev.map((hs) =>
        hs.id === currentHoleScore.id
          ? { ...hs, pin_lat: loc.lat, pin_lng: loc.lng }
          : hs,
      ),
    )
    setPinPlacementOpen(false)
    await enqueueHoleScorePatch(currentHoleScore, { pin_lat: loc.lat, pin_lng: loc.lng })
    syncPendingShots().catch(() => undefined)
  }

  async function clearRoundPin() {
    if (!currentHoleScore) return
    setHoleScores((prev) =>
      prev.map((hs) =>
        hs.id === currentHoleScore.id
          ? { ...hs, pin_lat: null, pin_lng: null }
          : hs,
      ),
    )
    setPinPlacementOpen(false)
    await enqueueHoleScorePatch(currentHoleScore, { pin_lat: null, pin_lng: null })
    syncPendingShots().catch(() => undefined)
  }

  // Auto-persist the tee = the first shot's start (the drive's starting point),
  // the live analogue of past-round deriving the tee from placed[0].start.
  // Called from persistShot on shot 1 only when the hole has no course tee, so
  // the dual-dot tee box + camera + distances (all keyed on holes.tee_lat/lng)
  // light up without a manual placement step. Background + non-blocking: the
  // shot already saved, so a failure warns rather than alerting.
  async function writeTee(loc: LatLng) {
    if (!currentHole || !id) return
    if (!Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return
    setHoles((prev) =>
      prev.map((h) =>
        h.id === currentHole.id
          ? { ...h, tee_lat: loc.lat, tee_lng: loc.lng }
          : h,
      ),
    )
    // `holes` has no UPDATE RLS policy — a direct .update() filters to
    // 0 rows and reports success (#710) — so the write goes through the
    // authorized RPC, scoped to this round. Still background enrichment:
    // the shot already saved, so a failure warns rather than alerting.
    const { error: updateErr } = await supabase.rpc('update_hole_tee', {
      p_hole_id: currentHole.id,
      p_round_id: id,
      p_tee_lat: loc.lat,
      p_tee_lng: loc.lng,
    })
    if (updateErr) {
      // eslint-disable-next-line no-console
      console.warn('[hole/tee-auto-persist]', updateErr.message)
    }
  }

  async function markBallHere(opts?: { toGreen?: boolean }) {
    // Use the dragged ball if the player set one, otherwise fall back to
    // raw GPS — "Mark ball here" should always work as long as we know
    // where the player is, even if they haven't tapped the map to drop
    // a marker first.
    const source = ball ?? gpsPosition
    // Stale-fix guard (#720): the last-known seed and the listener's cache
    // replay populate gpsPosition with no freshness gate (only the
    // ball/Kalman path has one), so after a pocketed walk to a new hole the
    // fallback can be a fix from hundreds of meters back. Decline anything
    // older than 30 s rather than persist it as a durable shot coordinate —
    // same recovery as no fix at all.
    const gpsStale =
      ball == null && Date.now() - gpsFixAtRef.current > 30_000
    if (!source || gpsStale) {
      Alert.alert(
        'No GPS yet',
        'Waiting for a location fix — try again in a moment, or tap the map to drop the ball manually.',
      )
      return
    }
    // NaN guard (#275). gpsPosition is the fallback when the player
    // hasn't dragged a ball yet, and a corrupt GPS reading that slipped
    // past upstream guards would otherwise propagate to setPendingShotEnd
    // (NaN → SQLite → Postgres rejects on sync) and setBall (NaN
    // poisons the next persistShot's start_lat).
    if (!Number.isFinite(source.lat) || !Number.isFinite(source.lng)) {
      // eslint-disable-next-line no-console
      console.warn('[hole/markBallHere] non-finite source coord', source)
      Alert.alert(
        'GPS reading invalid',
        'The location fix came back malformed. Try again, or tap the map to drop the ball manually.',
      )
      return
    }
    const ballSnapshot = { lat: source.lat, lng: source.lng }
    // Marking a ball IS engaging the live append flow for this hole visit —
    // keeps the aids on across the natural shot-to-shot loop even after the
    // hole gains prior shots (otherwise shot 2+ on a hole would read as a
    // revisit and suppress). See #484.
    setAppendEngaged(true)
    manuallyPlacedRef.current = true
    const prevLocalId = lastSavedShotLocalIdRef.current
    if (prevLocalId != null) {
      const result = await setPendingShotEnd(
        prevLocalId,
        ballSnapshot.lat,
        ballSnapshot.lng,
      ).catch(() => null)
      if (result?.status === 'synced' && result.remote_id) {
        supabase
          .from('shots')
          .update({ end_lat: ballSnapshot.lat, end_lng: ballSnapshot.lng })
          .eq('id', result.remote_id)
          .then(({ error }) => {
            if (error) {
              // eslint-disable-next-line no-console
              console.warn('[hole/end-coord-patch]', error.message)
            }
          })
      }
      lastSavedShotLocalIdRef.current = null
    }
    setBall(ballSnapshot)
    setAim(null)
    // On-green auto-detect, restored from pre-#791 (b0f123b removed it when
    // the on-green flow moved behind the explicit "⛳ On the green" chip):
    // a ball marked within PUTTING_RADIUS_YARDS of the pin enters the
    // putting flow on its own, same as if the player had tapped the chip.
    // The chip (opts?.toGreen) stays as the fallback for when there's no pin
    // yet or the auto-detect misses.
    const pinTarget = roundPin ?? storedPin ?? null
    // Never auto-enter putting on the hole's FIRST shot — you can't putt a tee
    // shot. A par-3 / drivable tee shot landing within PUTTING_RADIUS_YARDS
    // would otherwise pop Made/Missed and let one tap record a phantom ace.
    // Mirrors the "⛳ On the green" chip's own `totalShotsThisHole > 0` gate
    // (MapBottomChrome); the explicit chip (opts.toGreen) is already gated there.
    // Only auto-force the overlay in track_patterns. just_track's contract is
    // "save the location, never prompt" — auto-popping Made/Missed there breaks
    // it. The explicit "⛳ On the green" chip (opts.toGreen) still works in
    // either mode for a just_track player who wants to log the putt.
    const autoGreen =
      captureMode === 'track_patterns' &&
      previousShots.length > 0 &&
      pinTarget != null &&
      distanceYards(ballSnapshot, pinTarget) <= PUTTING_RADIUS_YARDS
    // On the green (#791 step 4 rework): the marked ball is the putt's start.
    // Skip aiming entirely — Made/Missed is the action (dock keys, not a
    // modal). persistPutt writes the putt; the detailed read lives in the
    // end-of-hole summary. Overrides capture mode (a putt is a putt in
    // either mode).
    if (opts?.toGreen || autoGreen) {
      setRoundState('PUTTING')
      return
    }
    // Just-track mode (#791 step 3): no aim step. Save the location right away
    // — passing the fresh ball since setBall hasn't committed — and persistShot
    // loops back to PLACE_BALL for the next ball. Putt-ness / club / lie are
    // still decided at the end-of-hole review.
    if (captureMode === 'just_track') {
      await persistShot(null, { forceAim: false, ball: ballSnapshot })
      return
    }
    // Track-patterns mode: every shot goes into aiming — the on-green "are you
    // putting?" prompt was dropped (#791). During play a putt is just another
    // location; whether it WAS a putt is decided at the end-of-hole review from
    // the ball's position (green lie → putter), where the break / speed / aimer
    // now live. The aim line auto-spawns to the pin (useHoleState) with a
    // draggable midpoint; "Skip aim" stays in the SET_AIM chrome for a tap-in
    // the player won't bother aiming.
    setRoundState('SET_AIM')
  }

  // Escape from the on-green Made/Missed overlays (#791 step 4 rework): the
  // ball marked into PUTTING wasn't actually on the green after all.
  function notOnGreen() {
    // just_track never enters aiming — mirror markBallHere's just_track path:
    // save the already-marked ball's location and loop back to PLACE_BALL,
    // rather than stranding the player in a SET_AIM chrome their mode never
    // shows. track_patterns re-routes the ball into the normal aim flow.
    if (captureMode === 'just_track') {
      void persistShot(null, { forceAim: false })
      return
    }
    setRoundState('SET_AIM')
  }

  function confirmAim() {
    // Location-now, details-at-EOH (#791): confirming the aim saves the shot
    // as a location (+ this accepted aim) and loops straight back to placing
    // the next ball. forceAim:true persists even an unadjusted
    // auto-spawn, since the player explicitly accepted it. persistShot clears
    // the aim and returns to PLACE_BALL. Club / lie / result are captured in
    // the end-of-hole review.
    void persistShot(null, { forceAim: true })
  }

  function skipAim() {
    // Same location-only save, minus the aim — a tap-in or a shot the player
    // won't bother aiming. forceAim:false drops the auto-spawn suggestion so it
    // can't enter the dispersion dataset.
    void persistShot(null, { forceAim: false })
  }

  function navigateHole(delta: number) {
    const next = holeNumber + delta
    // Bound by the round's actual hole count, not a hardcoded 18 — a
    // 9-hole course must stop at 9 or the player lands on padded holes
    // with no hole_scores (#525).
    if (next < 1 || next > holeCount) return
    onHoleChange(next)
  }

  function finishHole() {
    // Nothing placed on this hole → nothing to review; advance straight on
    // (a skipped / walked hole). Otherwise open the end-of-hole review so the
    // player confirms each shot's details before moving on (#791).
    if (previousShots.length === 0) {
      advanceAfterHole()
      return
    }
    setRoundState('SUMMARY')
  }

  // Post-hole navigation, shared by finishHole (empty hole) and
  // saveHoleSummary (after the review saves). This is the ONLY genuine
  // finish-advance path — onAdvanceHole (not onHoleChange) so the caller can
  // ratchet its "furthest hole reached" high-water mark here specifically,
  // not on a peek/jump (navigateHole below uses onHoleChange, deliberately
  // not this).
  function advanceAfterHole() {
    // Marks the hole finished for the resume point (#902) — its running score
    // can't, since every logged shot rewrites that. Queued (#226) so it
    // survives offline play. Not awaited: on the last hole, a patch that
    // misses completeRound's drain is dropped as stale, which is harmless —
    // a completed round is never resumed. Mirrored into local state so this
    // session's routing below sees it too.
    if (currentHoleScore) {
      const finishedAt = new Date().toISOString()
      setHoleScores((cur) =>
        cur.map((s) => (s.id === currentHoleScore.id ? { ...s, finished_at: finishedAt } : s)),
      )
      enqueueHoleScorePatch(currentHoleScore, { finished_at: finishedAt })
        .then(() => syncPendingShots())
        .catch(() => undefined)
    }
    // Next UNFINISHED hole, not holeNumber + 1: after a peek-finish or a
    // shotgun start the following hole may already be done (#940). In order,
    // this is always holeNumber + 1.
    if (nextUnfinished != null) {
      onAdvanceHole(nextUnfinished)
    } else if (unfinishedOthers.length > 0) {
      // Nothing left AFTER this hole but earlier ones are unfinished — the
      // last-hole peek or a shotgun start. Ask instead of ending (#940).
      setActiveDialog('unfinished')
    } else {
      // Every hole done → finalize the round: completeRound writes total_score /
      // sg_total / completed_at and routes to the summary. Without this the
      // round stays unfinished (blank total, reappears as resumable). Same
      // path as "End round early". (#639)
      void handleEndRound()
    }
  }

  // "Continue to hole N" from the #940 prompt: rewind the frontier to it so
  // it opens for live capture rather than the played-hole edit surface.
  function continueToHole(n: number) {
    setActiveDialog(null)
    onAdvanceHole(n, true)
  }

  // Back out of the review to the live map, into the played-hole EDIT surface
  // (stepper + drag-to-move + delete) rather than back into live capture —
  // this hole is already played by construction (the summary only opens once
  // previousShots is non-empty). setRoundState('PLACE_BALL') closes the
  // SUMMARY overlay; setAppendEngaged(false) is what actually flips
  // isRevisitingPlayedHole (→ editMode in LiveRoundSession) true for this
  // hole — without it, appendEngaged is still true from the live capture
  // that just finished, which is exactly the "re-enters live capture" bug
  // this replaces. currentHoleId hasn't changed (same hole), so nothing else
  // resets it.
  function editHoleOnMap() {
    setRoundState('PLACE_BALL')
    setAppendEngaged(false)
  }

  // End-of-hole save: writeHoleSummary attaches the reviewed metadata to the
  // shots logged live and writes the hole_scores tallies; then the hole advances.
  async function saveHoleSummary(
    rows: ReviewedRowWithId[],
    summary: { score: number; putts: number; penalties: number },
  ) {
    if (!user || !currentHoleScore || !currentHole) return
    if (saveSummaryInFlightRef.current) return
    saveSummaryInFlightRef.current = true
    setSaving(true)
    try {
      await writeHoleSummary({ user, currentHoleScore, currentHole, rows, summary, setHoleScores })
      setRoundState('PLACE_BALL')
      advanceAfterHole()
    } catch (err) {
      Alert.alert('Save failed', (err as Error).message)
    } finally {
      saveSummaryInFlightRef.current = false
      setSaving(false)
    }
  }

  return {
    ...edits,
    ...roundEnd,
    saving,
    persistShot,
    persistPutt,
    persistRoundPin,
    clearRoundPin,
    markBallHere,
    notOnGreen,
    confirmAim,
    skipAim,
    navigateHole,
    finishHole,
    continueToHole,
    unfinishedOthers,
    // Saving this hole ends the round (or asks, #940) rather than moving on.
    finishesRound: nextUnfinished == null,
    saveHoleSummary,
    editHoleOnMap,
  }
}
