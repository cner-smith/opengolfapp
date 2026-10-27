import { useEffect, useMemo } from 'react'
import { Text, View } from 'react-native'
import { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg'
import { Easing, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated'
import {
  NOT_RECORDED,
  averageAimDistance,
  cubic,
  flightControls,
  ringExtent,
  shapeTally,
  shotWords,
  teeBreakYards,
  startLineTally,
  type DispersionPoint,
  type DispersionRing,
  type DispersionStats,
  type FlightPoint,
  type ShotShape,
  type ShotStartLine,
} from '@oga/core'
import { FONT, TYPE } from '../../lib/typography'
import { FONT_CAP, P } from '../paper/tokens'
import { UNRECORDED_INK } from './layers'
import { LEFT, RIGHT, RULE, RULE_MAJOR, DENSE, type ChartProps, type Box, rad, type RingPx, placeOnRing, placeNear, teeFinish, S0, flightOf, KIND_SEGMENTS, Fade, TweenRing, DRAW_MS, STAGGER_MS, STAGGER_CAP, FlightSeg, Selected, Halo, Pennant, markStyle, Mark, groupBy, ChartFrame } from './chartParts'

/* ---------------------------------------------------------- tee view */

/** Where the tee view's shortened stretch ends (core teeBreakYards), short of
 *  the nearest finish, the outer ring's near edge and the aim. */
export function teeBreakOf(points: DispersionPoint[], stats: DispersionStats | null, avgAim: number, unitYd: number) {
  const ys = points.map((p) => teeFinish(p, avgAim).y)
  if (stats) ys.push(avgAim + stats.ring95.cy - ringExtent(stats.ring95).y)
  return teeBreakYards([...ys, avgAim], unitYd)
}

const SHORTENED_PX = 56
const MAX_POWER = 3
const PROTRACTOR_DEG = [-4, 0, 4]

// From the tee, still from above. The landing area is at one true scale; the
// stretch from the tee to the break is shortened, so angles there are widened
// (the start line reads more easily). Every flight is sampled through the same
// transform, so it still leaves on its start line and lands on its finish.
export function TeePlot(props: ChartProps) {
  const { points, stats, ghost, layers, leftHanded, width, unitYd, label, unit, unitWord, hot, onHot } = props
  const reduce = useReducedMotion()
  const TH = Math.round(width * 0.95)
  const TEE_Y = TH - 34
  const TL = LEFT
  const TR = RIGHT
  const dense = points.length > DENSE
  const avgAim = averageAimDistance(points)

  const geo = useMemo(() => {
    if (avgAim == null || avgAim < 5) return null
    const shots = points.map((p) => {
      const f = flightOf(p, avgAim, leftHanded)
      return { p, ...f, path: cubic(S0, f.c.p1, f.c.p2, f.E) }
    })
    const avgEnd = stats ? { x: stats.avgLateralOffset, y: avgAim + stats.avgDistanceOffset } : null
    const ys = shots.map((s) => s.E.y)
    const xs = [0, ...shots.flatMap((s) => s.path.map((q) => q.x))]
    for (const s of [stats, ghost?.stats]) {
      if (!s) continue
      const e = ringExtent(s.ring95)
      ys.push(avgAim + s.ring95.cy - e.y, avgAim + s.ring95.cy + e.y)
      xs.push(s.ring95.cx - e.x, s.ring95.cx + e.x)
    }
    const maxY = Math.max(...ys, avgAim) + 4 * unitYd
    const brk = teeBreakOf(points, stats, avgAim, unitYd)
    const lo = Math.min(...xs)
    const hi = Math.max(...xs)
    const centre = (lo + hi) / 2
    const halfW = Math.max((hi - lo) / 2, 10) * 1.08
    // Same rule as web: the shortened band is tall enough that its curve's power
    // stays at or under MAX_POWER, or every flight would leave the tee sideways.
    const H = TEE_Y - 14
    const wide = (width - TL - TR) / 2 / halfW
    const steep = Math.min(H / (maxY - brk + brk / MAX_POWER), wide)
    const comp = brk > 0 ? Math.max(SHORTENED_PX, (steep * brk) / MAX_POWER) : 0
    const scale = Math.min((H - comp) / (maxY - brk), wide)
    return { avgEnd, shots, maxY, brk, comp, centre, scale }
  }, [points, stats, ghost, avgAim, leftHanded, width, unitYd, TEE_Y, TL, TR])

  // Draw the flights on from the tee once per club (the page remounts this
  // view on a club change); the finish dots land after them.
  const clock = useSharedValue(reduce ? 1e6 : 0)
  const total = DRAW_MS + Math.min(points.length * STAGGER_MS, STAGGER_CAP)
  useEffect(() => {
    if (!reduce) clock.value = withTiming(total, { duration: total, easing: Easing.linear })
  }, [reduce, total, clock])

  if (!geo || avgAim == null) {
    return (
      <View style={{ height: width * 0.6, alignItems: 'center', justifyContent: 'center', padding: 22 }}>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 13, color: P.inkDim, textAlign: 'center' }]}>
          These shots have no start point saved, so there is no line from the tee to draw.
        </Text>
      </View>
    )
  }

  const { avgEnd, shots, maxY, brk, comp, centre, scale } = geo
  const midX = TL + (width - TL - TR) / 2
  const x = (l: number) => midX + (l - centre) * scale
  // Below the break a power curve, Y = comp·(d/brk)^r with r = scale·brk/comp,
  // so its slope meets the true scale at the break and no flight kinks there.
  const bend = brk > 0 ? (scale * brk) / comp : 1
  const y = (d: number) => (d <= brk ? TEE_Y - (brk > 0 ? comp * (Math.max(d, 0) / brk) ** bend : 0) : TEE_Y - comp - (d - brk) * scale)
  const poly = (pts: FlightPoint[]) => pts.map((q, i) => `${i ? 'L' : 'M'} ${x(q.x).toFixed(1)} ${y(q.y).toFixed(1)}`).join(' ')
  const polyLen = (pts: FlightPoint[]) => {
    let s = 0
    for (let i = 1; i < pts.length; i++) s += Math.hypot(x(pts[i]!.x) - x(pts[i - 1]!.x), y(pts[i]!.y) - y(pts[i - 1]!.y))
    return s
  }
  const teeX = x(0)
  const breakY = TEE_Y - comp
  const u = unitYd
  const ruleStep = (5 * u * scale >= 14 ? 5 : 10 * u * scale >= 12 ? 10 : 25) * u
  const labelStep = (10 * u * scale >= 24 ? 10 : 25 * u * scale >= 24 ? 25 : 50) * u
  const isMult = (v: number, m: number) => Math.abs(v / m - Math.round(v / m)) < 1e-6
  const rules: number[] = []
  for (let d = Math.ceil((brk + 1) / ruleStep) * ruleStep; d <= maxY; d += ruleStep) rules.push(d)
  const bounds = { x: TL + 2, y: 2, w: width - TL - TR - 4, h: breakY - 6 }
  const ringPx = (r: DispersionRing): RingPx => ({ cx: x(r.cx), cy: y(avgAim + r.cy), rx: r.rx * scale, ry: r.ry * scale, rot: r.rotationDeg })

  const styled = shots.map((s) => ({ ...s, s: markStyle(s.p, props, dense), dx: x(s.E.x), dy: y(s.E.y) }))
  const shown = styled.filter((d) => !props.hidden.has(d.s.key))
  const dots = layers.shots ? shown.map((d) => ({ x: d.dx, y: d.dy })) : []
  const coloured = props.colourBy !== 'none'
  const lineOp = dense ? 0.12 : coloured ? 0.85 : 0.7
  const lineW = dense ? 1 : 1.4
  // Stagger shortest first, so the short ones land before the long ones fly.
  const order = new Map([...styled].sort((a, b) => a.E.y - b.E.y).map((d, i) => [d.p.id, Math.min(i * STAGGER_MS, STAGGER_CAP)]))
  const aimY = y(avgAim)
  const taken: Box[] = [{ x: teeX - 2, y: aimY - 20, w: 14, h: 22 }]
  const aimLabel = placeNear(teeX, aimY - 10, 'aim', 13, dots, taken, bounds)
  taken.push(aimLabel.box)
  let r68: ReturnType<typeof placeOnRing> | null = null
  let r95: ReturnType<typeof placeOnRing> | null = null
  if (stats && layers.rings) {
    r68 = placeOnRing(ringPx(stats.ring68), '68%', 12, dots, taken, bounds, [-25, 205, 25, 155, -60, -120])
    taken.push(r68.box)
    r95 = placeOnRing(ringPx(stats.ring95), '95%', 12, dots, taken, bounds, [205, -25, 155, 25, -120, -60])
    taken.push(r95.box)
  }
  const rGhost = ghost && layers.rings ? placeOnRing(ringPx(ghost.stats.ring68), ghost.label, 12, dots, taken, bounds, [-90, 0, 180, 90]) : null
  if (rGhost) taken.push(rGhost.box)

  // Over 40 shots the lines blur into a fan: one typical flight per visible
  // group (its mean finish, commonest start line, its shape) carries the read.
  const typical = !dense || !layers.flights
    ? []
    : groupBy(shown)
        .filter(([, items]) => items.length >= 3)
        .map(([key, items]) => {
          const ps = items.map((d) => d.p)
          const E = { x: ps.reduce((a, p) => a + p.lateralOffsetYards, 0) / ps.length, y: avgAim + ps.reduce((a, p) => a + p.distanceOffsetYards, 0) / ps.length }
          const sv = startLineTally(ps, leftHanded).verdict
          const hv = shapeTally(ps, leftHanded).verdict
          const start = props.colourBy === 'start' && key !== NOT_RECORDED ? (key as ShotStartLine) : sv && sv !== 'mixed' ? sv : null
          const shape = props.colourBy === 'shape' && key !== NOT_RECORDED ? (key as ShotShape) : hv && hv !== 'mixed' ? hv : null
          const c = flightControls(S0, E, start, shape, leftHanded)
          const cat = props.categories.get(key)
          const text = coloured ? (cat ? `typical ${cat.label.toLowerCase()}` : 'typical, not recorded') : 'typical flight'
          const at = placeNear(x(E.x), y(E.y), text, 12, dots, taken, bounds)
          taken.push(at.box)
          return { key, d: poly(cubic(S0, c.p1, c.p2, E)), color: coloured ? cat?.color ?? UNRECORDED_INK : P.ink, text, at }
        })
  const hotD = hot ? shown.find((d) => d.p.id === hot) : null
  const barU = 10 * u * scale >= 30 ? 10 : 25
  const barW = barU * u * scale
  const rayTo = brk > 0 ? brk : avgAim * 0.35

  return (
    <ChartFrame
      width={width}
      height={TH}
      summary={props.summary}
      pickable={layers.shots || layers.flights ? shown.map((d) => ({ id: d.p.id, x: d.dx, y: d.dy })) : []}
      hot={hot}
      onHot={onHot}
      readout={hotD ? shotWords(hotD.p, props.extras[hotD.p.id], unit, hotD.c.kind) : null}
      roundId={hotD ? props.extras[hotD.p.id]?.roundId ?? null : null}
      onOpenRound={props.onOpenRound}
      bounds={bounds}
    >
      {rules.map((d) => (
        <G key={d}>
          <Line x1={TL} x2={width - TR} y1={y(d)} y2={y(d)} stroke={isMult(d, labelStep) ? RULE_MAJOR : RULE} strokeWidth={1} />
          {isMult(d, labelStep) && <SvgText x={TL - 5} y={y(d) + 4} textAnchor="end" fontFamily={FONT.serif} fontSize={12} fill={P.inkDim}>{label(d)}</SvgText>}
        </G>
      ))}
      <Line x1={TL} x2={TL} y1={y(maxY)} y2={breakY - 5} stroke={P.lineStrong} strokeWidth={1} />
      <Line x1={TL} x2={TL} y1={breakY + 5} y2={TEE_Y} stroke={P.lineStrong} strokeWidth={1} />
      <Line x1={TL} x2={width - TR} y1={TEE_Y} y2={TEE_Y} stroke={P.lineStrong} strokeWidth={1} />
      {brk > 0 && (
        <G>
          <Line x1={TL} x2={width - TR} y1={breakY} y2={breakY} stroke={P.lineStrong} strokeWidth={1} strokeDasharray="1,3" />
          <Path d={`M ${TL - 5} ${breakY - 1} l 10 -6 M ${TL - 5} ${breakY + 6} l 10 -6`} stroke={P.lineStrong} strokeWidth={1.2} />
          <SvgText x={TL - 8} y={breakY + 4} textAnchor="end" fontFamily={FONT.serif} fontSize={12} fill={P.inkDim}>{label(brk)}</SvgText>
          <SvgText x={TL + 8} y={breakY + comp / 2 + 4} fontFamily={FONT.bodyItalic} fontSize={12} fill={P.inkDim}>shortened</SvgText>
        </G>
      )}
      {/* The pull / on line / push protractor from the tee, through the same
          shortened stretch as the flights, so a flight on line follows its ray. */}
      {PROTRACTOR_DEG.map((a) => (
        <Path key={a} d={poly(Array.from({ length: 49 }, (_, i) => ({ x: (Math.tan(rad(a)) * rayTo * i) / 48, y: (rayTo * i) / 48 })))} fill="none" stroke={P.lineStrong} strokeOpacity={0.55} strokeWidth={0.8} />
      ))}
      {/* The aim line, amber, from the tee to the pennant. */}
      <Line x1={teeX} x2={teeX} y1={aimY} y2={TEE_Y} stroke={P.warn} strokeOpacity={0.7} strokeWidth={1} strokeDasharray="1.5,3.5" />
      <Fade on={layers.rings}>
        {ghost && <TweenRing ring={ringPx(ghost.stats.ring68)} fill="none" stroke={P.inkDim} strokeOpacity={0.75} strokeWidth={1} dash="1,3" />}
        {stats && <TweenRing ring={ringPx(stats.ring95)} fill="rgba(31,61,44,0.035)" stroke={P.forest} strokeOpacity={0.7} strokeWidth={1} dash="4,3" />}
        {stats && <TweenRing ring={ringPx(stats.ring68)} fill="rgba(31,61,44,0.07)" stroke={P.forest} strokeWidth={1.3} />}
      </Fade>
      <Fade on={layers.flights}>
        <G opacity={hot ? 0.3 : 1}>
          {groupBy(styled).map(([key, items]) => (
            <Fade key={key} on={!props.hidden.has(key)} duration={150}>
              {items.map((d) => {
                const stroke = coloured ? d.s.color : d.c.kind === 'none' ? UNRECORDED_INK : d.s.color
                const old = d.s.glyph === 'pencil'
                return (
                  <G key={d.p.id}>
                    {KIND_SEGMENTS[d.c.kind].map((seg, i) => {
                      const a = Math.round(seg.from * (d.path.length - 1))
                      const b = Math.round(seg.to * (d.path.length - 1))
                      const pts = d.path.slice(a, b + 1)
                      return (
                        <FlightSeg
                          key={i}
                          d={poly(pts)}
                          len={polyLen(pts)}
                          style={seg.style}
                          from={seg.from}
                          to={seg.to}
                          delay={order.get(d.p.id) ?? 0}
                          clock={clock}
                          color={stroke}
                          opacity={lineOp * seg.op * (old ? 0.5 : 1)}
                          width={lineW}
                        />
                      )
                    })}
                  </G>
                )
              })}
            </Fade>
          ))}
        </G>
      </Fade>
      {typical.map((t) => (
        <Path key={`t${t.key}`} d={t.d} fill="none" stroke={t.color} strokeWidth={2.2} strokeLinecap="round" />
      ))}
      {hotD && layers.flights && <Path d={poly(hotD.path)} fill="none" stroke={coloured ? hotD.s.color : P.ink} strokeWidth={2.4} strokeLinecap="round" strokeDasharray={hotD.c.kind === 'none' ? '4,3' : undefined} />}
      {stats && avgEnd && (
        <Fade on={layers.average}>
          <Path d={poly(Array.from({ length: 49 }, (_, i) => ({ x: (avgEnd.x * i) / 48, y: (avgEnd.y * i) / 48 })))} fill="none" stroke={P.ink} strokeWidth={1} strokeDasharray="3,3" />
          <Circle cx={x(avgEnd.x)} cy={y(avgEnd.y)} r={5.5} fill={P.raised} stroke={P.forest} strokeWidth={1.8} />
        </Fade>
      )}
      <Fade on={layers.shots} enter delay={reduce ? 0 : DRAW_MS * 0.7} duration={200}>
        {groupBy(styled).map(([key, items]) => (
          <Fade key={key} on={!props.hidden.has(key)} duration={150}>
            {items.map((d) => (
              <Mark key={d.p.id} x={d.dx} y={d.dy} s={d.s} />
            ))}
          </Fade>
        ))}
      </Fade>
      <Pennant x={teeX} y={aimY} />
      <Halo x={aimLabel.x} y={aimLabel.y} anchor={aimLabel.anchor} size={13} fill={P.warn} text="aim" />
      {r68 && <Halo x={r68.x} y={r68.y} anchor={r68.anchor} fill={P.forest} text="68%" />}
      {r95 && <Halo x={r95.x} y={r95.y} anchor={r95.anchor} fill={P.forest} text="95%" />}
      {rGhost && ghost && <Halo x={rGhost.x} y={rGhost.y} anchor={rGhost.anchor} fill={P.inkDim} text={ghost.label} />}
      {typical.map((t) => (
        <Halo key={`l${t.key}`} x={t.at.x} y={t.at.y} anchor={t.at.anchor} fill={t.color} text={t.text} />
      ))}
      {hotD && <Selected key={hotD.p.id} x={hotD.dx} y={hotD.dy} r={hotD.s.r} />}
      <Circle cx={teeX} cy={TEE_Y} r={4.5} fill={P.raised} stroke={P.ink} strokeWidth={1.6} />
      <SvgText x={teeX} y={TEE_Y + 19} textAnchor="middle" fontFamily={FONT.bodyItalic} fontSize={12} fill={P.inkDim}>hit from here</SvgText>
      <SvgText x={TL - 5} y={TEE_Y + 4} textAnchor="end" fontFamily={FONT.body} fontSize={12} fill={P.inkDim}>{unitWord}</SvgText>
      <Line x1={width - TR - barW} x2={width - TR} y1={TEE_Y + 22} y2={TEE_Y + 22} stroke={P.inkDim} strokeWidth={1.2} />
      <Line x1={width - TR - barW} x2={width - TR - barW} y1={TEE_Y + 18} y2={TEE_Y + 26} stroke={P.inkDim} strokeWidth={1.2} />
      <Line x1={width - TR} x2={width - TR} y1={TEE_Y + 18} y2={TEE_Y + 26} stroke={P.inkDim} strokeWidth={1.2} />
      <SvgText x={width - TR - barW / 2} y={TEE_Y + 15} textAnchor="middle" fontFamily={FONT.serif} fontSize={12} fill={P.inkDim}>{`${barU} ${unitWord}`}</SvgText>
    </ChartFrame>
  )
}
