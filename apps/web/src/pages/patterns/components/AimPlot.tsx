import { useMemo, useRef } from 'react'
import {
  YARDS_TO_METERS,
  distanceUnitAbbr as unitWord,
  insideRing,
  shotWords,
  type DispersionPoint,
  type DispersionStats,
  type DistanceUnit,
} from '@oga/core'
import {
  AMBER_TEXT,
  AXIS,
  DIM,
  Dot,
  FOREST,
  Halo,
  INK,
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
const RIGHT = 12
const BOTTOM = 36
// The legend under the chart.
const LEG = 50

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
  const H = TOP + AREA + BOTTOM + LEG
  const ly = TOP + AREA + BOTTOM
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dense = points.length > 40
  const grid = useMemo(() => aimGrid(points, older, stats, ghost, unit, AREA), [points, older, stats, ghost, unit, AREA])
  const { scale, halfDisp, step, stepYd } = grid

  const cx = LEFT + AREA / 2
  const cy = TOP + AREA / 2
  const px = (lat: number) => cx + lat * scale
  const py = (d: number) => cy - d * scale
  const labelEvery = stepYd * scale >= 18 ? 1 : 2
  const rules: number[] = []
  for (let k = -Math.round(halfDisp / step); k <= Math.round(halfDisp / step); k++) rules.push(k)
  const bounds: Box = { x: LEFT + 2, y: TOP + 2, w: AREA - 4, h: AREA - 4 }

  const styled = points.map((p) => ({ p, s: markStyle(p, props, dense), x: px(p.lateralOffsetYards), y: py(p.distanceOffsetYards) }))
  const visible = layers.shots ? styled.filter((d) => !d.s.hide) : []
  const order = useMemo(() => visible.map((d) => d.p).sort(byDistance).map((p) => p.id), [visible])
  const nav = useShotNav(svgRef, order, props.onOpenShot)

  // Rings and the average glide when the club or the filters change.
  const zero: ScreenRing = { cx, cy, rx: 0, ry: 0, rot: 0 }
  const r68 = stats ? screenRing(stats.ring68, px, py, scale) : zero
  const r95 = stats ? screenRing(stats.ring95, px, py, scale) : zero
  const avg = stats ? { x: px(stats.avgLateralOffset), y: py(stats.avgDistanceOffset) } : { x: cx, y: cy }
  const tw = useTween([r68.cx, r68.cy, r68.rx, r68.ry, r68.rot, r95.cx, r95.cy, r95.rx, r95.ry, r95.rot, avg.x, avg.y])
  const t68: ScreenRing = { cx: tw[0]!, cy: tw[1]!, rx: tw[2]!, ry: tw[3]!, rot: tw[4]! }
  const t95: ScreenRing = { cx: tw[5]!, cy: tw[6]!, rx: tw[7]!, ry: tw[8]!, rot: tw[9]! }
  const ghostRing = ghost ? screenRing(ghost.stats.ring68, px, py, scale) : null

  // Labels: the aim first, then the inner ring, the outer ring, the ghost, the average.
  const dots = visible.map((d) => ({ x: d.x, y: d.y }))
  const taken: Box[] = []
  const aimLabel = placeNear(cx + 3, cy - 12, 'aim', 14, dots, taken, bounds, dense)
  taken.push(aimLabel.box, { x: cx - 2, y: cy - 18, w: 14, h: 20 })
  const inside = stats ? points.filter((p) => insideRing(stats.ring68, p.lateralOffsetYards, p.distanceOffsetYards)).length : 0
  const label68 = `68% · ${inside} of ${points.length}`
  let l68: Placed | null = null
  let l95: Placed | null = null
  let lGhost: Placed | null = null
  let lAvg: Placed | null = null
  if (stats && layers.rings) {
    l68 = placeOnRing(r68, label68, 12, dots, taken, bounds, [52, 128, -52, -128, 18, 162])
    taken.push(l68.box)
    l95 = placeOnRing(r95, '95%', 12, dots, taken, bounds, [128, 52, -128, -52, 162, 18])
    taken.push(l95.box)
  }
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
        <g fontFamily={SANS} fontSize={12} fill={INK}>
          <circle cx={LEFT + 6} cy={ly + 14} r={4} fill={INK} />
          <text x={LEFT + 16} y={ly + 18}>a shot</text>
          <circle cx={LEFT + 84} cy={ly + 14} r={5.5} fill={PAPER} stroke={FOREST} strokeWidth={1.8} />
          <text x={LEFT + 95} y={ly + 18}>average</text>
          <Pennant x={LEFT + 166} y={ly + 20} />
          <text x={LEFT + 182} y={ly + 18}>aim</text>
          <RingMark r={{ cx: LEFT + 10, cy: ly + 36, rx: 10, ry: 6, rot: 0 }} />
          <text x={LEFT + 26} y={ly + 40}>{stats ? `68% of shots (${inside} of ${points.length})` : '68% of shots'}</text>
          <RingMark r={{ cx: LEFT + 196, cy: ly + 36, rx: 10, ry: 6, rot: 0 }} outer />
          <text x={LEFT + 212} y={ly + 40}>95% of shots</text>
        </g>
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
      {stats && (
        <g aria-hidden style={fade(layers.average)}>
          <line x1={cx} y1={cy} x2={tw[10]} y2={tw[11]} stroke={dense ? FOREST : INK} strokeWidth={dense ? 1.4 : 1} strokeDasharray="3 3" />
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
          <circle cx={tw[10]} cy={tw[11]} r={5.5} fill={PAPER} stroke={FOREST} strokeWidth={1.8} />
        </g>
      )}
      <g aria-hidden>
        <Pennant x={cx} y={cy} />
        <Halo at={aimLabel} size={14} fill={AMBER_TEXT}>aim</Halo>
        {l68 && <Halo at={l68} fill={FOREST}>{label68}</Halo>}
        {l95 && <Halo at={l95} fill={FOREST}>95%</Halo>}
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
