import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, BackHandler, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { HoleMap, type LatLng } from './HoleMap'
import type { OffscreenArrow } from './HoleMap.types'
import { HoleReviewSheet } from './HoleReviewSheet'
import { ShotStepper } from './ShotStepper'
import type { ShotLoggerValue } from './ShotLogger'
import {
  DEFAULT_BAG,
  DEFAULT_HANDICAP,
  NEAR_GREEN_YARDS,
  bearingDegrees,
  buildInitialRows,
  destinationYards,
  formatClubLabel,
  getExpectedStrokes,
  type CaptureMode,
  type Club,
} from '@oga/core'
import { getProfile } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { distanceYards } from '../../lib/maps'
import { useAuth } from '../../hooks/useAuth'
import { useClubDispersion } from './hole/useClubDispersion'
import { useUserBag } from '../../hooks/useUserBag'
import { useUnits } from '../../hooks/useUnits'
import { getLeftHand } from '../../lib/leftHand'
import { FALLBACK_CENTER, HOLE_SCOPED_DIALOGS, type ActiveDialog } from './hole/types'
import { useHoleData } from './hole/useHoleData'
import { useHoleState } from './hole/useHoleState'
import { useShotActions } from './hole/useShotActions'
import { HoleModals } from './hole/HoleModals'
import { LiveRoundDock, MIN_BOTTOM_STRIP } from './LiveRoundDock'
import { LiveRoundHeader, RoundOptionsMenu } from './LiveRoundHeader'
import { APPR_RULER_FEET, TEE_RULER_YARDS, rulerValueAt } from './HoleMapOverlays'
import { LiveRoundError } from './LiveRoundError'
import { P } from '../paper/tokens'

const FEET_PER_YARD = 3
// Aim framing (#611 §13): the ball sits this far above the dock top, so its
// 44 dp grab disc clears the footer by 12.
const BALL_ABOVE_DOCK = 34

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
  // The round was finalized — the parent swaps to the summary (#909).
  onRoundCompleted: () => void
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
  onRoundCompleted,
}: LiveRoundSessionProps) {
  const isPastMode = mode === 'past'
  const router = useRouter()
  const { user } = useAuth()
  const { unit, toDisplay } = useUnits()
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
  // Where the most recent shot's marker is when it's off-screen (HoleMap
  // measures it) — picks the OB prompt's form below (#895 B2).
  const [lastShotArrow, setLastShotArrow] = useState<OffscreenArrow | null>(null)
  // The dock footer's measured height — the aim frame keeps the ball above it.
  const [footerHeight, setFooterHeight] = useState(0)
  const recenterRef = useRef<(() => void) | null>(null)
  // Left-hand layout (§12), device-local; re-read on focus since Profile is
  // a tab away while this screen stays mounted.
  const [lefty, setLefty] = useState(false)
  useFocusEffect(
    useCallback(() => {
      void getLeftHand().then(setLefty)
    }, []),
  )
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
  const { selectClub, byClub } = useClubDispersion(user?.id)
  const { bag } = useUserBag({ seedIfEmpty: true })
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

  // Overlay sizing from the ruler. At rest it's the preset; while a finger
  // drags the ruler it's a fractional ruler position for the active mode. Circle radius = diameter-ft ÷ 2 ÷ 3.
  const [scrubPos, setScrubPos] = useState<number | null>(null)
  const railIndex = overlayMode === 'tee' ? teeRailIdx : apprRailIdx
  const railPos = scrubPos ?? railIndex
  const arcWidthYards = rulerValueAt(TEE_RULER_YARDS, overlayMode === 'tee' ? railPos : teeRailIdx)
  const circleRadiusYards =
    rulerValueAt(APPR_RULER_FEET, overlayMode === 'appr' ? railPos : apprRailIdx) / 2 / FEET_PER_YARD
  const selectRail = (i: number) => {
    setScrubPos(null)
    if (overlayMode === 'tee') setTeeRailIdx(i)
    else setApprRailIdx(i)
  }

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

  // Header hero (§3): ball → pin with one decimal, in feet (or metres) while
  // putting, plus expected strokes to hole out from there.
  const putting = finalState.roundState === 'PUTTING'
  const heroDistance = useMemo(() => {
    if (ballToPinYards == null) return null
    const text =
      putting && unit !== 'meters'
        ? `${(ballToPinYards * FEET_PER_YARD).toFixed(1)} ft`
        : toDisplay(ballToPinYards, 1)
    const [value = '', u = ''] = text.split(' ')
    return { value, unit: u }
  }, [ballToPinYards, putting, unit, toDisplay])
  const expectedStrokes =
    ballToPinYards == null
      ? null
      : putting
        ? getExpectedStrokes('putting', undefined, ballToPinYards * FEET_PER_YARD, handicap)
        : getExpectedStrokes(
            ballToPinYards <= NEAR_GREEN_YARDS ? 'around_green' : 'approach',
            Math.round(ballToPinYards),
            undefined,
            handicap,
          )

  const totalShotsThisHole =
    data.remoteShotCount + data.localShotCount > 0
      ? data.remoteShotCount + data.localShotCount
      : 0

  // Club wheel (#611 §4): the bag minus the putter, one row per club type.
  // It opens on the auto pick every shot; a manual pick lasts one shot.
  const [clubOverride, setClubOverride] = useState<Club | null>(null)
  useEffect(() => setClubOverride(null), [holeNumber, totalShotsThisHole])
  const wheelRows = useMemo(() => {
    const seen = new Set<string>()
    return (bag.length > 0 ? bag : DEFAULT_BAG)
      .filter((c) => c.club_type !== 'putter' && !seen.has(c.club_type) && !!seen.add(c.club_type))
      .map((c) => {
        const d = byClub.get(c.club_type as Club)
        return {
          club: c.club_type as Club,
          label: formatClubLabel(c),
          carryYards: d?.medianCarryYards ?? null,
          shots: d?.points.length ?? 0,
          sparse: !d?.dispersion,
        }
      })
  }, [bag, byClub])
  const autoClub = useMemo(
    () => selectClub(ballToPinYards, new Set(wheelRows.map((r) => r.club)))?.club ?? null,
    [selectClub, ballToPinYards, wheelRows],
  )
  const wheelClub = clubOverride ?? autoClub ?? wheelRows[0]?.club ?? null
  // The Pattern key draws the wheel club's shots around the aim.
  const pattern = useMemo(() => {
    const d = dotsVisible && wheelClub ? byClub.get(wheelClub) : undefined
    return d ? { points: d.points, dispersion: d.dispersion } : null
  }, [dotsVisible, wheelClub, byClub])

  // Manual ball placement: an explicit override of the GPS-tracked marker.
  // Freeze GPS updates for this PLACE_BALL cycle and re-anchor the Kalman
  // filter at the manual point with a low variance (1 m²) — strong prior so
  // any future un-freeze still resists snapping back to a noisy raw fix.
  // Used by the map drag/tap AND by the OB chip's stroke-and-distance snap
  // (#839), so both freeze GPS identically rather than through two paths.
  const placeBallManually = (loc: LatLng) => {
    finalState.manuallyPlacedRef.current = true
    setBallMoved(true)
    finalState.kalmanStateRef.current = {
      lat: loc.lat,
      lng: loc.lng,
      variance: 1,
    }
    finalState.setBall(loc)
  }

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
    placeBallManually,
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
    onAdvanceHole: (next, rewind) => {
      setFurthestHoleReached((f) => (rewind ? next : Math.max(f, next)))
      setHoleNumber(next)
      syncHoleToUrl?.(next)
    },
    onRoundCompleted,
  })

  // Android Back (#915): menu/pin/aim aren't Modals; runs before the router's listener (newest first).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (data.loading || data.error || !data.round || !data.currentHole || !data.currentHoleScore) return false
      if (menuOpen) setMenuOpen(false)
      else if (pinPlacementOpen) setPinPlacementOpen(false)
      else if (finalState.roundState !== 'SET_AIM') setActiveDialog('leave')
      else { finalState.setAim(null); finalState.setRoundState('PLACE_BALL') } // = onRePlaceBall
      return true
    })
    return () => sub.remove()
  }, [menuOpen, pinPlacementOpen, finalState, data])

  // End-of-hole review rows. Built from the shots placed live (their start
  // coords, in order) via the shared @oga/core inference — same call the web
  // review sheet uses. Only computed while the summary is open. The pin
  // anchors the last shot's end + every shot's distance-to-pin; with no pin
  // (unmapped hole, none placed) the last placed point stands in so distances
  // degrade to ~0 rather than exploding off [0,0].
  //
  // Declared below `actions` (rather than with the other data derivations
  // above) because the OB seeding needs actions.shotObs — see below.
  const summaryRows = useMemo(() => {
    if (finalState.roundState !== 'SUMMARY') return []
    const pts = data.previousShots
    if (pts.length === 0) return []
    const pin = data.roundPin ?? data.storedPin ?? pts[pts.length - 1]!
    const par = data.resolvedHole?.par ?? data.currentHoleScore?.par ?? data.currentHole?.par ?? 4
    // Carry the OB flag onto the rows (#839). buildInitialRows is geometry
    // only — it never sets shotResult — and ReviewedShotRow has no `ob` field
    // at all, so this string is the ONLY way a penalty reaches the sheet.
    // Without it the sheet is blind to an OB the player already marked: the
    // score ticker re-seeds to the struck count and Save persists that back
    // over the chip's bump, the row shows no OB chip, and saveHoleSummary
    // (which sources shot_result from the reviewed row, never from the stored
    // one) writes null over the 'ob' the chip wrote.
    //
    // Read off `actions.shotObs`, not data.previousShotObs, for the same
    // reason the chip's label is (see the OB props below): the fetched flags
    // lag our own write by a refetch, and finishing the hole inside that
    // window would seed the sheet without the penalty.
    return buildInitialRows(pts, par, pin.lat, pin.lng).map((r, i) =>
      actions.shotObs[i] ? { ...r, shotResult: 'ob' as const } : r,
    )
  }, [
    finalState.roundState,
    data.previousShots,
    actions.shotObs,
    data.roundPin,
    data.storedPin,
    data.resolvedHole?.par,
    data.currentHoleScore?.par,
    data.currentHole?.par,
  ])

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

  // Live OB prompt (#895 B2) — offered while placing the ball with a shot
  // already on this hole, the states the old bottom-row chip showed in. It
  // rides on the last shot's marker while that's on-screen (HoleMap), and is
  // an edge tab above the CTA while it isn't (MapBottomChrome).
  const obPromptActive =
    finalState.roundState === 'PLACE_BALL' &&
    !pinPlacementOpen &&
    !editMode &&
    !finalState.isRevisitingPlayedHole &&
    totalShotsThisHole > 0 &&
    !actions.saving

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

  if (data.loading || data.error || !data.round || !data.currentHole || !data.currentHoleScore) {
    return (
      <LiveRoundError
        loading={data.loading}
        error={!!data.error}
        holeNumber={holeNumber}
        onRetry={data.loadAll}
        exitOpen={activeDialog === 'exit'}
        onAskExit={() => setActiveDialog('exit')}
        onCancelExit={() => setActiveDialog(null)}
        onConfirmExit={actions.handleExitFromError}
      />
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: P.chrome }}>
      <LiveRoundHeader
        holeNumber={holeNumber}
        holeCount={data.holeCount}
        par={data.resolvedHole?.par ?? data.currentHole.par}
        yardsLabel={data.resolvedHole?.yards ? toDisplay(data.resolvedHole.yards) : null}
        shotNumber={data.shotNumber}
        distance={heroDistance}
        expected={expectedStrokes}
        onLeave={() => setActiveDialog('leave')}
        onPrev={() => actions.navigateHole(-1)}
        onNext={() => actions.navigateHole(1)}
        onOpenScorecard={() => setScorecardOpen(true)}
        onOpenMenu={() => setMenuOpen(true)}
      />

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
          overlayLive={scrubPos != null}
          pattern={pattern}
          obCallout={
            obPromptActive && !actions.lastShotIsOb
              ? { onPress: () => void actions.markLastShotOb() }
              : null
          }
          onLastShotOffscreen={setLastShotArrow}
          handicap={handicap}
          // Edit mode: only the shots BEFORE the active one form the
          // breadcrumb (mirrors PastRoundMap's review stepper) — the active
          // shot itself is the `ball` above, and shots after it aren't drawn
          // while stepping through an earlier one.
          previousShots={
            editMode ? data.previousShots.slice(0, activeShotIdx) : data.previousShots
          }
          // Read off `actions.shotObs`, not `data.previousShotObs`, for the
          // same reason the chip/summary do (see summaryRows above) — our own
          // last OB write outranks the fetched flags until the refetch lands.
          // Sliced identically to previousShots so the two stay index-aligned
          // in edit mode too (#839).
          previousShotObs={
            editMode ? actions.shotObs.slice(0, activeShotIdx) : actions.shotObs
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
          recenterRef={recenterRef}
          lefty={lefty}
          aimBallInset={Math.max(insets.bottom, MIN_BOTTOM_STRIP) + footerHeight + BALL_ABOVE_DOCK}
          onSetAim={(loc) => {
            // A user drag / long-press is an explicit aim — mark it touched so
            // it persists (an untouched auto-spawn suggestion is dropped on
            // save). All user aim-sets route through this prop.
            finalState.setAim(loc)
            finalState.setAimTouched(true)
          }}
          onSetBall={editMode ? handleEditModeMove : placeBallManually}
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
        <LiveRoundDock
          roundState={finalState.roundState}
          pinPlacementOpen={pinPlacementOpen}
          hasPin={(data.roundPin ?? data.storedPin) != null}
          ball={finalState.ball}
          aim={finalState.aim}
          saving={actions.saving}
          hasGps={finalState.gpsPosition != null}
          ballFromGps={
            !isPastMode && finalState.gpsPosition != null && finalState.ball != null && !ballMoved
          }
          isRevisitingPlayedHole={finalState.isRevisitingPlayedHole}
          totalShotsThisHole={totalShotsThisHole}
          finishesRound={actions.finishesRound}
          lefty={lefty}
          // Played-hole edit surface (Step 3) — in the footer in place of the
          // bottom row. Hole nav is in the header (#901).
          editStepper={
            editMode ? (
              <ShotStepper
                index={activeShotIdx}
                count={data.previousShots.length}
                onPrev={() => setActiveShotIdx((i) => Math.max(0, i - 1))}
                onNext={() => setActiveShotIdx((i) => Math.min(data.previousShots.length - 1, i + 1))}
                onDelete={handleDeleteActiveShot}
                deleteDisabled={data.previousShots.length === 0}
              />
            ) : null
          }
          patternOn={dotsVisible}
          onTogglePattern={() => setDotsVisible((v) => !v)}
          wheel={{
            rows: wheelRows,
            selected: wheelClub,
            auto: autoClub,
            onPick: (c) => setClubOverride(c === autoClub ? null : c),
          }}
          onTogglePin={() => setPinPlacementOpen((o) => !o)}
          overlayMode={overlayMode}
          onSetOverlayMode={setOverlayMode}
          rulerIndex={railIndex}
          rulerPos={railPos}
          onSelectRuler={selectRail}
          onScrubRuler={setScrubPos}
          showRecenter={!editMode}
          onRecenter={() => recenterRef.current?.()}
          aimHintVisible={finalState.aimHintVisible}
          onDismissAimHint={() => finalState.setAimHintVisible(false)}
          puttDistanceFt={puttDistanceFt}
          // Live OB (#839): label + toggle share one source in useShotActions
          // (the fetched flag, overridden by our own last write until the
          // refetch lands) — reading data.previousShotObs here would reopen
          // the window where a second tap charges a second penalty.
          obPromptActive={obPromptActive}
          lastShotIsOb={actions.lastShotIsOb}
          obArrow={lastShotArrow}
          onCancelPinPlacement={() => setPinPlacementOpen(false)}
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
          // Auto-detect on-green entry lives inside markBallHere itself; "On
          // the green" forces toGreen explicitly as the fallback.
          onMarkBallHere={actions.markBallHere}
          onOnGreen={() => actions.markBallHere({ toGreen: true })}
          onAddShot={() => {
            // Opt back into the live append flow on a revisited played hole:
            // re-arm the GPS ball + auto-aim and enter PLACE_BALL (#484).
            finalState.setAppendEngaged(true)
            finalState.setRoundState('PLACE_BALL')
          }}
          onMarkLastShotOb={() => void actions.markLastShotOb()}
          onFinishHole={actions.finishHole}
          onPuttMade={() =>
            actions.persistPutt({ puttMade: true, puttDistanceFt: puttDistanceFt ?? undefined })
          }
          onPuttMissed={() =>
            actions.persistPutt({ puttMade: false, puttDistanceFt: puttDistanceFt ?? undefined })
          }
          onNotOnGreen={actions.notOnGreen}
          onFooterHeight={setFooterHeight}
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
        unfinished={{ holes: actions.unfinishedOthers, onContinue: actions.continueToHole }}
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
        isLastHole={actions.finishesRound}
        par={data.resolvedHole?.par ?? data.currentHole.par}
        initialRows={summaryRows}
        saving={actions.saving}
        onSave={actions.saveHoleSummary}
        onEditOnMap={handleEditHoleOnMap}
        shotIds={data.previousShotIds}
        onDeleteShot={actions.deleteShot}
      />

      {menuOpen && (
        <RoundOptionsMenu
          onClose={() => setMenuOpen(false)}
          onEndRound={() => {
            setMenuOpen(false)
            setActiveDialog('end')
          }}
          onDeleteRound={() => {
            setMenuOpen(false)
            setActiveDialog('delete')
          }}
        />
      )}
    </View>
  )
}
