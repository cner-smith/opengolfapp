import { Text, View } from 'react-native'
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg'
import type { DispersionPoint, DispersionRing, DispersionStats } from '@oga/core'
import { TYPE } from '../../lib/typography'
import { HardShadow } from '../paper/Paper'

// Off-screen 1200×630 share card, captured by react-native-view-shot: the
// page's own finding sentence and recorded shape, never an inferred one.
// Stats only: no username, email or avatar.

const C = {
  bg: '#FBF8F1',
  surface: '#F2EEE5',
  rule: '#EBE5D6',
  axis: '#9F9580',
  ink: '#1C211C',
  inkDim: '#5C6356',
  accent: '#1F3D2C',
  warn: '#A66A1F',
} as const

const LABEL = { ...TYPE.body, color: C.inkDim }

function ringPath(r: DispersionRing, px: (l: number) => number, py: (d: number) => number, scale: number) {
  const t = (r.rotationDeg * Math.PI) / 180
  const cx = px(r.cx)
  const cy = py(r.cy)
  const a = Math.max(r.rx * scale, 0.5)
  const b = Math.max(r.ry * scale, 0.5)
  const x1 = cx + a * Math.cos(t)
  const y1 = cy - a * Math.sin(t)
  const x2 = cx - a * Math.cos(t)
  const y2 = cy + a * Math.sin(t)
  return `M ${x1} ${y1} A ${a} ${b} ${-r.rotationDeg} 0 1 ${x2} ${y2} A ${a} ${b} ${-r.rotationDeg} 0 1 ${x1} ${y1} Z`
}

function Plot({ points, stats, size }: { points: DispersionPoint[]; stats: DispersionStats; size: number }) {
  const reach = Math.max(
    ...points.map((p) => Math.max(Math.abs(p.lateralOffsetYards), Math.abs(p.distanceOffsetYards))),
    Math.abs(stats.ring95.cx) + Math.max(stats.ring95.rx, stats.ring95.ry),
    Math.abs(stats.ring95.cy) + Math.max(stats.ring95.rx, stats.ring95.ry),
    20,
  )
  const range = reach * 1.12
  const c = size / 2
  const scale = c / range
  const px = (l: number) => c + l * scale
  const py = (d: number) => c - d * scale
  const step = range > 50 ? 20 : range > 20 ? 10 : 5
  const ticks: number[] = []
  for (let t = step; t < range; t += step) ticks.push(t, -t)
  return (
    <Svg width={size} height={size}>
      <Rect x={0} y={0} width={size} height={size} fill={C.surface} rx={2} ry={2} />
      {ticks.map((t) => (
        <Line key={`v${t}`} x1={px(t)} y1={0} x2={px(t)} y2={size} stroke={C.rule} strokeWidth={1} />
      ))}
      {ticks.map((t) => (
        <Line key={`h${t}`} x1={0} y1={py(t)} x2={size} y2={py(t)} stroke={C.rule} strokeWidth={1} />
      ))}
      <Line x1={c} y1={0} x2={c} y2={size} stroke={C.axis} strokeWidth={1} />
      <Line x1={0} y1={c} x2={size} y2={c} stroke={C.axis} strokeWidth={1} />
      <Path d={ringPath(stats.ring95, px, py, scale)} fill="rgba(31,61,44,0.05)" stroke={C.accent} strokeDasharray="5 4" strokeWidth={1} />
      <Path d={ringPath(stats.ring68, px, py, scale)} fill="rgba(31,61,44,0.1)" stroke={C.accent} strokeWidth={1.4} />
      {points.map((p) => (
        <Circle key={p.id} cx={px(p.lateralOffsetYards)} cy={py(p.distanceOffsetYards)} r={4} fill={C.ink} fillOpacity={0.85} />
      ))}
      <Circle cx={px(stats.avgLateralOffset)} cy={py(stats.avgDistanceOffset)} r={6} fill={C.bg} stroke={C.accent} strokeWidth={2} />
      <Circle cx={c} cy={c} r={3.5} fill={C.warn} />
    </Svg>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={{ ...LABEL, fontSize: 13, marginBottom: 6 }}>{label}</Text>
      <Text style={{ ...TYPE.serifUpright, fontSize: 28, color: C.ink }}>{value}</Text>
    </View>
  )
}

export function ShareCard({ points, stats, noun, finding, width68, shape }: {
  points: DispersionPoint[]
  stats: DispersionStats
  noun: string
  finding: string
  /** "27 yd" */
  width68: string
  /** The Shape row's value: "Draw", "Mixed" or "—". */
  shape: string
}) {
  return (
    <View style={{ width: 1200, height: 630, backgroundColor: C.bg, paddingVertical: 44, paddingHorizontal: 56 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 22, borderBottomWidth: 1, borderColor: C.ink }}>
        <View>
          <Text style={{ ...LABEL, fontSize: 14, marginBottom: 8 }}>Open Golf App</Text>
          <Text style={{ ...TYPE.serif, fontSize: 44, color: C.ink }}>
            oga<Text style={{ ...TYPE.serifUpright }}>.</Text>
          </Text>
        </View>
        <Text style={{ ...LABEL, fontSize: 14 }}>Shot pattern</Text>
      </View>

      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 48, paddingVertical: 16 }}>
        <HardShadow dx={3} dy={3}>
          <View style={{ padding: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.ink, borderRadius: 3 }}>
            <Plot points={points} stats={stats} size={350} />
          </View>
        </HardShadow>
        <View style={{ flex: 1 }}>
          <Text style={{ ...LABEL, fontSize: 15, marginBottom: 10 }}>{noun[0]!.toUpperCase() + noun.slice(1)}</Text>
          <Text style={{ ...TYPE.serif, fontSize: 36, lineHeight: 46, color: C.ink, marginBottom: 30 }}>{finding}</Text>
          <View style={{ flexDirection: 'row', gap: 40 }}>
            <Stat label="Shots" value={String(stats.sampleSize)} />
            <Stat label="Two in three inside" value={width68} />
            <Stat label="Shape" value={shape} />
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20, borderTopWidth: 1, borderColor: C.ink }}>
        <Text style={{ ...LABEL, fontSize: 15, color: C.accent }}>oga.golf</Text>
        <Text style={{ ...LABEL, fontSize: 13 }}>Free forever · no paywalls</Text>
      </View>
    </View>
  )
}
