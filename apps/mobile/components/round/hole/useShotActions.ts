import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { uuid } from 'expo-modules-core'
import type { User } from '@supabase/supabase-js'
import {
  combinedBreakDirection,
  combinedPuttResult,
  inferHoleStats,
  isPuttEntry,
  isPuttShot,
  projectShotMove,
  type CaptureMode,
  type LieType,
  type ReviewedShotRow,
} from '@oga/core'
import { deleteRound, getProfile } from '@oga/supabase'
import { supabase } from '../../../lib/supabase'
import {
  allShotsForHoleScore,
  deletePendingShotById,
  insertPendingShot,
  pendingCount,
  setPendingShotEnd,
  upsertReviewedShot,
  type ShotPayload,
} from '../../../lib/db'
import { syncPendingShots } from '../../../lib/sync'
import { distanceYards } from '../../../lib/maps'
import { completeRound } from '../../../lib/completeRound'
import type { LatLng } from '../HoleMap'
import type { ShotLoggerValue } from '../ShotLogger'
import type { PuttingValue } from '../PuttingSheet'
import { PUTTING_RADIUS_YARDS, type ActiveDialog } from './types'
import type { UseHoleDataResult } from './useHoleData'
import type { UseHoleStateResult } from './useHoleState'

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
  setLoggerOpen: Dispatch<SetStateAction<boolean>>
  setLoggerInitial: Dispatch<SetStateAction<ShotLoggerValue>>
  setPinPlacementOpen: Dispatch<SetStateAction<boolean>>
  setActiveDialog: Dispatch<SetStateAction<ActiveDialog>>
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
  onAdvanceHole: (next: number) => void
}

export interface UseShotActionsResult {
  saving: boolean
  ending: boolean
  deleting: boolean
  // Monotonic counter that bumps once per successful persistShot.
  // Used by HoleModals as the ShotLogger key so the form remounts
  // (= resets) exactly when a shot saves — and not on incidental
  // shotNumber recomputation from stale fetches or background sync.
  // See #284 for the original symptom.
  shotEntrySeq: number
  persistShot: (meta: ShotLoggerValue | null) => Promise<void>
  persistPutt: (v: PuttingValue) => Promise<void>
  persistRoundPin: (loc: LatLng) => Promise<void>
  clearRoundPin: () => Promise<void>
  markBallHere: (opts?: { toGreen?: boolean }) => Promise<void>
  handleOnGreenYes: () => void
  handleOnGreenNo: () => void
  notOnGreen: () => void
  confirmAim: () => void
  skipAim: () => void
  handleAimPromptConfirm: () => void
  handleAimPromptSkip: () => void
  closeLogger: () => void
  closePuttingSheet: () => void
  swapPuttingToShot: (lieType: LieType) => void
  navigateHole: (delta: number) => void
  finishHole: () => void
  // End-of-hole review save: attach the confirmed metadata to every shot
  // logged live on this hole, write the hole_scores tallies, then advance.
  saveHoleSummary: (
    rows: ReviewedShotRow[],
    summary: { score: number; putts: number; penalties: number },
  ) => Promise<void>
  // Dismiss the summary back to the live map so the player can fix ball
  // positions (add / re-place a shot) before reopening the review.
  editHoleOnMap: () => void
  handleEndRound: () => Promise<void>
  handleDeleteRound: () => Promise<void>
  handleExitFromError: () => void
  // Online-first single-shot delete: flush pending, call the delete_shot RPC,
  // refresh the hole's shot state. Returns true on success, false (with an
  // alert already shown) on network/error.
  deleteShot: (shotId: string) => Promise<boolean>
  // Online-first single-shot reposition: recompute start coords (+
  // distance_to_target via projectShotMove) and write them directly.
  // Returns true on success, false (with an alert already shown) on
  // network/error.
  moveShot: (
    shotId: string,
    newStart: { lat: number; lng: number },
  ) => Promise<boolean>
}

export function useShotActions(input: UseShotActionsInput): UseShotActionsResult {
  const {
    id,
    user,
    holeNumber,
    captureMode,
    data,
    state,
    setLoggerOpen,
    setLoggerInitial,
    setPinPlacementOpen,
    setActiveDialog,
    onHoleChange,
    onAdvanceHole,
  } = input
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  // Ref-based in-flight gate. The `saving` state setter is async, so
  // a fast double-tap on the Save button can fire `persistShot` twice
  // before React commits the next render — both calls see `saving`
  // === false. The ref flips synchronously and blocks the second call.
  const persistShotInFlightRef = useRef(false)
  // Same async-setter race as persistShot: `setEnding(true)` commits a tick
  // late, so a fast double-tap of Finish (18th hole) or End round could fire
  // completeRound twice. The ref flips synchronously and blocks the second.
  const endInFlightRef = useRef(false)
  const [ending, setEnding] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [shotEntrySeq, setShotEntrySeq] = useState(0)

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
    shotNumber,
    holeCount,
  } = data
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
      putt_distance_ft: meta?.puttDistanceFt ?? null,
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
      setLoggerOpen(false)
      setLoggerInitial({})
      setRoundState('PLACE_BALL')
      // Background sync — don't await.
      syncPendingShots().catch(() => undefined)
      const newPutts = remotePuttCount + localPuttCount + (isPutt ? 1 : 0)
      supabase
        .from('hole_scores')
        .update({ score: shotNumber, putts: newPutts })
        .eq('id', payload.hole_score_id)
        .then(({ error }) => {
          if (error) {
            // eslint-disable-next-line no-console
            console.warn('[hole/score-update]', error.message)
          }
        })
      setHoleScores((prev) =>
        prev.map((hs) =>
          hs.id === payload.hole_score_id
            ? { ...hs, score: shotNumber, putts: newPutts }
            : hs,
        ),
      )
      // Bump only on success — a failed save (caught below) shouldn't
      // remount the form and wipe the player's entry.
      setShotEntrySeq((s) => s + 1)

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
    const { error: updateErr } = await supabase
      .from('hole_scores')
      .update({ pin_lat: loc.lat, pin_lng: loc.lng })
      .eq('id', currentHoleScore.id)
    if (updateErr) {
      Alert.alert('Pin save failed', updateErr.message)
    }
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
    const { error: updateErr } = await supabase
      .from('hole_scores')
      .update({ pin_lat: null, pin_lng: null })
      .eq('id', currentHoleScore.id)
    if (updateErr) {
      Alert.alert('Pin clear failed', updateErr.message)
    }
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
    // Skip aiming entirely — Made/Missed is the action (bottom-chrome
    // overlays, not a modal). Seed lie=green/putter so persistPutt writes a
    // putt; the make-% pill lives in MapBottomChrome, the detailed read in
    // the end-of-hole summary. Overrides capture mode (a putt is a putt in
    // either mode).
    if (opts?.toGreen || autoGreen) {
      setLoggerInitial({ lieType: 'green', club: 'putter' })
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

  function handleOnGreenYes() {
    setActiveDialog(prev => (prev === 'onGreen' ? null : prev))
    // Drop straight into the dedicated PuttingSheet — there is no
    // club/lie picker on that sheet, so there is nothing for the
    // player to select after confirming "Yes, I'm putting". persistPutt
    // hard-codes club='putter' + lie='green' on the way to the DB.
    setLoggerInitial({ lieType: 'green', club: 'putter' })
    setRoundState('PUTTING')
  }

  function handleOnGreenNo() {
    // Not on the green → close the prompt and go straight into aiming (no
    // separate "Set aim point?" prompt). Synchronous, so React batches the
    // dialog-clear with the phase change.
    setActiveDialog(prev => (prev === 'onGreen' ? null : prev))
    // 'rough' is the safest near-green default — fairway/fringe/sand
    // are common but rough is the modal answer for "near green but
    // not putting". Player overrides in ShotLogger.
    setLoggerInitial({ lieType: 'rough' })
    // Chips and pitches still benefit from explicit aim capture for the
    // shot-pattern dataset; the aim line auto-spawns and "Skip aim" stays
    // available in the SET_AIM chrome.
    setRoundState('SET_AIM')
  }

  // Escape from the on-green Made/Missed overlays (#791 step 4 rework): the
  // ball marked into PUTTING wasn't actually on the green after all. Same
  // seed as handleOnGreenNo — 'rough' is the safest near-green default, the
  // player overrides in ShotLogger — but there is no dialog to clear here
  // (the overlay isn't a Modal/ConfirmDialog, just bottom chrome).
  function notOnGreen() {
    // just_track never enters aiming — mirror markBallHere's just_track path:
    // save the already-marked ball's location and loop back to PLACE_BALL,
    // rather than stranding the player in a SET_AIM chrome their mode never
    // shows. track_patterns re-routes the ball into the normal aim flow.
    if (captureMode === 'just_track') {
      void persistShot(null, { forceAim: false })
      return
    }
    setLoggerInitial({ lieType: 'rough' })
    setRoundState('SET_AIM')
  }

  function confirmAim() {
    // Location-now, details-at-EOH (#791): confirming the aim saves the shot
    // as a location (+ this accepted aim) and loops straight back to placing
    // the next ball — no ShotLogger. forceAim:true persists even an unadjusted
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

  function handleAimPromptConfirm() {
    setActiveDialog(prev => (prev === 'aim' ? null : prev))
    setRoundState('SET_AIM')
  }

  function handleAimPromptSkip() {
    setActiveDialog(prev => (prev === 'aim' ? null : prev))
    skipAim()
  }

  function closeLogger() {
    setLoggerOpen(false)
    setLoggerInitial({})
    setRoundState('PLACE_BALL')
  }

  function closePuttingSheet() {
    setRoundState('PLACE_BALL')
  }

  // Recover from a mistaken "Yes, I'm putting" tap. PuttingSheet has
  // no club/lie picker — without this escape, a player who's actually
  // chipping from the fringe or in a bunker has no way out except
  // Close, which drops them back to PLACE_BALL and loses the ball
  // position. Mirrors handleOnGreenNo's seed.
  function swapPuttingToShot(lieType: LieType) {
    setLoggerInitial({ lieType })
    setRoundState('SHOT_DETAIL')
    setLoggerOpen(true)
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
    if (holeNumber < holeCount) {
      onAdvanceHole(holeNumber + 1)
    } else {
      // Last hole → finalize the round: completeRound writes total_score /
      // sg_total / completed_at and routes to the summary. Without this the
      // round stays unfinished (blank total, reappears as resumable). Same
      // path as "End round early". (#639)
      void handleEndRound()
    }
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

  // End-of-hole save. Mirrors the web review sheet's replace-all write, but
  // attaches metadata to the shots the player already logged live rather than
  // recreating them: each reviewed row is paired back to its live shot by
  // shot_number so the shot's client id (and its live-captured aim) carry
  // through, and the merged payload is re-queued via upsertReviewedShot →
  // idempotent re-sync updates the same server row (no delete, no duplicates
  // offline). Then the hole_scores tallies are written and the hole advances.
  async function saveHoleSummary(
    rows: ReviewedShotRow[],
    summary: { score: number; putts: number; penalties: number },
  ) {
    if (!user || !currentHoleScore || !currentHole) return
    if (saveSummaryInFlightRef.current) return
    saveSummaryInFlightRef.current = true
    setSaving(true)
    try {
      // Pair reviewed rows to the live shots by shot_number. Local queue
      // (pending + synced) is the primary source for id + live aim; the
      // remote table is the fallback for a shot whose local row was purged
      // after a prior session's sync (restart mid-hole). BOTH reads get a
      // one-retry (mirrors useHoleData's SQLite/remote reads) — a transient
      // failure that empties either map must not silently strand a shot on
      // the abort path below.
      let localRows = await allShotsForHoleScore(currentHoleScore.id).catch(
        () => null,
      )
      if (localRows === null) {
        localRows = await allShotsForHoleScore(currentHoleScore.id).catch(
          () => [] as Awaited<ReturnType<typeof allShotsForHoleScore>>,
        )
      }
      const localByNum = new Map<number, ShotPayload>()
      for (const r of localRows) {
        try {
          const p = JSON.parse(r.payload) as ShotPayload
          if (p.id && p.shot_number != null) localByNum.set(p.shot_number, p)
        } catch {
          // skip malformed pending payload
        }
      }
      const remoteByNum = new Map<
        number,
        { id: string; aim_lat: number | null; aim_lng: number | null }
      >()
      let remote = await supabase
        .from('shots')
        .select('id, shot_number, aim_lat, aim_lng')
        .eq('hole_score_id', currentHoleScore.id)
      if (remote.error) {
        remote = await supabase
          .from('shots')
          .select('id, shot_number, aim_lat, aim_lng')
          .eq('hole_score_id', currentHoleScore.id)
      }
      for (const s of remote.data ?? []) {
        remoteByNum.set(s.shot_number, {
          id: s.id,
          aim_lat: s.aim_lat,
          aim_lng: s.aim_lng,
        })
      }

      for (const row of rows) {
        const isPuttRow = isPuttEntry(row.lieType, row.club)
        const existing =
          localByNum.get(row.shotNumber) ?? remoteByNum.get(row.shotNumber)
        // The reviewed rows were built from these very shots, so each MUST
        // pair back to one. If both reads came up empty for this shot_number
        // (both transiently failed above), fabricating a fresh id would queue
        // a row that collides with the existing shot on unique(hole_score_id,
        // shot_number) — a novel id isn't arbitrated by the sync upsert's
        // onConflict:'id', so it 23505s and gets silently quarantined, losing
        // this shot's metadata. Abort loudly instead: the sheet stays open
        // with the player's edits intact (hydration is gated), so Save simply
        // retries once the read recovers. Never mint a colliding id.
        if (!existing?.id) {
          throw new Error(
            "Couldn't reach this hole's shots — check your connection and save again.",
          )
        }
        const id = existing.id
        // Keep the aim captured live (SET_AIM); the review sheet doesn't edit
        // non-putt aim, so the live value is authoritative. `existing` is a
        // queued payload or the remote row — both carry aim_lat/aim_lng.
        const aimLat = existing.aim_lat ?? null
        const aimLng = existing.aim_lng ?? null
        const payload: ShotPayload = {
          id,
          hole_score_id: currentHoleScore.id,
          user_id: user.id,
          shot_number: row.shotNumber,
          start_lat: row.startLat,
          start_lng: row.startLng,
          end_lat: row.endLat,
          end_lng: row.endLng,
          aim_lat: aimLat,
          aim_lng: aimLng,
          distance_to_target: isPuttRow ? null : Math.round(row.distanceToPin),
          club: row.club,
          lie_type: row.lieType,
          lie_slope: null,
          lie_slope_forward: isPuttRow ? null : row.lieSlopeForward ?? null,
          lie_slope_side: isPuttRow ? null : row.lieSlopeSide ?? null,
          shot_result: isPuttRow ? null : row.shotResult ?? null,
          penalty: false,
          ob: false,
          // Putt tap-to-tap distance is in yards; * 3 = feet (US convention),
          // and putt_distance_ft is what the rest of the app reads.
          putt_distance_ft: isPuttRow ? Math.round(row.distanceYards * 3) : null,
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
        }
        await upsertReviewedShot(payload)
      }
      // Background sync — the re-queued rows carry their metadata now.
      syncPendingShots().catch(() => undefined)

      // Authoritative hole_scores tallies from the review. fairway/gir are
      // inferred from the placed lies; holedOut=true because this flow ends at
      // the pin by construction (matches web's saveReviewedHole). An explicit
      // scorecard toggle is never overwritten (?? guards).
      const inferred = inferHoleStats(
        rows.map((r) => ({ shot_number: r.shotNumber, lie_type: r.lieType })),
        currentHole.par,
        true,
      )
      setHoleScores((prev) =>
        prev.map((hs) =>
          hs.id === currentHoleScore.id
            ? {
                ...hs,
                score: summary.score,
                putts: summary.putts,
                penalties: summary.penalties,
              }
            : hs,
        ),
      )
      const { error: hsErr } = await supabase
        .from('hole_scores')
        .update({
          score: summary.score,
          putts: summary.putts,
          penalties: summary.penalties,
          fairway_hit: currentHoleScore.fairway_hit ?? inferred.fairway,
          gir: currentHoleScore.gir ?? inferred.gir,
        })
        .eq('id', currentHoleScore.id)
      if (hsErr) {
        // Non-fatal: the shots (with their metadata) already re-queued and
        // will sync; only the hole_scores tally write failed. Warn for
        // diagnostics rather than alerting — completeRound self-repairs score
        // from the shot count at round end.
        // eslint-disable-next-line no-console -- diagnostic for a non-fatal tally-write failure
        console.warn('[hole/summary-score-update]', hsErr.message)
      }

      setRoundState('PLACE_BALL')
      advanceAfterHole()
    } catch (err) {
      Alert.alert('Save failed', (err as Error).message)
    } finally {
      saveSummaryInFlightRef.current = false
      setSaving(false)
    }
  }

  async function handleEndRound() {
    if (!round || !user) return
    if (endInFlightRef.current) return
    endInFlightRef.current = true
    setEnding(true)
    try {
      // Drain the queue before finalizing (#651). syncPendingShots joins
      // an in-flight run instead of no-oping, but a joined run may have
      // snapshotted the queue before the final putt's row landed — if
      // anything is still pending after the first pass, run once more now
      // that the previous run has settled.
      await syncPendingShots().catch(() => undefined)
      if ((await pendingCount()) > 0) {
        await syncPendingShots().catch(() => undefined)
      }
      const unsynced = await pendingCount()
      if (unsynced > 0) {
        // Shots that never reached the server would silently vanish from
        // totals/SG (completeRound reads the server's shot set). Make the
        // player choose: keep the round open and retry with a better
        // connection, or knowingly finalize over what synced. cancelable:
        // false so the Android back button can't dismiss without
        // resolving.
        const finishAnyway = await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Some shots have not synced',
            `${unsynced} shot${unsynced === 1 ? ' has' : 's have'} not reached the server. ` +
              'Finishing now will compute totals and strokes gained without ' +
              `${unsynced === 1 ? 'it' : 'them'}. You can keep the round open and finish later with a better connection.`,
            [
              {
                text: 'Keep round open',
                style: 'cancel',
                onPress: () => resolve(false),
              },
              {
                text: 'Finish anyway',
                style: 'destructive',
                onPress: () => resolve(true),
              },
            ],
            { cancelable: false },
          )
        })
        if (!finishAnyway) return
      }
      const { data: profile } = await getProfile(supabase, user.id)
      const handicap =
        (profile as { handicap_index?: number | null } | null)?.handicap_index ??
        null
      await completeRound({
        roundId: round.id,
        courseId: round.course_id,
        userId: user.id,
        handicap,
      })
      router.replace({ pathname: '/(app)/round/[id]', params: { id: round.id } })
    } catch (err) {
      Alert.alert('End round failed', (err as Error).message)
    } finally {
      endInFlightRef.current = false
      setEnding(false)
      // Guard against clobbering a different dialog the user may have
      // opened during the async window (TS agent feedback on #293).
      setActiveDialog(prev => (prev === 'end' ? null : prev))
    }
  }

  async function handleDeleteRound() {
    if (!round || !user) return
    setDeleting(true)
    try {
      const { error: delErr } = await deleteRound(supabase, round.id, user.id)
      if (delErr) {
        Alert.alert('Delete failed', delErr.message)
        return
      }
      router.replace('/(app)')
    } finally {
      setDeleting(false)
      // Guard against clobbering a different dialog the user may have
      // opened during the async window.
      setActiveDialog(prev => (prev === 'delete' ? null : prev))
    }
  }

  async function deleteShot(shotId: string): Promise<boolean> {
    try {
      // Flush any not-yet-synced shots so the target has a server row to delete.
      await syncPendingShots()
      const { data: deleted, error } = await supabase.rpc('delete_shot', {
        p_shot_id: shotId,
      })
      if (error) throw error
      // If the RPC found nothing on the server (false), the shot never synced —
      // drop its local pending row so it actually disappears.
      if (deleted === false) await deletePendingShotById(shotId)
      data.refreshShots()
      // refreshShots only refetches SHOTS; the RPC also re-tallied hole_scores
      // (score/putts/penalties/fairway_hit/gir) server-side, and that row is
      // fetched by a separate effect refreshShots doesn't trigger. Refetch it so
      // the scorecard score updates instead of staying stale after the delete.
      const hsId = data.currentHoleScore?.id
      if (hsId) {
        const { data: updatedHs } = await supabase
          .from('hole_scores')
          .select('*')
          .eq('id', hsId)
          .single()
        if (updatedHs) {
          setHoleScores((prev) =>
            prev.map((hs) => (hs.id === hsId ? { ...hs, ...updatedHs } : hs)),
          )
        }
      }
      return true
    } catch (e) {
      if (__DEV__) console.warn('[hole/deleteShot]', (e as Error)?.message)
      Alert.alert(
        "Couldn't delete that shot",
        'Deleting a shot needs a connection. Try again when you’re back online.',
      )
      return false
    }
  }

  // Online-first single-shot reposition: recompute the shot's start coords
  // (+ distance_to_target, via the pure projectShotMove) and write them
  // directly with a `.update()` — no RPC, since a move only touches columns
  // on the shot's own row (unlike delete_shot's renumber/re-tally fan-out).
  // Mirrors deleteShot's online-only pattern: try → Alert + return false on
  // error → data.refreshShots() → return boolean.
  async function moveShot(
    shotId: string,
    newStart: { lat: number; lng: number },
  ): Promise<boolean> {
    if (!user) return false
    try {
      // Flush any not-yet-synced shots first (mirrors deleteShot) — the shot's
      // client-generated id is stable, so once flushed the update below hits
      // the real server row instead of matching 0 rows.
      await syncPendingShots()
      // The shot's lie_type (putt vs. full shot) isn't held in memory for an
      // already-synced shot — only pending (not-yet-synced) shots carry it,
      // via their queued payload, and even there it's commonly null (live
      // shots are location-only until the end-of-hole review fills it in —
      // so a `null` from the loop below is a real found value, not a
      // "keep looking" signal). Fall back to a direct read only when the
      // shotId genuinely isn't in the pending queue (already synced).
      let lieType: string | null = null
      let foundLocally = false
      for (const p of pendingForHole) {
        try {
          const payload = JSON.parse(p.payload) as ShotPayload
          if (payload.id === shotId) {
            lieType = payload.lie_type ?? null
            foundLocally = true
            break
          }
        } catch {
          // skip malformed pending payload
        }
      }
      if (!foundLocally) {
        const { data: shotRow, error: shotErr } = await supabase
          .from('shots')
          .select('lie_type')
          .eq('id', shotId)
          .single()
        if (shotErr || !shotRow) throw shotErr ?? new Error('Shot not found')
        lieType = shotRow.lie_type
      }
      // Same pin source buildPayload uses for a fresh shot's distance_to_target.
      const pinTarget = roundPin ?? storedPin ?? null
      const proj = projectShotMove({
        newStart,
        pin: pinTarget,
        isPutt: isPuttShot(lieType),
      })
      const updates: { start_lat: number; start_lng: number; distance_to_target?: number | null } = {
        start_lat: proj.startLat,
        start_lng: proj.startLng,
      }
      // undefined = leave distance_to_target untouched (#662 no-pin guard)
      if (proj.distanceToTarget !== undefined) {
        updates.distance_to_target = proj.distanceToTarget
      }
      const { data: updatedRows, error } = await supabase
        .from('shots')
        .update(updates)
        .eq('id', shotId)
        .eq('user_id', user.id)
        .select('id')
      if (error) throw error
      // A matched-0-rows update returns error === null with empty data — the
      // synced shot still isn't on the server (or belongs to another user).
      // Surface it as a failure rather than silently "succeeding" while the
      // move is lost (mirrors the Alert path below).
      if (!updatedRows || updatedRows.length === 0) {
        if (__DEV__) console.warn('[hole/moveShot] update matched 0 rows', shotId)
        Alert.alert(
          "Couldn't move that shot",
          'Moving a shot needs a connection. Try again when you’re back online.',
        )
        return false
      }
      data.refreshShots()
      return true
    } catch (e) {
      if (__DEV__) console.warn('[hole/moveShot]', (e as Error)?.message)
      Alert.alert(
        "Couldn't move that shot",
        'Moving a shot needs a connection. Try again when you’re back online.',
      )
      return false
    }
  }

  function handleExitFromError() {
    // Leave to home WITHOUT deleting. A load error (network blip on a
    // rounds-deep resume) or a missing hole means the round is still
    // resumable — and synthetic no-layout courses are now playable (#614),
    // so there's no "unplayable, discard it" case left to justify a delete.
    // The old delete-on-exit destroyed a whole logged round on a transient
    // failure, behind copy that claimed nothing was logged (#653). The
    // round stays resumable, and is still deletable from the home list.
    setActiveDialog(prev => (prev === 'exit' ? null : prev))
    router.replace('/(app)')
  }

  return {
    saving,
    ending,
    deleting,
    shotEntrySeq,
    persistShot,
    persistPutt,
    persistRoundPin,
    clearRoundPin,
    markBallHere,
    handleOnGreenYes,
    handleOnGreenNo,
    notOnGreen,
    confirmAim,
    skipAim,
    handleAimPromptConfirm,
    handleAimPromptSkip,
    closeLogger,
    closePuttingSheet,
    swapPuttingToShot,
    navigateHole,
    finishHole,
    saveHoleSummary,
    editHoleOnMap,
    handleEndRound,
    handleDeleteRound,
    handleExitFromError,
    deleteShot,
    moveShot,
  }
}
