import { G, Line, Path, Rect, Text as SvgText } from 'react-native-svg'
import { aimGrid, bracketLabelAt, insideRing, ringBracket, shotWords, wholeDistance, type DispersionRing } from '@oga/core'
import { FONT } from '../../lib/typography'
import { P } from '../paper/tokens'
import { LEFT, RULE, RULE_MAJOR, isDense, stepsBack, type ChartProps, type Box, type RingPx, placeOnRing, placeNear, Fade, TweenRing, TweenAverage, PencilRing, Selected, Halo, Pennant, markStyle, Mark, groupBy, ChartFrame, ChartLegend } from './chartParts'

/* ---------------------------------------------------------- aim view */

const TOP = 10
// The right margin and the strip under the grid hold the pencil brackets for
// the ring's depth and width (as on the web).
const RIGHT = 42
const BOTTOM = 62
// The key has no 95% row here, so it never needs a second line.
const LEGEND_H = 50

export function AimPlot(props: ChartProps) {
  const { points, stats, ghost, layers, width, unitYd, label, unit, empty, hot, onHot } = props
  const area = width - LEFT - RIGHT
  const h = TOP + area + BOTTOM + LEGEND_H
  const dense = isDense(props)
  // The scale holds both rings (and the ghost) whether or not they are drawn,
  // so a toggle never rescales the chart.
  const { scale, step, rules } = aimGrid(points, stats, ghost?.stats ?? null, unitYd, area)
  const cx = LEFT + area / 2
  const cy = TOP + area / 2
  const px = (l: number) => cx + l * scale
  const py = (d: number) => cy - d * scale
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
  // The brackets span the average ± the 68% half-width and half-depth: the
  // upright box round the tilted ring. They are labelled with the whole width
  // and depth, rounded once as the numbers below the chart are.
  const box = stats ? ringBracket(stats, px, py) : null
  const bracket = stats && box
    ? {
        ...box,
        ...bracketLabelAt(box, { left: LEFT, top: TOP, size: area }),
        across: String(wholeDistance(stats.cone68.lateral * 2, unit)),
        deep: String(wholeDistance(stats.cone68.distance * 2, unit)),
      }
    : null
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
      {rules.map((r) => {
        const v = r.v * unitYd
        const stroke = r.v === 0 ? P.lineStrong : r.major ? RULE_MAJOR : RULE
        return (
          <G key={r.v}>
            <Line x1={LEFT} x2={LEFT + area} y1={py(v)} y2={py(v)} stroke={stroke} strokeWidth={1} />
            <Line x1={px(v)} x2={px(v)} y1={TOP} y2={TOP + area} stroke={stroke} strokeWidth={1} />
            {r.label && (
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
      <SvgText x={cx} y={TOP + area + BOTTOM - 3} textAnchor="middle" fontFamily={FONT.body} fontSize={12} fill={P.inkDim}>{`${unit === 'meters' ? 'metres' : 'yards'} from the aim · each square ${step} ${props.unitWord}`}</SvgText>
      <ChartLegend y={ly} width={width} ring68={stats && layers.rings ? `68% of shots (${inside} of ${ringPoints.length})` : null} pencil />

      <Fade on={layers.rings}>
        {ghost && <TweenRing ring={ringPx(ghost.stats.ring68)} fill="none" stroke={P.inkDim} strokeOpacity={0.75} strokeWidth={1} dash="1,3" />}
        {/* Only the 68% ring, in pencil; it draws itself again when the club
            changes. The 95% figure is in the numbers below the chart. */}
        {stats && <PencilRing ring={ringPx(stats.ring68)} />}
        {bracket && (
          <>
            <Path d={`M${bracket.l} ${TOP + area + 22}v5H${bracket.r}v-5`} stroke={P.ink} strokeOpacity={0.72} strokeWidth={1} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <Path d={`M${LEFT + area + 4} ${bracket.t}h5V${bracket.b}h-5`} stroke={P.ink} strokeOpacity={0.72} strokeWidth={1} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <SvgText x={bracket.acrossX} y={TOP + area + 43} textAnchor="middle" fontFamily={FONT.hand} fontSize={14} fill={P.ink}>{`${bracket.across} ${props.unitWord} across`}</SvgText>
            <SvgText x={LEFT + area + 13} y={bracket.deepY - 2} fontFamily={FONT.hand} fontSize={14} fill={P.ink}>{bracket.deep}</SvgText>
            <SvgText x={LEFT + area + 13} y={bracket.deepY + 14} fontFamily={FONT.hand} fontSize={14} fill={P.ink}>deep</SvgText>
          </>
        )}
      </Fade>
      <Fade on={layers.shots} key={`dots-${points.length}-${points[0]?.id ?? ''}`} enter duration={200}>
        {groupBy(styled).map(([key, items]) => (
          <Fade key={key} on={!props.hidden.has(key)} level={stepsBack(props, key) ? 0.14 : 1} duration={150}>
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
