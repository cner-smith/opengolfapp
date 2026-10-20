import { useEffect, useMemo, useState } from 'react'
import {
  LIE_TYPE_LABELS,
  SHOT_CONTACT_LABELS,
  SHOT_SHAPE_LABELS,
  SHOT_START_LINE_LABELS,
  YARDS_TO_METERS,
  type DispersionPoint,
  type DispersionStats,
  type DistanceUnit,
} from '@oga/core'
import { flightControl, type FlightPoint } from '../flight'
import { NOT_RECORDED, UNRECORDED_INK, categoryOf, type ColourBy, type Layer, type ShotAxes } from '../layers'

// The hero chart in two views (direction D, "Layers"). Both are drawn from
// above at one true scale; the reader chooses what is drawn (rings, average,
// shots, flights) and what the colour means. Labels sit on a paper halo and
// are placed where they cover the fewest shots.

const SERIF = 'Fraunces, Georgia, serif'
const SANS = 'Epilogue, sans-serif'
const PAPER = '#FBF8F1'
const INK = '#1C211C'
const DIM = '#5C6356'
const MUTE = '#8A8B7E'
const LINE_STRONG = '#9F9580'
const RULE = '#ECE6D8'
const RULE_MAJOR = '#DCD5C3'
const FOREST = '#1F3D2C'
const AMBER = '#A66A1F'

export interface ChartProps {
  points: DispersionPoint[]
  stats: DispersionStats | null
  unit: DistanceUnit
  axes: Record<string, ShotAxes>
  layers: Record<Layer, boolean>
  colourBy: ColourBy
  colours: Map<string, string>
  hidden: Set<string>
  /** A legend entry under the pointer: the other groups step back. */
  focus: string | null
  leftHanded: boolean
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

// Put a label on an ellipse's edge at the candidate angle that covers the
// fewest shots and no other label; earlier angles win ties.
function placeOnRing(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  text: string,
  px: number,
  dots: { x: number; y: number }[],
  taken: Box[],
  bounds: Box,
  angles: number[],
) {
  let best: { x: number; y: number; anchor: 'start' | 'middle' | 'end'; box: Box; score: number } | null = null
  for (const [i, deg] of angles.entries()) {
    const a = (deg * Math.PI) / 180
    const ex = cx + rx * Math.cos(a)
    const ey = cy - ry * Math.sin(a)
    const anchor: 'start' | 'middle' | 'end' = Math.cos(a) > 0.35 ? 'start' : Math.cos(a) < -0.35 ? 'end' : 'middle'
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

// A point's label: right, left, below, above, then the diagonals; the first
// spot that covers no shot and no other label wins.
function placeNear(x: number, y: number, text: string, px: number, dots: { x: number; y: number }[], taken: Box[], bounds: Box) {
  const w = textW(text, px)
  const spots: { x: number; y: number; anchor: 'start' | 'middle' | 'end' }[] = [
    { x: x + 9, y: y + px / 2 - 1, anchor: 'start' },
    { x: x - 9, y: y + px / 2 - 1, anchor: 'end' },
    { x, y: y + px + 8, anchor: 'middle' },
    { x, y: y - 9, anchor: 'middle' },
    { x: x + 7, y: y + px + 5, anchor: 'start' },
    { x: x - 7, y: y + px + 5, anchor: 'end' },
    { x: x + 7, y: y - 7, anchor: 'start' },
    { x: x - 7, y: y - 7, anchor: 'end' },
  ]
  let best: (typeof spots)[number] & { score: number } = { ...spots[0]!, score: Infinity }
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

function Halo({ x, y, children, size = 12, fill = DIM, anchor = 'start', italic = true, family = SERIF }: {
  x: number
  y: number
  children: string
  size?: number
  fill?: string
  anchor?: 'start' | 'middle' | 'end'
  italic?: boolean
  family?: string
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontFamily={family}
      fontStyle={italic ? 'italic' : undefined}
      fontSize={size}
      fill={fill}
      stroke={PAPER}
      strokeWidth={3.5}
      strokeLinejoin="round"
      paintOrder="stroke"
      style={{ pointerEvents: 'none' }}
    >
      {children}
    </text>
  )
}

function Pennant({ x, y, label }: { x: number; y: number; label?: boolean }) {
  return (
    <g style={{ pointerEvents: 'none' }}>
      <line x1={x} y1={y} x2={x} y2={y - 16} stroke={AMBER} strokeWidth={1.4} />
      <path d={`M ${x} ${y - 16} L ${x + 10} ${y - 12.5} L ${x} ${y - 9} Z`} fill={AMBER} />
      <circle cx={x} cy={y} r={2.2} fill={AMBER} />
      {label && <Halo x={x + 13} y={y - 9} size={14} fill={AMBER}>aim</Halo>}
    </g>
  )
}

// One shot's look under the current colour and focus.
function markStyle(p: DispersionPoint, props: ChartProps, dense: boolean) {
  const k = categoryOf(props.axes[p.id], props.colourBy)
  const coloured = props.colourBy !== 'none'
  const open = coloured && k === NOT_RECORDED
  const color = !coloured ? INK : open ? UNRECORDED_INK : props.colours.get(k) ?? INK
  const dimmed = props.focus != null && props.focus !== k
  return { k, open, color, hide: props.hidden.has(k), dimmed, r: dense ? 3 : 4 }
}

function Dot({ x, y, s, onEnter, onLeave, hot }: {
  x: number
  y: number
  s: ReturnType<typeof markStyle>
  onEnter: () => void
  onLeave: () => void
  hot: boolean
}) {
  const op = s.dimmed ? 0.14 : 1
  return (
    <g onPointerEnter={onEnter} onPointerLeave={onLeave} style={{ cursor: 'default' }}>
      <circle cx={x} cy={y} r={10} fill="transparent" />
      <circle
        cx={x}
        cy={y}
        r={hot ? s.r + 1.5 : s.r}
        fill={s.open ? PAPER : s.color}
        fillOpacity={s.open ? op : 0.9 * op}
        stroke={s.open ? s.color : PAPER}
        strokeOpacity={op}
        strokeWidth={s.open ? 1.4 : 1.2}
        style={{ pointerEvents: 'none' }}
      />
    </g>
  )
}

const dist = (yd: number, unit: DistanceUnit) => `${Math.round(Math.abs(unit === 'meters' ? yd * YARDS_TO_METERS : yd))} ${unit === 'meters' ? 'm' : 'yd'}`

function shotWords(p: DispersionPoint, a: ShotAxes | undefined, unit: DistanceUnit) {
  const along = Math.abs(p.distanceOffsetYards) < 1 ? 'pin-high to the aim' : `${dist(p.distanceOffsetYards, unit)} ${p.distanceOffsetYards < 0 ? 'short' : 'long'}`
  const across = Math.abs(p.lateralOffsetYards) < 1 ? 'on line' : `${dist(p.lateralOffsetYards, unit)} ${p.lateralOffsetYards > 0 ? 'right' : 'left'}`
  const parts = [
    a?.shape ? SHOT_SHAPE_LABELS[a.shape] : null,
    a?.startLine ? SHOT_START_LINE_LABELS[a.startLine].toLowerCase() : null,
    a?.contact ? SHOT_CONTACT_LABELS[a.contact].toLowerCase() : null,
    p.lieType ? `from the ${LIE_TYPE_LABELS[p.lieType].toLowerCase()}` : null,
  ].filter(Boolean)
  const missing = [!a?.shape && 'shape', !a?.startLine && 'start line'].filter(Boolean)
  return [`${cap(along)}, ${across}`, parts.join(' · ') || 'Nothing recorded', missing.length ? `${cap(missing.join(' and '))} not recorded` : null].filter(Boolean) as string[]
}

function Tooltip({ x, y, lines, bounds }: { x: number; y: number; lines: string[]; bounds: Box }) {
  const w = Math.max(...lines.map((l, i) => l.length * (i === 0 ? 13 : 12) * 0.47)) + 22
  const h = 12 + lines.length * 17
  const bx = Math.min(Math.max(x + 12, bounds.x), bounds.x + bounds.w - w)
  const by = y - h - 10 < bounds.y ? y + 12 : y - h - 10
  return (
    <g style={{ pointerEvents: 'none' }}>
      <rect x={bx} y={by} width={w} height={h} rx={2} fill={PAPER} stroke={LINE_STRONG} />
      {lines.map((l, i) => (
        <text key={i} x={bx + 10} y={by + 20 + i * 17} fontFamily={i === 0 ? SERIF : SANS} fontSize={i === 0 ? 13 : 12} fill={i === 0 ? INK : DIM}>
          {l}
        </text>
      ))}
    </g>
  )
}

/* ---------------------------------------------------------------- aim view */

// Below the desktop fold the chart draws on a narrower page so its type stays
// near true size on a phone.
export function useNarrow() {
  const q = '(max-width: 1023px)'
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const on = () => setNarrow(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return narrow
}

const BOTTOM = 34
const TOP = 12
const RIGHT = 12

export function AimPlot(props: ChartProps) {
  const { points, stats, unit, layers, empty } = props
  const narrow = useNarrow()
  const W = narrow ? 350 : 440
  const LEFT = narrow ? 42 : 48
  const AREA = W - LEFT - RIGHT
  const H = TOP + AREA + BOTTOM
  const [hover, setHover] = useState<string | null>(null)
  const dense = points.length > 40
  // The scale holds both rings whether or not they are drawn, so a toggle
  // never rescales the page.
  const { half, scale } = useMemo(() => {
    const reach = Math.max(
      ...points.map((p) => Math.max(Math.abs(p.lateralOffsetYards), Math.abs(p.distanceOffsetYards))),
      stats ? Math.abs(stats.avgLateralOffset) + stats.cone95.lateral : 0,
      stats ? Math.abs(stats.avgDistanceOffset) + stats.cone95.distance : 0,
      10,
    )
    const h = Math.ceil((reach * 1.08) / 5) * 5
    return { half: h, scale: AREA / 2 / h }
  }, [points, stats, AREA])

  const cx = LEFT + AREA / 2
  const cy = TOP + AREA / 2
  const px = (lat: number) => cx + lat * scale
  const py = (d: number) => cy - d * scale
  const ruleStep = 5 * scale >= 14 ? 5 : 10
  const labelStep = ruleStep * scale >= 18 ? ruleStep : ruleStep * 2
  const rules: number[] = []
  for (let v = -half; v <= half; v += ruleStep) rules.push(v)
  const tick = (yd: number) => String(Math.round(Math.abs(unit === 'meters' ? yd * YARDS_TO_METERS : yd)))
  const bounds = { x: LEFT + 2, y: TOP + 2, w: AREA - 4, h: AREA - 4 }

  const styled = points.map((p) => ({ p, s: markStyle(p, props, dense), x: px(p.lateralOffsetYards), y: py(p.distanceOffsetYards) }))
  const visible = layers.shots ? styled.filter((d) => !d.s.hide) : []

  // Labels: aim first (fixed), then the inner ring, the outer ring, the average.
  const taken: Box[] = [{ x: cx - 2, y: cy - 22, w: 50, h: 24 }]
  let ring68: ReturnType<typeof placeOnRing> | null = null
  let ring95: ReturnType<typeof placeOnRing> | null = null
  let avgLabel: ReturnType<typeof placeNear> | null = null
  if (stats) {
    const ax = px(stats.avgLateralOffset)
    const ay = py(stats.avgDistanceOffset)
    if (layers.rings) {
      ring68 = placeOnRing(ax, ay, stats.cone68.lateral * scale, stats.cone68.distance * scale, 'two in three', 12, visible, taken, bounds, [52, 128, -52, -128, 18, 162])
      taken.push(ring68.box)
      ring95 = placeOnRing(ax, ay, stats.cone95.lateral * scale, stats.cone95.distance * scale, 'nearly all', 12, visible, taken, bounds, [128, 52, -128, -52, 162, 18])
      taken.push(ring95.box)
    }
    if (layers.average) avgLabel = placeNear(ax, ay, 'average', 12, visible, taken, bounds)
  }
  const hot = hover ? styled.find((d) => d.p.id === hover) : null

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} role="img" aria-label="Where each shot finished, measured from your aim">
      {rules.map((v) => {
        const stroke = v === 0 ? LINE_STRONG : v % 10 === 0 ? RULE_MAJOR : RULE
        return (
          <g key={v}>
            <line x1={LEFT} x2={LEFT + AREA} y1={py(v)} y2={py(v)} stroke={stroke} strokeWidth={1} />
            <line x1={px(v)} x2={px(v)} y1={TOP} y2={TOP + AREA} stroke={stroke} strokeWidth={1} />
            {v % labelStep === 0 && v !== 0 && Math.abs(v) !== half && (
              <>
                <text x={LEFT - 6} y={py(v) + 4} textAnchor="end" fontFamily={SERIF} fontSize={13} fill={DIM}>{tick(v)}</text>
                <text x={px(v)} y={TOP + AREA + 16} textAnchor="middle" fontFamily={SERIF} fontSize={13} fill={DIM}>{tick(v)}</text>
              </>
            )}
          </g>
        )
      })}
      <rect x={LEFT} y={TOP} width={AREA} height={AREA} fill="none" stroke={LINE_STRONG} strokeWidth={1} />
      <text x={LEFT - 6} y={TOP + 4} textAnchor="end" fontFamily={SANS} fontSize={12} fontStyle="italic" fill={DIM}>long</text>
      <text x={LEFT - 6} y={TOP + AREA + 4} textAnchor="end" fontFamily={SANS} fontSize={12} fontStyle="italic" fill={DIM}>short</text>
      <text x={LEFT} y={H - 4} fontFamily={SANS} fontSize={12} fontStyle="italic" fill={DIM}>left</text>
      <text x={LEFT + AREA} y={H - 4} textAnchor="end" fontFamily={SANS} fontSize={12} fontStyle="italic" fill={DIM}>right</text>
      <text x={cx} y={H - 4} textAnchor="middle" fontFamily={SANS} fontSize={12} fill={MUTE}>{unit === 'meters' ? 'm' : 'yd'}</text>

      {stats && layers.rings && (
        <g style={{ pointerEvents: 'none' }}>
          <ellipse
            cx={px(stats.avgLateralOffset)}
            cy={py(stats.avgDistanceOffset)}
            rx={stats.cone95.lateral * scale}
            ry={stats.cone95.distance * scale}
            fill="rgba(31,61,44,0.035)"
            stroke={FOREST}
            strokeOpacity={0.7}
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          <ellipse
            cx={px(stats.avgLateralOffset)}
            cy={py(stats.avgDistanceOffset)}
            rx={stats.cone68.lateral * scale}
            ry={stats.cone68.distance * scale}
            fill="rgba(31,61,44,0.07)"
            stroke={FOREST}
            strokeWidth={1.3}
          />
        </g>
      )}
      {stats && layers.average && (
        <line x1={cx} y1={cy} x2={px(stats.avgLateralOffset)} y2={py(stats.avgDistanceOffset)} stroke={INK} strokeWidth={1} strokeDasharray="3 3" />
      )}

      {visible.map((d) => (
        <Dot key={d.p.id} x={d.x} y={d.y} s={d.s} hot={hover === d.p.id} onEnter={() => setHover(d.p.id)} onLeave={() => setHover(null)} />
      ))}

      {stats && layers.average && (
        <circle cx={px(stats.avgLateralOffset)} cy={py(stats.avgDistanceOffset)} r={5.5} fill={PAPER} stroke={FOREST} strokeWidth={1.8} style={{ pointerEvents: 'none' }} />
      )}
      <Pennant x={cx} y={cy} label />
      {ring68 && <Halo x={ring68.x} y={ring68.y} anchor={ring68.anchor} fill={FOREST}>two in three</Halo>}
      {ring95 && <Halo x={ring95.x} y={ring95.y} anchor={ring95.anchor} fill={FOREST}>nearly all</Halo>}
      {avgLabel && <Halo x={avgLabel.x} y={avgLabel.y} anchor={avgLabel.anchor} fill={INK}>average</Halo>}

      {points.length === 0 && empty && (
        <g>
          <rect x={LEFT + 8} y={cy + 22} width={AREA - 16} height={30} fill={PAPER} />
          <text x={cx} y={cy + 42} textAnchor="middle" fontFamily={SANS} fontSize={15} fill={DIM}>{empty}</text>
        </g>
      )}
      {hot && <Tooltip x={hot.x} y={hot.y} lines={shotWords(hot.p, props.axes[hot.p.id], unit)} bounds={bounds} />}
    </svg>
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

const TRIGHT = 12
// Height given to the shortened stretch between the tee and the break.
const SHORTENED_PX = 64

function bezier(S: FlightPoint, C: FlightPoint, E: FlightPoint, n = 28): FlightPoint[] {
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

// From the tee, still from above. The landing area is drawn at one true
// scale (across = along); the stretch from the tee to the break is shortened
// so a 250 yd drive doesn't shrink the landing area to a sliver. Each flight
// is the flight.ts curve, sampled and drawn through that scale.
export function TeePlot(props: ChartProps) {
  const { points, stats, unit, layers, axes, leftHanded } = props
  const [hover, setHover] = useState<string | null>(null)
  const narrow = useNarrow()
  const TW = narrow ? 350 : 440
  const TH = narrow ? 440 : 520
  const TLEFT = narrow ? 40 : 46
  const TEE_Y = TH - 40
  const dense = points.length > 40

  const geo = useMemo(() => {
    const aims = points.filter((p) => p.startDistanceOffsetYards != null).map((p) => -p.startDistanceOffsetYards!)
    const avgAim = aims.length ? aims.reduce((a, b) => a + b, 0) / aims.length : 0
    const S: FlightPoint = { x: 0, y: 0 }
    const shots = points.map((p) => {
      const aim = p.startDistanceOffsetYards != null ? -p.startDistanceOffsetYards : avgAim
      const E: FlightPoint = { x: p.lateralOffsetYards, y: aim + p.distanceOffsetYards }
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
    const scale = Math.min((TEE_Y - 16 - comp) / (maxY - brk), (TW - TLEFT - TRIGHT) / 2 / halfW)
    return { avgAim, avgEnd, shots, maxY, brk, comp, centre, scale }
  }, [points, stats, axes, leftHanded, TW, TLEFT, TEE_Y])

  if (!points.some((p) => p.startDistanceOffsetYards != null) || geo.avgAim < 5) {
    return (
      <div className="flex items-center justify-center text-caddie-ink-dim" style={{ aspectRatio: `${TW} / ${TH}`, fontSize: 13, padding: 24, textAlign: 'center' }}>
        These shots have no start point saved, so there is no line from the tee to draw.
      </div>
    )
  }

  const { avgAim, avgEnd, shots, maxY, brk, comp, centre, scale } = geo
  const midX = TLEFT + (TW - TLEFT - TRIGHT) / 2
  const x = (l: number) => midX + (l - centre) * scale
  const y = (d: number) => (d <= brk ? TEE_Y - (brk > 0 ? (d / brk) * comp : 0) : TEE_Y - comp - (d - brk) * scale)
  const line = (pts: FlightPoint[]) => pts.map((q, i) => `${i ? 'L' : 'M'} ${x(q.x).toFixed(1)} ${y(q.y).toFixed(1)}`).join(' ')
  // Above the break the flight is drawn to scale; below it only a faint stub
  // from the tee, since a shortened stretch can't keep the flight's angle.
  const split = (pts: FlightPoint[]) => {
    if (brk <= 0) return { upper: pts, cross: null as FlightPoint | null }
    const i = pts.findIndex((q) => q.y >= brk)
    if (i <= 0) return { upper: pts, cross: null }
    const a = pts[i - 1]!
    const b = pts[i]!
    const t = (brk - a.y) / (b.y - a.y)
    const cross = { x: a.x + (b.x - a.x) * t, y: brk }
    return { upper: [cross, ...pts.slice(i)], cross }
  }
  const teeX = x(0)
  const ruleStep = 5 * scale >= 14 ? 5 : 10 * scale >= 12 ? 10 : 25
  const labelStep = 10 * scale >= 26 ? 10 : 25 * scale >= 26 ? 25 : 50
  const rules: number[] = []
  for (let d = Math.ceil((brk + 1) / ruleStep) * ruleStep; d <= maxY; d += ruleStep) rules.push(d)
  const latStep = ruleStep === 25 ? 10 : ruleStep
  const lat: number[] = []
  for (let v = Math.ceil((centre - (midX - TLEFT) / scale) / latStep) * latStep; x(v) <= TW - TRIGHT; v += latStep) if (x(v) >= TLEFT) lat.push(v)
  const label = (yd: number) => String(Math.round(unit === 'meters' ? yd * YARDS_TO_METERS : yd))
  const bounds = { x: TLEFT + 2, y: 2, w: TW - TLEFT - TRIGHT - 4, h: TEE_Y - comp - 6 }
  const breakY = TEE_Y - comp

  const styled = shots.map((s) => ({ ...s, s: markStyle(s.p, props, dense), dx: x(s.E.x), dy: y(s.E.y) }))
  const shown = styled.filter((d) => !d.s.hide)
  const visibleDots = layers.shots ? shown.map((d) => ({ x: d.dx, y: d.dy })) : []
  const hot = hover ? styled.find((d) => d.p.id === hover) : null
  const lineOp = props.colourBy === 'none' ? (dense ? 0.2 : 0.42) : dense ? 0.42 : 0.8

  const taken: Box[] = [{ x: teeX - 2, y: y(avgAim) - 20, w: 40, h: 22 }]
  let ring68: ReturnType<typeof placeOnRing> | null = null
  let ring95: ReturnType<typeof placeOnRing> | null = null
  if (stats && avgEnd && layers.rings) {
    const ax = x(avgEnd.x)
    const ay = y(avgEnd.y)
    ring68 = placeOnRing(ax, ay, stats.cone68.lateral * scale, stats.cone68.distance * scale, 'two in three', 12, visibleDots, taken, bounds, [-25, 205, 25, 155, -60, -120])
    taken.push(ring68.box)
    ring95 = placeOnRing(ax, ay, stats.cone95.lateral * scale, stats.cone95.distance * scale, 'nearly all', 12, visibleDots, taken, bounds, [205, -25, 155, 25, -120, -60])
  }
  const barYd = 10 * scale >= 30 ? 10 : 25

  return (
    <svg viewBox={`0 0 ${TW} ${TH}`} width="100%" style={{ display: 'block' }} role="img" aria-label="Each shot from where it was hit to where it finished">
      {lat.map((v) => (
        <line key={`v${v}`} x1={x(v)} x2={x(v)} y1={y(maxY)} y2={breakY} stroke={v === 0 ? 'transparent' : v % 10 === 0 ? RULE : '#F2EDE2'} strokeWidth={1} />
      ))}
      {rules.map((d) => (
        <g key={d}>
          <line x1={TLEFT} x2={TW - TRIGHT} y1={y(d)} y2={y(d)} stroke={d % labelStep === 0 ? RULE_MAJOR : RULE} strokeWidth={1} />
          {d % labelStep === 0 && <text x={TLEFT - 6} y={y(d) + 4} textAnchor="end" fontFamily={SERIF} fontSize={13} fill={DIM}>{label(d)}</text>}
        </g>
      ))}
      <line x1={TLEFT} x2={TLEFT} y1={y(maxY)} y2={breakY - 5} stroke={LINE_STRONG} strokeWidth={1} />
      <line x1={TLEFT} x2={TLEFT} y1={breakY + 5} y2={TEE_Y} stroke={LINE_STRONG} strokeWidth={1} />
      <line x1={TLEFT} x2={TW - TRIGHT} y1={TEE_Y} y2={TEE_Y} stroke={LINE_STRONG} strokeWidth={1} />
      <line x1={teeX} x2={teeX} y1={y(maxY)} y2={TEE_Y} stroke={LINE_STRONG} strokeWidth={1} strokeDasharray="2 4" />
      {brk > 0 && (
        <g>
          {/* the axis break: everything above it is to scale */}
          <line x1={TLEFT} x2={TW - TRIGHT} y1={breakY} y2={breakY} stroke={LINE_STRONG} strokeWidth={1} strokeDasharray="1 3" />
          <path d={`M ${TLEFT - 5} ${breakY - 1} l 10 -6 M ${TLEFT - 5} ${breakY + 6} l 10 -6`} stroke={LINE_STRONG} strokeWidth={1.2} />
          <text x={TLEFT - 8} y={breakY + 4} textAnchor="end" fontFamily={SERIF} fontSize={13} fill={DIM}>{label(brk)}</text>
          <text x={TLEFT + 8} y={breakY + comp / 2 + 4} fontFamily={SANS} fontStyle="italic" fontSize={11} fill={MUTE}>shortened</text>
        </g>
      )}

      {stats && avgEnd && layers.rings && (
        <g style={{ pointerEvents: 'none' }}>
          <ellipse cx={x(avgEnd.x)} cy={y(avgEnd.y)} rx={stats.cone95.lateral * scale} ry={stats.cone95.distance * scale} fill="rgba(31,61,44,0.035)" stroke={FOREST} strokeOpacity={0.7} strokeWidth={1} strokeDasharray="4 3" />
          <ellipse cx={x(avgEnd.x)} cy={y(avgEnd.y)} rx={stats.cone68.lateral * scale} ry={stats.cone68.distance * scale} fill="rgba(31,61,44,0.07)" stroke={FOREST} strokeWidth={1.3} />
        </g>
      )}

      {layers.flights && (
        <g fill="none" style={{ pointerEvents: 'none' }}>
          {shown.map((d) => {
            const isHot = hover === d.p.id
            const op = isHot ? 1 : d.s.dimmed || hover ? 0.08 : d.recorded ? lineOp : lineOp * 0.8
            const { upper, cross } = split(d.path)
            const stroke = props.colourBy === 'none' ? (d.recorded ? INK : UNRECORDED_INK) : d.s.color
            return (
              <g key={d.p.id}>
                {cross && (
                  <line x1={teeX} y1={TEE_Y} x2={x(cross.x)} y2={y(cross.y)} stroke={stroke} strokeOpacity={Math.min(op, 0.22)} strokeWidth={1} strokeDasharray="1 3" />
                )}
                <path
                  d={line(upper)}
                  stroke={stroke}
                  strokeOpacity={op}
                  strokeWidth={isHot ? 2.4 : dense ? 1 : 1.4}
                  strokeDasharray={d.recorded ? undefined : '3 3'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            )
          })}
        </g>
      )}
      {stats && avgEnd && layers.average && (
        <path d={line(split(bezier({ x: 0, y: 0 }, { x: avgEnd.x / 2, y: avgEnd.y / 2 }, avgEnd, 12)).upper)} fill="none" stroke={INK} strokeWidth={1} strokeDasharray="3 3" style={{ pointerEvents: 'none' }} />
      )}

      {layers.shots &&
        shown.map((d) => (
          <Dot key={`d${d.p.id}`} x={d.dx} y={d.dy} s={d.s} hot={hover === d.p.id} onEnter={() => setHover(d.p.id)} onLeave={() => setHover(null)} />
        ))}
      {/* With the dots off, the flights' ends still answer the pointer. */}
      {!layers.shots &&
        layers.flights &&
        shown.map((d) => (
          <circle key={`h${d.p.id}`} cx={d.dx} cy={d.dy} r={9} fill="transparent" onPointerEnter={() => setHover(d.p.id)} onPointerLeave={() => setHover(null)} />
        ))}

      {stats && avgEnd && layers.average && (
        <circle cx={x(avgEnd.x)} cy={y(avgEnd.y)} r={5.5} fill={PAPER} stroke={FOREST} strokeWidth={1.8} style={{ pointerEvents: 'none' }} />
      )}
      <Pennant x={teeX} y={y(avgAim)} />
      {ring68 && <Halo x={ring68.x} y={ring68.y} anchor={ring68.anchor} fill={FOREST}>two in three</Halo>}
      {ring95 && <Halo x={ring95.x} y={ring95.y} anchor={ring95.anchor} fill={FOREST}>nearly all</Halo>}

      <circle cx={teeX} cy={TEE_Y} r={4.5} fill={PAPER} stroke={INK} strokeWidth={1.6} />
      <text x={teeX} y={TEE_Y + 20} textAnchor="middle" fontFamily={SANS} fontStyle="italic" fontSize={13} fill={DIM}>hit from here</text>
      <text x={TLEFT - 6} y={TEE_Y + 4} textAnchor="end" fontFamily={SANS} fontSize={12} fill={MUTE}>{unit === 'meters' ? 'm' : 'yd'}</text>
      {/* scale bar: across is drawn at the same scale as along */}
      <g>
        <line x1={TW - TRIGHT - barYd * scale} x2={TW - TRIGHT} y1={TEE_Y + 22} y2={TEE_Y + 22} stroke={DIM} strokeWidth={1.2} />
        <line x1={TW - TRIGHT - barYd * scale} x2={TW - TRIGHT - barYd * scale} y1={TEE_Y + 18} y2={TEE_Y + 26} stroke={DIM} strokeWidth={1.2} />
        <line x1={TW - TRIGHT} x2={TW - TRIGHT} y1={TEE_Y + 18} y2={TEE_Y + 26} stroke={DIM} strokeWidth={1.2} />
        <text x={TW - TRIGHT - (barYd * scale) / 2} y={TEE_Y + 16} textAnchor="middle" fontFamily={SERIF} fontSize={12} fill={DIM}>{label(barYd)} {unit === 'meters' ? 'm' : 'yd'}</text>
      </g>
      {hot && <Tooltip x={hot.dx} y={hot.dy} lines={shotWords(hot.p, axes[hot.p.id], unit)} bounds={bounds} />}
    </svg>
  )
}

function cap(s: string) {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s
}
