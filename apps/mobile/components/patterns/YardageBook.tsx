import { Text, View } from 'react-native'
import Svg, { Circle, Ellipse, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg'
import type { Club, DispersionPoint, DispersionStats } from '@oga/core'
import { PressableTouch } from '../ui/PressableTouch'
import { FONT, TYPE } from '../../lib/typography'
import { FONT_CAP, P } from '../paper/tokens'

// Shot Patterns drawn like a yardage book (direction C): the club row as a
// gapping chart, the pattern on a ruled grid, the same shots from the tee.
// Split out of app/(app)/patterns.tsx for size.

const MUTE = '#8A8B7E'
const RULE = '#EAE4D5'
const RULE_MAJOR = '#DCD5C3'

// The club row as a printed gapping chart: club over its typical distance.
// Wraps in rows (a scrolled row reads as the end of the bag, #740).
export function ClubLadder({
  clubs,
  value,
  onChange,
  typical,
  width,
}: {
  clubs: readonly Club[]
  value: Club
  onChange: (c: Club) => void
  typical: (c: Club) => number | null
  width: number
}) {
  const perRow = Math.max(5, Math.min(clubs.length, Math.floor(width / 48)))
  const cellW = Math.floor((width - 1) / perRow)
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderLeftWidth: 1, borderTopColor: P.lineStrong, borderLeftColor: P.line, width: cellW * perRow + 1 }}>
      {clubs.map((c) => {
        const on = c === value
        const t = typical(c)
        return (
          <PressableTouch
            key={c}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t != null ? `${c}, ${t}` : c}
            onPress={() => onChange(c)}
            style={{
              width: cellW,
              minHeight: 54,
              alignItems: 'center',
              justifyContent: 'center',
              borderRightWidth: 1,
              borderBottomWidth: 1,
              borderColor: P.line,
              backgroundColor: on ? P.forest : 'transparent',
            }}
          >
            <Text maxFontSizeMultiplier={FONT_CAP} style={[on ? TYPE.bodyBold : TYPE.body, { fontSize: 13, color: on ? P.chrome : P.ink }]}>
              {c === 'driver' ? 'dr' : c}
            </Text>
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serifUpright, { fontSize: 17, lineHeight: 21, color: on ? P.chrome : t != null ? P.ink : '#B7B2A2' }]}>
              {t != null ? t : '·'}
            </Text>
          </PressableTouch>
        )
      })}
    </View>
  )
}

export type ChartView = 'aim' | 'tee'

// Two views of one hero chart, set like printed tabs: the active one inked
// and underlined, no fill (the accent stays on the club).
export function ViewToggle({ value, onChange }: { value: ChartView; onChange: (v: ChartView) => void }) {
  const views: { v: ChartView; label: string }[] = [
    { v: 'aim', label: 'Around the aim' },
    { v: 'tee', label: 'From the tee' },
  ]
  return (
    <View style={{ flexDirection: 'row', gap: 20, borderBottomWidth: 1, borderColor: P.line }}>
      {views.map(({ v, label }) => {
        const on = v === value
        return (
          <PressableTouch
            key={v}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(v)}
            style={{ minHeight: 44, justifyContent: 'center', borderBottomWidth: 2, borderColor: on ? P.ink : 'transparent', marginBottom: -1 }}
          >
            <Text maxFontSizeMultiplier={FONT_CAP} style={[on ? TYPE.bodyBold : TYPE.body, { fontSize: 14, color: on ? P.ink : P.inkDim }]}>
              {label}
            </Text>
          </PressableTouch>
        )
      })}
    </View>
  )
}

const LEFT = 40
const BOTTOM = 30
const TOP = 10
const RIGHT = 8

// The pattern on a ruled grid: every `step` yd a rule, the margin labelled,
// the aim a small pennant, each finish a dot, the ring where about two shots
// in three finish, a dashed line from the aim to the average finish.
export function YardagePlot({
  points,
  stats,
  width,
  step,
  label,
  unitWord,
  empty,
}: {
  points: DispersionPoint[]
  stats: DispersionStats | null
  width: number
  /** Grid spacing in yards. */
  step: number
  /** Margin label for a distance in yards. */
  label: (yd: number) => string
  unitWord: string
  empty?: string
}) {
  const area = width - LEFT - RIGHT
  const h = TOP + area + BOTTOM
  const reach = Math.max(
    ...points.map((p) => Math.max(Math.abs(p.lateralOffsetYards), Math.abs(p.distanceOffsetYards))),
    stats ? Math.abs(stats.avgLateralOffset) + stats.cone68.lateral : 0,
    stats ? Math.abs(stats.avgDistanceOffset) + stats.cone68.distance : 0,
    step * 2,
  )
  const half = Math.ceil((reach * 1.1) / step) * step
  const scale = area / 2 / half
  const cx = LEFT + area / 2
  const cy = TOP + area / 2
  const px = (l: number) => cx + l * scale
  const py = (d: number) => cy - d * scale
  const labelEvery = step * scale >= 16 ? step : step * 2
  const rules: number[] = []
  for (let v = -half; v <= half + 1e-6; v += step) rules.push(Math.round(v * 1000) / 1000)
  const isMult = (v: number, m: number) => Math.abs(v / m - Math.round(v / m)) < 1e-6

  return (
    <Svg width={width} height={h}>
      {rules.map((v) => {
        const stroke = v === 0 ? P.lineStrong : isMult(v, step * 2) ? RULE_MAJOR : RULE
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

      {stats && (
        <>
          <Ellipse
            cx={px(stats.avgLateralOffset)}
            cy={py(stats.avgDistanceOffset)}
            rx={stats.cone68.lateral * scale}
            ry={stats.cone68.distance * scale}
            fill="rgba(31,61,44,0.07)"
            stroke={P.forest}
            strokeWidth={1.2}
          />
          <Line x1={cx} y1={cy} x2={px(stats.avgLateralOffset)} y2={py(stats.avgDistanceOffset)} stroke={P.ink} strokeWidth={1} strokeDasharray="3,3" />
        </>
      )}
      {points.map((p) => (
        <Circle key={p.id} cx={px(p.lateralOffsetYards)} cy={py(p.distanceOffsetYards)} r={3.6} fill={P.ink} fillOpacity={0.78} />
      ))}
      {stats && <Circle cx={px(stats.avgLateralOffset)} cy={py(stats.avgDistanceOffset)} r={5} fill={P.raised} stroke={P.forest} strokeWidth={1.6} />}

      <Line x1={cx} y1={cy} x2={cx} y2={cy - 16} stroke={P.warn} strokeWidth={1.4} />
      <Path d={`M ${cx} ${cy - 16} L ${cx + 10} ${cy - 12.5} L ${cx} ${cy - 9} Z`} fill={P.warn} />
      <Circle cx={cx} cy={cy} r={2.2} fill={P.warn} />
      <SvgText x={cx + 13} y={cy - 9} fontFamily={FONT.serifItalic} fontSize={13} fill={P.warn}>aim</SvgText>

      {points.length === 0 && empty && (
        <>
          <Rect x={LEFT + 6} y={cy + 20} width={area - 12} height={28} fill={P.raised} />
          <SvgText x={cx} y={cy + 39} textAnchor="middle" fontFamily={FONT.body} fontSize={14} fill={P.inkDim}>{empty}</SvgText>
        </>
      )}
    </Svg>
  )
}

// The same shots from the tee (still from above): each a curve from the tee
// to its finish at its true distance, so the shape reads. Common tee at the
// average aim distance; one scale on both axes.
export function BallFlightChart({
  points,
  stats,
  width,
  label,
  unitWord,
}: {
  points: DispersionPoint[]
  stats: DispersionStats | null
  width: number
  label: (yd: number) => string
  unitWord: string
}) {
  const h = Math.round(width * 1.07)
  const teeY = h - 32
  const aims = points.filter((p) => p.startDistanceOffsetYards != null).map((p) => -p.startDistanceOffsetYards!)
  const avgAim = aims.length ? aims.reduce((a, b) => a + b, 0) / aims.length : 0
  if (aims.length === 0 || avgAim < 5) {
    return (
      <View style={{ height: width * 0.6, alignItems: 'center', justifyContent: 'center', padding: 22 }}>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 13, color: P.inkDim, textAlign: 'center' }]}>
          These shots have no start point saved, so there is no line from the tee to draw.
        </Text>
      </View>
    )
  }
  const aimOf = (p: DispersionPoint) => (p.startDistanceOffsetYards != null ? -p.startDistanceOffsetYards : avgAim)
  const max = Math.max(...points.map((p) => aimOf(p) + p.distanceOffsetYards), avgAim, 1) * 1.06
  const center = stats ? stats.avgLateralOffset : 0
  const lat = Math.max(...points.map((p) => Math.abs(p.lateralOffsetYards - center)), Math.abs(center), 8) * 1.15
  const scale = Math.min((teeY - 12) / max, ((width - LEFT) / 2 - 8) / lat)
  const midX = LEFT + (width - LEFT) / 2
  const x = (l: number) => midX + (l - center) * scale
  const y = (d: number) => teeY - d * scale
  const teeX = x(0)
  const step = max <= 160 ? 10 : 25
  const rules: number[] = []
  for (let d = step; d <= max; d += step) rules.push(d)
  return (
    <Svg width={width} height={h}>
      {rules.map((d) => (
        <G key={d}>
          <Line x1={LEFT} x2={width} y1={y(d)} y2={y(d)} stroke={d % 50 === 0 ? RULE_MAJOR : RULE} strokeWidth={1} />
          {d % 50 === 0 && (
            <SvgText x={LEFT - 5} y={y(d) + 4} textAnchor="end" fontFamily={FONT.serif} fontSize={12} fill={P.inkDim}>{label(d)}</SvgText>
          )}
        </G>
      ))}
      <Line x1={LEFT} x2={LEFT} y1={0} y2={teeY} stroke={P.lineStrong} strokeWidth={1} />
      <Line x1={teeX} x2={teeX} y1={y(max)} y2={teeY} stroke={P.lineStrong} strokeWidth={1} strokeDasharray="3,4" />
      {points.map((p) => (
        <Path
          key={p.id}
          d={`M ${teeX} ${teeY} Q ${x(p.lateralOffsetYards)} ${y(aimOf(p))} ${x(p.lateralOffsetYards)} ${y(aimOf(p) + p.distanceOffsetYards)}`}
          fill="none"
          stroke={P.ink}
          strokeOpacity={0.22}
          strokeWidth={1.2}
        />
      ))}
      {stats && (
        <Path
          d={`M ${teeX} ${teeY} Q ${x(stats.avgLateralOffset)} ${y(avgAim)} ${x(stats.avgLateralOffset)} ${y(avgAim + stats.avgDistanceOffset)}`}
          fill="none"
          stroke={P.forest}
          strokeWidth={2.5}
        />
      )}
      {points.map((p) => (
        <Circle key={`d${p.id}`} cx={x(p.lateralOffsetYards)} cy={y(aimOf(p) + p.distanceOffsetYards)} r={3} fill={P.ink} fillOpacity={0.78} />
      ))}
      <Line x1={teeX} y1={y(avgAim)} x2={teeX} y2={y(avgAim) - 14} stroke={P.warn} strokeWidth={1.4} />
      <Path d={`M ${teeX} ${y(avgAim) - 14} L ${teeX + 9} ${y(avgAim) - 11} L ${teeX} ${y(avgAim) - 8} Z`} fill={P.warn} />
      <Circle cx={teeX} cy={teeY} r={4.5} fill={P.raised} stroke={P.ink} strokeWidth={1.6} />
      <SvgText x={teeX} y={teeY + 20} textAnchor="middle" fontFamily={FONT.bodyItalic} fontSize={12} fill={P.inkDim}>tee</SvgText>
      <SvgText x={LEFT - 5} y={teeY + 4} textAnchor="end" fontFamily={FONT.body} fontSize={11} fill={MUTE}>{unitWord}</SvgText>
    </Svg>
  )
}
