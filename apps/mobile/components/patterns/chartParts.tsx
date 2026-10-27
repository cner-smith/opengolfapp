import { useEffect, useState, type ReactNode } from 'react'
import { Pressable, Text, View, type GestureResponderEvent } from 'react-native'
import Svg, { Circle, Ellipse, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg'
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import {
  NOT_RECORDED,
  categoryOf,
  flightControls,
  type ColourBy,
  type DispersionPoint,
  type DispersionStats,
  type DistanceUnit,
  type FlightKind,
  type FlightPoint,
  type ShotExtras,
} from '@oga/core'
import { FONT, TYPE } from '../../lib/typography'
import { haptic } from '../../lib/haptics'
import { FONT_CAP, P } from '../paper/tokens'
import { Key, KeyText } from '../paper/Paper'
import { INK, UNRECORDED_INK, type Category, type Glyph, type Layer } from './layers'

// What the two Shot patterns charts (AimPlot, TeePlot) share: label placement
// on a paper halo where it covers the fewest shots, the shot glyphs, the
// motion, and one touch layer over the plot that picks the nearest shot, so a
// thumb in a dense scatter still opens the right one.

export const RULE = '#ECE6D8'
export const RULE_MAJOR = '#DCD5C3'
export const DENSE = 40
export const PICK_DP = 24
/** The plot's left gutter (margin labels) and right edge. */
export const LEFT = 48
export const RIGHT = 8

export interface ChartProps {
  points: DispersionPoint[]
  /** The rings and average to draw (the recent 20 when that layer is on). */
  stats: DispersionStats | null
  /** A faint outline to compare with: every lie, or every shot. */
  ghost: { stats: DispersionStats; label: string } | null
  extras: Record<string, ShotExtras>
  /** How each shot's flight record reads (flags a conflict in the readout). */
  kinds: Map<string, FlightKind>
  layers: Record<Layer, boolean>
  colourBy: ColourBy
  categories: Map<string, Category>
  hidden: Set<string>
  /** With the recent layer on: the recent shots; the rest are drawn in pencil. */
  recentIds: Set<string> | null
  leftHanded: boolean
  width: number
  /** Yards per display unit (1, or 1/0.9144 for metres). */
  unitYd: number
  unit: DistanceUnit
  /** Margin label for a distance in yards. */
  label: (yd: number) => string
  unitWord: string
  /** What a screen reader hears for the whole chart. */
  summary: string
  hot: string | null
  onHot: (id: string | null) => void
  /** Opens the round a shot was played in (the readout's Open round key). */
  onOpenRound: (roundId: string) => void
  empty?: string
}

/* ------------------------------------------------------------ geometry */

export interface Box {
  x: number
  y: number
  w: number
  h: number
}
export const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
export const textW = (s: string, px: number) => s.length * px * 0.52
export type Anchor = 'start' | 'middle' | 'end'
export const rad = (d: number) => (d * Math.PI) / 180

export interface RingPx {
  cx: number
  cy: number
  rx: number
  ry: number
  /** Degrees counter-clockwise on screen. */
  rot: number
}

export function ringD(cx: number, cy: number, rx: number, ry: number, rot: number) {
  'worklet'
  const t = (rot * Math.PI) / 180
  const a = Math.max(rx, 0.5)
  const b = Math.max(ry, 0.5)
  const x1 = cx + a * Math.cos(t)
  const y1 = cy - a * Math.sin(t)
  const x2 = cx - a * Math.cos(t)
  const y2 = cy + a * Math.sin(t)
  return `M ${x1} ${y1} A ${a} ${b} ${-rot} 0 1 ${x2} ${y2} A ${a} ${b} ${-rot} 0 1 ${x1} ${y1} Z`
}

export function placeOnRing(ring: RingPx, text: string, px: number, dots: { x: number; y: number }[], taken: Box[], bounds: Box, angles: number[]) {
  const t = rad(ring.rot)
  let best: { x: number; y: number; anchor: Anchor; box: Box; score: number } | null = null
  for (const [i, deg] of angles.entries()) {
    const a = rad(deg)
    const ex = ring.cx + ring.rx * Math.cos(a) * Math.cos(t) - ring.ry * Math.sin(a) * Math.sin(t)
    const ey = ring.cy - (ring.rx * Math.cos(a) * Math.sin(t) + ring.ry * Math.sin(a) * Math.cos(t))
    const side = ex - ring.cx
    const anchor: Anchor = side > ring.rx * 0.35 ? 'start' : side < -ring.rx * 0.35 ? 'end' : 'middle'
    const x = ex + (anchor === 'start' ? 5 : anchor === 'end' ? -5 : 0)
    const y = ey <= ring.cy ? ey - 5 : ey + px + 3
    const w = textW(text, px)
    const box = { x: anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2, y: y - px, w, h: px + 3 }
    const pad = { x: box.x - 3, y: box.y - 3, w: box.w + 6, h: box.h + 6 }
    let score = i * 0.6
    for (const d of dots) if (d.x > pad.x && d.x < pad.x + pad.w && d.y > pad.y && d.y < pad.y + pad.h) score += 10
    for (const b of taken) if (overlaps(pad, b)) score += 100
    if (box.x < bounds.x || box.y < bounds.y || box.x + box.w > bounds.x + bounds.w || box.y + box.h > bounds.y + bounds.h) score += 1000
    if (!best || score < best.score) best = { x, y, anchor, box, score }
  }
  return best!
}

export function placeNear(x: number, y: number, text: string, px: number, dots: { x: number; y: number }[], taken: Box[], bounds: Box) {
  const w = textW(text, px)
  const spots: { x: number; y: number; anchor: Anchor }[] = [
    { x: x + 9, y: y + px / 2 - 1, anchor: 'start' },
    { x: x - 9, y: y + px / 2 - 1, anchor: 'end' },
    { x, y: y + px + 8, anchor: 'middle' },
    { x, y: y - 9, anchor: 'middle' },
    { x: x + 7, y: y + px + 5, anchor: 'start' },
    { x: x - 7, y: y + px + 5, anchor: 'end' },
  ]
  let best = { ...spots[0]!, box: { x: 0, y: 0, w: 0, h: 0 }, score: Infinity }
  for (const [i, sp] of spots.entries()) {
    const bx = sp.anchor === 'start' ? sp.x : sp.anchor === 'end' ? sp.x - w : sp.x - w / 2
    const box = { x: bx - 3, y: sp.y - px - 2, w: w + 6, h: px + 6 }
    let score = i * 0.6
    for (const d of dots) if (d.x > box.x - 3 && d.x < box.x + box.w + 3 && d.y > box.y - 3 && d.y < box.y + box.h + 3) score += 10
    for (const b of taken) if (overlaps(box, b)) score += 100
    if (box.x < bounds.x || box.x + box.w > bounds.x + bounds.w || box.y < bounds.y || box.y + box.h > bounds.y + bounds.h) score += 1000
    if (score < best.score) best = { ...sp, box, score }
  }
  return best
}

/** Flight finishes in the tee frame are all set at the average aim distance,
 *  so the dots, the rings (aim-relative) and the one pennant share a frame. */
export function teeFinish(p: DispersionPoint, avgAim: number): FlightPoint {
  return { x: p.lateralOffsetYards, y: avgAim + p.distanceOffsetYards }
}

export const S0: FlightPoint = { x: 0, y: 0 }

/** A shot's flight from the tee to its (normalised) finish. */
export function flightOf(p: DispersionPoint, avgAim: number, leftHanded: boolean) {
  const E = teeFinish(p, avgAim)
  return { E, c: flightControls(S0, E, p.startLine ?? null, p.shape ?? null, leftHanded) }
}

export type SegStyle = 'solid' | 'dash' | 'dot'
// How each kind is drawn (research §3): what was recorded is solid, what is
// read from the finish is fainter, what can't be true is dashed.
export const KIND_SEGMENTS: Record<FlightKind, { from: number; to: number; style: SegStyle; op: number }[]> = {
  agree: [{ from: 0, to: 1, style: 'solid', op: 1 }],
  conflict: [
    { from: 0, to: 0.5, style: 'solid', op: 1 },
    { from: 0.5, to: 1, style: 'dash', op: 1 },
  ],
  'start-only': [
    { from: 0, to: 1 / 3, style: 'solid', op: 1 },
    { from: 1 / 3, to: 1, style: 'solid', op: 0.7 },
  ],
  'shape-only': [
    { from: 0, to: 1 / 3, style: 'dot', op: 1 },
    { from: 1 / 3, to: 1, style: 'solid', op: 1 },
  ],
  none: [{ from: 0, to: 1, style: 'dash', op: 1 }],
}
export const DASH: Record<Exclude<SegStyle, 'solid'>, number[]> = { dash: [4, 3], dot: [1, 3] }

/* -------------------------------------------------------------- motion */

export const AG = Animated.createAnimatedComponent(G)
export const APath = Animated.createAnimatedComponent(Path)
export const ACircle = Animated.createAnimatedComponent(Circle)
export const ALine = Animated.createAnimatedComponent(Line)
export const TWEEN = { duration: 320, easing: Easing.bezier(0.22, 1, 0.36, 1) }

/** Fades its marks in or out (180 ms); `enter` fades them in on mount. */
export function Fade({ on, enter = false, delay = 0, duration = 180, children }: { on: boolean; enter?: boolean; delay?: number; duration?: number; children: ReactNode }) {
  const reduce = useReducedMotion()
  const o = useSharedValue(enter && !reduce ? 0 : on ? 1 : 0)
  useEffect(() => {
    const to = on ? 1 : 0
    o.value = reduce ? to : withDelay(delay, withTiming(to, { duration }))
  }, [on, reduce, delay, duration, o])
  const ap = useAnimatedProps(() => ({ opacity: o.value }))
  return <AG animatedProps={ap}>{children}</AG>
}

export function useTween(target: number, reduce: boolean) {
  const v = useSharedValue(target)
  useEffect(() => {
    v.value = reduce ? target : withTiming(target, TWEEN)
  }, [target, reduce, v])
  return v
}

/** A ring that moves and resizes to its new place when the club changes. */
export function TweenRing({ ring, fill, stroke, strokeWidth, strokeOpacity, dash }: { ring: RingPx; fill: string; stroke: string; strokeWidth: number; strokeOpacity?: number; dash?: string }) {
  const reduce = useReducedMotion()
  const cx = useTween(ring.cx, reduce)
  const cy = useTween(ring.cy, reduce)
  const rx = useTween(ring.rx, reduce)
  const ry = useTween(ring.ry, reduce)
  const rot = useTween(ring.rot, reduce)
  const ap = useAnimatedProps(() => ({ d: ringD(cx.value, cy.value, rx.value, ry.value, rot.value) }))
  return <APath animatedProps={ap} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity} strokeDasharray={dash} />
}

export function TweenAverage({ x0, y0, x, y, dense }: { x0: number; y0: number; x: number; y: number; dense: boolean }) {
  const reduce = useReducedMotion()
  const tx = useTween(x, reduce)
  const ty = useTween(y, reduce)
  const lineProps = useAnimatedProps(() => ({ x2: tx.value, y2: ty.value }))
  const dotProps = useAnimatedProps(() => ({ cx: tx.value, cy: ty.value }))
  return (
    <>
      <ALine animatedProps={lineProps} x1={x0} y1={y0} stroke={dense ? P.forest : P.ink} strokeWidth={dense ? 1.4 : 1} strokeDasharray="3,3" />
      <ACircle animatedProps={dotProps} r={5.5} fill={P.raised} stroke={P.forest} strokeWidth={1.8} />
    </>
  )
}

export const DRAW_MS = 600
export const STAGGER_MS = 25
export const STAGGER_CAP = 400

/** One stretch of a flight, drawn on from the tee (solid) or faded in (dashed). */
export function FlightSeg({ d, len, style, from, to, delay, clock, color, opacity, width }: {
  d: string
  len: number
  style: SegStyle
  from: number
  to: number
  delay: number
  clock: SharedValue<number>
  color: string
  opacity: number
  width: number
}) {
  const dashed = style !== 'solid'
  const ap = useAnimatedProps(() => {
    const local = Math.min(1, Math.max(0, (clock.value - delay) / DRAW_MS))
    const e = local >= 1 ? 1 : 1 - Math.pow(2, -10 * local)
    const f = Math.min(1, Math.max(0, (e - from) / Math.max(to - from, 1e-6)))
    return { strokeOpacity: dashed ? opacity * f : opacity, strokeDashoffset: dashed ? 0 : len * (1 - f) }
  })
  return (
    <APath
      animatedProps={ap}
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeDasharray={dashed ? DASH[style as 'dash' | 'dot'] : [len + 1, len + 1]}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}

/** The selected shot grows over 140 ms and gets an ink ring. */
export function Selected({ x, y, r }: { x: number; y: number; r: number }) {
  const reduce = useReducedMotion()
  const g = useSharedValue(reduce ? 1 : 0)
  useEffect(() => {
    if (!reduce) g.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.cubic) })
  }, [reduce, g])
  const ring = useAnimatedProps(() => ({ r: r + 1.5 + 1.5 * g.value }))
  return <ACircle animatedProps={ring} cx={x} cy={y} fill="none" stroke={P.ink} strokeWidth={1} />
}

/* --------------------------------------------------------------- marks */

// RN-svg has no paint-order, so the halo is the same text drawn first as a
// thick paper stroke.
export function Halo({ x, y, text, size = 12, fill = P.inkDim, anchor = 'start' }: { x: number; y: number; text: string; size?: number; fill?: string; anchor?: Anchor }) {
  return (
    <G>
      <SvgText x={x} y={y} textAnchor={anchor} fontFamily={FONT.serifItalic} fontSize={size} fill={P.raised} stroke={P.raised} strokeWidth={3.5} strokeLinejoin="round">
        {text}
      </SvgText>
      <SvgText x={x} y={y} textAnchor={anchor} fontFamily={FONT.serifItalic} fontSize={size} fill={fill}>
        {text}
      </SvgText>
    </G>
  )
}

export function Pennant({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <Line x1={x} y1={y} x2={x} y2={y - 16} stroke={P.warn} strokeWidth={1.4} />
      <Path d={`M ${x} ${y - 16} L ${x + 10} ${y - 12.5} L ${x} ${y - 9} Z`} fill={P.warn} />
      <Circle cx={x} cy={y} r={2.2} fill={P.warn} />
    </G>
  )
}

export interface MarkStyle {
  key: string
  color: string
  glyph: Glyph | 'pencil'
  r: number
  dense: boolean
}

export function markStyle(p: DispersionPoint, props: ChartProps, dense: boolean): MarkStyle {
  const r = dense ? 2.4 : 4
  if (props.colourBy === 'none') {
    const old = props.recentIds != null && !props.recentIds.has(p.id)
    return { key: NOT_RECORDED, color: old ? P.graphite : INK, glyph: old ? 'pencil' : 'dot', r, dense }
  }
  const key = categoryOf(p, props.extras[p.id], props.colourBy)
  if (key === NOT_RECORDED) return { key, color: UNRECORDED_INK, glyph: 'unrecorded', r, dense }
  const c = props.categories.get(key)
  return { key, color: c?.color ?? INK, glyph: c?.glyph ?? 'dot', r, dense }
}

/** One glyph: the shot's mark on the chart and its swatch in the legend. The
 *  web's Marker draws the same shapes. */
export function Marker({ x, y, r, glyph, color, dense }: { x: number; y: number; r: number; glyph: Glyph | 'pencil'; color: string; dense?: boolean }) {
  const solid = { fill: color, fillOpacity: dense ? 0.6 : 0.92, stroke: dense ? 'none' : P.raised, strokeWidth: 1.2 }
  const open = { fill: P.raised, stroke: color, strokeWidth: 1.6 }
  const tri = (dir: 1 | -1, s: number) =>
    `M ${x + dir * s * 1.3} ${y} L ${x - dir * s * 0.95} ${y - s * 1.2} L ${x - dir * s * 0.95} ${y + s * 1.2} Z`
  switch (glyph) {
    case 'pencil':
      return <Circle cx={x} cy={y} r={r} fill={color} fillOpacity={0.35} />
    case 'left':
      return <Path d={tri(-1, r)} {...solid} />
    case 'right':
      return <Path d={tri(1, r)} {...solid} />
    case 'left-open':
      return <Path d={tri(-1, r * 0.95)} {...open} strokeLinejoin="round" />
    case 'right-open':
      return <Path d={tri(1, r * 0.95)} {...open} strokeLinejoin="round" />
    case 'tick-below':
    case 'tick-above': {
      const ty = glyph === 'tick-below' ? y + r + 2.4 : y - r - 2.4
      return (
        <G>
          <Circle cx={x} cy={y} r={r * 0.9} {...solid} />
          <Line x1={x - r - 1} x2={x + r + 1} y1={ty} y2={ty} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
        </G>
      )
    }
    case 'cross': {
      const s = r * 1.05
      return <Path d={`M ${x - s} ${y - s} L ${x + s} ${y + s} M ${x - s} ${y + s} L ${x + s} ${y - s}`} stroke={color} strokeWidth={2} strokeLinecap="round" />
    }
    case 'square':
      return <Rect x={x - r * 0.9} y={y - r * 0.9} width={r * 1.8} height={r * 1.8} {...solid} />
    case 'unrecorded':
      return <Circle cx={x} cy={y} r={Math.max(1.6, r - 0.4)} fill={P.raised} stroke={UNRECORDED_INK} strokeWidth={1.3} strokeDasharray={dense ? undefined : '1.6,1.4'} />
    default:
      return <Circle cx={x} cy={y} r={r} {...solid} />
  }
}

export const Mark = ({ x, y, s }: { x: number; y: number; s: MarkStyle }) => <Marker x={x} y={y} r={s.r} glyph={s.glyph} color={s.color} dense={s.dense} />

/** Marks grouped by legend key, so hiding a group fades it as one. */
export function groupBy<T extends { s: MarkStyle }>(items: T[]) {
  const m = new Map<string, T[]>()
  for (const it of items) m.set(it.s.key, [...(m.get(it.s.key) ?? []), it])
  return [...m.entries()]
}

/* ------------------------------------------------------ touch + readout */

export interface Pickable {
  id: string
  x: number
  y: number
}

/** The plot's touch layer, the readout and the screen-reader summary. */
export function ChartFrame({ width, height, summary, pickable, hot, onHot, readout, roundId, onOpenRound, bounds, children }: {
  width: number
  height: number
  summary: string
  pickable: Pickable[]
  hot: string | null
  onHot: (id: string | null) => void
  readout: string[] | null
  /** The selected shot's round, for the readout's Open round key. */
  roundId: string | null
  onOpenRound: (roundId: string) => void
  bounds: Box
  children: ReactNode
}) {
  const [measured, setMeasured] = useState<{ id: string; w: number; h: number } | null>(null)
  const size = measured && measured.id === hot ? measured : null
  const hotP = hot ? pickable.find((d) => d.id === hot) : null
  const pick = (e: GestureResponderEvent) => {
    const { locationX: x, locationY: y } = e.nativeEvent
    let best: Pickable | null = null
    let bestD = PICK_DP
    for (const d of pickable) {
      const dist = Math.hypot(d.x - x, d.y - y)
      if (dist <= bestD) {
        best = d
        bestD = dist
      }
    }
    if (best && best.id !== hot) haptic('tick')
    onHot(best && best.id !== hot ? best.id : null)
  }
  let left = 0
  let top = 0
  if (hotP && size) {
    left = Math.min(Math.max(hotP.x - size.w / 2, bounds.x), bounds.x + bounds.w - size.w)
    top = hotP.y - size.h - 14 < bounds.y ? hotP.y + 14 : hotP.y - size.h - 14
  }
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary} style={{ width, height }}>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden pointerEvents="none">
        <Svg width={width} height={height}>
          {children}
        </Svg>
      </View>
      {/* A raw Pressable, not PressableTouch: the pick needs the press's own locationX/Y. */}
      <Pressable onPress={pick} style={{ position: 'absolute', left: 0, top: 0, width, height }} importantForAccessibility="no" />
      {hotP && readout && (
        <View
          key={hot}
          pointerEvents="box-none"
          onLayout={(e) => {
            const { width: w, height: h } = e.nativeEvent.layout
            if (hot && (!size || Math.abs(size.w - w) > 0.5 || Math.abs(size.h - h) > 0.5)) setMeasured({ id: hot, w, h })
          }}
          style={{
            position: 'absolute',
            left,
            top,
            maxWidth: Math.min(260, bounds.w),
            opacity: size ? 1 : 0,
            backgroundColor: P.raised,
            borderWidth: 1,
            borderColor: P.lineStrong,
            borderRadius: 2,
            paddingHorizontal: 10,
            paddingVertical: 7,
          }}
        >
          {readout.map((l, i) => (
            <Text
              key={i}
              maxFontSizeMultiplier={FONT_CAP}
              style={[
                i === 0 ? TYPE.serifUpright : TYPE.body,
                { fontSize: i === 0 ? 13 : 12, lineHeight: i === 0 ? 18 : 16, color: i === 0 ? P.ink : l.endsWith('check this shot') ? P.neg : P.inkDim },
              ]}
            >
              {l}
            </Text>
          ))}
          {roundId && (
            <Key
              accessibilityLabel="Open round"
              onPress={() => onOpenRound(roundId)}
              style={{ alignSelf: 'flex-start', marginTop: 6 }}
              hitSlop={4}
              faceStyle={{ minHeight: 40, paddingHorizontal: 10 }}
            >
              <KeyText size={12}>Open round</KeyText>
            </Key>
          )}
        </View>
      )}
    </View>
  )
}

/** The key under both charts: a shot, the average, the aim, and the rings
 *  (`ring68` names the inner one; null while the rings are hidden). On a narrow
 *  phone the 95% ring takes its own row. */
export const legendHeight = (width: number) => (width >= 380 ? 50 : 72)
export function ChartLegend({ y, width, ring68 }: { y: number; width: number; ring68: string | null }) {
  const wide = width >= 380
  return (
    <G>
      <Circle cx={LEFT + 6} cy={y + 14} r={4} fill={P.ink} />
      <SvgText x={LEFT + 16} y={y + 18} fontFamily={FONT.body} fontSize={12} fill={P.ink}>a shot</SvgText>
      <Circle cx={LEFT + 82} cy={y + 14} r={5} fill={P.raised} stroke={P.ink} strokeWidth={2} />
      <SvgText x={LEFT + 92} y={y + 18} fontFamily={FONT.body} fontSize={12} fill={P.ink}>average</SvgText>
      <Line x1={LEFT + 160} x2={LEFT + 160} y1={y + 7} y2={y + 20} stroke={P.warn} strokeWidth={1.5} />
      <SvgText x={LEFT + 168} y={y + 18} fontFamily={FONT.body} fontSize={12} fill={P.ink}>aim</SvgText>
      {ring68 != null && (
        <>
          <Ellipse cx={LEFT + 10} cy={y + 36} rx={10} ry={6} fill="rgba(31,61,44,0.07)" stroke={P.forest} strokeWidth={1.3} />
          <SvgText x={LEFT + 26} y={y + 40} fontFamily={FONT.body} fontSize={12} fill={P.ink}>{ring68}</SvgText>
          <Ellipse cx={wide ? LEFT + 182 : LEFT + 10} cy={wide ? y + 36 : y + 58} rx={10} ry={6} fill="rgba(31,61,44,0.035)" stroke={P.forest} strokeOpacity={0.7} strokeWidth={1} strokeDasharray="4,3" />
          <SvgText x={wide ? LEFT + 198 : LEFT + 26} y={wide ? y + 40 : y + 62} fontFamily={FONT.body} fontSize={12} fill={P.ink}>95% of shots</SvgText>
        </>
      )}
    </G>
  )
}
