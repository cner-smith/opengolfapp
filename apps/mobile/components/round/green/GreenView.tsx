import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Pressable, Text, View, type ViewStyle } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type AnimatedStyle,
} from 'react-native-reanimated'
import Svg, { Line, Polyline } from 'react-native-svg'
import {
  bothEndsWords,
  falseFront,
  falseFrontWords,
  greenApproach,
  greenMiddle,
  pinSheet,
  shapePhrase,
  steepnessTerm,
  type DistanceUnit,
  type GeoPoint,
  type PinSheet,
} from '@oga/core'
import { haptic } from '../../../lib/haptics'
import { TYPE } from '../../../lib/typography'
import { Key, KeyText, Rocker } from '../../paper/Paper'
import { Primary } from '../../paper/Dock'
import { Icon } from '../../paper/icons'
import { P } from '../../paper/tokens'
import { fitGreen, GreenDrawing, screenFrame, type ScreenFrame, type GreenMode } from './GreenDrawing'
import { useGreenMaps, type PreparedGreen } from './greenData'
import { GreenMapLayers } from './GreenMapLayers'

// The green view (#1381, design locked on #1379). Nothing is on the map
// until the player asks: a mini green key sits at the top of the key column,
// and a tap grows it into the view (Plain | Height | Slope, the pin-sheet
// bars, the read). The pin is set here by dragging the flag, as the Pin key
// did; a hole with no outline gets a flag key that leads to the map's
// placement mode. Measurements only, never advice.

const PACE_M = 0.9144
const EASE = Easing.out(Easing.cubic)
const MODE_KEY = (userId: string | undefined) => `oga.green-view-v1.${userId ?? 'anon'}`
const KEY_W = 124
const MINI = { w: 110, h: 64 }

type Rect = { x: number; y: number; w: number; h: number }

export interface GreenViewInput {
  courseId: string | undefined
  holes: { id: string; number: number; loop_of: string | null }[]
  /** The hole on screen; a loop hole reads its front-nine hole's green. */
  hole: { id: string; loop_of: string | null } | null
  holeNumber: number
  pin: GeoPoint | null
  ball: GeoPoint | null
  previousShots: GeoPoint[]
  tee: GeoPoint | null
  userId: string | undefined
  offline: boolean
  unit: DistanceUnit
  pinPlacementOpen: boolean
  onSetPin: (p: GeoPoint) => unknown
  onStartPinPlacement: () => void
  onCancelPinPlacement: () => void
}

export function useGreenView(i: GreenViewInput): {
  key: ReactNode
  view: ReactNode
  mapLayers: ReactNode
  open: boolean
  close: () => void
} {
  const { loaded, greens } = useGreenMaps(i.courseId, i.holes, i.holeNumber, i.userId, i.offline)
  const green = i.hole ? greens.get(i.hole.loop_of ?? i.hole.id) ?? null : null
  const [from, setFrom] = useState<Rect | null>(null)
  const [closing, setClosing] = useState(false)
  const [mode, setModeState] = useState<GreenMode>('plain')
  const [flipped, setFlipped] = useState(false)
  const [mapOn, setMapOn] = useState(false)
  const [paceOn, setPaceOn] = useState(false)

  useEffect(() => {
    let live = true
    AsyncStorage.getItem(MODE_KEY(i.userId))
      .then((v) => live && (v === 'height' || v === 'slope' || v === 'plain') && setModeState(v))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [i.userId])
  const setMode = (m: GreenMode) => {
    setModeState(m)
    AsyncStorage.setItem(MODE_KEY(i.userId), m).catch(() => undefined)
  }
  useEffect(() => setFrom(null), [i.holeNumber])

  // The player's line, as web reads it: from the newest start off the green.
  const approach = useMemo(() => {
    if (!green) return 0
    const starts = [i.tee, ...i.previousShots, i.ball].filter((p): p is GeoPoint => p != null)
    return Math.round(greenApproach(green.ring, starts) ?? 0)
  }, [green?.ring, i.ball?.lat, i.ball?.lng, i.previousShots, i.tee?.lat, i.tee?.lng])
  const frame = useMemo(() => (green ? screenFrame(green.ring, approach) : null), [green?.ring, approach])
  const sheet = useMemo(() => (green && i.pin ? pinSheet(green.ring, i.pin, approach) : null), [green?.ring, i.pin, approach])

  const open = from != null
  const close = () => setClosing(true)

  const key = (
    <GreenKey
      green={green}
      frame={frame}
      pin={i.pin}
      sheet={sheet}
      holeNumber={i.holeNumber}
      pinPlacementOpen={i.pinPlacementOpen}
      onCancelPinPlacement={i.onCancelPinPlacement}
      onOpen={(r) => {
        setClosing(false)
        setFrom(r)
      }}
    />
  )

  const view = open ? (
    <GreenDetail
      key={i.holeNumber}
      green={loaded ? green : null}
      loaded={loaded}
      frame={frame}
      approach={approach}
      pin={i.pin}
      holeNumber={i.holeNumber}
      unit={i.unit}
      from={from}
      closing={closing}
      onClosed={() => {
        setFrom(null)
        setClosing(false)
      }}
      onClose={close}
      mode={mode}
      onMode={setMode}
      flipped={flipped}
      onFlip={() => setFlipped((f) => !f)}
      mapOn={mapOn}
      onMapOn={setMapOn}
      paceOn={paceOn}
      onPaceOn={setPaceOn}
      onSetPin={i.onSetPin}
      onStartPinPlacement={i.onStartPinPlacement}
    />
  ) : null

  const lidar = green && typeof green.lidar === 'object' ? green.lidar : null
  const mapLayers =
    green && !i.pinPlacementOpen && ((mapOn && lidar && mode !== 'plain') || paceOn) ? (
      <GreenMapLayers green={green} mode={mapOn && lidar ? mode : 'plain'} approach={approach} pin={i.pin} paceLines={paceOn} />
    ) : null

  return { key, view, mapLayers, open, close }
}

// ---------- the key ----------
function GreenKey({
  green,
  frame,
  pin,
  sheet,
  holeNumber,
  pinPlacementOpen,
  onCancelPinPlacement,
  onOpen,
}: {
  green: PreparedGreen | null
  frame: ScreenFrame | null
  pin: GeoPoint | null
  sheet: PinSheet | null
  holeNumber: number
  pinPlacementOpen: boolean
  onCancelPinPlacement: () => void
  onOpen: (from: Rect) => void
}) {
  const ref = useRef<View>(null)
  const [down, setDown] = useState(false)
  const openFromHere = () => {
    if (ref.current) ref.current.measureInWindow((x, y, w, h) => onOpen({ x, y, w, h }))
    else onOpen({ x: 0, y: 0, w: KEY_W, h: 46 })
  }

  if (!green || !frame) {
    // No outline: the flag key, at the old Pin key's height.
    return (
      <View ref={ref} collapsable={false}>
        <Key
          accessibilityLabel={pinPlacementOpen ? 'Cancel pin placement' : 'Pin: open the green'}
          onPress={() => {
            haptic(pinPlacementOpen ? 'toggleOff' : 'toggleOn')
            if (pinPlacementOpen) onCancelPinPlacement()
            else openFromHere()
          }}
          latched={pinPlacementOpen}
          pressHaptic={false}
          faceStyle={{ height: 46, gap: 1 }}
        >
          <Icon.pin size={20} />
          <KeyText size={11} bold={pinPlacementOpen}>
            Pin
          </KeyText>
        </Key>
      </View>
    )
  }

  const layout = fitGreen(frame, MINI.w, MINI.h, 0.88)
  // The flag grows with the drawing, so it never hides a small green.
  const flagH = Math.max(12, Math.min(24, 0.45 * Math.min(MINI.w, (frame.box.y1 - frame.box.y0) * layout.s)))
  return (
    <Pressable
      ref={ref}
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel={sheet ? `Green: ${Math.round(sheet.onPaces)} paces on, ${Math.round(sheet.sidePaces)} from the ${sheet.side}. Open the green` : 'Green: set pin. Open the green'}
      onPress={() => {
        haptic('press')
        openFromHere()
      }}
      onPressIn={() => setDown(true)}
      onPressOut={() => setDown(false)}
      style={{ paddingBottom: 3, width: KEY_W }}
    >
      {/* Only the ledge strip under the face: the see-through face must not show a solid block. */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 6, backgroundColor: P.ink, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 }} />
      <View
        style={{
          height: 100,
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingBottom: 4,
          borderWidth: 1,
          borderColor: P.ink,
          borderRadius: 3,
          overflow: 'hidden',
          backgroundColor: down ? 'rgba(228,220,202,0.88)' : 'rgba(251,248,241,0.88)',
          transform: [{ translateY: down ? 3 : 0 }],
        }}
      >
        <GreenDrawing
          green={green}
          frame={frame}
          layout={layout}
          width={MINI.w}
          height={MINI.h}
          mode="plain"
          pin={pin}
          sheet={sheet}
          holeNumber={holeNumber}
          flagHeight={flagH}
          mini
        />
        <Text allowFontScaling={false} style={[TYPE.serif, { fontSize: 11, lineHeight: 13, color: P.ink, paddingHorizontal: 4 }]}>
          {/* The trailing space keeps Android from clipping the italic's last figure. */}
          {sheet ? `${Math.round(sheet.onPaces)} · ${Math.round(sheet.sidePaces)} ` : 'Set pin '}
        </Text>
        <KeyText size={11}>Green</KeyText>
      </View>
    </Pressable>
  )
}

// ---------- the view ----------
function GreenDetail(p: {
  green: PreparedGreen | null
  loaded: boolean
  frame: ScreenFrame | null
  approach: number
  pin: GeoPoint | null
  holeNumber: number
  unit: DistanceUnit
  from: Rect
  closing: boolean
  onClose: () => void
  onClosed: () => void
  mode: GreenMode
  onMode: (m: GreenMode) => void
  flipped: boolean
  onFlip: () => void
  mapOn: boolean
  onMapOn: (on: boolean) => void
  paceOn: boolean
  onPaceOn: (on: boolean) => void
  onSetPin: (pin: GeoPoint) => unknown
  onStartPinPlacement: () => void
}) {
  const insets = useSafeAreaInsets()
  const reduce = useReducedMotion()
  const rootRef = useRef<View>(null)
  const [box, setBox] = useState<{ w: number; h: number; x: number; y: number } | null>(null)
  const t = useSharedValue(0)
  const dur = reduce ? 0 : 350

  useEffect(() => {
    if (!box) return
    t.value = withTiming(1, { duration: dur, easing: EASE })
  }, [box != null])
  useEffect(() => {
    if (!p.closing) return
    t.value = withTiming(0, { duration: reduce ? 0 : 300, easing: EASE }, (done) => {
      if (done) runOnJS(p.onClosed)()
    })
  }, [p.closing])

  const W = box?.w ?? 0
  const H = box?.h ?? 0
  const noOutline = p.loaded && !p.green
  const panel = { x: 10, y: 10, w: W - 20, h: noOutline ? 240 : H - 20 - insets.bottom }
  const G0 = Math.max(120, Math.min(panel.w - 28, panel.h - 340))
  const gsq = { x: panel.x + (panel.w - G0) / 2, y: panel.y + 92 }
  // The key's rect in this view's coordinates.
  const fr = box ? { x: p.from.x - box.x, y: p.from.y - box.y, w: p.from.w, h: p.from.h } : p.from

  const scrimStyle = useAnimatedStyle(() => ({ opacity: t.value }))
  const panelStyle = useAnimatedStyle(() => {
    const sx = fr.w / Math.max(1, panel.w)
    const sy = fr.h / Math.max(1, panel.h)
    const k = t.value
    return {
      opacity: noOutline ? k : 1,
      transform: [
        { translateX: (fr.x + fr.w / 2 - (panel.x + panel.w / 2)) * (1 - k) },
        { translateY: (fr.y + fr.h / 2 - (panel.y + panel.h / 2)) * (1 - k) },
        { scaleX: sx + (1 - sx) * k },
        { scaleY: sy + (1 - sy) * k },
      ],
    }
  })
  const greenStyle = useAnimatedStyle(() => {
    const s = (Math.min(fr.w, fr.h) * 0.8) / G0
    const k = t.value
    return {
      transform: [
        { translateX: (fr.x + fr.w / 2 - (gsq.x + G0 / 2)) * (1 - k) },
        { translateY: (fr.y + fr.h / 2 - (gsq.y + G0 / 2)) * (1 - k) },
        { scale: s + (1 - s) * k },
      ],
    }
  })
  const controlsStyle = useAnimatedStyle(() => ({ opacity: interpolate(t.value, [0.7, 1], [0, 1], 'clamp') }))

  return (
    <View
      ref={rootRef}
      collapsable={false}
      style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 30 }}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout
        rootRef.current?.measureInWindow((x, y) => setBox({ w: width, h: height, x, y }))
      }}
    >
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: P.scrim }, scrimStyle]}>
        <Pressable accessibilityLabel="Close the green" style={{ flex: 1 }} onPress={p.onClose} />
      </Animated.View>
      {box && (
        <>
          <Animated.View style={[{ position: 'absolute', left: panel.x, top: panel.y, width: panel.w, height: panel.h }, panelStyle]}>
            <View style={{ position: 'absolute', left: 3, top: 3, right: -3, bottom: -3, backgroundColor: P.ink, borderRadius: 3 }} />
            <View style={{ flex: 1, backgroundColor: P.raised, borderWidth: 1, borderColor: P.ink, borderRadius: 3 }} />
          </Animated.View>
          {noOutline || !p.green || !p.frame ? (
            <NoOutline panel={panel} style={controlsStyle} loading={!p.loaded} onClose={p.onClose} onStartPinPlacement={p.onStartPinPlacement} />
          ) : (
            <Detail {...p} green={p.green} frame={p.frame} panel={panel} G0={G0} gsq={gsq} greenStyle={greenStyle} controlsStyle={controlsStyle} />
          )}
        </>
      )}
    </View>
  )
}

function NoOutline({
  panel,
  style,
  loading,
  onClose,
  onStartPinPlacement,
}: {
  panel: Rect
  style: AnimatedStyle<ViewStyle>
  loading: boolean
  onClose: () => void
  onStartPinPlacement: () => void
}) {
  return (
    <Animated.View style={[{ position: 'absolute', left: panel.x, top: panel.y, width: panel.w, height: panel.h, padding: 14 }, style]}>
      <Text style={[TYPE.serif, { fontSize: 22, color: P.ink }]}>Green</Text>
      <Text style={[TYPE.body, { fontSize: 15, color: P.ink, marginTop: 10 }]}>
        {loading ? 'Reading the course’s greens…' : 'No green outline for this hole.'}
      </Text>
      <Text style={[TYPE.body, { fontSize: 12, color: P.inkDim, marginTop: 4 }]}>
        Set the pin where you see the flag. Distances and clubs follow it.
      </Text>
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row' }}>
        <Primary
          label="Set pin on the map"
          onPress={() => {
            onClose()
            onStartPinPlacement()
          }}
        />
      </View>
    </Animated.View>
  )
}

function Detail(
  p: Parameters<typeof GreenDetail>[0] & {
    green: PreparedGreen
    frame: ScreenFrame
    panel: Rect
    G0: number
    gsq: { x: number; y: number }
    greenStyle: AnimatedStyle<ViewStyle>
    controlsStyle: AnimatedStyle<ViewStyle>
  },
) {
  const { green, frame, panel, G0, gsq } = p
  const lidar = typeof green.lidar === 'object' ? green.lidar : null
  const [pin, setPin] = useState<GeoPoint | null>(p.pin)
  const [dragging, setDragging] = useState(false)
  useEffect(() => setPin(p.pin), [p.pin?.lat, p.pin?.lng])
  const sheet = useMemo(() => (pin ? pinSheet(green.ring, pin, p.approach) : null), [green.ring, pin, p.approach])
  const ff = useMemo(() => (lidar ? falseFront(lidar.grid, lidar.field, p.approach) : null), [lidar, p.approach])

  const layout = fitGreen(frame, G0, G0, 0.64)
  const flagPin = pin ?? greenMiddle(green.ring)
  const [fx, fy] = frame.to(flagPin)
  const flagPx = [(fx - layout.vx) * layout.s, (fy - layout.vy) * layout.s] as const
  const start = useRef<[number, number]>([0, 0])
  const moved = useRef<GeoPoint | null>(null)
  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin(() => {
      start.current = frame.to(flagPin)
      moved.current = null
      setDragging(true)
    })
    .onUpdate((e) => {
      const q = frame.from([start.current[0] + e.translationX / layout.s, start.current[1] + e.translationY / layout.s])
      moved.current = q
      setPin(q)
    })
    .onFinalize(() => {
      setDragging(false)
      if (moved.current) {
        haptic('confirm')
        void p.onSetPin(moved.current)
      }
    })

  const depth = Math.round((frame.box.y1 - frame.box.y0) / PACE_M)
  const shown: GreenMode = lidar ? (dragging ? 'plain' : p.mode) : 'plain'
  const tilt = lidar?.tilt ?? null
  const ends = tilt ? bothEndsWords(tilt.downhillDeg, tilt.tiltPct, p.approach) : null
  const second = lidar
    ? ff
      ? falseFrontWords(ff, p.unit)
      : lidar.shape && lidar.shape.kind !== 'planar'
        ? shapePhrase(lidar.shape, p.approach, p.unit)
        : null
    : null
  const source = [
    lidar ? (green.gridSource?.startsWith('3dep:') ? 'USGS 3DEP lidar' : 'Lidar') : null,
    green.outlineSource === 'osm' ? 'OSM outline' : green.outlineSource === 'manual' ? 'Outline drawn by hand' : 'Traced outline',
    '1 pace = 1 yd',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <>
      <Animated.View style={[{ position: 'absolute', left: panel.x + 14, top: panel.y + 12, width: panel.w - 28 }, p.controlsStyle]}>
        <Text style={[TYPE.serif, { fontSize: 22, color: P.ink }]}>Green · {depth} paces deep</Text>
        <Rocker
          style={{ marginTop: 8 }}
          height={36}
          options={[
            { value: 'plain', label: 'Plain' },
            { value: 'height', label: 'Height', disabled: !lidar },
            { value: 'slope', label: 'Slope', disabled: !lidar },
          ]}
          value={lidar ? p.mode : 'plain'}
          onChange={(m) => m && p.onMode(m)}
        />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: gsq.x, top: gsq.y, width: G0, height: G0 }, p.greenStyle]}>
        <GreenDrawing
          green={green}
          frame={frame}
          layout={layout}
          width={G0}
          height={G0}
          mode={shown}
          pin={flagPin}
          sheet={sheet}
          holeNumber={p.holeNumber}
          flagHeight={30}
          dashed={green.lidar === 'pending'}
        />
        <GestureDetector gesture={pan}>
          <View
            accessibilityLabel="Pin: drag to move"
            collapsable={false}
            hitSlop={8}
            style={{ position: 'absolute', width: 44, height: 44, left: flagPx[0] - 14, top: flagPx[1] - 36 }}
          />
        </GestureDetector>
      </Animated.View>
      <Animated.View
        style={[{ position: 'absolute', left: panel.x + 14, width: panel.w - 28, top: gsq.y + G0 + 6, height: panel.y + panel.h - (gsq.y + G0 + 6) - 12 }, p.controlsStyle]}
      >
        <Text style={[TYPE.serif, { fontSize: 19, color: P.ink }]}>
          {sheet
            ? `${Math.round(sheet.onPaces)} paces on · ${Math.round(sheet.sidePaces)} from the ${sheet.side} edge`
            : 'Set pin'}
        </Text>
        {!sheet && <Small style={{ marginTop: 2 }}>Drag the flag to where the cup is.</Small>}
        {lidar && tilt && ends ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 8, gap: 6 }}>
              {ends !== 'Level' && <Text style={[TYPE.body, { fontSize: 15, color: P.ink }]}>{ends} ·</Text>}
              <TermWord pct={tilt.tiltPct} flipped={p.flipped} onFlip={p.onFlip} />
            </View>
            {second && <Small style={{ marginTop: 3, fontSize: 13 }}>{second}</Small>}
          </>
        ) : (
          <Small style={{ marginTop: 8, fontSize: 13 }}>
            {green.lidar === 'pending' ? 'Reading the green…' : green.gridNote ?? 'No slope survey covers this green yet'}
          </Small>
        )}
        <View style={{ marginTop: 12, gap: 8 }}>
          {lidar && p.mode !== 'plain' && (
            <Check label={`${p.mode === 'slope' ? 'Slope' : 'Height'} on the map`} on={p.mapOn} onChange={p.onMapOn} />
          )}
          <Check label="Pace lines on the map" on={p.paceOn} onChange={p.onPaceOn} />
        </View>
        <View style={{ flex: 1 }} />
        <Small style={{ fontSize: 10.5, marginBottom: 8 }}>{source}</Small>
        <View style={{ flexDirection: 'row' }}>
          <Primary label="Done" onPress={p.onClose} />
        </View>
      </Animated.View>
    </>
  )
}

function Small({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[TYPE.body, { fontSize: 12, color: P.inkDim }, style]}>{children}</Text>
}

/** The steepness word; a tap flips it to the exact %. */
function TermWord({ pct, flipped, onFlip }: { pct: number; flipped: boolean; onFlip: () => void }) {
  const word = flipped ? `${pct.toFixed(1)}%` : steepnessTerm(pct)
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Slope ${word}. Tap to flip`} onPress={onFlip} hitSlop={10}>
      <View>
        <Text style={[TYPE.bodyBold, { fontSize: 15, color: P.ink }]}>{word}</Text>
        <Svg height={3} width="100%" style={{ position: 'absolute', left: 0, right: 0, bottom: -2 }}>
          <Line x1={1} x2={400} y1={1.5} y2={1.5} stroke={P.ink} strokeWidth={1.4} strokeDasharray="1.5 2.5" strokeLinecap="round" />
        </Svg>
      </View>
    </Pressable>
  )
}

function Check({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      onPress={() => {
        haptic(on ? 'toggleOff' : 'toggleOn')
        onChange(!on)
      }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 30 }}
    >
      <View style={{ width: 22, height: 22, borderWidth: 1, borderColor: P.ink, borderRadius: 2, backgroundColor: on ? P.well : P.raised, alignItems: 'center', justifyContent: 'center' }}>
        {on && (
          <Svg width={14} height={14}>
            <Polyline points="2,7 6,11 12,3" fill="none" stroke={P.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        )}
      </View>
      <Text style={[TYPE.body, { fontSize: 14, color: P.ink }]}>{label}</Text>
    </Pressable>
  )
}
