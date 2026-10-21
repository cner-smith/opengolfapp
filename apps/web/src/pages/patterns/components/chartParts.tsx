import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import type { DispersionPoint, DispersionRing, DispersionStats, DistanceUnit, FlightKind } from '@oga/core'
import type { ShotExtras } from '../../../hooks/useShotPatterns'
import { NOT_RECORDED, UNRECORDED_INK, categoryOf, type ColourBy, type Glyph, type Layer } from '../layers'

// What the two chart views (AimPlot, TeePlot) share: the marks, the label
// placers, the readout, the keyboard walk through the shots and the tweens.

export const SERIF = 'Fraunces, Georgia, serif'
export const SANS = 'Epilogue, sans-serif'
export const PAPER = '#FBF8F1'
export const INK = '#1C211C'
export const DIM = '#5C6356'
export const MUTE = '#8A8B7E'
export const AXIS = '#7A705C'
export const RULE = '#ECE6D8'
export const RULE_MAJOR = '#DCD5C3'
export const FOREST = '#1F3D2C'
export const AMBER = '#A66A1F'
export const AMBER_TEXT = '#8F5714'

/** A second pattern drawn faintly behind this one: all lies under a filter,
 *  or all shots behind the recent ones. */
export interface Ghost {
  stats: DispersionStats
  label: string
}

export interface ChartProps {
  /** The shots the pattern is built from. */
  points: DispersionPoint[]
  stats: DispersionStats | null
  /** Older shots drawn in pencil behind a recent pattern. */
  older: DispersionPoint[]
  ghost: Ghost | null
  unit: DistanceUnit
  extras: Record<string, ShotExtras>
  kinds: Map<string, FlightKind>
  layers: Record<Layer, boolean>
  colourBy: ColourBy
  colours: Map<string, { color: string; glyph: Glyph }>
  hidden: Set<string>
  /** A legend entry under the pointer: the other groups step back. */
  focus: string | null
  leftHanded: boolean
  /** Changes when the club does: the draw-on runs once per club. */
  club: string
  labelId: string
  descId: string
  empty?: string
  /** Opens the shot's round (Enter on a shot, or the readout's link). */
  onOpenShot?: (id: string) => void
}

export interface Box {
  x: number
  y: number
  w: number
  h: number
}
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
const textW = (s: string, px: number) => s.length * px * 0.52
const outside = (b: Box, bounds: Box) =>
  b.x < bounds.x || b.y < bounds.y || b.x + b.w > bounds.x + bounds.w || b.y + b.h > bounds.y + bounds.h

export function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

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

/** Glide numbers to their new values (320 ms, ease-out), e.g. the rings when
 *  the club changes. Snaps under reduced motion. */
export function useTween(target: number[], ms = 320) {
  const [v, setV] = useState(target)
  const cur = useRef(target)
  const key = target.map((n) => n.toFixed(2)).join(',')
  useEffect(() => {
    if (reducedMotion() || cur.current.length !== target.length) {
      cur.current = target
      setV(target)
      return
    }
    const from = cur.current
    const t0 = performance.now()
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms)
      const e = 1 - Math.pow(1 - k, 4)
      const next = target.map((b, i) => from[i]! + (b - from[i]!) * e)
      cur.current = next
      setV(next)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is the target's value
  }, [key, ms])
  return v
}

/** A ring in screen units: centre, semi-axes and the SVG rotation (clockwise). */
export interface ScreenRing {
  cx: number
  cy: number
  rx: number
  ry: number
  rot: number
}

export function screenRing(r: DispersionRing, px: (lat: number) => number, py: (d: number) => number, scale: number): ScreenRing {
  return { cx: px(r.cx), cy: py(r.cy), rx: r.rx * scale, ry: r.ry * scale, rot: -r.rotationDeg }
}

/** Is a point (aim frame, yards) inside a ring? */
export function insideRing(r: DispersionRing, lat: number, along: number) {
  const t = (r.rotationDeg * Math.PI) / 180
  const dx = lat - r.cx
  const dy = along - r.cy
  const u = dx * Math.cos(t) + dy * Math.sin(t)
  const v = -dx * Math.sin(t) + dy * Math.cos(t)
  return (u / r.rx) ** 2 + (v / r.ry) ** 2 <= 1
}

export function RingMark({ r, outer, ghost }: { r: ScreenRing; outer?: boolean; ghost?: boolean }) {
  return (
    <ellipse
      cx={r.cx}
      cy={r.cy}
      rx={Math.max(0, r.rx)}
      ry={Math.max(0, r.ry)}
      transform={`rotate(${r.rot} ${r.cx} ${r.cy})`}
      fill={ghost ? 'none' : outer ? 'rgba(31,61,44,0.035)' : 'rgba(31,61,44,0.07)'}
      stroke={ghost ? DIM : FOREST}
      strokeOpacity={ghost ? 0.75 : outer ? 0.7 : 1}
      strokeWidth={ghost ? 1 : outer ? 1 : 1.3}
      strokeDasharray={ghost ? '1 3' : outer ? '4 3' : undefined}
      strokeLinecap="round"
    />
  )
}

type Anchor = 'start' | 'middle' | 'end'
export interface Placed {
  x: number
  y: number
  anchor: Anchor
  box: Box
}

// Put a label on a (turned) ellipse's edge at the candidate angle that covers
// the fewest shots and no other label; earlier angles win ties.
export function placeOnRing(r: ScreenRing, text: string, px: number, dots: { x: number; y: number }[], taken: Box[], bounds: Box, angles: number[]): Placed {
  let best: (Placed & { score: number }) | null = null
  const t = (-r.rot * Math.PI) / 180
  for (const [i, deg] of angles.entries()) {
    const a = (deg * Math.PI) / 180
    const lx = r.rx * Math.cos(a)
    const ly = r.ry * Math.sin(a)
    const wx = lx * Math.cos(t) - ly * Math.sin(t)
    const wy = lx * Math.sin(t) + ly * Math.cos(t)
    const len = Math.hypot(wx, wy) || 1
    const ex = r.cx + wx
    const ey = r.cy - wy
    const anchor: Anchor = wx / len > 0.35 ? 'start' : wx / len < -0.35 ? 'end' : 'middle'
    const x = ex + (anchor === 'start' ? 5 : anchor === 'end' ? -5 : 0)
    const y = wy >= 0 ? ey - 5 : ey + px + 3
    const w = textW(text, px)
    const box = { x: anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2, y: y - px, w, h: px + 3 }
    const pad = { x: box.x - 3, y: box.y - 3, w: box.w + 6, h: box.h + 6 }
    let score = i * 0.6
    for (const d of dots) if (d.x > pad.x && d.x < pad.x + pad.w && d.y > pad.y && d.y < pad.y + pad.h) score += 10
    for (const tk of taken) if (overlaps(pad, tk)) score += 100
    if (outside(box, bounds)) score += 1000
    if (!best || score < best.score) best = { x, y, anchor, box, score }
  }
  return best!
}

// A point's label: right, left, below, above, then the diagonals; the first
// spot that covers no shot and no other label wins.
export function placeNear(x: number, y: number, text: string, px: number, dots: { x: number; y: number }[], taken: Box[], bounds: Box, preferLeft = false): Placed {
  const w = textW(text, px)
  const spots: { x: number; y: number; anchor: Anchor }[] = [
    { x: x + 9, y: y + px / 2 - 1, anchor: 'start' },
    { x: x - 9, y: y + px / 2 - 1, anchor: 'end' },
    { x, y: y + px + 8, anchor: 'middle' },
    { x, y: y - 9, anchor: 'middle' },
    { x: x + 7, y: y + px + 5, anchor: 'start' },
    { x: x - 7, y: y + px + 5, anchor: 'end' },
    { x: x + 7, y: y - 7, anchor: 'start' },
    { x: x - 7, y: y - 7, anchor: 'end' },
  ]
  if (preferLeft) spots.unshift(spots.splice(1, 1)[0]!)
  let best: (Placed & { score: number }) | null = null
  for (const [i, sp] of spots.entries()) {
    const bx = sp.anchor === 'start' ? sp.x : sp.anchor === 'end' ? sp.x - w : sp.x - w / 2
    const box = { x: bx, y: sp.y - px, w, h: px + 3 }
    const pad = { x: bx - 3, y: sp.y - px - 2, w: w + 6, h: px + 6 }
    let score = i * 0.6
    for (const d of dots) if (d.x > pad.x - 3 && d.x < pad.x + pad.w + 3 && d.y > pad.y - 3 && d.y < pad.y + pad.h + 3) score += 10
    for (const t of taken) if (overlaps(pad, t)) score += 100
    if (outside(pad, bounds)) score += 1000
    if (!best || score < best.score) best = { ...sp, box, score }
  }
  return best!
}

export function Halo({ at, children, size = 12, fill = DIM, italic = true, family = SERIF }: {
  at: { x: number; y: number; anchor?: Anchor }
  children: string
  size?: number
  fill?: string
  italic?: boolean
  family?: string
}) {
  return (
    <text
      x={at.x}
      y={at.y}
      textAnchor={at.anchor ?? 'start'}
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

export function Pennant({ x, y }: { x: number; y: number }) {
  return (
    <g style={{ pointerEvents: 'none' }}>
      <line x1={x} y1={y} x2={x} y2={y - 16} stroke={AMBER} strokeWidth={1.4} strokeLinecap="round" />
      <path d={`M ${x} ${y - 16} L ${x + 10} ${y - 12.5} L ${x} ${y - 9} Z`} fill={AMBER} stroke={PAPER} strokeWidth={0.8} paintOrder="stroke" />
      <circle cx={x} cy={y} r={2.2} fill={AMBER} />
    </g>
  )
}

/** One glyph: the shot's mark on the chart and its swatch in the legend. */
export function Marker({ x, y, r, glyph, color, dense }: { x: number; y: number; r: number; glyph: Glyph; color: string; dense?: boolean }) {
  const solid = { fill: color, fillOpacity: dense ? 0.6 : 0.92, stroke: dense ? 'none' : PAPER, strokeWidth: 1.2, paintOrder: 'stroke' as const }
  const open = { fill: PAPER, stroke: color, strokeWidth: 1.6 }
  const tri = (dir: 1 | -1, s: number) =>
    `M ${x + dir * s * 1.3} ${y} L ${x - dir * s * 0.95} ${y - s * 1.2} L ${x - dir * s * 0.95} ${y + s * 1.2} Z`
  switch (glyph) {
    case 'left':
      return <path d={tri(-1, r)} {...solid} />
    case 'right':
      return <path d={tri(1, r)} {...solid} />
    case 'left-open':
      return <path d={tri(-1, r * 0.95)} {...open} strokeLinejoin="round" />
    case 'right-open':
      return <path d={tri(1, r * 0.95)} {...open} strokeLinejoin="round" />
    case 'tick-below':
    case 'tick-above': {
      const ty = glyph === 'tick-below' ? y + r + 2.4 : y - r - 2.4
      return (
        <g>
          <circle cx={x} cy={y} r={r * 0.9} {...solid} />
          <line x1={x - r - 1} x2={x + r + 1} y1={ty} y2={ty} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
        </g>
      )
    }
    case 'cross': {
      const s = r * 1.05
      return (
        <path d={`M ${x - s} ${y - s} L ${x + s} ${y + s} M ${x - s} ${y + s} L ${x + s} ${y - s}`} stroke={color} strokeWidth={2} strokeLinecap="round" />
      )
    }
    case 'square':
      return <rect x={x - r * 0.9} y={y - r * 0.9} width={r * 1.8} height={r * 1.8} {...solid} />
    case 'unrecorded':
      return <circle cx={x} cy={y} r={Math.max(1.6, r - 0.4)} fill={PAPER} stroke={UNRECORDED_INK} strokeWidth={1.3} strokeDasharray={dense ? undefined : '1.6 1.4'} />
    default:
      return <circle cx={x} cy={y} r={r} {...solid} />
  }
}

/** One shot's look under the current colour and focus. */
export function markStyle(p: DispersionPoint, props: ChartProps, dense: boolean) {
  const coloured = props.colourBy !== 'none'
  const k = categoryOf(p, props.extras[p.id], props.colourBy)
  const style = !coloured
    ? { color: INK, glyph: 'dot' as Glyph }
    : k === NOT_RECORDED
      ? { color: UNRECORDED_INK, glyph: 'unrecorded' as Glyph }
      : props.colours.get(k) ?? { color: INK, glyph: 'dot' as Glyph }
  return { k, ...style, hide: props.hidden.has(k), dimmed: props.focus != null && !props.hidden.has(props.focus) && props.focus !== k, r: dense ? 2.4 : 4 }
}

/** A shot on the chart: focusable, with its readout as its name. */
export function Dot({ x, y, s, hot, dense, nav, label, delay }: {
  x: number
  y: number
  s: ReturnType<typeof markStyle>
  hot: boolean
  dense: boolean
  nav: ReturnType<ReturnType<typeof useShotNav>['dotProps']>
  label: string
  delay: number
}) {
  return (
    <g
      {...nav}
      role="button"
      aria-label={label}
      aria-hidden={s.hide || undefined}
      className="pat-dot"
      style={{ opacity: s.hide ? 0 : s.dimmed ? 0.14 : 1, pointerEvents: s.hide ? 'none' : undefined }}
    >
      <circle cx={x} cy={y} r={10} fill="transparent" />
      <g className="pat-pop" style={{ animationDelay: `${delay}ms`, pointerEvents: 'none' }}>
        <Marker x={x} y={y} r={hot ? s.r + 1 : s.r} glyph={s.glyph} color={s.color} dense={dense} />
      </g>
      {hot && <circle cx={x} cy={y} r={s.r + 4} fill="none" stroke={INK} strokeWidth={1.5} style={{ pointerEvents: 'none' }} />}
    </g>
  )
}

/** Older shots behind a recent pattern: pencil, not part of the reading. */
export function OlderDots({ dots }: { dots: { x: number; y: number }[] }) {
  return (
    <g aria-hidden style={{ pointerEvents: 'none' }}>
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={2.2} fill={MUTE} fillOpacity={0.45} />
      ))}
    </g>
  )
}

/**
 * The shots as one tab stop: arrows step through them in distance order
 * (short to long), Home / End jump, Escape lets go, Enter opens the shot's
 * round. The readout follows focus, a mouse hover, or a tap, and stays until
 * Escape or focus leaves the shots and the readout.
 */
export function useShotNav(svgRef: RefObject<SVGSVGElement | null>, order: string[], open?: (id: string) => void) {
  const [hover, setHover] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const tabStop = selected && order.includes(selected) ? selected : order[0]
  const focusId = (id: string) => svgRef.current?.querySelector<SVGGElement>(`[data-shot="${id}"]`)?.focus()
  const onKeyDown = (e: KeyboardEvent<SVGGElement>, id: string) => {
    const i = order.indexOf(id)
    const n = order.length
    const j =
      e.key === 'ArrowRight' || e.key === 'ArrowUp'
        ? Math.min(n - 1, i + 1)
        : e.key === 'ArrowLeft' || e.key === 'ArrowDown'
          ? Math.max(0, i - 1)
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? n - 1
              : -1
    if (j >= 0) {
      e.preventDefault()
      focusId(order[j]!)
    } else if (e.key === 'Escape') {
      setSelected(null)
      e.currentTarget.blur()
    } else if (e.key === 'Enter' && open) {
      e.preventDefault()
      open(id)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setSelected(id)
    }
  }
  const keepOn = (e: React.FocusEvent) => {
    if (!(e.relatedTarget as Element | null)?.closest?.('[data-shot], [data-readout]')) setSelected(null)
  }
  const dotProps = (id: string) => ({
    'data-shot': id,
    tabIndex: id === tabStop ? 0 : -1,
    onFocus: () => setSelected(id),
    onBlur: keepOn,
    onKeyDown: (e: KeyboardEvent<SVGGElement>) => onKeyDown(e, id),
    onPointerEnter: (e: React.PointerEvent) => e.pointerType === 'mouse' && setHover(id),
    onPointerLeave: () => setHover(null),
    onClick: () => setSelected(id),
  })
  const shown = hover ?? selected
  // The readout's "Open round" link, while the shown shot is the chosen one.
  const link = open && shown && shown === selected
    ? { onOpen: () => open(shown), onBlur: keepOn }
    : undefined
  return { shown, dotProps, link }
}

/** The shot readout, set where it covers the fewest other shots. */
export function Readout({ x, y, lines, bounds, dots, warn, link }: {
  x: number
  y: number
  lines: string[]
  bounds: Box
  dots: { x: number; y: number }[]
  warn?: boolean
  link?: { onOpen: () => void; onBlur: (e: React.FocusEvent) => void }
}) {
  const w = Math.max(...lines.map((l, i) => l.length * (i === 0 ? 13 : 12) * 0.47)) + 22
  const h = 12 + (lines.length + (link ? 1 : 0)) * 17 + (link ? 4 : 0)
  const spots = [
    { x: x + 12, y: y - h - 10 },
    { x: x - 12 - w, y: y - h - 10 },
    { x: x + 12, y: y + 12 },
    { x: x - 12 - w, y: y + 12 },
  ]
  let best = { ...spots[0]!, score: Infinity }
  for (const [i, sp] of spots.entries()) {
    const b = { x: sp.x, y: sp.y, w, h }
    let score = i * 0.5
    for (const d of dots) if (d.x > b.x && d.x < b.x + w && d.y > b.y && d.y < b.y + h) score += 10
    if (outside(b, bounds)) score += 1000
    if (score < best.score) best = { ...sp, score }
  }
  const bx = Math.min(Math.max(best.x, bounds.x), bounds.x + bounds.w - w)
  const by = Math.min(Math.max(best.y, bounds.y), bounds.y + bounds.h - h)
  return (
    <g className="pat-fade" style={{ pointerEvents: 'none' }}>
      <g aria-hidden>
      <rect x={bx} y={by} width={w} height={h} rx={2} fill={PAPER} stroke={AXIS} />
      {lines.map((l, i) => (
        <text
          key={i}
          x={bx + 10}
          y={by + 20 + i * 17}
          fontFamily={i === 0 ? SERIF : SANS}
          fontSize={i === 0 ? 13 : 12}
          fill={i === 0 ? INK : warn && i === 2 ? '#A33A2A' : DIM}
        >
          {l}
        </text>
      ))}
      </g>
      {link && (
        <g
          data-readout
          role="link"
          tabIndex={0}
          aria-label="Open round"
          className="pat-link"
          style={{ pointerEvents: 'auto', cursor: 'pointer' }}
          onClick={link.onOpen}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              link.onOpen()
            }
          }}
          onBlur={link.onBlur}
        >
          <rect x={bx + 4} y={by + 8 + lines.length * 17} width={90} height={22} fill="transparent" />
          <text x={bx + 10} y={by + 24 + lines.length * 17} fontFamily={SANS} fontSize={12} fill={INK} textDecoration="underline">
            Open round
          </text>
        </g>
      )}
    </g>
  )
}

/** Order shots short to long for the keyboard walk. */
export const byDistance = (a: DispersionPoint, b: DispersionPoint) => a.distanceOffsetYards - b.distanceOffsetYards
