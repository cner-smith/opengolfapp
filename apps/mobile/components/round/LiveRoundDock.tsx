import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { MIN_SAMPLES_FOR_STATS as MIN_SHOTS, tourMakePercent, type Club } from '@oga/core'
import { useUnits } from '../../hooks/useUnits'
import { TYPE } from '../../lib/typography'
import { Key, KeyText, PaperSurface, Rocker } from '../paper/Paper'
import { Em, NoPinVoice, Primary, Secondary, SmallKey, Voice } from '../paper/Dock'
import { Icon } from '../paper/icons'
import { marksPath, pencilEllipse } from '../paper/pencil'
import { CoachTarget } from '../help/CoachMarks'
import { haptic } from '../../lib/haptics'
import { FONT_CAP, GAP, MARGIN, P, R } from '../paper/tokens'
import { APPR_RULER_FEET, RULER_STEP, RulerCard, TEE_RULER_YARDS } from './HoleMapOverlays'
import type { RoundState } from './hole/types'
import type { OffscreenArrow } from './HoleMap.types'

export interface LiveRoundDockProps {
  /** The shot the last Mark measured (#1087). */
  lastHit: { shot: number; yards: number } | null
  roundState: RoundState
  pinPlacementOpen: boolean
  hasPin: boolean
  ball: { lat: number; lng: number } | null
  aim: { lat: number; lng: number } | null
  saving: boolean
  hasGps: boolean
  /** The ball is tracking the player's GPS (not dragged). */
  ballFromGps: boolean
  isRevisitingPlayedHole: boolean
  totalShotsThisHole: number
  /** Saving this hole ends the round rather than moving on (#940). */
  finishesRound: boolean
  lefty: boolean
  /** Played-hole edit surface: renders in place of the buttons. */
  editStepper: ReactNode | null

  patternOn: boolean
  onTogglePattern: () => void
  /** Club wheel (§4); hidden while putting or with no pin. */
  wheel: WheelProps
  onTogglePin: () => void
  overlayMode: 'tee' | 'appr'
  onSetOverlayMode: (m: 'tee' | 'appr') => void
  rulerIndex: number
  /** Fractional while a finger is on the size. */
  rulerPos: number
  onSelectRuler: (i: number) => void
  onScrubRuler: (pos: number) => void
  showRecenter: boolean
  onRecenter: () => void

  aimHintVisible: boolean
  onDismissAimHint: () => void
  puttDistanceFt: number | null
  /** OB offered for the hole's last shot (#839 / #895 B2). */
  obPromptActive: boolean
  lastShotIsOb: boolean
  /** The OB / Undo request is in flight (#1112). */
  obBusy: boolean
  /** Direction to the last shot's marker while it's off-screen, else null. */
  obArrow: OffscreenArrow | null

  onCancelPinPlacement: () => void
  onConfirmAim: () => void
  onRePlaceBall: () => void
  onSkipAim: () => void
  onMarkBallHere: () => void
  onOnGreen: () => void
  onAddShot: () => void
  onMarkLastShotOb: () => void
  onFinishHole: () => void
  onPuttMade: () => void
  onPuttMissed: () => void
  onNotOnGreen: () => void
  /** Height of the paper footer (voice line + buttons), for camera framing. */
  onFooterHeight: (h: number) => void
  /** Whole dock (stacks + footer), so map tags can stay above it. */
  onDockHeight?: (h: number) => void
  /** The ruler drawer's top in dp above the footer while it's up, else 0. */
  onRulerDrawer?: (box: { width: number; top: number } | null) => void
}

// The ruler drawer stands on the 64-high ruler key, in a 96-wide column.
const KEY_H = 64
const RULER_W = 96

// Live-round dock (#611 §4–§6): the side stacks standing 8 above a paper
// footer that holds the voice line and the bottom row. Absolute over the map,
// which runs on under the nav bar (the Mapbox logo shows there).
export function LiveRoundDock(p: LiveRoundDockProps) {
  const insets = useSafeAreaInsets()
  const aimLike = p.roundState === 'SET_AIM' && !p.pinPlacementOpen && p.aim != null
  const putting = p.roundState === 'PUTTING'
  const showStacks = p.editStepper == null

  const keys = (
    <View style={{ flexDirection: 'row', gap: GAP, width: 124 }}>
      <CoachTarget id="live.pattern" style={{ flex: 1 }}>
      <Key
        accessibilityLabel={p.patternOn ? 'Hide shot pattern' : 'Show shot pattern'}
        onPress={() => {
          haptic(p.patternOn ? 'toggleOff' : 'toggleOn')
          p.onTogglePattern()
        }}
        latched={p.patternOn && !putting && p.hasPin}
        pressHaptic={false}
        disabled={putting || !p.hasPin}
        style={{ flex: 1 }}
        faceStyle={{ height: 46, gap: 1 }}
      >
        <Icon.pattern size={20} color={putting || !p.hasPin ? P.ink35 : P.ink} />
        <KeyText size={11} bold={p.patternOn && !putting && p.hasPin} disabled={putting || !p.hasPin}>
          Pattern
        </KeyText>
      </Key>
      </CoachTarget>
      <CoachTarget id="live.pin" style={{ flex: 1 }}>
      <Key
        accessibilityLabel={p.pinPlacementOpen ? 'Cancel pin placement' : 'Place pin'}
        onPress={() => {
          haptic(p.pinPlacementOpen ? 'toggleOff' : 'toggleOn')
          p.onTogglePin()
        }}
        latched={p.pinPlacementOpen}
        pressHaptic={false}
        style={{ flex: 1 }}
        faceStyle={{ height: 46, gap: 1 }}
      >
        <Icon.pin size={20} />
        <KeyText size={11} bold={p.pinPlacementOpen}>
          Pin
        </KeyText>
      </Key>
      </CoachTarget>
    </View>
  )

  // The ruler folds into one key. A tap opens the drawer (Tee/Appr and the
  // ruler) and picking a width folds it; holding the key shows the drawer as
  // a ghost at once, and dragging sizes the arc at the ruler's own pitch.
  const [rulerOpen, setRulerOpen] = useState(false)
  const [scrubbing, setScrubbing] = useState(false)
  const [drawerH, setDrawerH] = useState(0)
  const scrubStart = useRef(0)
  const lastScrub = useRef(0)
  const drawerUp = aimLike && (rulerOpen || scrubbing)
  useEffect(() => {
    if (!aimLike) setRulerOpen(false)
  }, [aimLike])
  useEffect(() => {
    p.onRulerDrawer?.(drawerUp && drawerH ? { width: MARGIN + RULER_W, top: GAP + KEY_H + GAP + drawerH } : null)
  }, [drawerUp, drawerH])
  const rulerValues = p.overlayMode === 'tee' ? TEE_RULER_YARDS : APPR_RULER_FEET
  const beginScrub = () => {
    scrubStart.current = p.rulerIndex
    lastScrub.current = p.rulerIndex
    if (!rulerOpen) setScrubbing(true)
  }
  const moveScrub = (dy: number) => {
    lastScrub.current = Math.max(0, Math.min(rulerValues.length - 1, scrubStart.current + dy / RULER_STEP))
    p.onScrubRuler(lastScrub.current)
  }
  // The release can report a zero translation; commit where the finger last
  // was. A cancelled scrub puts the pointer back.
  const endScrub = (activated: boolean) => {
    setScrubbing(false)
    if (activated) p.onSelectRuler(Math.round(lastScrub.current))
    else if (lastScrub.current !== scrubStart.current) p.onScrubRuler(scrubStart.current)
  }
  // Default minDistance: a tap never activates the pan, so it reaches the
  // key's onPress (and a screen reader's tap does too).
  const keyPan = Gesture.Pan()
    .onBegin(() => runOnJS(beginScrub)())
    .onUpdate((e) => runOnJS(moveScrub)(e.translationY))
    .onFinalize((_e, success) => runOnJS(endScrub)(success))
  const right = aimLike ? (
    <CoachTarget id="live.ruler" style={{ width: RULER_W }}>
      <Grow
        open={drawerUp}
        ghost={scrubbing && !rulerOpen}
        onHeight={setDrawerH}
        style={{ position: 'absolute', bottom: KEY_H + GAP, left: 0, right: 0, gap: GAP }}
      >
        <Rocker
          options={[
            { value: 'tee', label: 'Tee' },
            { value: 'appr', label: 'Appr' },
          ]}
          value={p.overlayMode}
          onChange={(v) => v && p.onSetOverlayMode(v)}
        />
        <RulerCard
          mode={p.overlayMode}
          index={p.rulerIndex}
          pos={p.rulerPos}
          onSelect={(i) => {
            p.onSelectRuler(i)
            setRulerOpen(false)
          }}
          onScrub={p.onScrubRuler}
          lefty={p.lefty}
        />
      </Grow>
      <GestureDetector gesture={keyPan}>
        <View>
          <Key
            accessibilityLabel={`${p.overlayMode === 'tee' ? 'Tee width' : 'Approach circle'}: tap to change, or hold and drag`}
            onPress={() => setRulerOpen((o) => !o)}
            latched={rulerOpen}
            faceStyle={{ height: KEY_H, gap: 0 }}
          >
            <KeyText size={11}>{p.overlayMode === 'tee' ? 'Tee width' : 'Appr circle'}</KeyText>
            <Text allowFontScaling={false} style={[TYPE.serif, { fontSize: 26, lineHeight: 30, color: P.ink }]}>
              {rulerValues[Math.round(p.rulerPos)]}
              <Text style={[TYPE.body, { fontSize: 12 }]}> {p.overlayMode === 'tee' ? 'yd' : 'ft'}</Text>
            </Text>
          </Key>
        </View>
      </GestureDetector>
    </CoachTarget>
  ) : p.showRecenter ? (
    <CoachTarget id="live.recenter">
      <Key
        accessibilityLabel="Put the ball on my GPS spot"
        onPress={p.onRecenter}
        disabled={!p.hasGps}
        faceStyle={{ width: 48, height: 48 }}
      >
        <Icon.gps size={24} color={p.hasGps ? P.ink : P.ink35} />
      </Key>
    </CoachTarget>
  ) : (
    <View />
  )

  const voice = voiceLine(p)
  const buttons = bottomRow(p)
  if (p.lefty) buttons.reverse()

  return (
    <View
      pointerEvents="box-none"
      onLayout={(e) => p.onDockHeight?.(e.nativeEvent.layout.height)}
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
    >
      {showStacks && (
        <View
          pointerEvents="box-none"
          style={{
            flexDirection: p.lefty ? 'row-reverse' : 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            paddingHorizontal: MARGIN,
            paddingBottom: GAP,
          }}
        >
          <View style={{ width: 124, gap: GAP }}>
            {keys}
            {!putting && p.hasPin && (
              <CoachTarget id="live.wheel">
                {/* Keyed by shot to reset the card's animation; open state is the parent's. */}
                <ClubWheel key={p.totalShotsThisHole} {...p.wheel} />
              </CoachTarget>
            )}
          </View>
          {right}
        </View>
      )}
      <PaperSurface
        onLayout={(e) => p.onFooterHeight(e.nativeEvent.layout.height)}
        style={{
          borderTopWidth: 1,
          borderTopColor: P.ink,
          paddingTop: voice ? 0 : 6,
          paddingHorizontal: MARGIN,
          // Paper runs to the screen edge, under the home indicator / nav bar.
          // (The strip that used to sit here held the Mapbox logo; the live map
          // pins it to its top corners now.)
          paddingBottom: 7 + insets.bottom,
        }}
      >
        {voice && <CoachTarget id="live.voice">{voice}</CoachTarget>}
        {p.editStepper ?? (
          <CoachTarget
            id={putting ? 'live.row.putt' : p.roundState === 'SET_AIM' ? 'live.row.aim' : 'live.row.place'}
            style={{ flexDirection: 'row', gap: GAP, alignItems: 'stretch' }}
          >
            {buttons}
          </CoachTarget>
        )}
      </PaperSurface>
    </View>
  )
}

// One line at a time, highest priority wins (§6 table).
function voiceLine(p: LiveRoundDockProps): ReactNode {
  if (p.editStepper) return null
  if (p.pinPlacementOpen) {
    return (
      <Voice trailing={<SmallKey label="Cancel" onPress={p.onCancelPinPlacement} />}>
        <Em>Where’s the flag?</Em> Tap it on the map.
      </Voice>
    )
  }
  if (!p.hasPin) return <NoPinVoice onPress={p.onTogglePin} />
  if (p.obPromptActive && p.lastShotIsOb) {
    return (
      <Voice trailing={<SmallKey label={p.obBusy ? 'Saving…' : 'Undo'} a11y="Undo" disabled={p.obBusy} onPress={p.onMarkLastShotOb} />}>
        Penalty stroke added.
      </Voice>
    )
  }
  if (p.obPromptActive && p.obArrow) {
    return (
      <Voice trailing={<SmallKey label={p.obBusy ? 'Saving…' : 'OB'} a11y="OB" disabled={p.obBusy} color={p.obBusy ? undefined : P.neg} onPress={p.onMarkLastShotOb} pressHaptic={false} />}>
        {p.obArrow} Did shot {p.totalShotsThisHole} go out of bounds?
      </Voice>
    )
  }
  if (p.roundState === 'PUTTING') {
    const ft = p.puttDistanceFt
    const pct = ft != null && ft > 0 ? tourMakePercent(ft) : null
    return pct != null ? (
      <Voice>
        Nice — you’re on. <Em>Tour pros hole this {pct}%</Em> of the time.
      </Voice>
    ) : (
      <Voice>Nice — you’re on.</Voice>
    )
  }
  if (p.roundState === 'SET_AIM') {
    if (!p.aim) return <Voice>Long-press the map where you’re aiming.</Voice>
    if (p.aimHintVisible) {
      return (
        <Voice
          trailing={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss hint"
              onPress={p.onDismissAimHint}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon.x size={18} />
            </Pressable>
          }
        >
          Aim where you want it to finish — drag to adjust.
        </Voice>
      )
    }
    // The last shot's distance (#1087) outranks the aim helper, which then
    // shows where there's no last shot: every tee.
    const hit = hitLine(p)
    if (hit) return hit
    // #1076: early on only — while the club in hand has no pattern yet, so
    // the line fades out club by club.
    const inHand = p.wheel.rows.find((r) => r.club === p.wheel.selected) ?? p.wheel.rows[0]
    if (!inHand || inHand.sparse) {
      return (
        <Voice>
          Aim where you want it to <Em>finish</Em>. That’s what builds your pattern.
        </Voice>
      )
    }
    return null
  }
  if (p.roundState === 'PLACE_BALL' && !p.isRevisitingPlayedHole) {
    return hitLine(p) ?? <Voice>Mark your ball, then drag to fine-tune.</Voice>
  }
  return null
}

// "Shot 1 went 164 yd." after a Mark (#1087): it takes the place of the
// generic guidance until the next Mark. The OB question and hints outrank it.
function hitLine(p: LiveRoundDockProps): ReactNode {
  return p.lastHit ? <HitLine {...p.lastHit} /> : null
}

function HitLine({ shot, yards }: { shot: number; yards: number }) {
  const { toDisplay } = useUnits()
  return (
    <Voice>
      Shot {shot} went <Em>{toDisplay(Math.round(yards))}</Em>.
    </Voice>
  )
}

function bottomRow(p: LiveRoundDockProps): ReactNode[] {
  if (p.roundState === 'PUTTING') {
    return [
      <Secondary key="not" label="Not on the green" onPress={p.onNotOnGreen} />,
      <Secondary key="miss" label="Missed" onPress={p.onPuttMissed} disabled={p.saving} />,
      <Primary key="made" label="Made it" onPress={p.onPuttMade} disabled={p.saving} />,
    ]
  }
  if (p.roundState === 'SET_AIM') {
    return [
      <Secondary key="replace" label="Re-place ball" onPress={p.onRePlaceBall} />,
      <Secondary key="skip" label="Skip aim" onPress={p.onSkipAim} />,
      <Primary key="confirm" label="Confirm aim" onPress={p.onConfirmAim} disabled={!p.aim} />,
    ]
  }
  const finish =
    p.totalShotsThisHole > 0 ? (
      <Secondary key="finish" label={p.finishesRound ? 'Finish round' : 'Finish hole'} onPress={p.onFinishHole} />
    ) : null
  if (p.isRevisitingPlayedHole) {
    return [finish, <Primary key="add" label="Add a shot" onPress={p.onAddShot} disabled={p.saving} />].filter(Boolean)
  }
  const onGreen =
    p.totalShotsThisHole > 0 && (p.ball != null || p.hasGps) && !p.saving ? (
      <Secondary key="green" label="On the green" onPress={p.onOnGreen} pressHaptic={false} />
    ) : null
  const waiting = !p.ball && !p.hasGps
  const label = p.saving ? 'Saving…' : waiting ? 'Waiting for GPS…' : 'Mark my ball'
  const sub = p.saving || waiting ? undefined : p.ballFromGps || !p.ball ? 'at my GPS spot' : undefined
  return [
    finish,
    onGreen,
    <Primary key="mark" label={label} sub={sub} onPress={p.onMarkBallHere} disabled={waiting || p.saving} pressHaptic={false} />,
  ].filter(Boolean)
}

export interface WheelRow {
  club: Club
  /** Glyph on the wheel ("dr", "6i"). */
  label: string
  /** Spoken name ("driver"). */
  name: string
  /** Measured once the club has MIN_SHOTS, else the My Bag estimate. */
  typicalYards: number | null
  /** Usable (aim-tracked) shots with this club. */
  shots: number
  /** Below the 5 shots a pattern needs. */
  sparse: boolean
}

export interface WheelProps {
  rows: WheelRow[]
  selected: Club | null
  /** The app's pick for this shot; null when no club has a pattern yet. */
  auto: Club | null
  onPick: (club: Club) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Row centres at rest: a 49 neighbour + half the 60 centre block (F6).
const PITCH = 54
const VIEW_H = 158
const CENTRE_H = 60
const SPRING = { stiffness: 420, damping: 32, mass: 1 }

// The club whose pattern the map shows (#1088). The live round never saves
// this club (the review fills clubs in), so it shouldn't read as a step: at
// rest it's a small key that opens the wheel, and a pick closes it.
function ClubWheel(props: WheelProps) {
  const { toDisplay, unit } = useUnits()
  if (props.open) return <ClubWheelCard {...props} onDone={() => props.onOpenChange(false)} />
  const row = props.rows.find((r) => r.club === props.selected) ?? props.rows[0]
  if (!row) return null
  // No auto pick when no club has a pattern yet: then neither caption applies.
  const caption = props.auto == null ? null : row.club === props.auto ? 'Auto' : 'Just this shot'
  const spoken = [
    `Pattern club, ${row.name}`,
    // The unit as a word: TalkBack can spell "yd" out letter by letter.
    row.typicalYards != null ? `typical distance ${toDisplay(row.typicalYards).split(' ')[0]} ${unit}` : null,
    caption?.toLowerCase(),
  ]
  return (
    <Key
      accessibilityLabel={`${spoken.filter(Boolean).join(', ')}. Change it`}
      onPress={() => props.onOpenChange(true)}
      faceStyle={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10 }}
    >
      <Text allowFontScaling={false} style={[TYPE.serif, { fontSize: 26, color: P.ink }]}>{row.label}</Text>
      <View style={{ flex: 1 }}>
        {caption && (
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[TYPE.body, { fontSize: 12, color: P.inkDim }]}
          >
            {caption}
          </Text>
        )}
        {row.typicalYards != null && (
          <Text allowFontScaling={false} numberOfLines={1} style={[TYPE.body, { fontSize: 13, color: P.ink }]}>
            {toDisplay(row.typicalYards)}
          </Text>
        )}
      </View>
    </Key>
  )
}

// Club wheel (§4, settle §15): the whole card is one vertical pan target
// that snaps row to row; a tap picks the row under it. The pick commits on
// release (state first, spring after); the wheel closes back to the key once
// the spring has settled. Starts on the auto pick every shot; a manual pick
// lasts one shot and shows "Back to auto" above the card. Screen-reader steps
// leave it open, so several clubs can be stepped through.
function ClubWheelCard({ rows, selected, auto, onPick, onDone }: WheelProps & { onDone: () => void }) {
  const { toDisplay, unit } = useUnits()
  const sel = Math.max(0, rows.findIndex((r) => r.club === selected))
  const autoIdx = rows.findIndex((r) => r.club === auto)
  const manual = autoIdx >= 0 && sel !== autoIdx
  const last = rows.length - 1
  const pos = useSharedValue(sel)
  // A detent tick each time a row crosses the centre (§15 native phase).
  useAnimatedReaction(
    () => Math.round(pos.value),
    (row, prev) => {
      if (prev !== null && row !== prev) runOnJS(haptic)('tick')
    },
  )
  const start = useSharedValue(0)
  // The index the wheel is heading to, so our own commit doesn't re-spring
  // (and kill the fling's velocity) when `selected` comes back around.
  const target = useRef(sel)
  useEffect(() => {
    if (sel === target.current) return
    target.current = sel
    pos.value = withSpring(sel, SPRING)
  }, [sel, pos])

  // Close after the settle (§15 springs take about 350 ms); a new drag cancels it.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }
  useEffect(() => cancelClose, [])
  const commit = (i: number, close = true) => {
    target.current = i
    const row = rows[i]
    if (row && i !== sel) onPick(row.club)
    if (!close) return
    cancelClose()
    closeTimer.current = setTimeout(onDone, 400)
  }
  const pan = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .onBegin(() => {
      start.value = pos.value
      runOnJS(cancelClose)()
    })
    .onUpdate((e) => {
      pos.value = Math.min(last + 0.3, Math.max(-0.3, start.value - e.translationY / PITCH))
    })
    .onEnd((e) => {
      // Fling projection 80 ms, then the one spring in the app (§15).
      const i = Math.round(Math.min(last, Math.max(0, pos.value - (e.velocityY * 0.08) / PITCH)))
      pos.value = withSpring(i, { ...SPRING, velocity: -e.velocityY / PITCH })
      runOnJS(commit)(i)
    })
  const tap = Gesture.Tap().onEnd((e) => {
    const i = Math.round(Math.min(last, Math.max(0, pos.value + (e.y - VIEW_H / 2) / PITCH)))
    pos.value = withSpring(i, SPRING)
    runOnJS(commit)(i)
  })
  const step = (d: number) => {
    const i = Math.min(last, Math.max(0, sel + d))
    pos.value = withSpring(i, SPRING)
    commit(i, false)
  }

  // A tab shows once the wheel has settled on the pick (|Δ| < 2.5 dp).
  const autoTabStyle = useAnimatedStyle(() => ({
    opacity: !manual && Math.abs(pos.value - sel) * PITCH < 2.5 ? 1 : 0,
  }))
  const manualTabStyle = useAnimatedStyle(() => ({
    opacity: manual && Math.abs(pos.value - sel) * PITCH < 2.5 ? 1 : 0,
  }))
  const ruleTop = (VIEW_H - CENTRE_H) / 2
  const row = rows[sel]

  return (
    <View
      style={{
        width: 124,
        backgroundColor: P.glass,
        borderWidth: 1,
        borderColor: P.ink,
        borderRadius: R,
        paddingVertical: 2,
      }}
    >
      {manual && auto && (
        <Key
          accessibilityLabel="Back to the auto club"
          onPress={() => {
            pos.value = withSpring(autoIdx, SPRING)
            commit(autoIdx)
          }}
          style={{ marginTop: 7, marginHorizontal: 7, marginBottom: 6 }}
          faceStyle={{ minHeight: 44, flexDirection: 'row', gap: 5, paddingHorizontal: 4 }}
        >
          <Icon.reset size={15} color={P.warn} />
          <Text allowFontScaling={false} numberOfLines={1} style={[TYPE.body, { fontSize: 13, color: P.ink }]}>
            Back to auto
          </Text>
        </Key>
      )}
      <GestureDetector gesture={Gesture.Race(pan, tap)}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Club"
          accessibilityValue={{
            text: row
              ? // The unit as a word: TalkBack can spell "yd" out letter by letter.
                `${row.name}${row.typicalYards != null ? `, ${row.sparse ? 'estimated' : 'typical'} distance ${toDisplay(row.typicalYards).split(' ')[0]} ${unit}` : ''}${sel === autoIdx ? ', auto pick' : ''}`
              : '',
          }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
          style={{ height: VIEW_H, overflow: 'hidden' }}
        >
          {rows.map((r, i) => (
            <WheelRowView
              key={r.club}
              row={r}
              index={i}
              pos={pos}
              distance={r.typicalYards != null ? toDisplay(r.typicalYards) : null}
              autoPick={manual && i === autoIdx}
            />
          ))}
          <Svg pointerEvents="none" width="100%" height={VIEW_H} style={{ position: 'absolute' }}>
            <Defs>
              <LinearGradient id="wheelTop" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={P.raised} stopOpacity={0.68} />
                <Stop offset="1" stopColor={P.raised} stopOpacity={0} />
              </LinearGradient>
              <LinearGradient id="wheelBottom" x1="0" y1="1" x2="0" y2="0">
                <Stop offset="0" stopColor={P.raised} stopOpacity={0.68} />
                <Stop offset="1" stopColor={P.raised} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height={16} fill="url(#wheelTop)" />
            <Rect x="0" y={VIEW_H - 8} width="100%" height={8} fill="url(#wheelBottom)" />
          </Svg>
          <View pointerEvents="none" style={{ position: 'absolute', top: ruleTop, left: 6, right: 6, height: 1, backgroundColor: P.ink }} />
          <View pointerEvents="none" style={{ position: 'absolute', top: ruleTop + CENTRE_H, left: 6, right: 6, height: 1, backgroundColor: P.ink }} />
          {/* Both tabs stay mounted and only fade: swapping the text in place
              (or remounting) left Android with a stale layout that clipped
              "just this shot" to "just this". */}
          {autoIdx >= 0 && (
            <>
              <AutoRing manual={manual} top={ruleTop - 8 - 9} />
              <Animated.View pointerEvents="none" style={[tabBox(ruleTop, false), autoTabStyle]}>
                <Text allowFontScaling={false} style={[TYPE.kicker, { fontSize: 11, lineHeight: 13, letterSpacing: 1.2, color: P.ink }]}>AUTO</Text>
              </Animated.View>
              <Animated.View pointerEvents="none" style={[tabBox(ruleTop, true), manualTabStyle]}>
                <Text allowFontScaling={false} numberOfLines={1} style={[TYPE.body, { fontSize: 11, lineHeight: 13, color: P.ink }]}>just this shot</Text>
              </Animated.View>
            </>
          )}
        </View>
      </GestureDetector>
    </View>
  )
}

// Tier 3 (§15): a pencil loop round the AUTO tab when the wheel lands back
// home — 220 ms draw, 600 ms hold, 200 ms fade. Not on first mount, and not
// with reduce motion.
const RING_W = 70
const RING_H = 33
function AutoRing({ manual, top }: { manual: boolean; top: number }) {
  const reduce = useReducedMotion()
  const wasManual = useRef(manual)
  const [t, setT] = useState<number | null>(null)
  const marks = useMemo(() => pencilEllipse(29, 12, 220, 7), [])
  useEffect(() => {
    const landed = wasManual.current && !manual
    wasManual.current = manual
    if (!landed || reduce) return
    let raf = 0
    let t0 = 0
    const step = (now: number) => {
      if (!t0) t0 = now
      const e = now - t0
      setT(e)
      if (e < 1020) raf = requestAnimationFrame(step)
      else setT(null)
    }
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      setT(null)
    }
  }, [manual, reduce])
  if (t == null) return null
  const d = marksPath(marks, Math.min(t, 220))
  const opacity = t < 820 ? 0.9 : 0.9 * Math.max(0, 1 - (t - 820) / 200)
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top, left: 4, width: RING_W, height: RING_H }}>
      <Svg width={RING_W} height={RING_H} viewBox={`${-RING_W / 2} ${-RING_H / 2} ${RING_W} ${RING_H}`}>
        {d ? <Path d={d} fill="#353430" opacity={opacity} /> : null}
      </Svg>
    </View>
  )
}

// The AUTO / "just this shot" tab sitting on the centre block's top rule.
function tabBox(ruleTop: number, manual: boolean) {
  return {
    position: 'absolute' as const,
    top: ruleTop - 8,
    left: 16,
    height: 15,
    paddingHorizontal: 5,
    borderRadius: 2,
    justifyContent: 'center' as const,
    backgroundColor: manual ? P.raised : P.brass,
    borderWidth: manual ? 1.5 : 1,
    borderColor: manual ? P.warn : P.brassEdge,
  }
}

// One wheel row, drawn at the centre size and scaled down with its distance
// from the centre (glyph scale 1 − 0.2|d|, opacity 1 − 0.15|d|).
function WheelRowView({
  row,
  index,
  pos,
  distance,
  autoPick,
}: {
  row: WheelRow
  index: number
  pos: SharedValue<number>
  distance: string | null
  autoPick: boolean
}) {
  const rowStyle = useAnimatedStyle(() => {
    const d = index - pos.value
    return { opacity: Math.abs(d) > 1.6 ? 0 : 1 - 0.15 * Math.abs(d), transform: [{ translateY: d * PITCH }] }
  })
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - 0.2 * Math.min(1, Math.abs(index - pos.value)) }] }))
  const [num = '', unit = ''] = (distance ?? '').split(' ')
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: (VIEW_H - CENTRE_H) / 2,
          left: 0,
          right: 0,
          height: CENTRE_H,
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: 11,
          paddingRight: 10,
        },
        rowStyle,
      ]}
    >
      {/* paddingRight: Fraunces italic overhangs its box ("3w206"). */}
      <Animated.View style={[{ transformOrigin: 'left center', paddingRight: 4 }, scaleStyle]}>
        {/* A long custom name ("wedge") steps down so the meta keeps its room. */}
        <Text allowFontScaling={false}
          numberOfLines={1}
          style={[TYPE.serif, { fontSize: row.label.length > 3 ? 24 : 32, lineHeight: 38, color: row.sparse ? P.ink45 : P.ink }]}
        >
          {row.label}
        </Text>
      </Animated.View>
      <Animated.View style={[{ marginLeft: 'auto', alignItems: 'flex-end', transformOrigin: 'right center' }, scaleStyle]}>
        {row.sparse ? (
          <>
            {/* The My Bag estimate, muted until the club has its own shots. */}
            {distance != null && (
              <Text allowFontScaling={false} numberOfLines={1} style={[TYPE.serif, { fontSize: 20, lineHeight: 24, color: P.inkDim }]}>
                {num}
                <Text allowFontScaling={false} style={[TYPE.kicker, { fontSize: 13 }]}>{'\u2009'}{unit}</Text>
              </Text>
            )}
            <Text allowFontScaling={false} style={[TYPE.body, { fontSize: 12, lineHeight: 15, color: P.ink }]}>{MIN_SHOTS - row.shots} more</Text>
            <View style={{ flexDirection: 'row', gap: 3, marginTop: 2 }}>
              {Array.from({ length: MIN_SHOTS }, (_, i) => (
                <View
                  key={i}
                  style={{ width: 6, height: 6, borderRadius: 3, borderWidth: 1, borderColor: P.ink, backgroundColor: i < row.shots ? P.ink : 'transparent' }}
                />
              ))}
            </View>
          </>
        ) : (
          <>
            {distance != null && (
              <Text allowFontScaling={false} numberOfLines={1} style={[TYPE.serif, { fontSize: 20, lineHeight: 24, color: P.ink }]}>
                {num}
                <Text allowFontScaling={false} style={[TYPE.kicker, { fontSize: 13 }]}>{'\u2009'}{unit}</Text>
              </Text>
            )}
            <Text allowFontScaling={false} numberOfLines={1} style={[TYPE.body, { fontSize: 12, lineHeight: 15, color: P.ink }]}>
              {autoPick ? 'auto pick' : `${row.shots} shots`}
            </Text>
          </>
        )}
      </Animated.View>
    </Animated.View>
  )
}

// The ruler drawer grows up out of its key and sinks back in, staying mounted
// while it closes. A ghost is see-through and lets touches pass.
function Grow({
  open,
  ghost,
  onHeight,
  style,
  children,
}: {
  open: boolean
  ghost: boolean
  onHeight: (h: number) => void
  style: object
  children: ReactNode
}) {
  const reduce = useReducedMotion()
  const t = useSharedValue(open ? 1 : 0)
  const fade = useSharedValue(ghost ? 0.82 : 1)
  const [mounted, setMounted] = useState(open)
  useEffect(() => {
    if (open) setMounted(true)
    fade.value = ghost ? 0.82 : 1
    if (reduce) {
      t.value = open ? 1 : 0
      if (!open) setMounted(false)
      return
    }
    t.value = withSpring(open ? 1 : 0, { stiffness: 140, damping: 22, mass: 1 }, (done) => {
      if (done && !open) runOnJS(setMounted)(false)
    })
  }, [open, ghost, reduce, t, fade])
  const anim = useAnimatedStyle(() => ({
    opacity: Math.min(1, t.value * 1.6) * fade.value,
    transform: [{ translateY: (1 - t.value) * 28 }, { scaleY: 0.7 + 0.3 * t.value }],
    transformOrigin: 'bottom',
  }))
  if (!mounted) return null
  return (
    <Animated.View
      pointerEvents={open && !ghost ? 'auto' : 'none'}
      onLayout={(e) => onHeight(e.nativeEvent.layout.height)}
      style={[style, anim]}
    >
      {children}
    </Animated.View>
  )
}
