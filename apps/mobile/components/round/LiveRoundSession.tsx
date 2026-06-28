import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from 'react-native'
import { PressableTouch } from '../ui/PressableTouch'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { HoleMap, type LatLng } from './HoleMap'
import type { ShotLoggerValue } from './ShotLogger'
import { DEFAULT_HANDICAP, bearingDegrees, destinationYards } from '@oga/core'
import { getProfile } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { distanceYards } from '../../lib/maps'
import { useAuth } from '../../hooks/useAuth'
import { useClubDispersion } from './hole/useClubDispersion'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { useUnits } from '../../hooks/useUnits'
import { TYPE } from '../../lib/typography'
import {
  FALLBACK_CENTER,
  HOLE_SCOPED_DIALOGS,
  KICKER,
  type ActiveDialog,
} from './hole/types'
import { useHoleData } from './hole/useHoleData'
import { useHoleState } from './hole/useHoleState'
import { useShotActions } from './hole/useShotActions'
import { HoleModals } from './hole/HoleModals'
import { MapBottomChrome } from './MapBottomChrome'
import { LeftToolbar, RightRail } from './HoleMapOverlays'

// Distance-rail presets (Shot Pattern refs ux-10/11). Tee = arc TOTAL width
// in yards (half each side of the aim line); Appr = circle diameter in feet
// (greens use feet). Fixed presets, not a club picker. Shown in their native
// unit even on a meters profile — these are discrete golf-standard widths,
// not measured distances; a metric preset set is a deferred follow-up.
const TEE_RAIL_YARDS = [95, 85, 75, 65] as const
const APPR_RAIL_FEET = [50, 36, 30, 24] as const
const FEET_PER_YARD = 3

// Half-width of the two-dot tee box, each side of the line of play (matches
// PastRoundMap's dual-dot tee). Place the drive between the dots.
const TEE_BOX_HALF_YARDS = 4

interface LiveRoundSessionProps {
  roundId: string | undefined
  initialHoleNumber: number
  mode: 'live' | 'past'
  // Called whenever the player navigates to a new hole. The parent uses
  // this to keep the URL in sync (router.setParams) — but never to
  // remount the screen, which is the whole point of this component.
  // Optional so the component can be tested or driven without URL sync.
  onHoleChange?: (next: number) => void
}

// Resident live-round screen. Owns the MapView for the full round so
// @rnmapbox/maps doesn't accumulate stranded native peers across 18
// per-hole remounts — see #264. Hole transitions are state changes
// inside this component; the underlying route never re-navigates.
export default function LiveRoundSession({
  roundId,
  initialHoleNumber,
  mode,
  onHoleChange: syncHoleToUrl,
}: LiveRoundSessionProps) {
  const isPastMode = mode === 'past'
  const router = useRouter()
  const { user } = useAuth()
  const { toDisplay } = useUnits()
  const insets = useSafeAreaInsets()

  const [holeNumber, setHoleNumber] = useState(initialHoleNumber)

  // Per-hole UI state — modal/dialog flags + logger seed. These are
  // explicitly reset when holeNumber changes (see useEffect below) so
  // a modal left open on hole 5 doesn't reappear on hole 6.
  const [loggerOpen, setLoggerOpen] = useState(false)
  const [pinPlacementOpen, setPinPlacementOpen] = useState(false)
  const [scorecardOpen, setScorecardOpen] = useState(false)
  // One mutually-exclusive confirm dialog at a time. See ActiveDialog
  // in ./hole/types for the full union + rationale (#293).
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null)
  const [loggerInitial, setLoggerInitial] = useState<ShotLoggerValue>({})
  // Left-toolbar dispersion-dots toggle (T2). Drives the single-color
  // historical-shot scatter overlay; the render lands in T4. Off by
  // default — it's a summoned planning aid, not always-on clutter.
  const [dotsVisible, setDotsVisible] = useState(false)
  // True once the player drags the ball off its GPS-tracked position this
  // PLACE_BALL cycle — flips the place-ball CTA from "Mark ball at my GPS"
  // to the generic "Mark ball here". Reset on each new placement / hole.
  const [ballMoved, setBallMoved] = useState(false)
  // Aim overlay shape + size (T3). Tee → arc band, Appr → circle ring; the
  // rail index sizes each, kept per-mode so switching modes preserves the
  // other's pick. Default Tee, widest rail.
  const [overlayMode, setOverlayMode] = useState<'tee' | 'appr'>('tee')
  const [teeRailIdx, setTeeRailIdx] = useState(0)
  const [apprRailIdx, setApprRailIdx] = useState(0)
  // Round-options overflow menu (⋮) in the header — End / Delete live behind
  // it instead of as always-visible taps, so a destructive Delete can't be
  // mis-fired. A plain absolute popover (not a Modal) so it never collides
  // with the confirm dialogs it opens (#293 one-modal-per-presenter).
  const [menuOpen, setMenuOpen] = useState(false)

  // Per-hole reset. useHoleState resets its own refs (Kalman, manual
  // placement, last-saved-shot id) keyed on currentHoleId — we don't
  // duplicate that here. This effect covers the component-owned UI
  // state machine that those hooks can't see.
  useEffect(() => {
    setLoggerOpen(false)
    setPinPlacementOpen(false)
    setLoggerInitial({})
    setBallMoved(false)
    // Clear only hole-scoped dialogs (onGreen / aim). Session-scoped
    // confirms (delete / leave / end / exit) stay open across hole
    // navigation — a confirmDelete dialog mid-navigation should not
    // vanish out from under the user.
    setActiveDialog(prev =>
      prev !== null && HOLE_SCOPED_DIALOGS.has(prev) ? null : prev,
    )
  }, [holeNumber])

  // External URL change → internal state. The scorecard hole-jump
  // calls router.replace which updates the ?hole= search param;
  // RoundIndex re-renders and passes a new initialHoleNumber. Without
  // this sync, useState's initial-value semantics ignore the new prop
  // and the player is stranded on the previous hole. setHoleNumber
  // bails on no-op so this doesn't loop with the inline urlSync below.
  useEffect(() => {
    setHoleNumber(initialHoleNumber)
  }, [initialHoleNumber])

  const data = useHoleData(roundId, holeNumber)
  const finalState = useHoleState({
    currentHoleId: data.currentHole?.id ?? null,
    currentHoleScoreId: data.currentHoleScore?.id ?? null,
    isPastMode,
    storedPin: data.storedPin,
    roundPin: data.roundPin,
    tee: data.tee,
    hasPriorShots: data.remoteShotCount + data.localShotCount > 0,
  })

  // Each fresh PLACE_BALL entry (new shot, re-place) starts GPS-tracked, so the
  // ball is back at the GPS dot until the player drags it again.
  useEffect(() => {
    if (finalState.roundState === 'PLACE_BALL') setBallMoved(false)
  }, [finalState.roundState])

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

  // Two-dot tee box flanking the tee, oriented down the line of play (toward the
  // aim, else the pin). The marker ALWAYS derives from where the player actually
  // teed off — the FIRST shot's start — never the surveyed holes.tee_lat (real
  // tee boxes move daily; the stored coord lies about where you hit from).
  // While placing shot 1 that's the live ball as you drag it, so the marker
  // tracks it reactively. After shot 1, `data.tee` is the SAVED first-shot
  // start (= previousShots[0]). The stored course tee inside `data.tee` is
  // consulted ONLY as a last resort — before any first shot exists — so the
  // hole isn't marker-less on entry.
  const teeBox = useMemo<[LatLng, LatLng] | null>(() => {
    const origin =
      (data.shotNumber === 1 ? finalState.ball : null) ?? data.tee
    if (!origin) return null
    const toward = finalState.aim ?? data.roundPin ?? data.storedPin
    const heading = toward
      ? bearingDegrees(origin.lat, origin.lng, toward.lat, toward.lng)
      : 0
    return [
      destinationYards(origin, heading - 90, TEE_BOX_HALF_YARDS),
      destinationYards(origin, heading + 90, TEE_BOX_HALF_YARDS),
    ]
  }, [
    data.tee?.lat,
    data.tee?.lng,
    data.shotNumber,
    finalState.ball?.lat,
    finalState.ball?.lng,
    finalState.aim?.lat,
    finalState.aim?.lng,
    data.roundPin?.lat,
    data.roundPin?.lng,
    data.storedPin?.lat,
    data.storedPin?.lng,
  ])

  // Per-club dispersion from the player's whole history (one query/session).
  // The overlay shows the club whose median carry best matches the current
  // ball→aim distance; a tee shot with no aim yet falls back to the longest
  // club. Clubs with too little data simply produce no overlay (null).
  const { selectClub } = useClubDispersion(user?.id)
  // The dots' club is chosen by the SHOT distance (ball→pin), not ball→aim —
  // so nudging the aim doesn't swap clubs and make the pattern flicker. The
  // dots are still PLACED around the aim (in HoleMap); only WHICH club's
  // pattern shows is pinned to the shot you're facing. Null (no pin / tee
  // shot) → selectClub falls back to the longest club.
  const ballToPinYards = useMemo(() => {
    const pinPt = data.roundPin ?? data.storedPin
    if (!finalState.ball || !pinPt) return null
    return distanceYards(finalState.ball, pinPt)
  }, [
    finalState.ball?.lat,
    finalState.ball?.lng,
    data.roundPin?.lat,
    data.roundPin?.lng,
    data.storedPin?.lat,
    data.storedPin?.lng,
  ])
  // Single-color dispersion dots for the selected club (left-toolbar toggle).
  // Computed only when the dots are shown; sparse clubs → null (no dots).
  const dispersionPoints = useMemo(() => {
    if (!dotsVisible) return null
    const selected = selectClub(ballToPinYards)
    return selected ? selected.dispersion.points : null
  }, [dotsVisible, selectClub, ballToPinYards])

  // Overlay sizing from the active rail pick (fallbacks guard the indexed
  // access). Arc width = the yard preset; circle radius = diameter-ft ÷ 2 ÷ 3.
  const arcWidthYards = TEE_RAIL_YARDS[teeRailIdx] ?? TEE_RAIL_YARDS[0]
  const circleDiaFeet = APPR_RAIL_FEET[apprRailIdx] ?? APPR_RAIL_FEET[0]
  const circleRadiusYards = circleDiaFeet / 2 / FEET_PER_YARD
  const railLabels =
    overlayMode === 'tee'
      ? TEE_RAIL_YARDS.map((y) => `${y} yd`)
      : APPR_RAIL_FEET.map((f) => `${f} ft`)
  const railIndex = overlayMode === 'tee' ? teeRailIdx : apprRailIdx
  const selectRail = (i: number) =>
    overlayMode === 'tee' ? setTeeRailIdx(i) : setApprRailIdx(i)

  // Handicap for the live expected-strokes / SG readouts. Read once from the
  // canonical profiles.handicap_index (player-entered, refined by the web
  // round-complete recompute); falls back to DEFAULT_HANDICAP until it loads
  // or if unset. NOTE: mobile does not yet recompute the index after rounds —
  // it consumes whatever web/onboarding last wrote.
  const [handicap, setHandicap] = useState(DEFAULT_HANDICAP)
  useEffect(() => {
    if (!user?.id) return
    let active = true
    getProfile(supabase, user.id).then(({ data }) => {
      if (!active) return
      const idx = (data as { handicap_index?: number | null } | null)?.handicap_index
      if (idx != null) setHandicap(idx)
    })
    return () => {
      active = false
    }
  }, [user?.id])

  const totalShotsThisHole =
    data.remoteShotCount + data.localShotCount > 0
      ? data.remoteShotCount + data.localShotCount
      : 0

  const actions = useShotActions({
    id: roundId,
    user,
    holeNumber,
    data,
    state: finalState,
    setLoggerOpen,
    setLoggerInitial,
    setPinPlacementOpen,
    setActiveDialog,
    // URL sync fires here — only on user-driven navigation (Next /
    // Prev / Finish), not on every render. A reactive useEffect that
    // depended on the parent's onHoleChange prop looped because the
    // prop was a new arrow on every parent render → effect re-fired →
    // setParams → parent re-render → ...
    onHoleChange: (next) => {
      setHoleNumber(next)
      syncHoleToUrl?.(next)
    },
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
          style={[
            TYPE.serif,
            {
              color: '#1C211C',
              fontSize: 20,
              fontStyle: 'italic',
              fontWeight: '500',
              textAlign: 'center',
              marginBottom: 10,
            },
          ]}
        >
          {headline}
        </Text>
        <Text
          style={[
            TYPE.body,
            {
              color: '#5C6356',
              fontSize: 13,
              lineHeight: 18,
              textAlign: 'center',
              marginBottom: 22,
            },
          ]}
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
            style={[
              TYPE.bodyBold,
              {
                color: '#1F3D2C',
                fontSize: 13,
                fontWeight: '600',
                letterSpacing: 0.3,
              },
            ]}
          >
            Try again
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Exit round and discard"
          onPress={() => setActiveDialog('exit')}
          style={{
            backgroundColor: '#A33A2A',
            borderRadius: 2,
            paddingVertical: 14,
            paddingHorizontal: 24,
          }}
        >
          <Text
            style={[
              TYPE.bodyBold,
              {
                color: '#F2EEE5',
                fontSize: 14,
                fontWeight: '600',
                letterSpacing: 0.3,
              },
            ]}
          >
            Exit round
          </Text>
        </Pressable>
        <ConfirmDialog
          visible={activeDialog === 'exit'}
          title="Leave this round?"
          message="Nothing's been logged yet, so the round will be discarded."
          confirmLabel="Leave round"
          cancelLabel="Stay"
          destructive
          busy={actions.deleting}
          onConfirm={actions.handleExitFromError}
          onCancel={() => setActiveDialog(null)}
        />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F2EEE5' }}>
      <View
        style={{
          backgroundColor: '#1C211C',
          // Was a hardcoded 52 (Android ~24dp status bar + 28 gap); use the
          // real top inset so the header clears the Dynamic Island (#494).
          paddingTop: insets.top + 28,
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
          onPress={() => setActiveDialog('leave')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ padding: 6 }}
        >
          <Text style={[TYPE.kicker, { ...KICKER, color: 'rgba(242,238,229,0.6)' }]}>
            ← Home
          </Text>
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text
            style={[
              TYPE.kicker,
              {
                ...KICKER,
                color: 'rgba(242,238,229,0.45)',
                marginBottom: 4,
              },
            ]}
          >
            Hole {holeNumber}
          </Text>
          <Text
            style={[
              TYPE.serif,
              {
                color: '#F2EEE5',
                fontSize: 17,
                fontWeight: '500',
                fontStyle: 'italic',
              },
            ]}
          >
            Par {data.currentHole.par}
            {data.currentHole.yards ? ` · ${toDisplay(data.currentHole.yards)}` : ''}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={[TYPE.kicker, { ...KICKER, color: 'rgba(242,238,229,0.45)' }]}>
            Shot {data.shotNumber}
          </Text>
          <PressableTouch
            accessibilityRole="button"
            accessibilityLabel="Round options"
            onPress={() => setMenuOpen(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            android_ripple={{ color: 'rgba(242,238,229,0.2)', borderless: true, radius: 18 }}
            style={{ paddingHorizontal: 6, paddingVertical: 2 }}
          >
            <Text style={[TYPE.bodyBold, { color: '#F2EEE5', fontSize: 22, fontWeight: '600', lineHeight: 24 }]}>
              ⋮
            </Text>
          </PressableTouch>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <HoleMap
          center={center}
          pin={data.storedPin}
          roundPin={data.roundPin}
          tee={data.tee}
          teeBox={teeBox}
          aim={finalState.aim}
          ball={finalState.ball}
          overlayMode={overlayMode}
          arcWidthYards={arcWidthYards}
          circleRadiusYards={circleRadiusYards}
          dotsVisible={dotsVisible}
          dispersionPoints={dispersionPoints}
          handicap={handicap}
          previousShots={data.previousShots}
          gpsPosition={finalState.gpsPosition}
          courseCenter={data.courseCenter}
          holeNumber={holeNumber}
          missingHoleLayout={data.tee == null && data.storedPin == null && data.roundPin == null}
          phase={
            pinPlacementOpen
              ? 'PIN'
              : finalState.roundState === 'SET_AIM'
                ? 'SET_AIM'
                : 'PLACE_BALL'
          }
          // A SET_AIM → SHOT_DETAIL/PUTTING transition is a real shot commit;
          // SET_AIM → bare PLACE_BALL ("Re-place ball") is a backout. The
          // collapsed `phase` above can't tell them apart, so the aim-ghost
          // promotion reads this raw-roundState signal instead.
          aimCommitted={
            finalState.roundState === 'SHOT_DETAIL' ||
            finalState.roundState === 'PUTTING'
          }
          showLocationPuck={
            finalState.roundState !== 'SHOT_DETAIL' &&
            finalState.roundState !== 'PUTTING'
          }
          onSetAim={(loc) => {
            // A user drag / long-press is an explicit aim — mark it touched so
            // it persists (an untouched auto-spawn suggestion is dropped on
            // save). All user aim-sets route through this prop.
            finalState.setAim(loc)
            finalState.setAimTouched(true)
          }}
          onSetBall={(loc) => {
            // Manual drag/tap is an explicit override. Freeze GPS
            // updates for this PLACE_BALL cycle and re-anchor the
            // Kalman filter at the manual point with a low variance
            // (1 m²) — strong prior so any future un-freeze still
            // resists snapping back to a noisy raw fix.
            finalState.manuallyPlacedRef.current = true
            setBallMoved(true)
            finalState.kalmanStateRef.current = {
              lat: loc.lat,
              lng: loc.lng,
              variance: 1,
            }
            finalState.setBall(loc)
          }}
          onPlacePin={actions.persistRoundPin}
        />
        {finalState.aimHintVisible && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss aim point hint"
            onPress={() => finalState.setAimHintVisible(false)}
            style={{
              position: 'absolute',
              // Tracks the header offset (was 48 = ~24dp status bar + 24) so
              // it shifts down with the header on notched devices (#494).
              top: insets.top + 24,
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
            <Text style={[TYPE.body, { color: '#F2EEE5', fontSize: 13, lineHeight: 18 }]}>
              Aim point = start line. Drag to adjust.
            </Text>
          </Pressable>
        )}
        <LeftToolbar
          dotsVisible={dotsVisible}
          onToggleDots={() => setDotsVisible((v) => !v)}
          onPlacePin={() => setPinPlacementOpen(true)}
          pinMode={pinPlacementOpen}
        />
        {/* Tee/Appr + distance rail — appears once an aim exists, hidden
            during pin placement so it doesn't fight that flow. */}
        {finalState.aim && !pinPlacementOpen && (
          <RightRail
            mode={overlayMode}
            onSetMode={setOverlayMode}
            railLabels={railLabels}
            railIndex={railIndex}
            onSelectRail={selectRail}
          />
        )}
        <MapBottomChrome
          roundState={finalState.roundState}
          pinPlacementOpen={pinPlacementOpen}
          ball={finalState.ball}
          aim={finalState.aim}
          saving={actions.saving}
          roundPin={data.roundPin}
          hasGps={finalState.gpsPosition != null}
          ballFromGps={
            !isPastMode &&
            finalState.gpsPosition != null &&
            finalState.ball != null &&
            !ballMoved
          }
          totalShotsThisHole={totalShotsThisHole}
          holeNumber={holeNumber}
          holeCount={data.holeCount}
          par={data.currentHole.par}
          yardsLabel={data.currentHole.yards ? toDisplay(data.currentHole.yards) : null}
          onCancelPinPlacement={() => setPinPlacementOpen(false)}
          onClearRoundPin={actions.clearRoundPin}
          onConfirmAim={actions.confirmAim}
          onRePlaceBall={() => {
            // Clear the aim when backing out to re-place — otherwise the
            // abandoned aim line lingers (showAim includes PLACE_BALL) and the
            // ghost promotion is suppressed (see AimGhost). markBallHere
            // re-seeds a fresh aim on the next mark.
            finalState.setAim(null)
            finalState.setRoundState('PLACE_BALL')
          }}
          onSkipAim={actions.skipAim}
          onMarkBallHere={actions.markBallHere}
          onFinishHole={actions.finishHole}
          onPrev={() => actions.navigateHole(-1)}
          onNext={() => actions.navigateHole(1)}
          onOpenScorecard={() => setScorecardOpen(true)}
        />
      </View>

      <HoleModals
        shotNumber={data.shotNumber}
        // Compound key: hole_score id + per-save counter. Changes
        // only on a real "new shot entry" event — a legitimate save
        // (counter bumps in useShotActions) or a hole change (id
        // changes). Never on incidental shotNumber recomputation
        // from background fetches or sync. See #284.
        shotEntryKey={`${data.currentHoleScore?.id ?? 'init'}-${actions.shotEntrySeq}`}
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
        id={roundId}
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
        activeDialog={activeDialog}
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
        onCancelDelete={() => setActiveDialog(null)}
        onConfirmLeave={() => {
          setActiveDialog(null)
          router.replace('/(app)')
        }}
        onCancelLeave={() => setActiveDialog(null)}
        onConfirmEnd={actions.handleEndRound}
        onCancelEnd={() => setActiveDialog(null)}
        onGreenYes={actions.handleOnGreenYes}
        onGreenNo={actions.handleOnGreenNo}
        onAimPromptConfirm={actions.handleAimPromptConfirm}
        onAimPromptSkip={actions.handleAimPromptSkip}
      />

      {/* Round-options popover. Full-screen transparent backdrop catches the
          outside-tap to dismiss; the card is right-aligned under the header.
          Static styles only (function `style` is dropped by css-interop). */}
      {menuOpen && (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close menu"
            onPress={() => setMenuOpen(false)}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 }}
          />
          <View
            style={{
              position: 'absolute',
              // Drops just below the header; was 96 = ~24dp status bar + 72.
              // Derive from the inset so it stays flush under the header
              // when it grows on notched devices (#494).
              top: insets.top + 72,
              right: 12,
              zIndex: 21,
              minWidth: 184,
              backgroundColor: '#1C211C',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: 'rgba(242,238,229,0.15)',
              paddingVertical: 6,
              shadowColor: '#000',
              shadowOpacity: 0.4,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 8,
            }}
          >
            <PressableTouch
              accessibilityRole="button"
              accessibilityLabel="End round early"
              onPress={() => {
                setMenuOpen(false)
                setActiveDialog('end')
              }}
              android_ripple={{ color: 'rgba(242,238,229,0.15)' }}
              style={{ paddingVertical: 12, paddingHorizontal: 16 }}
            >
              <Text style={[TYPE.bodyBold, { color: '#F2EEE5', fontSize: 15, fontWeight: '600' }]}>
                End round early
              </Text>
            </PressableTouch>
            <View
              style={{
                height: 1,
                backgroundColor: 'rgba(242,238,229,0.1)',
                marginHorizontal: 8,
              }}
            />
            <PressableTouch
              accessibilityRole="button"
              accessibilityLabel="Delete round"
              onPress={() => {
                setMenuOpen(false)
                setActiveDialog('delete')
              }}
              android_ripple={{ color: 'rgba(163,58,42,0.22)' }}
              style={{ paddingVertical: 12, paddingHorizontal: 16 }}
            >
              <Text style={[TYPE.bodyBold, { color: '#E0796B', fontSize: 15, fontWeight: '600' }]}>
                Delete round
              </Text>
            </PressableTouch>
          </View>
        </>
      )}
    </View>
  )
}
