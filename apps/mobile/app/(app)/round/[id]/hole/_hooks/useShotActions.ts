import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { Alert } from 'react-native'
import { useRouter } from 'expo-router'
import type { User } from '@supabase/supabase-js'
import { combinedPuttResult, type LieType } from '@oga/core'
import { deleteRound, getProfile } from '@oga/supabase'
import { supabase } from '../../../../../../lib/supabase'
import {
  insertPendingShot,
  setPendingShotEnd,
  type ShotPayload,
} from '../../../../../../lib/db'
import { syncPendingShots } from '../../../../../../lib/sync'
import { distanceYards } from '../../../../../../lib/maps'
import { completeRound } from '../../../../../../lib/completeRound'
import type { LatLng } from '../../../../../../components/round/HoleMap'
import type { ShotLoggerValue } from '../../../../../../components/round/ShotLogger'
import type { PuttingValue } from '../../../../../../components/round/PuttingSheet'
import { PUTTING_RADIUS_YARDS } from '../_state/types'
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
  setTeePlacementOpen: Dispatch<SetStateAction<boolean>>
  setOnGreenPromptOpen: Dispatch<SetStateAction<boolean>>
  setAimPromptOpen: Dispatch<SetStateAction<boolean>>
  setConfirmDelete: Dispatch<SetStateAction<boolean>>
  setConfirmEnd: Dispatch<SetStateAction<boolean>>
  setConfirmExit: Dispatch<SetStateAction<boolean>>
}

export interface UseShotActionsResult {
  saving: boolean
  ending: boolean
  deleting: boolean
  persistShot: (meta: ShotLoggerValue | null) => Promise<void>
  persistPutt: (v: PuttingValue) => Promise<void>
  persistRoundPin: (loc: LatLng) => Promise<void>
  clearRoundPin: () => Promise<void>
  persistTee: (loc: LatLng) => Promise<void>
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
    setTeePlacementOpen,
    setOnGreenPromptOpen,
    setAimPromptOpen,
    setConfirmDelete,
    setConfirmEnd,
    setConfirmExit,
  } = input
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  // Ref-based in-flight gate. The `saving` state setter is async, so
  // a fast double-tap on the Save button can fire `persistShot` twice
  // before React commits the next render — both calls see `saving`
  // === false. The ref flips synchronously and blocks the second call.
  const persistShotInFlightRef = useRef(false)
  const [ending, setEnding] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
  } = data
  const {
    ball,
    setBall,
    aim,
    setAim,
    setRoundState,
    manuallyPlacedRef,
    lastSavedShotLocalIdRef,
    gpsPosition,
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
      aim_lat: aim?.lat ?? null,
      aim_lng: aim?.lng ?? null,
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
      break_direction: meta?.breakDirection ?? null,
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
      breakDirection: v.breakDirection,
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

  async function persistTee(loc: LatLng) {
    if (!currentHole) return
    if (!Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return
    setHoles((prev) =>
      prev.map((h) =>
        h.id === currentHole.id
          ? { ...h, tee_lat: loc.lat, tee_lng: loc.lng }
          : h,
      ),
    )
    setTeePlacementOpen(false)
    const { error: updateErr } = await supabase
      .from('holes')
      .update({ tee_lat: loc.lat, tee_lng: loc.lng })
      .eq('id', currentHole.id)
    if (updateErr) {
      Alert.alert('Tee save failed', updateErr.message)
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
    const ballSnapshot = { lat: source.lat, lng: source.lng }
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
      setOnGreenPromptOpen(true)
      return
    }
    setAimPromptOpen(true)
  }

  function handleOnGreenYes() {
    setOnGreenPromptOpen(false)
    // Drop straight into the dedicated PuttingSheet — there is no
    // club/lie picker on that sheet, so there is nothing for the
    // player to select after confirming "Yes, I'm putting". persistPutt
    // hard-codes club='putter' + lie='green' on the way to the DB.
    setLoggerInitial({ lieType: 'green', club: 'putter' })
    setRoundState('PUTTING')
  }

  function handleOnGreenNo() {
    setOnGreenPromptOpen(false)
    // 'rough' is the safest near-green default — fairway/fringe/sand
    // are common but rough is the modal answer for "near green but
    // not putting". Player overrides in ShotLogger.
    setLoggerInitial({ lieType: 'rough' })
    setRoundState('SHOT_DETAIL')
    setLoggerOpen(true)
  }

  function confirmAim() {
    setRoundState('SHOT_DETAIL')
    setLoggerOpen(true)
  }

  function skipAim() {
    setAim(null)
    setRoundState('SHOT_DETAIL')
    setLoggerOpen(true)
  }

  function handleAimPromptConfirm() {
    setAimPromptOpen(false)
    setRoundState('SET_AIM')
  }

  function handleAimPromptSkip() {
    setAimPromptOpen(false)
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
    if (next < 1 || next > 18) return
    router.replace(`/(app)/round/${id}/hole/${next}`)
  }

  function finishHole() {
    if (holeNumber < 18) {
      router.replace(`/(app)/round/${id}/hole/${holeNumber + 1}`)
    } else {
      router.replace('/(app)')
    }
  }

  async function handleEndRound() {
    if (!round || !user) return
    setEnding(true)
    try {
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
      router.replace(`/(app)/round/${round.id}`)
    } catch (err) {
      Alert.alert('End round failed', (err as Error).message)
    } finally {
      setEnding(false)
      setConfirmEnd(false)
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
      setConfirmDelete(false)
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
        setConfirmExit(false)
      }
    } else {
      setConfirmExit(false)
    }
    router.replace('/(app)')
  }

  return {
    saving,
    ending,
    deleting,
    persistShot,
    persistPutt,
    persistRoundPin,
    clearRoundPin,
    persistTee,
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
