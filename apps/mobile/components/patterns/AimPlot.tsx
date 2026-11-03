import { G, Line, Rect, Text as SvgText } from 'react-native-svg'
import { insideRing, ringExtent, shotWords, type DispersionRing, type DispersionStats } from '@oga/core'
import { FONT } from '../../lib/typography'
import { P } from '../paper/tokens'
import { LEFT, RIGHT, RULE, RULE_MAJOR, DENSE, type ChartProps, type Box, type RingPx, placeOnRing, placeNear, Fade, TweenRing, TweenAverage, Selected, Halo, Pennant, markStyle, Mark, groupBy, ChartFrame, ChartLegend, legendHeight } from './chartParts'

/* ---------------------------------------------------------- aim view */

const BOTTOM = 30
const TOP = 10

export function AimPlot(props: ChartProps) {
  const { points, stats, ghost, layers, width, unitYd, label, unit, empty, hot, onHot } = props
  const area = width - LEFT - RIGHT
  const h = TOP + area + BOTTOM + legendHeight(width)
  const dense = points.length > DENSE
  const step = 5 * unitYd
  // The scale holds both rings (and the ghost) whether or not they are drawn,
  // so a toggle never rescales the chart.
  const reachOf = (s: DispersionStats) => {
    const e = ringExtent(s.ring95)
    return [Math.abs(s.ring95.cx) + e.x, Math.abs(s.ring95.cy) + e.y]
  }
  const reach = Math.max(
    ...points.map((p) => Math.max(Math.abs(p.lateralOffsetYards), Math.abs(p.distanceOffsetYards))),
    ...(stats ? reachOf(stats) : []),
    ...(ghost ? reachOf(ghost.stats) : []),
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
  const ringPx = (r: DispersionRing): RingPx => ({ cx: px(r.cx), cy: py(r.cy), rx: r.rx * scale, ry: r.ry * scale, rot: r.rotationDeg })

  const styled = points.map((p) => ({ p, s: markStyle(p, props, dense), x: px(p.lateralOffsetYards), y: py(p.distanceOffsetYards) }))
  const visible = layers.shots ? styled.filter((d) => !props.hidden.has(d.s.key)) : []
  const taken: Box[] = [{ x: cx - 30, y: cy - 22, w: 30, h: 24 }]
  const aimLabel = placeNear(cx, cy - 10, 'aim', 13, visible, taken, bounds)
  taken.push(aimLabel.box)
  let rGhost: ReturnType<typeof placeOnRing> | null = null
  let avg: ReturnType<typeof placeNear> | null = null
  const ringPoints = props.recentIds ? points.filter((p) => props.recentIds!.has(p.id)) : points
  const inside = stats ? ringPoints.filter((p) => insideRing(stats.ring68, p.lateralOffsetYards, p.distanceOffsetYards)).length : 0
  if (ghost && layers.rings) {
    rGhost = placeOnRing(ringPx(ghost.stats.ring68), ghost.label, 12, visible, taken, bounds, [90, -90, 30, 150, -30, -150])
    taken.push(rGhost.box)
  }
  if (stats && layers.average) avg = placeNear(px(stats.avgLateralOffset), py(stats.avgDistanceOffset), 'average', 12, visible, taken, bounds)
  const ly = TOP + area + BOTTOM
  const hotD = hot ? visible.find((d) => d.p.id === hot) : null

  return (
    <ChartFrame
      width={width}
      height={h}
      summary={props.summary}
      pickable={visible.map((d) => ({ id: d.p.id, x: d.x, y: d.y }))}
      hot={hot}
      onHot={onHot}
      readout={hotD ? shotWords(hotD.p, props.extras[hotD.p.id], unit, props.kinds.get(hotD.p.id)) : null}
      roundId={hotD ? props.extras[hotD.p.id]?.roundId ?? null : null}
      onOpenRound={props.onOpenRound}
      bounds={bounds}
    >
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
      {/* Which way is which, on the aim lines. The counts are in the rows below the chart. */}
      <SvgText x={cx + 4} y={TOP + 13} fontFamily={FONT.bodyItalic} fontSize={12} fill={P.inkDim}>long ↑</SvgText>
      <SvgText x={cx + 4} y={TOP + area - 5} fontFamily={FONT.bodyItalic} fontSize={12} fill={P.inkDim}>short ↓</SvgText>
      <SvgText x={LEFT + 4} y={cy - 5} fontFamily={FONT.bodyItalic} fontSize={12} fill={P.inkDim}>← left</SvgText>
      <SvgText x={LEFT + area - 4} y={cy - 5} textAnchor="end" fontFamily={FONT.bodyItalic} fontSize={12} fill={P.inkDim}>right →</SvgText>
      <SvgText x={cx} y={TOP + area + BOTTOM - 3} textAnchor="middle" fontFamily={FONT.body} fontSize={12} fill={P.inkDim}>{`${unit === 'meters' ? 'metres' : 'yards'} from the aim · each square ${label(ruleStep)} ${props.unitWord}`}</SvgText>
      <ChartLegend y={ly} width={width} ring68={stats && layers.rings ? `68% of shots (${inside} of ${ringPoints.length})` : null} />

      <Fade on={layers.rings}>
        {ghost && <TweenRing ring={ringPx(ghost.stats.ring68)} fill="none" stroke={P.inkDim} strokeOpacity={0.75} strokeWidth={1} dash="1,3" />}
        {stats && <TweenRing ring={ringPx(stats.ring95)} fill="rgba(31,61,44,0.035)" stroke={P.forest} strokeOpacity={0.7} strokeWidth={1} dash="4,3" />}
        {stats && <TweenRing ring={ringPx(stats.ring68)} fill="rgba(31,61,44,0.07)" stroke={P.forest} strokeWidth={1.3} />}
      </Fade>
      <Fade on={layers.shots} key={`dots-${points.length}-${points[0]?.id ?? ''}`} enter duration={200}>
        {groupBy(styled).map(([key, items]) => (
          <Fade key={key} on={!props.hidden.has(key)} duration={150}>
            {items.map((d) => (
              <Mark key={d.p.id} x={d.x} y={d.y} s={d.s} />
            ))}
          </Fade>
        ))}
      </Fade>
      {stats && (
        <Fade on={layers.average}>
          <TweenAverage x0={cx} y0={cy} x={px(stats.avgLateralOffset)} y={py(stats.avgDistanceOffset)} dense={dense} />
        </Fade>
      )}
      <Pennant x={cx} y={cy} />
      <Halo x={aimLabel.x} y={aimLabel.y} anchor={aimLabel.anchor} size={13} fill={P.warn} text="aim" />
      {rGhost && ghost && <Halo x={rGhost.x} y={rGhost.y} anchor={rGhost.anchor} fill={P.inkDim} text={ghost.label} />}
      {avg && <Halo x={avg.x} y={avg.y} anchor={avg.anchor} fill={P.ink} text="average" />}
      {hotD && <Selected key={hotD.p.id} x={hotD.x} y={hotD.y} r={hotD.s.r} />}

      {points.length === 0 && empty && (
        <>
          <Rect x={LEFT + 6} y={cy + 20} width={area - 12} height={28} fill={P.raised} />
          <SvgText x={cx} y={cy + 39} textAnchor="middle" fontFamily={FONT.body} fontSize={14} fill={P.inkDim}>{empty}</SvgText>
        </>
      )}
    </ChartFrame>
  )
}
