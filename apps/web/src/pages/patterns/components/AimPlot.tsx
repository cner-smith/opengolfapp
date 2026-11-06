import { useMemo, useRef } from 'react'
import {
  YARDS_TO_METERS,
  distanceUnitAbbr as unitWord,
  insideRing,
  shotWords,
  wholeDistance,
  type DispersionPoint,
  type DispersionStats,
  type DistanceUnit,
} from '@oga/core'
import {
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
  PencilRing,
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
  screenRing,
  useNarrow,
  useShotNav,
  useTween,
  type Box,
  type ChartProps,
  type Ghost,
  type Placed,
  type ScreenRing,
} from './chartParts'

// Around the aim: every finish from above at one true scale, on a ruled grid
// like a yardage book. The aim is the cross of the two heavy rules.

const TOP = 12
// The right margin and the strip under the grid hold the pencil brackets for
// the ring's depth and width.
const RIGHT = 44
const BOTTOM = 66
const HAND = 'Kalam, cursive'

/** The grid: a half-width in yards that holds every shot and both rings (so a
 *  toggle never rescales the chart), ruled every 5 or 10 of the player's unit. */
export function aimGrid(
  points: DispersionPoint[],
  older: DispersionPoint[],
  stats: DispersionStats | null,
  ghost: Ghost | null,
  unit: DistanceUnit,
  area: number,
) {
  const reachOf = (s: DispersionStats) => [
    Math.abs(s.avgLateralOffset) + s.cone95.lateral,
    Math.abs(s.avgDistanceOffset) + s.cone95.distance,
  ]
  const reach = Math.max(
    ...[...points, ...older].map((p) => Math.max(Math.abs(p.lateralOffsetYards), Math.abs(p.distanceOffsetYards))),
    ...(stats ? reachOf(stats) : []),
    ...(ghost ? reachOf(ghost.stats).map((r) => r * 0.66) : []),
    10,
  )
  const u = unit === 'meters' ? YARDS_TO_METERS : 1
  const halfDisp = Math.ceil((reach * u * 1.08) / 5) * 5
  const half = halfDisp / u
  const scale = area / 2 / half
  const step = (5 / u) * scale >= 14 ? 5 : 10
  return { half, halfDisp, scale, step, stepYd: step / u, u }
}

export function AimPlot(props: ChartProps) {
  const { points, older, stats, ghost, unit, layers, empty, extras, kinds } = props
  const narrow = useNarrow()
  const W = narrow ? 350 : 440
  const LEFT = narrow ? 44 : 50
  const AREA = W - LEFT - RIGHT
  const H = TOP + AREA + BOTTOM + LEGEND_H
  const ly = TOP + AREA + BOTTOM
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dense = points.length > 40
  const grid = useMemo(() => aimGrid(points, older, stats, ghost, unit, AREA), [points, older, stats, ghost, unit, AREA])
  const { scale, halfDisp, step, stepYd } = grid

  const cx = LEFT + AREA / 2
  const cy = TOP + AREA / 2
  const px = (lat: number) => cx + lat * scale
  const py = (d: number) => cy - d * scale
  const labelEvery = stepYd * scale >= 19 ? 1 : 2
  const rules: number[] = []
  for (let k = -Math.round(halfDisp / step); k <= Math.round(halfDisp / step); k++) rules.push(k)
  const bounds: Box = { x: LEFT + 2, y: TOP + 2, w: AREA - 4, h: AREA - 4 }

  const styled = points.map((p) => ({ p, s: markStyle(p, props, dense), x: px(p.lateralOffsetYards), y: py(p.distanceOffsetYards) }))
  const visible = layers.shots ? styled.filter((d) => !d.s.hide) : []
  const order = useMemo(() => visible.map((d) => d.p).sort(byDistance).map((p) => p.id), [visible])
  const nav = useShotNav(svgRef, order, props.onOpenShot)

  // The average and the brackets glide when the club or the filters change;
  // the pencil ring draws itself again in its new place. Only the 68% ring is
  // drawn (the 95% figure is in the numbers beside the chart). The brackets
  // span the average ± the 68% half-width and half-depth, which is exactly
  // the upright box round the tilted ring.
  const r68: ScreenRing | null = stats ? screenRing(stats.ring68, px, py, scale) : null
  const avg = stats ? { x: px(stats.avgLateralOffset), y: py(stats.avgDistanceOffset) } : { x: cx, y: cy }
  const span = stats
    ? [px(stats.avgLateralOffset - stats.cone68.lateral), px(stats.avgLateralOffset + stats.cone68.lateral), py(stats.avgDistanceOffset + stats.cone68.distance), py(stats.avgDistanceOffset - stats.cone68.distance)]
    : [cx, cx, cy, cy]
  const tw = useTween([avg.x, avg.y, ...span])
  const [bL, bR, bT, bB] = [tw[2]!, tw[3]!, tw[4]!, tw[5]!]
  // Labelled with the whole width and depth, rounded once as the numbers
  // beside the chart are, so the two always agree.
  const whole = (half: number) => String(wholeDistance(half * 2, unit))
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
  const acrossX = clamp((bL + bR) / 2, LEFT + 48, LEFT + AREA - 48)
  const deepY = clamp((bT + bB) / 2, TOP + 14, TOP + AREA - 16)
  const ghostRing = ghost ? screenRing(ghost.stats.ring68, px, py, scale) : null

  // Labels: the aim first, then the inner ring, the outer ring, the ghost, the average.
  const dots = visible.map((d) => ({ x: d.x, y: d.y }))
  const taken: Box[] = []
  const aimLabel = placeNear(cx + 3, cy - 12, 'aim', 14, dots, taken, bounds, dense)
  taken.push(aimLabel.box, { x: cx - 2, y: cy - 18, w: 14, h: 20 })
  const inside = stats ? points.filter((p) => insideRing(stats.ring68, p.lateralOffsetYards, p.distanceOffsetYards)).length : 0
  let lGhost: Placed | null = null
  let lAvg: Placed | null = null
  if (ghostRing && layers.rings) {
    lGhost = placeOnRing(ghostRing, ghost!.label, 12, dots, taken, bounds, [-90, 90, 0, 180, -45, -135])
    taken.push(lGhost.box)
  }
  if (stats && layers.average) lAvg = placeNear(avg.x, avg.y, 'average', 12, dots, taken, bounds)

  const hot = nav.shown ? styled.find((d) => d.p.id === nav.shown) : null
  const fade = (on: boolean) => ({ opacity: on ? 1 : 0, transition: 'opacity 180ms ease', pointerEvents: on ? undefined : ('none' as const) })
  const tick = (k: number) => String(Math.abs(k * step))

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      className="pat-chart pat-aim"
      style={{ display: 'block' }}
      role="group"
      aria-labelledby={props.labelId}
      aria-describedby={props.descId}
    >
      <g aria-hidden>
        {rules.map((k) => {
          const v = k * stepYd
          const stroke = k === 0 ? AXIS : (k * step) % 10 === 0 ? RULE_MAJOR : RULE
          const edge = Math.abs(k * step) >= halfDisp
          return (
            <g key={k}>
              <line x1={LEFT} x2={LEFT + AREA} y1={py(v)} y2={py(v)} stroke={stroke} strokeWidth={1} />
              <line x1={px(v)} x2={px(v)} y1={TOP} y2={TOP + AREA} stroke={stroke} strokeWidth={1} />
              {k % labelEvery === 0 && k !== 0 && !edge && (
                <>
                  <text x={LEFT - 6} y={py(v) + 4} textAnchor="end" fontFamily={SERIF} fontSize={13} fill={DIM}>{tick(k)}</text>
                  <text x={px(v)} y={TOP + AREA + 16} textAnchor="middle" fontFamily={SERIF} fontSize={13} fill={DIM}>{tick(k)}</text>
                </>
              )}
            </g>
          )
        })}
        <rect x={LEFT} y={TOP} width={AREA} height={AREA} fill="none" stroke={AXIS} strokeWidth={1} />
        {/* Which way is which, on the aim lines. The counts are in the rows below the chart. */}
        <text x={cx + 5} y={TOP + 15} fontFamily={SANS} fontSize={12} fontStyle="italic" fill={DIM}>long ↑</text>
        <text x={cx + 5} y={TOP + AREA - 6} fontFamily={SANS} fontSize={12} fontStyle="italic" fill={DIM}>short ↓</text>
        <text x={LEFT + 5} y={cy - 6} fontFamily={SANS} fontSize={12} fontStyle="italic" fill={DIM}>← left</text>
        <text x={LEFT + AREA - 5} y={cy - 6} textAnchor="end" fontFamily={SANS} fontSize={12} fontStyle="italic" fill={DIM}>right →</text>
        <text x={cx} y={ly - 4} textAnchor="middle" fontFamily={SANS} fontSize={12} fill={DIM}>
          {`${unit === 'meters' ? 'metres' : 'yards'} from the aim · each square ${step} ${unitWord(unit)}`}
        </text>
        <ChartLegend x={LEFT} y={ly} ring68={stats && layers.rings ? `68% of shots (${inside} of ${points.length})` : null} pencil />
      </g>

      <g aria-hidden style={fade(layers.rings)}>
        {ghostRing && <RingMark r={ghostRing} ghost />}
        {r68 && <PencilRing r={r68} />}
        {stats && (
          <g stroke={INK} strokeOpacity={0.72} strokeWidth={1} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d={`M${bL} ${TOP + AREA + 24}v5H${bR}v-5`} />
            <path d={`M${LEFT + AREA + 4} ${bT}h5V${bB}h-5`} />
            <g fontFamily={HAND} fontSize={14} fill={INK} stroke="none">
              <text x={acrossX} y={TOP + AREA + 46} textAnchor="middle">{`${whole(stats.cone68.lateral)} ${unitWord(unit)} across`}</text>
              <text x={LEFT + AREA + 13} y={deepY - 2}>{whole(stats.cone68.distance)}</text>
              <text x={LEFT + AREA + 13} y={deepY + 14}>deep</text>
            </g>
          </g>
        )}
      </g>
      {stats && (
        <g aria-hidden style={fade(layers.average)}>
          <line x1={cx} y1={cy} x2={tw[0]} y2={tw[1]} stroke={dense ? FOREST : INK} strokeWidth={dense ? 1.4 : 1} strokeDasharray="3 3" />
        </g>
      )}

      <OlderDots dots={older.map((p) => ({ x: px(p.lateralOffsetYards), y: py(p.distanceOffsetYards) }))} />
      <g style={fade(layers.shots)} aria-hidden={!layers.shots || undefined}>
        {styled.map((d, i) => (
          <Dot
            key={d.p.id}
            x={d.x}
            y={d.y}
            s={layers.shots ? d.s : { ...d.s, hide: true }}
            hot={nav.shown === d.p.id}
            dense={dense}
            nav={nav.dotProps(d.p.id)}
            label={shotWords(d.p, extras[d.p.id], unit, kinds.get(d.p.id)).join('. ')}
            delay={Math.min(i * 6, 180)}
          />
        ))}
      </g>

      {stats && (
        <g aria-hidden style={fade(layers.average)}>
          <circle cx={tw[0]} cy={tw[1]} r={5.5} fill={PAPER} stroke={FOREST} strokeWidth={1.8} />
        </g>
      )}
      <g aria-hidden>
        <Pennant x={cx} y={cy} />
        <Halo at={aimLabel} size={14} fill={AMBER_TEXT}>aim</Halo>
        {lGhost && <Halo at={lGhost} fill={DIM}>{ghost!.label}</Halo>}
        {lAvg && <Halo at={lAvg} fill={INK}>average</Halo>}
      </g>

      {points.length === 0 && empty && (
        <g aria-hidden>
          <rect x={LEFT + 8} y={cy + 22} width={AREA - 16} height={30} fill={PAPER} />
          <text x={cx} y={cy + 42} textAnchor="middle" fontFamily={SANS} fontSize={15} fill={DIM}>{empty}</text>
        </g>
      )}
      {hot && (
        <Readout
          x={hot.x}
          y={hot.y}
          lines={shotWords(hot.p, extras[hot.p.id], unit, kinds.get(hot.p.id))}
          warn={kinds.get(hot.p.id) === 'conflict'}
          bounds={bounds}
          dots={dots}
          link={nav.link}
        />
      )}
    </svg>
  )
}
