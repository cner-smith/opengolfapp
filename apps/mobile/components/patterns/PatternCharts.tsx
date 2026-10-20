import { useMemo, useState } from 'react'
import { Text, View } from 'react-native'
import Svg, { Circle, Ellipse, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg'
import {
  LIE_TYPE_LABELS,
  SHOT_CONTACT_LABELS,
  SHOT_SHAPE_LABELS,
  SHOT_START_LINE_LABELS,
  type DispersionPoint,
  type DispersionStats,
} from '@oga/core'
import { FONT, TYPE } from '../../lib/typography'
import { FONT_CAP, P } from '../paper/tokens'
import { flightControl, type FlightPoint } from './flight'
import { NOT_RECORDED, UNRECORDED_INK, categoryOf, type ColourBy, type Layer, type ShotAxes } from './layers'

// The hero chart in two views (direction D, "Layers"), the mobile port of the
// web PatternCharts. Both are drawn from above; the reader chooses what is
// drawn and what the colour means. Labels sit on a paper halo and go where
// they cover the fewest shots. Tap a shot to read it; tap again to close.

const MUTE = '#8A8B7E'
const RULE = '#ECE6D8'
const RULE_MAJOR = '#DCD5C3'

export interface ChartProps {
  points: DispersionPoint[]
  stats: DispersionStats | null
  axes: Record<string, ShotAxes>
  layers: Record<Layer, boolean>
  colourBy: ColourBy
  colours: Map<string, string>
  hidden: Set<string>
  leftHanded: boolean
  width: number
  /** Grid spacing in yards (1 for the putter, 5 otherwise). */
  step: number
  /** Margin label for a distance in yards. */
  label: (yd: number) => string
  unitWord: string
  empty?: string
}

interface Box {
  x: number
  y: number
  w: number
  h: number
}
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
const textW = (s: string, px: number) => s.length * px * 0.52
type Anchor = 'start' | 'middle' | 'end'

function placeOnRing(cx: number, cy: number, rx: number, ry: number, text: string, px: number, dots: { x: number; y: number }[], taken: Box[], bounds: Box, angles: number[]) {
  let best: { x: number; y: number; anchor: Anchor; box: Box; score: number } | null = null
  for (const [i, deg] of angles.entries()) {
    const a = (deg * Math.PI) / 180
    const ex = cx + rx * Math.cos(a)
    const ey = cy - ry * Math.sin(a)
    const anchor: Anchor = Math.cos(a) > 0.35 ? 'start' : Math.cos(a) < -0.35 ? 'end' : 'middle'
    const x = ex + (anchor === 'start' ? 5 : anchor === 'end' ? -5 : 0)
    const y = Math.sin(a) >= 0 ? ey - 5 : ey + px + 3
    const w = textW(text, px)
    const box = { x: anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2, y: y - px, w, h: px + 3 }
    const pad = { x: box.x - 3, y: box.y - 3, w: box.w + 6, h: box.h + 6 }
    let score = i * 0.6
    for (const d of dots) if (d.x > pad.x && d.x < pad.x + pad.w && d.y > pad.y && d.y < pad.y + pad.h) score += 10
    for (const t of taken) if (overlaps(pad, t)) score += 100
    if (box.x < bounds.x || box.y < bounds.y || box.x + box.w > bounds.x + bounds.w || box.y + box.h > bounds.y + bounds.h) score += 1000
    if (!best || score < best.score) best = { x, y, anchor, box, score }
  }
  return best!
}

function placeNear(x: number, y: number, text: string, px: number, dots: { x: number; y: number }[], taken: Box[], bounds: Box) {
  const w = textW(text, px)
  const spots: { x: number; y: number; anchor: Anchor }[] = [
    { x: x + 9, y: y + px / 2 - 1, anchor: 'start' },
    { x: x - 9, y: y + px / 2 - 1, anchor: 'end' },
    { x, y: y + px + 8, anchor: 'middle' },
    { x, y: y - 9, anchor: 'middle' },
    { x: x + 7, y: y + px + 5, anchor: 'start' },
    { x: x - 7, y: y + px + 5, anchor: 'end' },
  ]
  let best = { ...spots[0]!, score: Infinity }
  for (const [i, sp] of spots.entries()) {
    const bx = sp.anchor === 'start' ? sp.x : sp.anchor === 'end' ? sp.x - w : sp.x - w / 2
    const pad = { x: bx - 3, y: sp.y - px - 2, w: w + 6, h: px + 6 }
    let score = i * 0.6
    for (const d of dots) if (d.x > pad.x - 3 && d.x < pad.x + pad.w + 3 && d.y > pad.y - 3 && d.y < pad.y + pad.h + 3) score += 10
    for (const t of taken) if (overlaps(pad, t)) score += 100
    if (pad.x < bounds.x || pad.x + pad.w > bounds.x + bounds.w || pad.y < bounds.y || pad.y + pad.h > bounds.y + bounds.h) score += 1000
    if (score < best.score) best = { ...sp, score }
  }
  return best
}

// RN-svg has no paint-order, so the halo is the same text drawn first as a
// thick paper stroke.
function Halo({ x, y, text, size = 11, fill = P.inkDim, anchor = 'start' }: { x: number; y: number; text: string; size?: number; fill?: string; anchor?: Anchor }) {
  return (
    <G pointerEvents="none">
      <SvgText x={x} y={y} textAnchor={anchor} fontFamily={FONT.serifItalic} fontSize={size} fill={P.raised} stroke={P.raised} strokeWidth={3.5} strokeLinejoin="round">
        {text}
      </SvgText>
      <SvgText x={x} y={y} textAnchor={anchor} fontFamily={FONT.serifItalic} fontSize={size} fill={fill}>
        {text}
      </SvgText>
    </G>
  )
}

function Pennant({ x, y, label }: { x: number; y: number; label?: boolean }) {
  return (
    <G pointerEvents="none">
      <Line x1={x} y1={y} x2={x} y2={y - 16} stroke={P.warn} strokeWidth={1.4} />
      <Path d={`M ${x} ${y - 16} L ${x + 10} ${y - 12.5} L ${x} ${y - 9} Z`} fill={P.warn} />
      <Circle cx={x} cy={y} r={2.2} fill={P.warn} />
      {label && <Halo x={x + 13} y={y - 9} size={13} fill={P.warn} text="aim" />}
    </G>
  )
}

function markStyle(p: DispersionPoint, props: ChartProps, dense: boolean) {
  const k = categoryOf(props.axes[p.id], props.colourBy)
  const coloured = props.colourBy !== 'none'
  const open = coloured && k === NOT_RECORDED
  const color = !coloured ? P.ink : open ? UNRECORDED_INK : props.colours.get(k) ?? P.ink
  return { k, open, color, hide: props.hidden.has(k), r: dense ? 3 : 4 }
}

function Dot({ x, y, s, hot, onPress }: { x: number; y: number; s: ReturnType<typeof markStyle>; hot: boolean; onPress: () => void }) {
  return (
    <G onPress={onPress}>
      <Circle cx={x} cy={y} r={11} fill="transparent" />
      <Circle cx={x} cy={y} r={hot ? s.r + 1.5 : s.r} fill={s.open ? P.raised : s.color} fillOpacity={s.open ? 1 : 0.9} stroke={s.open ? s.color : P.raised} strokeWidth={s.open ? 1.4 : 1.2} />
    </G>
  )
}

function shotWords(p: DispersionPoint, a: ShotAxes | undefined, label: (yd: number) => string, unitWord: string) {
  const along = Math.abs(p.distanceOffsetYards) < 1 ? 'Pin-high to the aim' : `${label(p.distanceOffsetYards)} ${unitWord} ${p.distanceOffsetYards < 0 ? 'short' : 'long'}`
  const across = Math.abs(p.lateralOffsetYards) < 1 ? 'on line' : `${label(p.lateralOffsetYards)} ${unitWord} ${p.lateralOffsetYards > 0 ? 'right' : 'left'}`
  const parts = [
    a?.shape ? SHOT_SHAPE_LABELS[a.shape] : null,
    a?.startLine ? SHOT_START_LINE_LABELS[a.startLine].toLowerCase() : null,
    a?.contact ? SHOT_CONTACT_LABELS[a.contact].toLowerCase() : null,
    p.lieType ? `from the ${LIE_TYPE_LABELS[p.lieType].toLowerCase()}` : null,
  ].filter(Boolean)
  return [`${along}, ${across}`, parts.join(' · ') || 'Nothing recorded']
}

function Tooltip({ x, y, lines, bounds }: { x: number; y: number; lines: string[]; bounds: Box }) {
  const w = Math.max(...lines.map((l, i) => l.length * (i === 0 ? 12 : 11) * 0.5)) + 20
  const h = 12 + lines.length * 16
  const bx = Math.min(Math.max(x - w / 2, bounds.x), bounds.x + bounds.w - w)
  const by = y - h - 12 < bounds.y ? y + 12 : y - h - 12
  return (
    <G pointerEvents="none">
      <Rect x={bx} y={by} width={w} height={h} rx={2} fill={P.raised} stroke={P.lineStrong} />
      {lines.map((l, i) => (
        <SvgText key={i} x={bx + 10} y={by + 19 + i * 16} fontFamily={i === 0 ? FONT.serif : FONT.body} fontSize={i === 0 ? 12 : 11} fill={i === 0 ? P.ink : P.inkDim}>
          {l}
        </SvgText>
      ))}
    </G>
  )
}

/* ---------------------------------------------------------------- aim view */

const LEFT = 40
const BOTTOM = 30
const TOP = 10
const RIGHT = 8

export function AimPlot(props: ChartProps) {
  const { points, stats, layers, width, step, label, unitWord, empty } = props
  const [hot, setHot] = useState<string | null>(null)
  const area = width - LEFT - RIGHT
  const h = TOP + area + BOTTOM
  const dense = points.length > 40
  const reach = Math.max(
    ...points.map((p) => Math.max(Math.abs(p.lateralOffsetYards), Math.abs(p.distanceOffsetYards))),
    stats ? Math.abs(stats.avgLateralOffset) + stats.cone95.lateral : 0,
    stats ? Math.abs(stats.avgDistanceOffset) + stats.cone95.distance : 0,
    step * 2,
  )
  const half = Math.ceil((reach * 1.08) / step) * step
  const scale = area / 2 / half
  const cx = LEFT + area / 2
  const cy = TOP + area / 2
  const px = (l: number) => cx + l * scale
  const py = (d: number) => cy - d * scale
  const ruleStep = step * scale >= 12 ? step : step * 2
  const labelEvery = ruleStep * scale >= 18 ? ruleStep : ruleStep * 2
  const isMult = (v: number, m: number) => Math.abs(v / m - Math.round(v / m)) < 1e-6
  const rules: number[] = []
  for (let v = -half; v <= half + 1e-6; v += ruleStep) rules.push(Math.round(v * 1000) / 1000)
  const bounds = { x: LEFT + 2, y: TOP + 2, w: area - 4, h: area - 4 }

  const styled = points.map((p) => ({ p, s: markStyle(p, props, dense), x: px(p.lateralOffsetYards), y: py(p.distanceOffsetYards) }))
  const visible = layers.shots ? styled.filter((d) => !d.s.hide) : []
  const taken: Box[] = [{ x: cx - 2, y: cy - 22, w: 46, h: 24 }]
  let r68: ReturnType<typeof placeOnRing> | null = null
  let r95: ReturnType<typeof placeOnRing> | null = null
  let avg: ReturnType<typeof placeNear> | null = null
  if (stats) {
    const ax = px(stats.avgLateralOffset)
    const ay = py(stats.avgDistanceOffset)
    if (layers.rings) {
      r68 = placeOnRing(ax, ay, stats.cone68.lateral * scale, stats.cone68.distance * scale, 'two in three', 11, visible, taken, bounds, [52, 128, -52, -128, 18, 162])
      taken.push(r68.box)
      r95 = placeOnRing(ax, ay, stats.cone95.lateral * scale, stats.cone95.distance * scale, 'nearly all', 11, visible, taken, bounds, [128, 52, -128, -52, 162, 18])
      taken.push(r95.box)
    }
    if (layers.average) avg = placeNear(ax, ay, 'average', 11, visible, taken, bounds)
  }
  const hotD = hot ? styled.find((d) => d.p.id === hot) : null

  return (
    <Svg width={width} height={h}>
      {rules.map((v) => {
        const stroke = v === 0 ? P.lineStrong : isMult(v, ruleStep * 2) ? RULE_MAJOR : RULE
        const show = v !== 0 && Math.abs(v) !== half && isMult(v, labelEvery)
        return (
          <G key={v}>
            <Line x1={LEFT} x2={LEFT + area} y1={py(v)} y2={py(v)} stroke={stroke} strokeWidth={1} />
            <Line x1={px(v)} x2={px(v)} y1={TOP} y2={TOP + area} stroke={stroke} strokeWidth={1} />
            {show && (
              <>
                <SvgText x={LEFT - 5} y={py(v) + 4} textAnchor="end" fontFamily={FONT.serif} fontSize={12} fill={P.inkDim}>{label(v)}</SvgText>
                <SvgText x={px(v)} y={TOP + area + 15} textAnchor="middle" fontFamily={FONT.serif} fontSize={12} fill={P.inkDim}>{label(v)}</SvgText>
              </>
            )}
          </G>
        )
      })}
      <Rect x={LEFT} y={TOP} width={area} height={area} fill="none" stroke={P.lineStrong} strokeWidth={1} />
      <SvgText x={LEFT - 5} y={TOP + 4} textAnchor="end" fontFamily={FONT.bodyItalic} fontSize={11} fill={P.inkDim}>long</SvgText>
      <SvgText x={LEFT - 5} y={TOP + area + 4} textAnchor="end" fontFamily={FONT.bodyItalic} fontSize={11} fill={P.inkDim}>short</SvgText>
      <SvgText x={LEFT} y={h - 3} fontFamily={FONT.bodyItalic} fontSize={11} fill={P.inkDim}>left</SvgText>
      <SvgText x={LEFT + area} y={h - 3} textAnchor="end" fontFamily={FONT.bodyItalic} fontSize={11} fill={P.inkDim}>right</SvgText>
      <SvgText x={cx} y={h - 3} textAnchor="middle" fontFamily={FONT.body} fontSize={11} fill={MUTE}>{unitWord}</SvgText>

      {stats && layers.rings && (
        <G pointerEvents="none">
          <Ellipse cx={px(stats.avgLateralOffset)} cy={py(stats.avgDistanceOffset)} rx={stats.cone95.lateral * scale} ry={stats.cone95.distance * scale} fill="rgba(31,61,44,0.035)" stroke={P.forest} strokeOpacity={0.7} strokeWidth={1} strokeDasharray="4,3" />
          <Ellipse cx={px(stats.avgLateralOffset)} cy={py(stats.avgDistanceOffset)} rx={stats.cone68.lateral * scale} ry={stats.cone68.distance * scale} fill="rgba(31,61,44,0.07)" stroke={P.forest} strokeWidth={1.3} />
        </G>
      )}
      {stats && layers.average && <Line x1={cx} y1={cy} x2={px(stats.avgLateralOffset)} y2={py(stats.avgDistanceOffset)} stroke={P.ink} strokeWidth={1} strokeDasharray="3,3" />}
      {visible.map((d) => (
        <Dot key={d.p.id} x={d.x} y={d.y} s={d.s} hot={hot === d.p.id} onPress={() => setHot(hot === d.p.id ? null : d.p.id)} />
      ))}
      {stats && layers.average && <Circle cx={px(stats.avgLateralOffset)} cy={py(stats.avgDistanceOffset)} r={5.5} fill={P.raised} stroke={P.forest} strokeWidth={1.8} />}
      <Pennant x={cx} y={cy} label />
      {r68 && <Halo x={r68.x} y={r68.y} anchor={r68.anchor} fill={P.forest} text="two in three" />}
      {r95 && <Halo x={r95.x} y={r95.y} anchor={r95.anchor} fill={P.forest} text="nearly all" />}
      {avg && <Halo x={avg.x} y={avg.y} anchor={avg.anchor} fill={P.ink} text="average" />}

      {points.length === 0 && empty && (
        <>
          <Rect x={LEFT + 6} y={cy + 20} width={area - 12} height={28} fill={P.raised} />
          <SvgText x={cx} y={cy + 39} textAnchor="middle" fontFamily={FONT.body} fontSize={14} fill={P.inkDim}>{empty}</SvgText>
        </>
      )}
      {hotD && <Tooltip x={hotD.x} y={hotD.y} lines={shotWords(hotD.p, props.axes[hotD.p.id], label, unitWord)} bounds={bounds} />}
    </Svg>
  )
}

/* ---------------------------------------------------------------- tee view */

/** Where the tee view's shortened stretch ends: a round number comfortably
 *  short of the nearest finish (or ring edge); 0 when there is none. */
export function teeBreakYards(points: DispersionPoint[], stats: DispersionStats | null) {
  const aims = points.filter((p) => p.startDistanceOffsetYards != null).map((p) => -p.startDistanceOffsetYards!)
  const avgAim = aims.length ? aims.reduce((a, b) => a + b, 0) / aims.length : 0
  const ys = points.map((p) => (p.startDistanceOffsetYards != null ? -p.startDistanceOffsetYards : avgAim) + p.distanceOffsetYards)
  if (stats) ys.push(avgAim + stats.avgDistanceOffset - stats.cone95.distance)
  const lowY = Math.min(...ys, avgAim)
  return lowY > 90 ? Math.floor((lowY * 0.82) / 25) * 25 : 0
}

const SHORTENED_PX = 56

function bezier(S: FlightPoint, C: FlightPoint, E: FlightPoint, n = 24): FlightPoint[] {
  const out: FlightPoint[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const a = (1 - t) * (1 - t)
    const b = 2 * (1 - t) * t
    const c = t * t
    out.push({ x: a * S.x + b * C.x + c * E.x, y: a * S.y + b * C.y + c * E.y })
  }
  return out
}

// From the tee, still from above. The landing area is at one true scale; the
// stretch from the tee to the break is shortened, and there each flight is
// only a faint stub (a shortened stretch can't keep the flight's angle).
export function TeePlot(props: ChartProps) {
  const { points, stats, layers, axes, leftHanded, width, label, unitWord } = props
  const [hot, setHot] = useState<string | null>(null)
  const TH = Math.round(width * 1.2)
  const TEE_Y = TH - 34
  const TL = LEFT
  const TR = RIGHT
  const dense = points.length > 40

  const geo = useMemo(() => {
    const aims = points.filter((p) => p.startDistanceOffsetYards != null).map((p) => -p.startDistanceOffsetYards!)
    const avgAim = aims.length ? aims.reduce((a, b) => a + b, 0) / aims.length : 0
    const S = { x: 0, y: 0 }
    const shots = points.map((p) => {
      const aim = p.startDistanceOffsetYards != null ? -p.startDistanceOffsetYards : avgAim
      const E = { x: p.lateralOffsetYards, y: aim + p.distanceOffsetYards }
      const a = axes[p.id]
      const { c, recorded } = flightControl(S, E, a?.startLine ?? null, a?.shape ?? null, leftHanded)
      return { p, E, path: bezier(S, c, E), recorded }
    })
    const avgEnd = stats ? { x: stats.avgLateralOffset, y: avgAim + stats.avgDistanceOffset } : null
    const ys = shots.map((s) => s.E.y)
    if (stats && avgEnd) ys.push(avgEnd.y - stats.cone95.distance, avgEnd.y + stats.cone95.distance)
    const maxY = Math.max(...ys, avgAim, 1) + 6
    const brk = teeBreakYards(points, stats)
    const xs = [0, ...shots.flatMap((s) => s.path.filter((q) => q.y >= brk).map((q) => q.x))]
    if (stats && avgEnd) xs.push(avgEnd.x - stats.cone95.lateral, avgEnd.x + stats.cone95.lateral)
    const lo = Math.min(...xs)
    const hi = Math.max(...xs)
    const centre = (lo + hi) / 2
    const halfW = Math.max((hi - lo) / 2, 10) * 1.1
    const comp = brk > 0 ? SHORTENED_PX : 0
    const scale = Math.min((TEE_Y - 14 - comp) / (maxY - brk), (width - TL - TR) / 2 / halfW)
    return { avgAim, avgEnd, shots, maxY, brk, comp, centre, scale }
  }, [points, stats, axes, leftHanded, width, TEE_Y, TL, TR])

  if (!points.some((p) => p.startDistanceOffsetYards != null) || geo.avgAim < 5) {
    return (
      <View style={{ height: width * 0.6, alignItems: 'center', justifyContent: 'center', padding: 22 }}>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 13, color: P.inkDim, textAlign: 'center' }]}>
          These shots have no start point saved, so there is no line from the tee to draw.
        </Text>
      </View>
    )
  }

  const { avgAim, avgEnd, shots, maxY, brk, comp, centre, scale } = geo
  const midX = TL + (width - TL - TR) / 2
  const x = (l: number) => midX + (l - centre) * scale
  const y = (d: number) => (d <= brk ? TEE_Y - (brk > 0 ? (d / brk) * comp : 0) : TEE_Y - comp - (d - brk) * scale)
  const line = (pts: FlightPoint[]) => pts.map((q, i) => `${i ? 'L' : 'M'} ${x(q.x).toFixed(1)} ${y(q.y).toFixed(1)}`).join(' ')
  const split = (pts: FlightPoint[]) => {
    if (brk <= 0) return { upper: pts, cross: null as FlightPoint | null }
    const i = pts.findIndex((q) => q.y >= brk)
    if (i <= 0) return { upper: pts, cross: null }
    const a = pts[i - 1]!
    const b = pts[i]!
    const cross = { x: a.x + ((b.x - a.x) * (brk - a.y)) / (b.y - a.y), y: brk }
    return { upper: [cross, ...pts.slice(i)], cross }
  }
  const teeX = x(0)
  const breakY = TEE_Y - comp
  const ruleStep = 5 * scale >= 14 ? 5 : 10 * scale >= 12 ? 10 : 25
  const labelStep = 10 * scale >= 24 ? 10 : 25 * scale >= 24 ? 25 : 50
  const rules: number[] = []
  for (let d = Math.ceil((brk + 1) / ruleStep) * ruleStep; d <= maxY; d += ruleStep) rules.push(d)
  const bounds = { x: TL + 2, y: 2, w: width - TL - TR - 4, h: breakY - 6 }

  const styled = shots.map((s) => ({ ...s, s: markStyle(s.p, props, dense), dx: x(s.E.x), dy: y(s.E.y) }))
  const shown = styled.filter((d) => !d.s.hide)
  const dots = layers.shots ? shown.map((d) => ({ x: d.dx, y: d.dy })) : []
  const lineOp = props.colourBy === 'none' ? (dense ? 0.2 : 0.42) : dense ? 0.42 : 0.8
  const taken: Box[] = [{ x: teeX - 2, y: y(avgAim) - 20, w: 40, h: 22 }]
  let r68: ReturnType<typeof placeOnRing> | null = null
  let r95: ReturnType<typeof placeOnRing> | null = null
  if (stats && avgEnd && layers.rings) {
    r68 = placeOnRing(x(avgEnd.x), y(avgEnd.y), stats.cone68.lateral * scale, stats.cone68.distance * scale, 'two in three', 11, dots, taken, bounds, [-25, 205, 25, 155, -60, -120])
    taken.push(r68.box)
    r95 = placeOnRing(x(avgEnd.x), y(avgEnd.y), stats.cone95.lateral * scale, stats.cone95.distance * scale, 'nearly all', 11, dots, taken, bounds, [205, -25, 155, 25, -120, -60])
  }
  const hotD = hot ? styled.find((d) => d.p.id === hot) : null
  const barYd = 10 * scale >= 30 ? 10 : 25

  return (
    <Svg width={width} height={TH}>
      {rules.map((d) => (
        <G key={d}>
          <Line x1={TL} x2={width - TR} y1={y(d)} y2={y(d)} stroke={d % labelStep === 0 ? RULE_MAJOR : RULE} strokeWidth={1} />
          {d % labelStep === 0 && <SvgText x={TL - 5} y={y(d) + 4} textAnchor="end" fontFamily={FONT.serif} fontSize={12} fill={P.inkDim}>{label(d)}</SvgText>}
        </G>
      ))}
      <Line x1={TL} x2={TL} y1={y(maxY)} y2={breakY - 5} stroke={P.lineStrong} strokeWidth={1} />
      <Line x1={TL} x2={TL} y1={breakY + 5} y2={TEE_Y} stroke={P.lineStrong} strokeWidth={1} />
      <Line x1={TL} x2={width - TR} y1={TEE_Y} y2={TEE_Y} stroke={P.lineStrong} strokeWidth={1} />
      <Line x1={teeX} x2={teeX} y1={y(maxY)} y2={TEE_Y} stroke={P.lineStrong} strokeWidth={1} strokeDasharray="2,4" />
      {brk > 0 && (
        <G>
          <Line x1={TL} x2={width - TR} y1={breakY} y2={breakY} stroke={P.lineStrong} strokeWidth={1} strokeDasharray="1,3" />
          <Path d={`M ${TL - 5} ${breakY - 1} l 10 -6 M ${TL - 5} ${breakY + 6} l 10 -6`} stroke={P.lineStrong} strokeWidth={1.2} />
          <SvgText x={TL - 8} y={breakY + 4} textAnchor="end" fontFamily={FONT.serif} fontSize={12} fill={P.inkDim}>{label(brk)}</SvgText>
          <SvgText x={TL + 8} y={breakY + comp / 2 + 4} fontFamily={FONT.bodyItalic} fontSize={10} fill={MUTE}>shortened</SvgText>
        </G>
      )}
      {stats && avgEnd && layers.rings && (
        <G pointerEvents="none">
          <Ellipse cx={x(avgEnd.x)} cy={y(avgEnd.y)} rx={stats.cone95.lateral * scale} ry={stats.cone95.distance * scale} fill="rgba(31,61,44,0.035)" stroke={P.forest} strokeOpacity={0.7} strokeWidth={1} strokeDasharray="4,3" />
          <Ellipse cx={x(avgEnd.x)} cy={y(avgEnd.y)} rx={stats.cone68.lateral * scale} ry={stats.cone68.distance * scale} fill="rgba(31,61,44,0.07)" stroke={P.forest} strokeWidth={1.3} />
        </G>
      )}
      {layers.flights &&
        shown.map((d) => {
          const isHot = hot === d.p.id
          const op = isHot ? 1 : hot ? 0.08 : d.recorded ? lineOp : lineOp * 0.8
          const { upper, cross } = split(d.path)
          const stroke = props.colourBy === 'none' ? (d.recorded ? P.ink : UNRECORDED_INK) : d.s.color
          return (
            <G key={d.p.id} pointerEvents="none">
              {cross && <Line x1={teeX} y1={TEE_Y} x2={x(cross.x)} y2={y(cross.y)} stroke={stroke} strokeOpacity={Math.min(op, 0.22)} strokeWidth={1} strokeDasharray="1,3" />}
              <Path d={line(upper)} fill="none" stroke={stroke} strokeOpacity={op} strokeWidth={isHot ? 2.4 : dense ? 1 : 1.4} strokeDasharray={d.recorded ? undefined : '3,3'} strokeLinecap="round" strokeLinejoin="round" />
            </G>
          )
        })}
      {stats && avgEnd && layers.average && (
        <Path d={line(split(bezier({ x: 0, y: 0 }, { x: avgEnd.x / 2, y: avgEnd.y / 2 }, avgEnd, 12)).upper)} fill="none" stroke={P.ink} strokeWidth={1} strokeDasharray="3,3" />
      )}
      {(layers.shots || layers.flights) &&
        shown.map((d) =>
          layers.shots ? (
            <Dot key={`d${d.p.id}`} x={d.dx} y={d.dy} s={d.s} hot={hot === d.p.id} onPress={() => setHot(hot === d.p.id ? null : d.p.id)} />
          ) : (
            <Circle key={`h${d.p.id}`} cx={d.dx} cy={d.dy} r={11} fill="transparent" onPress={() => setHot(hot === d.p.id ? null : d.p.id)} />
          ),
        )}
      {stats && avgEnd && layers.average && <Circle cx={x(avgEnd.x)} cy={y(avgEnd.y)} r={5.5} fill={P.raised} stroke={P.forest} strokeWidth={1.8} />}
      <Pennant x={teeX} y={y(avgAim)} />
      {r68 && <Halo x={r68.x} y={r68.y} anchor={r68.anchor} fill={P.forest} text="two in three" />}
      {r95 && <Halo x={r95.x} y={r95.y} anchor={r95.anchor} fill={P.forest} text="nearly all" />}
      <Circle cx={teeX} cy={TEE_Y} r={4.5} fill={P.raised} stroke={P.ink} strokeWidth={1.6} />
      <SvgText x={teeX} y={TEE_Y + 19} textAnchor="middle" fontFamily={FONT.bodyItalic} fontSize={12} fill={P.inkDim}>hit from here</SvgText>
      <SvgText x={TL - 5} y={TEE_Y + 4} textAnchor="end" fontFamily={FONT.body} fontSize={11} fill={MUTE}>{unitWord}</SvgText>
      <Line x1={width - TR - barYd * scale} x2={width - TR} y1={TEE_Y + 22} y2={TEE_Y + 22} stroke={P.inkDim} strokeWidth={1.2} />
      <Line x1={width - TR - barYd * scale} x2={width - TR - barYd * scale} y1={TEE_Y + 18} y2={TEE_Y + 26} stroke={P.inkDim} strokeWidth={1.2} />
      <Line x1={width - TR} x2={width - TR} y1={TEE_Y + 18} y2={TEE_Y + 26} stroke={P.inkDim} strokeWidth={1.2} />
      <SvgText x={width - TR - (barYd * scale) / 2} y={TEE_Y + 15} textAnchor="middle" fontFamily={FONT.serif} fontSize={11} fill={P.inkDim}>{`${label(barYd)} ${unitWord}`}</SvgText>
      {hotD && <Tooltip x={hotD.dx} y={hotD.dy} lines={shotWords(hotD.p, axes[hotD.p.id], label, unitWord)} bounds={bounds} />}
    </Svg>
  )
}
