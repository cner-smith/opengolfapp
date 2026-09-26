import { useEffect, useRef, type ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { tourMakePercent, type Club } from '@oga/core'
import { useUnits } from '../../hooks/useUnits'
import { TYPE } from '../../lib/typography'
import { Key, KeyText, PaperSurface, Rocker } from '../paper/Paper'
import { Em, NoPinVoice, Primary, Secondary, SmallKey, Voice } from '../paper/Dock'
import { Icon } from '../paper/icons'
import { GAP, MARGIN, P, R } from '../paper/tokens'
import { RulerCard } from './HoleMapOverlays'
import type { RoundState } from './hole/types'
import type { OffscreenArrow } from './HoleMap.types'

// The Mapbox logo + attribution live in the strip under the footer (ToS);
// gesture-nav insets are too thin to show them, so keep at least this much.
export const MIN_BOTTOM_STRIP = 26

export interface LiveRoundDockProps {
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
}

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
      <Key
        accessibilityLabel={p.patternOn ? 'Hide shot pattern' : 'Show shot pattern'}
        onPress={p.onTogglePattern}
        latched={p.patternOn && !putting && p.hasPin}
        disabled={putting || !p.hasPin}
        style={{ flex: 1 }}
        faceStyle={{ height: 46, gap: 1 }}
      >
        <Icon.pattern size={20} color={putting || !p.hasPin ? P.ink35 : P.ink} />
        <KeyText size={11} bold={p.patternOn && !putting && p.hasPin} disabled={putting || !p.hasPin}>
          Pattern
        </KeyText>
      </Key>
      <Key
        accessibilityLabel={p.pinPlacementOpen ? 'Cancel pin placement' : 'Place pin'}
        onPress={p.onTogglePin}
        latched={p.pinPlacementOpen}
        style={{ flex: 1 }}
        faceStyle={{ height: 46, gap: 1 }}
      >
        <Icon.pin size={20} />
        <KeyText size={11} bold={p.pinPlacementOpen}>
          Pin
        </KeyText>
      </Key>
    </View>
  )

  const right = aimLike ? (
    <View style={{ width: 96, gap: GAP }}>
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
        onSelect={p.onSelectRuler}
        onScrub={p.onScrubRuler}
        lefty={p.lefty}
      />
    </View>
  ) : p.showRecenter ? (
    <Key
      accessibilityLabel="Put the ball on my GPS spot"
      onPress={p.onRecenter}
      disabled={!p.hasGps}
      faceStyle={{ width: 48, height: 48 }}
    >
      <Icon.gps size={24} color={p.hasGps ? P.ink : P.ink35} />
    </Key>
  ) : (
    <View />
  )

  const voice = voiceLine(p)
  const buttons = bottomRow(p)
  if (p.lefty) buttons.reverse()

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(insets.bottom, MIN_BOTTOM_STRIP) }}
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
            {!putting && p.hasPin && <ClubWheel {...p.wheel} />}
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
          paddingBottom: 7,
        }}
      >
        {voice}
        {p.editStepper ?? (
          <View style={{ flexDirection: 'row', gap: GAP, alignItems: 'stretch' }}>{buttons}</View>
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
      <Voice trailing={<SmallKey label="Undo" onPress={p.onMarkLastShotOb} />}>
        Penalty stroke added.
      </Voice>
    )
  }
  if (p.obPromptActive && p.obArrow) {
    return (
      <Voice trailing={<SmallKey label="OB" color={P.neg} onPress={p.onMarkLastShotOb} />}>
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
          Your aim is your start line — drag it to adjust.
        </Voice>
      )
    }
    return null
  }
  if (p.roundState === 'PLACE_BALL' && !p.isRevisitingPlayedHole) {
    return <Voice>Mark your ball, then drag to fine-tune.</Voice>
  }
  return null
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
      <Secondary key="green" label="On the green" onPress={p.onOnGreen} />
    ) : null
  const waiting = !p.ball && !p.hasGps
  const label = p.saving ? 'Saving…' : waiting ? 'Waiting for GPS…' : 'Mark my ball'
  const sub = p.saving || waiting ? undefined : p.ballFromGps || !p.ball ? 'at my GPS spot' : undefined
  return [
    finish,
    onGreen,
    <Primary key="mark" label={label} sub={sub} onPress={p.onMarkBallHere} disabled={waiting || p.saving} />,
  ].filter(Boolean)
}

export interface WheelRow {
  club: Club
  /** Glyph on the wheel ("dr", "6i"). */
  label: string
  /** Spoken name ("driver"). */
  name: string
  carryYards: number | null
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
}

const MIN_SHOTS = 5
// Row centres at rest: a 49 neighbour + half the 60 centre block (F6).
const PITCH = 54
const VIEW_H = 158
const CENTRE_H = 60
const SPRING = { stiffness: 420, damping: 32, mass: 1 }

// Club wheel (§4, settle §15): the whole card is one vertical pan target
// that snaps row to row; a tap picks the row under it. The pick commits on
// release (state first, spring after). Opens on the auto pick every shot; a
// manual pick lasts one shot and shows "Back to auto" above the card.
function ClubWheel({ rows, selected, auto, onPick }: WheelProps) {
  const { toDisplay } = useUnits()
  const sel = Math.max(0, rows.findIndex((r) => r.club === selected))
  const autoIdx = rows.findIndex((r) => r.club === auto)
  const manual = autoIdx >= 0 && sel !== autoIdx
  const last = rows.length - 1
  const pos = useSharedValue(sel)
  const start = useSharedValue(0)
  // The index the wheel is heading to, so our own commit doesn't re-spring
  // (and kill the fling's velocity) when `selected` comes back around.
  const target = useRef(sel)
  useEffect(() => {
    if (sel === target.current) return
    target.current = sel
    pos.value = withSpring(sel, SPRING)
  }, [sel, pos])

  const commit = (i: number) => {
    target.current = i
    const row = rows[i]
    if (row && i !== sel) onPick(row.club)
  }
  const pan = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .onBegin(() => {
      start.value = pos.value
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
    commit(i)
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
          onPress={() => onPick(auto)}
          style={{ marginTop: 7, marginHorizontal: 7, marginBottom: 6 }}
          faceStyle={{ minHeight: 44, flexDirection: 'row', gap: 5, paddingHorizontal: 4 }}
        >
          <Icon.reset size={15} color={P.warn} />
          <Text numberOfLines={1} style={[TYPE.body, { fontSize: 13, color: P.ink }]}>
            Back to auto
          </Text>
        </Key>
      )}
      <GestureDetector gesture={Gesture.Race(pan, tap)}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Club"
          accessibilityValue={{ text: row ? `${row.name}${sel === autoIdx ? ', auto pick' : ''}` : '' }}
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
              carry={r.carryYards != null ? toDisplay(r.carryYards) : null}
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
              <Animated.View pointerEvents="none" style={[tabBox(ruleTop, false), autoTabStyle]}>
                <Text style={[TYPE.kicker, { fontSize: 11, lineHeight: 13, letterSpacing: 1.2, color: P.ink }]}>AUTO</Text>
              </Animated.View>
              <Animated.View pointerEvents="none" style={[tabBox(ruleTop, true), manualTabStyle]}>
                <Text style={[TYPE.body, { fontSize: 11, lineHeight: 13, color: P.ink }]}>just this shot</Text>
              </Animated.View>
            </>
          )}
        </View>
      </GestureDetector>
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
  carry,
  autoPick,
}: {
  row: WheelRow
  index: number
  pos: SharedValue<number>
  carry: string | null
  autoPick: boolean
}) {
  const rowStyle = useAnimatedStyle(() => {
    const d = index - pos.value
    return { opacity: Math.abs(d) > 1.6 ? 0 : 1 - 0.15 * Math.abs(d), transform: [{ translateY: d * PITCH }] }
  })
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - 0.2 * Math.min(1, Math.abs(index - pos.value)) }] }))
  const [num = '', unit = ''] = (carry ?? '').split(' ')
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
      <Animated.View style={[{ transformOrigin: 'left center' }, scaleStyle]}>
        {/* A long custom name ("wedge") steps down so the meta keeps its room. */}
        <Text
          numberOfLines={1}
          style={[TYPE.serif, { fontSize: row.label.length > 3 ? 24 : 32, lineHeight: 38, color: row.sparse ? P.ink45 : P.ink }]}
        >
          {row.label}
        </Text>
      </Animated.View>
      <Animated.View style={[{ marginLeft: 'auto', alignItems: 'flex-end', transformOrigin: 'right center' }, scaleStyle]}>
        {row.sparse ? (
          <>
            <Text style={[TYPE.body, { fontSize: 12, lineHeight: 15, color: P.ink }]}>{MIN_SHOTS - row.shots} more</Text>
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
            {carry != null && (
              <Text numberOfLines={1} style={[TYPE.serif, { fontSize: 20, lineHeight: 24, color: P.ink }]}>
                {num}
                <Text style={[TYPE.kicker, { fontSize: 13 }]}>{'\u2009'}{unit}</Text>
              </Text>
            )}
            <Text numberOfLines={1} style={[TYPE.body, { fontSize: 12, lineHeight: 15, color: P.ink }]}>
              {autoPick ? 'auto pick' : `${row.shots} shots`}
            </Text>
          </>
        )}
      </Animated.View>
    </Animated.View>
  )
}
