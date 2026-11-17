import { useMemo, useRef } from 'react'
import {
  NOT_RECORDED,
  YARDS_TO_METERS,
  averageAimDistance,
  cubic,
  distanceUnitAbbr as unitWord,
  flightControls,
  insideRing,
  shotWords,
  teeAxis,
  teeView,
  typicalFlight,
  typicalFlightFixed,
  type DispersionPoint,
  type DispersionRing,
  type FlightKind,
  type FlightPoint,
  type ShotShape,
  type ShotStartLine,
} from '@oga/core'
import {
  AMBER,
  AMBER_TEXT,
  AXIS,
  ChartLegend,
  DIM,
  Dot,
  FOREST,
  Halo,
  INK,
  LEGEND_H,
  OlderDots,
  PAPER,
  Pennant,
  RULE,
  RULE_MAJOR,
  Readout,
  RingMark,
  SANS,
  SERIF,
  byDistance,
  markStyle,
  placeNear,
  placeOnRing,
  useNarrow,
  useShotNav,
  useTween,
  type Box,
  type ChartProps,
  type Placed,
  type ScreenRing,
} from './chartParts'
import { UNRECORDED_INK } from '../layers'

// From the tee, still from above. Each flight leaves on its recorded start
// line, bends by its recorded shape and finishes on the ball (core
// flightControls). The landing area is drawn at one true scale (across =
// along); the stretch from the tee to a round-number break is shortened, so a
// 250 yd drive doesn't shrink the landing area to a sliver. Below the break
// distance runs on a power curve that meets the true scale at the break with
// the same slope, so no flight kinks there. The squeeze widens the start
// angles: the faint wedge shows how wide a straight push or pull would look.

export interface TeeShot {
  p: DispersionPoint
  E: FlightPoint
  kind: FlightKind
  path: FlightPoint[]
}

const S: FlightPoint = { x: 0, y: 0 }

export function flightPath(E: FlightPoint, startLine: ShotStartLine | null, shape: ShotShape | null, leftHanded: boolean) {
  const f = flightControls(S, E, startLine, shape, leftHanded)
  return { kind: f.kind, path: cubic(S, f.p1, f.p2, E) }
}

/** Every finish placed as if aimed at the average aim distance, so the dots,
 *  the rings (built from aim-relative offsets) and the one pennant agree. The
 *  older shots under Latest are placed by the same aim, which they don't move. */
export function teeGeometry(points: DispersionPoint[], leftHanded: boolean, older: DispersionPoint[] = []) {
  const aim = averageAimDistance(points)
  const avgAim = aim ?? 0
  const place = (p: DispersionPoint): TeeShot => {
    const E = { x: p.lateralOffsetYards, y: avgAim + p.distanceOffsetYards }
    return { p, E, ...flightPath(E, p.startLine ?? null, p.shape ?? null, leftHanded) }
  }
  return { avgAim, hasStart: aim != null, shots: points.map(place), olderShots: older.map(place) }
}

/** A straight line from the tee to (lat, d), sampled so it follows the curve. */
const wedgeEdge = (lat: number, d: number) => Array.from({ length: 49 }, (_, i) => ({ x: (lat * i) / 48, y: (d * i) / 48 }))

const TRIGHT = 12
const SHORTENED_PX = 64

export function TeePlot(props: ChartProps) {
  const { points, older, stats, ghost, unit, layers, extras, kinds, leftHanded, colourBy } = props
  const narrow = useNarrow()
  const svgRef = useRef<SVGSVGElement | null>(null)
  const TW = narrow ? 350 : 440
  const TH = narrow ? 440 : 520
  const TLEFT = narrow ? 40 : 46
  const TEE_Y = TH - 40
  const dense = points.length > 40
  const u = unit === 'meters' ? YARDS_TO_METERS : 1

  const geo = useMemo(() => {
    const { avgAim, hasStart, shots, olderShots } = teeGeometry(points, leftHanded, older)
    const view = teeView(
      { points: [...points, ...older], flights: shots.map((s) => s.path), stats, ghost: ghost?.stats ?? null, avgAim, yardsPerUnit: 1 / u },
      { left: TLEFT, right: TW - TRIGHT, top: 16, teeY: TEE_Y, minBandPx: SHORTENED_PX },
    )
    return { avgAim, hasStart, shots, olderShots, view }
  }, [points, older, stats, ghost, leftHanded, u, TW, TLEFT, TEE_Y])

  const { avgAim, shots, olderShots, view } = geo
  const { maxY, brk, comp, centre, scale, x, y } = view
  const midX = TLEFT + (TW - TLEFT - TRIGHT) / 2
  const line = (pts: FlightPoint[]) => pts.map((q, i) => `${i ? 'L' : 'M'} ${x(q.x).toFixed(1)} ${y(q.y).toFixed(1)}`).join(' ')

  const styled = shots.map((s) => ({ ...s, s: markStyle(s.p, props, dense), dx: x(s.E.x), dy: y(s.E.y) }))
  const visible = styled.filter((d) => !d.s.hide)
  const dots = layers.shots ? visible.map((d) => ({ x: d.dx, y: d.dy })) : []
  const order = useMemo(
    () => (layers.shots || layers.flights ? visible.map((d) => d.p).sort(byDistance).map((p) => p.id) : []),
    [visible, layers.shots, layers.flights],
  )
  const nav = useShotNav(svgRef, order, props.onOpenShot)

  const ringAt = (r: DispersionRing): ScreenRing => ({ cx: x(r.cx), cy: y(avgAim + r.cy), rx: r.rx * scale, ry: r.ry * scale, rot: -r.rotationDeg })
  const zero: ScreenRing = { cx: x(0), cy: y(avgAim), rx: 0, ry: 0, rot: 0 }
  const r68 = stats ? ringAt(stats.ring68) : zero
  const r95 = stats ? ringAt(stats.ring95) : zero
  const avg = stats ? { x: x(stats.avgLateralOffset), y: y(avgAim + stats.avgDistanceOffset) } : { x: zero.cx, y: zero.cy }
  const tw = useTween([r68.cx, r68.cy, r68.rx, r68.ry, r68.rot, r95.cx, r95.cy, r95.rx, r95.ry, r95.rot, avg.x, avg.y])
  const t68: ScreenRing = { cx: tw[0]!, cy: tw[1]!, rx: tw[2]!, ry: tw[3]!, rot: tw[4]! }
  const t95: ScreenRing = { cx: tw[5]!, cy: tw[6]!, rx: tw[7]!, ry: tw[8]!, rot: tw[9]! }
  const ghostRing = ghost ? ringAt(ghost.stats.ring68) : null

  if (!geo.hasStart || avgAim < 5) {
    return (
      <div className="flex items-center justify-center text-caddie-ink-dim" style={{ aspectRatio: `${TW} / ${TH}`, fontSize: 13, padding: 24, textAlign: 'center' }}>
        These shots have no start point saved, so there is no line from the tee to draw.
      </div>
    )
  }

  const teeX = x(0)
  const breakY = TEE_Y - comp
  const stepPx = (s: number) => (s / u) * scale
  const { ruleStep, barStep: barDisp, rules } = teeAxis(scale, brk, maxY, 1 / u)
  const latStep = ruleStep === 25 ? 10 : ruleStep
  const lat: number[] = []
  for (let v = Math.ceil(((centre - (midX - TLEFT) / scale) * u) / latStep) * latStep; x(v / u) <= TW - TRIGHT; v += latStep) if (x(v / u) >= TLEFT) lat.push(v)
  const bounds: Box = { x: TLEFT + 2, y: 2, w: TW - TLEFT - TRIGHT - 4, h: breakY - 6 }
  // The protractor: a straight push or pull from the tee, as drawn here.
  const { x: wedgeX, d: wedgeD } = view.wedge

  // Over 40 shots each flight is a faint hair and one typical flight per
  // visible group of 3 or more (core typicalFlight) carries the reading.
  const typical = dense && layers.flights ? typicalFlights(visible, avgAim, colourBy, props.hidden, props.colours, leftHanded) : []
  const lineOp = colourBy === 'none' ? 0.7 : 0.85
  const fade = (on: boolean) => ({ opacity: on ? 1 : 0, transition: 'opacity 180ms ease', pointerEvents: on ? undefined : ('none' as const) })

  const inside = stats ? points.filter((p) => insideRing(stats.ring68, p.lateralOffsetYards, p.distanceOffsetYards)).length : 0
  const taken: Box[] = [{ x: teeX - 2, y: y(avgAim) - 20, w: 16, h: 22 }]
  const aimLabel = placeNear(teeX + 3, y(avgAim) - 12, 'aim', 14, dots, taken, bounds, dense)
  taken.push(aimLabel.box)
  let lGhost: Placed | null = null
  if (ghostRing && layers.rings) {
    lGhost = placeOnRing(ghostRing, ghost!.label, 12, dots, taken, bounds, [-90, 0, 180, 90])
    taken.push(lGhost.box)
  }
  const typicalLabels = typical.map((t) => {
    const at = placeNear(x(t.E.x), y(t.E.y), t.label, 12, dots, taken, bounds)
    taken.push(at.box)
    return at
  })
  const olderAt = olderShots.map((s) => ({ ...s, dx: x(s.E.x), dy: y(s.E.y) }))
  const olderOn = layers.shots || layers.flights
  const hotOlder = nav.shown ? olderAt.find((d) => d.p.id === nav.shown) ?? null : null
  const hot = nav.shown ? styled.find((d) => d.p.id === nav.shown) ?? hotOlder : null
  const label = (disp: number) => String(Math.round(disp))

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${TW} ${TH + LEGEND_H}`}
      width="100%"
      className="pat-chart"
      style={{ display: 'block' }}
      role="group"
      aria-labelledby={props.labelId}
      aria-describedby={props.descId}
    >
      <g aria-hidden>
        {lat.map((v) => (
          <line key={`v${v}`} x1={x(v / u)} x2={x(v / u)} y1={y(maxY)} y2={breakY} stroke={v === 0 ? 'transparent' : v % 10 === 0 ? RULE : '#F2EDE2'} strokeWidth={1} />
        ))}
        {rules.map(({ d, label: major }) => (
          <g key={d}>
            <line x1={TLEFT} x2={TW - TRIGHT} y1={y(d / u)} y2={y(d / u)} stroke={major ? RULE_MAJOR : RULE} strokeWidth={1} />
            {major && <text x={TLEFT - 6} y={y(d / u) + 4} textAnchor="end" fontFamily={SERIF} fontSize={13} fill={DIM}>{label(d)}</text>}
          </g>
        ))}
        <line x1={TLEFT} x2={TLEFT} y1={y(maxY)} y2={brk > 0 ? breakY - 5 : TEE_Y} stroke={AXIS} strokeWidth={1} />
        {brk > 0 && <line x1={TLEFT} x2={TLEFT} y1={breakY + 5} y2={TEE_Y} stroke={AXIS} strokeWidth={1} />}
        <line x1={TLEFT} x2={TW - TRIGHT} y1={TEE_Y} y2={TEE_Y} stroke={AXIS} strokeWidth={1} />
        {brk > 0 && (
          <g>
            <line x1={TLEFT} x2={TW - TRIGHT} y1={breakY} y2={breakY} stroke={AXIS} strokeWidth={1} strokeDasharray="1 3" />
            <path d={`M ${TLEFT - 5} ${breakY - 1} l 10 -6 M ${TLEFT - 5} ${breakY + 6} l 10 -6`} stroke={AXIS} strokeWidth={1.2} />
            <text x={TLEFT - 8} y={breakY + 4} textAnchor="end" fontFamily={SERIF} fontSize={13} fill={DIM}>{label(brk * u)}</text>
            <text x={TLEFT + 8} y={breakY + comp / 2 + 4} fontFamily={SANS} fontStyle="italic" fontSize={12} fill={DIM}>shortened</text>
          </g>
        )}
        {/* The start-line wedge: a straight 4° pull or push, as drawn. */}
        <path
          d={`${line(wedgeEdge(-wedgeX, wedgeD))} ${line(wedgeEdge(wedgeX, wedgeD).reverse()).replace('M', 'L')} Z`}
          fill={INK}
          fillOpacity={0.045}
          stroke={DIM}
          strokeOpacity={0.45}
          strokeWidth={0.8}
        />
        <Halo at={{ x: teeX + 5, y: y(wedgeD) + 15 }} fill={DIM}>on line</Halo>
        {/* The aim line, tee to pennant. */}
        <line x1={teeX} y1={TEE_Y} x2={teeX} y2={y(avgAim)} stroke={AMBER} strokeWidth={1.2} strokeDasharray="2 3" />
      </g>

      <g aria-hidden style={fade(layers.rings)}>
        {ghostRing && <RingMark r={ghostRing} ghost />}
        {stats && (
          <>
            <RingMark r={t95} outer />
            <RingMark r={t68} />
          </>
        )}
      </g>

      <g aria-hidden fill="none" style={fade(layers.flights)} key={`f-${props.club}`}>
        {styled.map((d, i) => {
          const isHot = nav.shown === d.p.id
          const base = dense ? 0.12 : lineOp
          const op = d.s.hide ? 0 : isHot ? 1 : nav.shown || (d.s.dimmed && !dense) ? 0.08 : props.focus && !d.s.dimmed && dense ? 0.6 : base
          const stroke = colourBy === 'none' ? INK : d.s.color
          return (
            <Flight
              key={d.p.id}
              path={d.path}
              kind={d.kind}
              line={line}
              stroke={stroke}
              opacity={op}
              width={isHot ? 2.4 : dense ? 1 : 1.4}
              delay={Math.min(i * 12, 400)}
            />
          )
        })}
        {/* An older shot's flight shows only while it is chosen. */}
        {hotOlder && (
          <path d={line(hotOlder.path)} stroke={colourBy === 'none' ? INK : UNRECORDED_INK} strokeWidth={2.4} strokeLinecap="round" strokeDasharray={hotOlder.kind === 'none' ? '4 3' : undefined} />
        )}
        {typical.map((t) => (
          <path key={t.key} d={line(t.path)} stroke={t.color} strokeWidth={2.2} strokeLinecap="round" opacity={props.focus && props.focus !== t.key ? 0.2 : 1} />
        ))}
      </g>
      {stats && (
        <g aria-hidden style={fade(layers.average)}>
          <line x1={teeX} y1={TEE_Y} x2={tw[10]} y2={tw[11]} stroke={dense ? FOREST : INK} strokeWidth={dense ? 1.4 : 1} strokeDasharray="3 3" />
        </g>
      )}

      <OlderDots
        dots={olderAt.map((d) => ({ id: d.p.id, x: d.dx, y: d.dy }))}
        shown={nav.shown}
        nav={olderOn ? nav.dotProps : null}
        label={(id) => {
          const d = olderAt.find((o) => o.p.id === id)!
          return shotWords(d.p, extras[id], unit, d.kind).join('. ')
        }}
      />
      <g style={fade(layers.shots || layers.flights)}>
        {styled.map((d, i) => (
          <g key={d.p.id} style={{ opacity: layers.shots ? 1 : 0 }}>
            <Dot
              x={d.dx}
              y={d.dy}
              s={d.s}
              hot={nav.shown === d.p.id}
              dense={dense}
              nav={nav.dotProps(d.p.id)}
              label={shotWords(d.p, extras[d.p.id], unit, kinds.get(d.p.id)).join('. ')}
              delay={560 + Math.min(i * 12, 400)}
            />
          </g>
        ))}
      </g>

      {stats && (
        <g aria-hidden style={fade(layers.average)}>
          <circle cx={tw[10]} cy={tw[11]} r={5.5} fill={PAPER} stroke={FOREST} strokeWidth={1.8} />
        </g>
      )}
      <g aria-hidden>
        <Pennant x={teeX} y={y(avgAim)} />
        <Halo at={aimLabel} size={14} fill={AMBER_TEXT}>aim</Halo>
        {lGhost && <Halo at={lGhost} fill={DIM}>{ghost!.label}</Halo>}
        {typical.map((t, i) => (
          <Halo key={t.key} at={typicalLabels[i]!} fill={t.color === INK ? INK : t.color}>{t.label}</Halo>
        ))}
        <circle cx={teeX} cy={TEE_Y} r={4.5} fill={PAPER} stroke={INK} strokeWidth={1.6} />
        <text x={teeX} y={TEE_Y + 20} textAnchor="middle" fontFamily={SANS} fontStyle="italic" fontSize={13} fill={DIM}>hit from here</text>
        <text x={TLEFT - 6} y={TEE_Y + 4} textAnchor="end" fontFamily={SANS} fontSize={12} fill={DIM}>{unitWord(unit)}</text>
        {/* Scale bar: across is drawn at the same scale as along. */}
        <line x1={TW - TRIGHT - stepPx(barDisp)} x2={TW - TRIGHT} y1={TEE_Y + 22} y2={TEE_Y + 22} stroke={DIM} strokeWidth={1.2} />
        <line x1={TW - TRIGHT - stepPx(barDisp)} x2={TW - TRIGHT - stepPx(barDisp)} y1={TEE_Y + 18} y2={TEE_Y + 26} stroke={DIM} strokeWidth={1.2} />
        <line x1={TW - TRIGHT} x2={TW - TRIGHT} y1={TEE_Y + 18} y2={TEE_Y + 26} stroke={DIM} strokeWidth={1.2} />
        <text x={TW - TRIGHT - stepPx(barDisp) / 2} y={TEE_Y + 16} textAnchor="middle" fontFamily={SERIF} fontSize={12} fill={DIM}>{barDisp} {unitWord(unit)}</text>
        <ChartLegend x={TLEFT} y={TH} ring68={stats && layers.rings ? `68% of shots (${inside} of ${points.length})` : null} />
      </g>
      {hot && (
        <Readout
          x={hot.dx}
          y={hot.dy}
          lines={shotWords(hot.p, extras[hot.p.id], unit, hot.kind)}
          warn={hot.kind === 'conflict'}
          bounds={bounds}
          dots={dots}
          link={nav.link}
        />
      )}
    </svg>
  )
}

// A flight drawn by what was recorded (research §3): both tags and they fit =
// solid; they don't add up = dashed second half; start line only = solid first
// third, the bend fainter; shape only = dotted first third; neither = a dashed
// chord. Solid stretches draw on once per club; the rest fade in.
function Flight({ path, kind, line, stroke, opacity, width, delay }: {
  path: FlightPoint[]
  kind: FlightKind
  line: (pts: FlightPoint[]) => string
  stroke: string
  opacity: number
  width: number
  delay: number
}) {
  const at = (f: number) => Math.round((path.length - 1) * f)
  const seg = (from: number, to: number) => path.slice(at(from), at(to) + 1)
  const common = { stroke, strokeWidth: width, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const drawn = (d: string, op: number) => (
    <path d={d} {...common} strokeOpacity={op} pathLength={1} className="pat-draw" style={{ animationDelay: `${delay}ms` }} />
  )
  const late = (d: string, op: number, dash: string) => (
    <path d={d} {...common} strokeOpacity={op} strokeDasharray={dash} className="pat-fade" style={{ animationDelay: `${delay + 250}ms` }} />
  )
  const g = (children: React.ReactNode) => <g style={{ opacity: opacity === 0 ? 0 : 1, transition: 'opacity 150ms ease' }}>{children}</g>
  if (kind === 'agree') return g(drawn(line(path), opacity))
  if (kind === 'conflict') return g(<>{drawn(line(seg(0, 0.5)), opacity)}{late(line(seg(0.5, 1)), opacity, '4 3')}</>)
  if (kind === 'start-only') return g(<>{drawn(line(seg(0, 1 / 3)), opacity)}{drawn(line(seg(1 / 3, 1)), opacity * 0.7)}</>)
  if (kind === 'shape-only') return g(<>{late(line(seg(0, 1 / 3)), opacity, '1 3')}{drawn(line(seg(1 / 3, 1)), opacity)}</>)
  return g(late(line(path), opacity * 0.85, '3 3'))
}

interface Typical {
  key: string
  label: string
  color: string
  E: FlightPoint
  path: FlightPoint[]
}

function typicalFlights(
  visible: (TeeShot & { s: ReturnType<typeof markStyle> })[],
  avgAim: number,
  colourBy: ChartProps['colourBy'],
  hidden: Set<string>,
  colours: ChartProps['colours'],
  leftHanded: boolean,
): Typical[] {
  const groups = new Map<string, TeeShot[]>()
  for (const d of visible) {
    const k = colourBy === 'none' ? 'all' : d.s.k
    if (hidden.has(k)) continue
    groups.set(k, [...(groups.get(k) ?? []), d])
  }
  const out: Typical[] = []
  for (const [k, members] of groups) {
    const t = typicalFlight(members.map((m) => m.p), avgAim, leftHanded, typicalFlightFixed(colourBy, k))
    if (!t) continue
    const unrecorded = colourBy !== 'none' && k === NOT_RECORDED
    const word = colourBy === 'none' ? 'typical flight' : unrecorded ? 'typical, not recorded' : `typical ${labelOf(k)}`
    const color = colourBy === 'none' ? INK : unrecorded ? UNRECORDED_INK : colours.get(k)?.color ?? INK
    out.push({ key: k, label: word, color, E: t.end, path: flightPath(t.end, t.startLine, t.shape, leftHanded).path })
  }
  return out
}

const labelOf = (k: string) => k.replace('_', ' ')
