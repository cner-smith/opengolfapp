import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { Alert } from 'react-native'
import { useRouter } from 'expo-router'
import type { User } from '@supabase/supabase-js'
import {
  combinedBreakDirection,
  combinedPuttResult,
  type LieType,
} from '@oga/core'
import { deleteRound, getProfile } from '@oga/supabase'
import { supabase } from '../../../lib/supabase'
import {
  insertPendingShot,
  pendingCount,
  setPendingShotEnd,
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
  markBallHere: () => Promise<void>
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
  handleEndRound: () => Promise<void>
  handleDeleteRound: () => Promise<void>
  handleExitFromError: () => Promise<void>
}

export function useShotActions(input: UseShotActionsInput): UseShotActionsResult {
  const {
    id,
    user,
    holeNumber,
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
    shotNumber,
    holeCount,
  } = data
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
    setAppendEngaged,
  } = state

  function buildPayload(meta: ShotLoggerValue | null): ShotPayload | null {
    if (!user || !currentHoleScore || !ball) return null
    return {
      hole_score_id: currentHoleScore.id,
      user_id: user.id,
      shot_number: shotNumber,
      start_lat: ball.lat,
      start_lng: ball.lng,
      end_lat: null,
      end_lng: null,
      // Persist aim only if the player set/dragged it; an untouched auto-spawn
      // suggestion is dropped so it can't enter the dispersion dataset.
      aim_lat: aimTouched ? aim?.lat ?? null : null,
      aim_lng: aimTouched ? aim?.lng ?? null : null,
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

  async function persistShot(meta: ShotLoggerValue | null) {
    if (persistShotInFlightRef.current) return
    const payload = buildPayload(meta)
    if (!payload) return
    persistShotInFlightRef.current = true
    setSaving(true)
    try {
      const localId = await insertPendingShot(payload)
      lastSavedShotLocalIdRef.current = localId
      const isPutt = payload.club === 'putter' || payload.lie_type === 'green'
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
    if (!currentHole) return
    if (!Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return
    setHoles((prev) =>
      prev.map((h) =>
        h.id === currentHole.id
          ? { ...h, tee_lat: loc.lat, tee_lng: loc.lng }
          : h,
      ),
    )
    const { error: updateErr } = await supabase
      .from('holes')
      .update({ tee_lat: loc.lat, tee_lng: loc.lng })
      .eq('id', currentHole.id)
    if (updateErr) {
      // eslint-disable-next-line no-console
      console.warn('[hole/tee-auto-persist]', updateErr.message)
    }
  }

  async function markBallHere() {
    // Use the dragged ball if the player set one, otherwise fall back to
    // raw GPS — "Mark ball here" should always work as long as we know
    // where the player is, even if they haven't tapped the map to drop
    // a marker first.
    const source = ball ?? gpsPosition
    if (!source) {
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
    const pinTarget = roundPin ?? storedPin ?? null
    if (pinTarget && distanceYards(ballSnapshot, pinTarget) <= PUTTING_RADIUS_YARDS) {
      setActiveDialog('onGreen')
      return
    }
    // Go straight into aiming — no "Set aim point?" prompt. The aim line
    // auto-spawns to the pin (useHoleState) with a draggable midpoint; "Skip
    // aim" stays available in the SET_AIM bottom chrome. (The on-green prompt
    // above is kept.)
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
    // Confirming is an explicit acceptance of the aim — even the unadjusted
    // auto-suggestion — so mark it touched and persist it. ('Skip aim' clears
    // the aim instead, so that path stays unpersisted.)
    setAimTouched(true)
    setRoundState('SHOT_DETAIL')
    setLoggerOpen(true)
  }

  function skipAim() {
    setAim(null)
    setRoundState('SHOT_DETAIL')
    setLoggerOpen(true)
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

  async function handleExitFromError() {
    if (round && user) {
      setDeleting(true)
      try {
        const { error: delErr } = await deleteRound(supabase, round.id, user.id)
        if (delErr) {
          // eslint-disable-next-line no-console
          console.error('[hole/exitFromError]', delErr.message)
          Alert.alert('Could not discard round', delErr.message)
          return
        }
      } finally {
        setDeleting(false)
        // Guard against clobbering a different dialog the user may have
        // opened during the async window.
        setActiveDialog(prev => (prev === 'exit' ? null : prev))
      }
    } else {
      setActiveDialog(prev => (prev === 'exit' ? null : prev))
    }
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
    handleEndRound,
    handleDeleteRound,
    handleExitFromError,
  }
}
