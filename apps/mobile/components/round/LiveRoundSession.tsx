import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  View,
} from 'react-native'
import { PressableTouch } from '../ui/PressableTouch'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { HoleMap, type LatLng } from './HoleMap'
import { HoleReviewSheet } from './HoleReviewSheet'
import { ShotStepper } from './ShotStepper'
import type { ShotLoggerValue } from './ShotLogger'
import {
  DEFAULT_HANDICAP,
  bearingDegrees,
  buildInitialRows,
  destinationYards,
  type CaptureMode,
} from '@oga/core'
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
  // Live capture mode (rounds.capture_mode). 'just_track' saves ball
  // locations only; 'track_patterns' captures an aim per shot. Defaults to
  // 'track_patterns' at the call site.
  captureMode: CaptureMode
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
  captureMode,
  onHoleChange: syncHoleToUrl,
}: LiveRoundSessionProps) {
  const isPastMode = mode === 'past'
  const router = useRouter()
  const { user } = useAuth()
  const { toDisplay } = useUnits()
  const insets = useSafeAreaInsets()

  const [holeNumber, setHoleNumber] = useState(initialHoleNumber)

  // Monotonic high-water mark of the finish-advance frontier — the "active
  // capture hole" signal for editMode below. Deliberately NOT ratcheted off
  // `holeNumber` in a generic effect (fix round 1 did that, and it was still
  // wrong — see fix round 2): peeking `‹`/`›` or jumping via the scorecard
  // moves `holeNumber` freely without this changing, so a forward peek/jump
  // can never advance the frontier either. It only moves in the ONE place a
  // hole is genuinely finished and the round advances — `onAdvanceHole`
  // below, passed to useShotActions and invoked from its `advanceAfterHole`
  // — plus the deliberate synthetic bump in `handleEditHoleOnMap` (edit mode
  // entry from a hole's own summary, not a peek). Initialized to the round's
  // resume point, same seed `holeNumber` uses.
  const [furthestHoleReached, setFurthestHoleReached] = useState(initialHoleNumber)

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
  // Deep-link / refresh clamp (#718): ?hole= can name a hole past the
  // round's actual count (e.g. hole=10 on a 9-hole round) — the
  // Resume-banner path (useActiveRound) already clamps to the round's
  // real hole count, this mirrors it here once data.holeCount is known,
  // instead of stranding the player on the "isn't set up" error branch.
  useEffect(() => {
    if (data.loading) return
    if (holeNumber > data.holeCount) {
      setHoleNumber(data.holeCount)
      // furthestHoleReached may have been seeded from the same bad
      // initialHoleNumber (its own useState mirrors holeNumber's initial
      // value) — its ratchet effect only ever raises it, so a downward
      // clamp here needs its own explicit correction, or the just-clamped
      // hole could transiently read as "behind the furthest" (→ editMode)
      // on load, even though it's the round's real current hole.
      setFurthestHoleReached((f) => Math.min(f, data.holeCount))
    }
  }, [data.loading, data.holeCount, holeNumber])
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
  // Putt distance in feet, mirrored from HoleModals' ShotLogger puttDistanceFt
  // calc (yards × 3 = feet). Feeds both the on-green make-% pill and the
  // persisted putt_distance_ft on Made/Missed.
  const puttDistanceFt =
    ballToPinYards != null ? Math.round(ballToPinYards * 3) : null
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

  // End-of-hole review rows. Built from the shots placed live (their start
  // coords, in order) via the shared @oga/core inference — same call the web
  // review sheet uses. Only computed while the summary is open. The pin
  // anchors the last shot's end + every shot's distance-to-pin; with no pin
  // (unmapped hole, none placed) the last placed point stands in so distances
  // degrade to ~0 rather than exploding off [0,0].
  const summaryRows = useMemo(() => {
    if (finalState.roundState !== 'SUMMARY') return []
    const pts = data.previousShots
    if (pts.length === 0) return []
    const pin = data.roundPin ?? data.storedPin ?? pts[pts.length - 1]!
    const par = data.resolvedHole?.par ?? data.currentHoleScore?.par ?? data.currentHole?.par ?? 4
    return buildInitialRows(pts, par, pin.lat, pin.lng)
  }, [
    finalState.roundState,
    data.previousShots,
    data.roundPin,
    data.storedPin,
    data.resolvedHole?.par,
    data.currentHoleScore?.par,
    data.currentHole?.par,
  ])

  const actions = useShotActions({
    id: roundId,
    user,
    holeNumber,
    captureMode,
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
    // Fires ONLY from advanceAfterHole (a genuine finish) — see the prop's
    // own doc comment in useShotActions.ts. This is the one place
    // `furthestHoleReached` is allowed to move off a `holeNumber` change;
    // navigateHole's peeks go through `onHoleChange` above instead, which
    // never touches it (fix round 2, C1 residual).
    onAdvanceHole: (next) => {
      setFurthestHoleReached((f) => Math.max(f, next))
      setHoleNumber(next)
      syncHoleToUrl?.(next)
    },
  })

  // Played-hole on-map EDIT mode (vs. live capture): true when the shown
  // hole is BEHIND the finish-advance frontier AND has ≥1 logged shot — i.e.
  // a hole is editable IFF the player has finished PAST it. `furthestHoleReached`
  // only moves via a genuine finish (`onAdvanceHole` above) or the deliberate
  // synthetic bump in `handleEditHoleOnMap`, never off a bare `holeNumber`
  // change — so neither a backward peek (`‹`), a forward peek (`›` to an
  // untouched next hole), nor a scorecard jump ahead can move it. The active
  // hole, and any hole merely peeked/jumped to (even one with shots logged),
  // therefore always satisfies `holeNumber >= furthestHoleReached` →
  // editMode false, capture chrome intact — the append-lock trap (fix round
  // 1's C1, and its forward-peek/jump residual in fix round 2) is
  // structurally impossible. ANDed with `previousShots.length > 0` since
  // Step 3 below indexes directly into the previousShots/previousShotIds
  // arrays. See task-4-report.md §Fix round 2 for the verified case list.
  const editMode = holeNumber < furthestHoleReached && data.previousShots.length > 0

  // Which of this hole's played shots is selected in edit mode. Reset to the
  // first shot on a hole switch; clamped into bounds whenever the shot count
  // changes (e.g. after a delete shrinks it).
  const [activeShotIdx, setActiveShotIdx] = useState(0)
  useEffect(() => {
    setActiveShotIdx(0)
  }, [holeNumber])
  useEffect(() => {
    setActiveShotIdx((i) => Math.min(i, Math.max(0, data.previousShots.length - 1)))
  }, [data.previousShots.length])

  // Edit-mode marker drag → reposition via the online-first moveShot (reuses
  // HoleMap's existing 5-yd-ignore threshold on the ball annotation's
  // onDragEnd — this is just a different onSetBall handler, not new drag
  // logic).
  const handleEditModeMove = async (loc: LatLng) => {
    const shotId = data.previousShotIds[activeShotIdx]
    if (!shotId) return
    await actions.moveShot(shotId, loc)
  }

  const handleDeleteActiveShot = () => {
    const shotId = data.previousShotIds[activeShotIdx]
    if (!shotId) return
    Alert.alert(
      'Delete this shot?',
      'This removes the shot and renumbers the rest of the hole.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void actions.deleteShot(shotId)
          },
        },
      ],
    )
  }

  // "Edit on map" from the summary: the just-finished hole is still ===
  // furthestHoleReached (the player hasn't advanced past it yet), so the
  // editMode predicate above would read false for it — same "furthest hole
  // is always capture mode" invariant that fixes C1, just now working
  // against us for the ONE hole that's simultaneously the furthest AND
  // wants edit mode. Bump the high-water mark past it so
  // `holeNumber < furthestHoleReached` reads true here too.
  // `furthestHoleReached` feeds nothing else (hole-count bounds are
  // separately governed by data.holeCount in navigateHole), so bumping it
  // synthetically is safe. actions.editHoleOnMap() still closes the SUMMARY
  // overlay and clears appendEngaged (suppresses the GPS/aim live-capture
  // aids inside useHoleState via isRevisitingPlayedHole).
  const handleEditHoleOnMap = () => {
    setFurthestHoleReached((f) => Math.max(f, holeNumber + 1))
    actions.editHoleOnMap()
  }

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
      ? 'Check your connection and try again, or leave and resume this round later.'
      : 'Try again, or leave and pick this round back up from the home screen.'
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
          accessibilityLabel="Leave and go to the home screen"
          onPress={() => setActiveDialog('exit')}
          style={{
            backgroundColor: '#5C6356',
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
            Leave to home
          </Text>
        </Pressable>
        <ConfirmDialog
          visible={activeDialog === 'exit'}
          title="Leave this round?"
          message="Your round is saved — you can resume it from the home screen."
          confirmLabel="Leave"
          cancelLabel="Stay"
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
              },
            ]}
          >
            Par {data.resolvedHole?.par ?? data.currentHole.par}
            {data.resolvedHole?.yards ? ` · ${toDisplay(data.resolvedHole.yards)}` : ''}
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
          ball={editMode ? data.previousShots[activeShotIdx] ?? null : finalState.ball}
          overlayMode={overlayMode}
          arcWidthYards={arcWidthYards}
          circleRadiusYards={circleRadiusYards}
          dotsVisible={dotsVisible}
          dispersionPoints={dispersionPoints}
          handicap={handicap}
          // Edit mode: only the shots BEFORE the active one form the
          // breadcrumb (mirrors PastRoundMap's review stepper) — the active
          // shot itself is the `ball` above, and shots after it aren't drawn
          // while stepping through an earlier one.
          previousShots={
            editMode ? data.previousShots.slice(0, activeShotIdx) : data.previousShots
          }
          gpsPosition={finalState.gpsPosition}
          courseCenter={data.courseCenter}
          holeNumber={holeNumber}
          phase={
            pinPlacementOpen
              ? 'PIN'
              : editMode
                ? 'PLACE_BALL'
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
            finalState.roundState !== 'PUTTING' &&
            // Hide the live GPS puck while revisiting a played hole — that hole
            // is in breadcrumb-only review mode until "Add a shot" (#484).
            !finalState.isRevisitingPlayedHole
          }
          tapToPlaceBall={!editMode}
          focusOn={editMode ? data.previousShots[activeShotIdx] ?? null : null}
          showRecenterButton={!editMode}
          onSetAim={(loc) => {
            // A user drag / long-press is an explicit aim — mark it touched so
            // it persists (an untouched auto-spawn suggestion is dropped on
            // save). All user aim-sets route through this prop.
            finalState.setAim(loc)
            finalState.setAimTouched(true)
          }}
          onSetBall={
            editMode
              ? handleEditModeMove
              : (loc) => {
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
                }
          }
          onRecenterBall={(loc) => {
            // Deliberate recenter tap = "put the ball back on me": the
            // inverse of onSetBall above. Lift the manual freeze, restart
            // the Kalman filter from the next fresh fix, and snap the ball
            // to GPS now for instant feedback. ballMoved=false restores
            // the HUD's ball-from-GPS labeling.
            if (isPastMode) return
            finalState.manuallyPlacedRef.current = false
            setBallMoved(false)
            finalState.kalmanStateRef.current = null
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
          isRevisitingPlayedHole={finalState.isRevisitingPlayedHole}
          editMode={editMode}
          totalShotsThisHole={totalShotsThisHole}
          holeNumber={holeNumber}
          holeCount={data.holeCount}
          par={data.resolvedHole?.par ?? data.currentHole.par}
          yardsLabel={data.resolvedHole?.yards ? toDisplay(data.resolvedHole.yards) : null}
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
          // Auto-detect on-green entry lives inside markBallHere itself
          // (restored from pre-#791 — see useShotActions comment); this
          // stays a plain pass-through. The chip below still forces toGreen
          // explicitly as the fallback.
          onMarkBallHere={actions.markBallHere}
          onOnGreen={() => actions.markBallHere({ toGreen: true })}
          onGreenActive={finalState.roundState === 'PUTTING'}
          puttDistanceFt={puttDistanceFt}
          onPuttMade={() =>
            actions.persistPutt({
              puttMade: true,
              puttDistanceFt: puttDistanceFt ?? undefined,
            })
          }
          onPuttMissed={() =>
            actions.persistPutt({
              puttMade: false,
              puttDistanceFt: puttDistanceFt ?? undefined,
            })
          }
          onNotOnGreen={actions.notOnGreen}
          onAddShot={() => {
            // Opt back into the live append flow on a revisited played hole:
            // re-arm the GPS ball + auto-aim and enter PLACE_BALL (#484).
            finalState.setAppendEngaged(true)
            finalState.setRoundState('PLACE_BALL')
          }}
          onFinishHole={actions.finishHole}
          onPrev={() => actions.navigateHole(-1)}
          onNext={() => actions.navigateHole(1)}
          onOpenScorecard={() => setScorecardOpen(true)}
        />
        {/* Played-hole edit HUD (Step 3) — replaces MapBottomChrome's
            contextual-action row (suppressed via editMode above) while the
            hole-nav pill stays mounted underneath it. */}
        {editMode && (
          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: insets.bottom + 68,
              alignItems: 'center',
            }}
          >
            <ShotStepper
              index={activeShotIdx}
              count={data.previousShots.length}
              onPrev={() => setActiveShotIdx((i) => Math.max(0, i - 1))}
              onNext={() =>
                setActiveShotIdx((i) => Math.min(data.previousShots.length - 1, i + 1))
              }
              onDelete={handleDeleteActiveShot}
              deleteDisabled={data.previousShots.length === 0}
            />
          </View>
        )}
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
        scorecardOpen={scorecardOpen}
        holes={data.holes}
        holeScores={data.holeScores}
        resolvedHoleByNumber={data.resolvedHoleByNumber}
        holeNumber={holeNumber}
        routerReplace={(href) => router.replace(href as Parameters<typeof router.replace>[0])}
        id={roundId}
        onChangePar={async (holeId, newPar) => {
          // Par is a per-round override on hole_scores.par (#710) — this
          // round's opinion, not global course curation (holes has no
          // UPDATE policy; the old direct update silently no-op'd). The
          // hole's hole_scores row is batch-created at round start.
          const hs = data.holeScores.find((s) => s.hole_id === holeId)
          if (!hs) return
          // Optimistic update so the cell reflects the tap immediately.
          // Roll back if the DB write fails so the UI doesn't lie.
          const prev = hs.par
          data.setHoleScores((cur) =>
            cur.map((s) => (s.id === hs.id ? { ...s, par: newPar } : s)),
          )
          const { data: updated, error: parErr } = await supabase
            .from('hole_scores')
            .update({ par: newPar })
            .eq('id', hs.id)
            .select('id')
          // 0 returned rows = RLS filtered the write while reporting
          // success — the exact failure mode from #710. Treat as failure.
          if (parErr || !updated || updated.length === 0) {
            data.setHoleScores((cur) =>
              cur.map((s) => (s.id === hs.id ? { ...s, par: prev } : s)),
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
        onCloseLogger={actions.closeLogger}
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

      {/* End-of-hole review — full-screen overlay (zIndex 40). Confirms each
          shot's club / lie / result + putt read for the shots logged
          location-only during play, then writes metadata + hole_scores and
          advances (#791). */}
      <HoleReviewSheet
        visible={finalState.roundState === 'SUMMARY'}
        holeNumber={holeNumber}
        par={data.resolvedHole?.par ?? data.currentHole.par}
        initialRows={summaryRows}
        saving={actions.saving}
        onSave={actions.saveHoleSummary}
        onEditOnMap={handleEditHoleOnMap}
        shotIds={data.previousShotIds}
        onDeleteShot={actions.deleteShot}
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
