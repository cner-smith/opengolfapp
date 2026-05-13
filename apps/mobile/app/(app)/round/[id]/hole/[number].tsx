import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { HoleMap, type LatLng } from '../../../../../components/round/HoleMap'
import type { ShotLoggerValue } from '../../../../../components/round/ShotLogger'
import { supabase } from '../../../../../lib/supabase'
import { useAuth } from '../../../../../hooks/useAuth'
import { ConfirmDialog } from '../../../../../components/ui/ConfirmDialog'
import { useUnits } from '../../../../../hooks/useUnits'
import { FALLBACK_CENTER, KICKER } from './_state/types'
import { useHoleData } from './_hooks/useHoleData'
import { useHoleState } from './_hooks/useHoleState'
import { useShotActions } from './_hooks/useShotActions'
import { HoleStrip } from './_components/HoleStrip'
import { HoleModals } from './_components/HoleModals'

export default function HoleScreen() {
  const { id, number, mode } = useLocalSearchParams<{
    id: string
    number: string
    mode?: string
  }>()
  const holeNumber = Number(number)
  // 'past' means the player is logging after the fact — GPS would just
  // put the ball wherever they happen to be sitting, so skip the
  // auto-place + nearPin prompt and let them tap markers manually.
  const isPastMode = mode === 'past'
  const router = useRouter()
  const { user } = useAuth()
  const { toDisplay } = useUnits()

  // Local UI state — modal/dialog open flags + logger seed.
  const [loggerOpen, setLoggerOpen] = useState(false)
  const [pinPlacementOpen, setPinPlacementOpen] = useState(false)
  const [teePlacementOpen, setTeePlacementOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [scorecardOpen, setScorecardOpen] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [confirmExit, setConfirmExit] = useState(false)
  const [onGreenPromptOpen, setOnGreenPromptOpen] = useState(false)
  const [aimPromptOpen, setAimPromptOpen] = useState(false)
  const [loggerInitial, setLoggerInitial] = useState<ShotLoggerValue>({})

  const data = useHoleData(id, holeNumber)
  const finalState = useHoleState({
    currentHoleId: data.currentHole?.id ?? null,
    currentHoleScoreId: data.currentHoleScore?.id ?? null,
    isPastMode,
    storedPin: data.storedPin,
    roundPin: data.roundPin,
  })

  // Camera anchors on the tee box — the player's starting point. Pin/green
  // is intentionally NOT a fallback; it would mis-frame the hole every time.
  // Course centroid is the next-best landing if no per-hole layout exists,
  // and the hard-coded US-center FALLBACK_CENTER is the absolute last
  // resort (course rows missing lat/lng entirely).
  const center: LatLng = useMemo(() => {
    if (data.tee) return data.tee
    // Course centroid beats GPS — without hole data the player may not be
    // at the course yet, so GPS ball position is the wrong anchor.
    if (data.courseCenter) return data.courseCenter
    if (finalState.ball) return finalState.ball
    return FALLBACK_CENTER
  }, [
    data.tee?.lat,
    data.tee?.lng,
    data.courseCenter?.lat,
    data.courseCenter?.lng,
    finalState.ball?.lat,
    finalState.ball?.lng,
  ])

  const totalShotsThisHole =
    data.remoteShotCount + data.localShotCount > 0
      ? data.remoteShotCount + data.localShotCount
      : 0

  const actions = useShotActions({
    id,
    user,
    holeNumber,
    data,
    state: finalState,
    setLoggerOpen,
    setLoggerInitial,
    setPinPlacementOpen,
    setTeePlacementOpen,
    setOnGreenPromptOpen,
    setAimPromptOpen,
    setConfirmDelete,
    setConfirmEnd,
    setConfirmExit,
  })

  if (data.loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F2EEE5',
        }}
      >
        <ActivityIndicator color="#1F3D2C" />
      </View>
    )
  }
  if (data.error || !data.round || !data.currentHole || !data.currentHoleScore) {
    const headline = data.error
      ? 'Something went wrong loading this round.'
      : `Hole ${holeNumber} isn't set up for this round yet.`
    const subline = data.error
      ? 'Check your connection and try again, or exit to clear the round.'
      : 'This usually means the course was created without per-hole layout data. Exit to discard the round and start fresh.'
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F2EEE5',
          padding: 22,
        }}
      >
        <Text
          style={{
            color: '#1C211C',
            fontSize: 20,
            fontStyle: 'italic',
            fontWeight: '500',
            fontFamily: 'Fraunces-MediumItalic',
            textAlign: 'center',
            marginBottom: 10,
          }}
        >
          {headline}
        </Text>
        <Text
          style={{
            color: '#5C6356',
            fontSize: 13,
            lineHeight: 18,
            textAlign: 'center',
            marginBottom: 22,
          }}
        >
          {subline}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Try again"
          onPress={data.loadAll}
          style={{
            borderWidth: 1,
            borderColor: '#1F3D2C',
            borderRadius: 2,
            paddingVertical: 12,
            paddingHorizontal: 22,
            marginBottom: 10,
          }}
        >
          <Text
            style={{
              color: '#1F3D2C',
              fontSize: 13,
              fontWeight: '600',
              letterSpacing: 0.3,
            }}
          >
            Try again
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Exit round and discard"
          onPress={() => setConfirmExit(true)}
          style={{
            backgroundColor: '#A33A2A',
            borderRadius: 2,
            paddingVertical: 14,
            paddingHorizontal: 24,
          }}
        >
          <Text
            style={{
              color: '#F2EEE5',
              fontSize: 14,
              fontWeight: '600',
              letterSpacing: 0.3,
            }}
          >
            Exit round
          </Text>
        </Pressable>
        <ConfirmDialog
          visible={confirmExit}
          title="Leave this round?"
          message="Nothing's been logged yet, so the round will be discarded."
          confirmLabel="Leave round"
          cancelLabel="Stay"
          destructive
          busy={actions.deleting}
          onConfirm={actions.handleExitFromError}
          onCancel={() => setConfirmExit(false)}
        />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F2EEE5' }}>
      <View
        style={{
          backgroundColor: '#1C211C',
          paddingTop: 52,
          paddingBottom: 14,
          paddingHorizontal: 18,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Leave round and return home"
          onPress={() => setConfirmLeave(true)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ padding: 6 }}
        >
          <Text style={{ ...KICKER, color: 'rgba(242,238,229,0.6)' }}>
            ← Home
          </Text>
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text
            style={{
              ...KICKER,
              color: 'rgba(242,238,229,0.45)',
              marginBottom: 4,
            }}
          >
            Hole {holeNumber}
          </Text>
          <Text
            style={{
              color: '#F2EEE5',
              fontSize: 17,
              fontWeight: '500',
              fontStyle: 'italic',
            }}
          >
            Par {data.currentHole.par}
            {data.currentHole.yards ? ` · ${toDisplay(data.currentHole.yards)}` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setConfirmEnd(true)}
            accessibilityLabel="End round early"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={{ ...KICKER, color: 'rgba(242,238,229,0.85)' }}>
              End · Shot {data.shotNumber}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setConfirmDelete(true)}
            accessibilityLabel="Delete round"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={{ ...KICKER, color: 'rgba(163,58,42,0.85)' }}>
              Delete
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <HoleMap
          center={center}
          pin={data.storedPin}
          roundPin={data.roundPin}
          tee={data.tee}
          aim={finalState.aim}
          ball={finalState.ball}
          previousShots={data.previousShots}
          missingHoleLayout={data.tee == null && data.storedPin == null && data.roundPin == null}
          phase={
            pinPlacementOpen
              ? 'PIN'
              : teePlacementOpen
                ? 'TEE'
                : finalState.roundState === 'SET_AIM'
                  ? 'SET_AIM'
                  : 'PLACE_BALL'
          }
          onSetAim={finalState.setAim}
          onSetBall={(loc) => {
            // Manual drag/tap is an explicit override. Freeze GPS
            // updates for this PLACE_BALL cycle and re-anchor the
            // Kalman filter at the manual point with a low variance
            // (1 m²) — strong prior so any future un-freeze still
            // resists snapping back to a noisy raw fix.
            finalState.manuallyPlacedRef.current = true
            finalState.kalmanStateRef.current = {
              lat: loc.lat,
              lng: loc.lng,
              variance: 1,
            }
            finalState.setBall(loc)
          }}
          onPlacePin={actions.persistRoundPin}
          onPlaceTee={actions.persistTee}
        />
        {finalState.aimHintVisible && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss aim point hint"
            onPress={() => finalState.setAimHintVisible(false)}
            style={{
              position: 'absolute',
              top: 48,
              left: 12,
              right: 12,
              backgroundColor: 'rgba(28,33,28,0.92)',
              borderColor: 'rgba(159,149,128,0.6)',
              borderWidth: 1,
              borderRadius: 4,
              paddingHorizontal: 14,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: '#F2EEE5', fontSize: 13, lineHeight: 18 }}>
              Aim point = start line. Drag to adjust.
            </Text>
          </Pressable>
        )}
      </View>

      <HoleStrip
        pinPlacementOpen={pinPlacementOpen}
        teePlacementOpen={teePlacementOpen}
        roundState={finalState.roundState}
        ball={finalState.ball}
        aim={finalState.aim}
        saving={actions.saving}
        roundPin={data.roundPin}
        tee={data.tee}
        nearPin={finalState.nearPin}
        totalShotsThisHole={totalShotsThisHole}
        holeNumber={holeNumber}
        holes={data.holes}
        holeScores={data.holeScores}
        onCancelPinPlacement={() => setPinPlacementOpen(false)}
        onCancelTeePlacement={() => setTeePlacementOpen(false)}
        onClearRoundPin={actions.clearRoundPin}
        onConfirmAim={actions.confirmAim}
        onRePlaceBall={() => finalState.setRoundState('PLACE_BALL')}
        onSkipAim={actions.skipAim}
        onMarkBallHere={actions.markBallHere}
        onOpenPinPlacement={() => setPinPlacementOpen(true)}
        onOpenTeePlacement={() => setTeePlacementOpen(true)}
        onFinishHole={actions.finishHole}
        onPrev={() => actions.navigateHole(-1)}
        onNext={() => actions.navigateHole(1)}
        onOpenScorecard={() => setScorecardOpen(true)}
      />

      <HoleModals
        shotNumber={data.shotNumber}
        loggerOpen={loggerOpen}
        loggerInitial={loggerInitial}
        ball={finalState.ball}
        roundPin={data.roundPin}
        storedPin={data.storedPin}
        roundState={finalState.roundState}
        scorecardOpen={scorecardOpen}
        holes={data.holes}
        holeScores={data.holeScores}
        holeNumber={holeNumber}
        routerReplace={(href) => router.replace(href as Parameters<typeof router.replace>[0])}
        id={id}
        onChangePar={async (holeId, newPar) => {
          // Optimistic update so the cell reflects the tap immediately.
          // Roll back if the DB write fails so the UI doesn't lie.
          const prev = data.holes.find((h) => h.id === holeId)?.par ?? 4
          data.setHoles((cur) =>
            cur.map((h) => (h.id === holeId ? { ...h, par: newPar } : h)),
          )
          const { error: parErr } = await supabase
            .from('holes')
            .update({ par: newPar })
            .eq('id', holeId)
          if (parErr) {
            data.setHoles((cur) =>
              cur.map((h) => (h.id === holeId ? { ...h, par: prev } : h)),
            )
          }
        }}
        setScorecardOpen={setScorecardOpen}
        confirmDelete={confirmDelete}
        confirmLeave={confirmLeave}
        confirmEnd={confirmEnd}
        onGreenPromptOpen={onGreenPromptOpen}
        aimPromptOpen={aimPromptOpen}
        totalShotsThisHole={totalShotsThisHole}
        ending={actions.ending}
        deleting={actions.deleting}
        saving={actions.saving}
        onPersistShot={actions.persistShot}
        onPersistPutt={actions.persistPutt}
        onCloseLogger={actions.closeLogger}
        onClosePuttingSheet={actions.closePuttingSheet}
        onSwapPuttingToShot={actions.swapPuttingToShot}
        onConfirmDelete={actions.handleDeleteRound}
        onCancelDelete={() => setConfirmDelete(false)}
        onConfirmLeave={() => {
          setConfirmLeave(false)
          router.replace('/(app)')
        }}
        onCancelLeave={() => setConfirmLeave(false)}
        onConfirmEnd={actions.handleEndRound}
        onCancelEnd={() => setConfirmEnd(false)}
        onGreenYes={actions.handleOnGreenYes}
        onGreenNo={actions.handleOnGreenNo}
        onAimPromptConfirm={actions.handleAimPromptConfirm}
        onAimPromptSkip={actions.handleAimPromptSkip}
      />
    </View>
  )
}
