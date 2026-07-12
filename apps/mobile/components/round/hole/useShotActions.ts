import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { Alert } from 'react-native'
import { useRouter } from 'expo-router'
import type { User } from '@supabase/supabase-js'
import {
  combinedBreakDirection,
  combinedPuttResult,
  inferHoleStats,
  isPuttEntry,
  isPuttShot,
  type CaptureMode,
  type LieType,
  type ReviewedShotRow,
} from '@oga/core'
import { deleteRound, getProfile } from '@oga/supabase'
import { supabase } from '../../../lib/supabase'
import {
  allShotsForHoleScore,
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
import { type ActiveDialog } from './types'
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
    const payload = buildPayload(meta, opts)
    if (!payload) return
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
    // next putt. (previousShots is ≥1 here — the tee shot precedes any putt —
    // so finishHole opens the summary, never the empty-hole advance.)
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
    // On the green (#791 step 4): the marked ball is the putt's start. Skip
    // aiming entirely — Made/Missed is the action. Seed lie=green/putter so
    // persistPutt writes a putt; the make-% readout + read live in PuttingSheet.
    // Overrides capture mode (a putt is a putt in either mode).
    if (opts?.toGreen) {
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
  // saveHoleSummary (after the review saves).
  function advanceAfterHole() {
    if (holeNumber < holeCount) {
      onHoleChange(holeNumber + 1)
    } else {
      // Last hole → finalize the round: completeRound writes total_score /
      // sg_total / completed_at and routes to the summary. Without this the
      // round stays unfinished (blank total, reappears as resumable). Same
      // path as "End round early". (#639)
      void handleEndRound()
    }
  }

  // Back out of the review to the live map so the player can add or re-place a
  // ball, then reopen the summary. Mobile has no drag-existing-marker mode, so
  // "edit on map" drops to PLACE_BALL — the append flow, which can add / re-mark
  // a shot before finishing again.
  function editHoleOnMap() {
    setRoundState('PLACE_BALL')
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
  }
}
