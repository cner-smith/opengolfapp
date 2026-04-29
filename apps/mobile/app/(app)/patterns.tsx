import { useEffect, useMemo, useState } from 'react'
import { Dimensions, Pressable, ScrollView, Text, View } from 'react-native'
import Svg, { Circle, Ellipse, Line, Rect, Text as SvgText } from 'react-native-svg'
import {
  CLUBS,
  LIE_SLOPES,
  LIE_TYPES,
  computeDispersion,
  computeDispersionStats,
  filterDispersionByLie,
  getAimCorrection,
  type Club,
  type DispersionPoint,
  type DispersionStats,
  type LieSlope,
  type LieType,
  type Shot,
} from '@oga/core'
import { getShotsByClub } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

interface ShotRowMin {
  id: string
  hole_score_id: string
  user_id: string
  shot_number: number
  aim_lat: number | null
  aim_lng: number | null
  end_lat: number | null
  end_lng: number | null
  start_lat: number | null
  start_lng: number | null
  distance_to_target: number | null
  club: string | null
  lie_type: LieType | null
  lie_slope: LieSlope | null
  shot_result: string | null
  penalty: boolean
  ob: boolean
}

function rowToShot(r: ShotRowMin): Shot {
  return {
    id: r.id,
    holeScoreId: r.hole_score_id,
    userId: r.user_id,
    shotNumber: r.shot_number,
    aimLat: r.aim_lat ?? undefined,
    aimLng: r.aim_lng ?? undefined,
    endLat: r.end_lat ?? undefined,
    endLng: r.end_lng ?? undefined,
    startLat: r.start_lat ?? undefined,
    startLng: r.start_lng ?? undefined,
    distanceToTarget: r.distance_to_target ?? undefined,
    club: (r.club as Shot['club']) ?? undefined,
    lieType: r.lie_type ?? undefined,
    lieSlope: r.lie_slope ?? undefined,
    shotResult: (r.shot_result as Shot['shotResult']) ?? undefined,
    penalty: r.penalty,
    ob: r.ob,
  }
}

const ANY = '__any__' as const

export default function Patterns() {
  const { user } = useAuth()
  const [club, setClub] = useState<Club>('7i')
  const [lieType, setLieType] = useState<LieType | typeof ANY>(ANY)
  const [lieSlope, setLieSlope] = useState<LieSlope | typeof ANY>(ANY)
  const [shots, setShots] = useState<ShotRowMin[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    let active = true
    setLoading(true)
    getShotsByClub(supabase, user.id, club).then(({ data }) => {
      if (!active) return
      setShots((data as ShotRowMin[]) ?? [])
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [user?.id, club])

  const points = useMemo(() => {
    let pts = computeDispersion(shots.map(rowToShot))
    if (lieType !== ANY || lieSlope !== ANY) {
      pts = filterDispersionByLie(
        pts,
        lieSlope === ANY ? undefined : lieSlope,
        lieType === ANY ? undefined : lieType,
      )
    }
    return pts
  }, [shots, lieType, lieSlope])

  const stats = useMemo(() => computeDispersionStats(points), [points])

  return (
    <ScrollView className="flex-1 bg-fairway-50" contentContainerStyle={{ padding: 16 }}>
      <Text className="mb-3 text-xl font-bold text-fairway-700">Shot Patterns</Text>

      <Section title="Club">
        <ChipRow
          value={club}
          options={CLUBS}
          onChange={(v) => v && setClub(v)}
        />
      </Section>

      <Section title="Lie type">
        <ChipRow
          value={lieType}
          options={[ANY, ...LIE_TYPES] as const}
          onChange={(v) => setLieType(v as LieType | typeof ANY)}
          labelFor={(v) => (v === ANY ? 'any' : (v as string).replace(/_/g, ' '))}
        />
      </Section>

      <Section title="Lie slope">
        <ChipRow
          value={lieSlope}
          options={[ANY, ...LIE_SLOPES] as const}
          onChange={(v) => setLieSlope(v as LieSlope | typeof ANY)}
          labelFor={(v) => (v === ANY ? 'any' : (v as string).replace(/_/g, ' '))}
        />
      </Section>

      <View className="mt-3 rounded-lg bg-white p-3">
        {loading ? (
          <Text className="text-sm text-gray-500">Loading…</Text>
        ) : points.length === 0 ? (
          <Text className="text-sm text-gray-500">
            No shots yet for {club}
            {lieType !== ANY ? ` (${lieType})` : ''}
            {lieSlope !== ANY ? ` (${lieSlope})` : ''}.
          </Text>
        ) : (
          <DispersionPlot points={points} stats={stats} />
        )}
      </View>

      <View className="mt-3 rounded-lg bg-white p-3">
        <Text className="mb-2 text-xs font-semibold uppercase text-gray-500">
          Pattern summary
        </Text>
        {stats ? (
          <View className="flex-row flex-wrap" style={{ gap: 12 }}>
            <Stat label="Sample" value={`${stats.sampleSize} shots`} />
            <Stat
              label="Avg lateral"
              value={`${stats.avgLateralOffset.toFixed(1)} yd`}
            />
            <Stat
              label="Avg distance bias"
              value={`${stats.avgDistanceOffset.toFixed(1)} yd`}
            />
            <Stat label="Shape" value={stats.shotShape} />
            <Stat label="Dominant miss" value={stats.dominantMiss} />
            <Stat
              label="68% spread"
              value={`±${stats.cone68.lateral.toFixed(1)} / ${stats.cone68.distance.toFixed(1)} yd`}
            />
          </View>
        ) : (
          <Text className="text-sm text-gray-500">
            Need at least 5 shots with aim + landing coords to compute a pattern.
          </Text>
        )}
      </View>

      {stats && (
        <View className="mt-3 rounded-lg border border-fairway-100 bg-fairway-50 p-3">
          <Text className="text-xs font-semibold uppercase text-fairway-700">
            Aim correction
          </Text>
          <Text className="mt-1 text-sm text-fairway-900">
            {getAimCorrection(stats)}
          </Text>
        </View>
      )}
    </ScrollView>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-3">
      <Text className="mb-1 text-xs font-semibold uppercase text-gray-500">{title}</Text>
      {children}
    </View>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text className="text-xs text-gray-500">{label}</Text>
      <Text className="text-sm font-semibold capitalize text-gray-900">{value}</Text>
    </View>
  )
}

interface ChipRowProps<T extends string> {
  value: T
  options: readonly T[]
  onChange: (v: T) => void
  labelFor?: (v: T) => string
}

function ChipRow<T extends string>({ value, options, onChange, labelFor }: ChipRowProps<T>) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View className="flex-row" style={{ gap: 4 }}>
        {options.map((opt) => (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            className={
              value === opt
                ? 'rounded-full bg-fairway-500 px-3 py-1.5'
                : 'rounded-full border border-gray-200 px-3 py-1.5'
            }
          >
            <Text
              className={
                value === opt
                  ? 'text-xs font-semibold text-white'
                  : 'text-xs text-gray-700'
              }
            >
              {labelFor ? labelFor(opt) : opt}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  )
}

const SVG_SIZE = 320

function pointColor(result: string | undefined): string {
  if (result === 'solid') return '#1D9E75'
  if (result === 'push_right' || result === 'pull_left') return '#EF9F27'
  if (result === undefined) return '#888880'
  return '#E24B4A'
}

function DispersionPlot({
  points,
  stats,
}: {
  points: DispersionPoint[]
  stats: DispersionStats | null
}) {
  const screenWidth = Dimensions.get('window').width
  const size = Math.min(SVG_SIZE, screenWidth - 64)

  const maxAbs = Math.max(
    ...points.map((p) =>
      Math.max(Math.abs(p.lateralOffsetYards), Math.abs(p.distanceOffsetYards)),
    ),
    stats ? stats.cone95.lateral : 0,
    stats ? stats.cone95.distance : 0,
    20,
  )
  const range = maxAbs * 1.15
  const cx = size / 2
  const cy = size / 2
  const scale = size / 2 / range
  const px = (lat: number) => cx + lat * scale
  const py = (dist: number) => cy - dist * scale

  const tickStep = range > 50 ? 20 : range > 20 ? 10 : 5
  const ticks: number[] = []
  for (let t = tickStep; t < range; t += tickStep) {
    ticks.push(t, -t)
  }

  return (
    <Svg width={size} height={size}>
      <Rect x={0} y={0} width={size} height={size} fill="#F8F8F6" />
      {ticks.map((t) => (
        <Line
          key={`v${t}`}
          x1={px(t)}
          y1={0}
          x2={px(t)}
          y2={size}
          stroke="#E8E8E4"
          strokeWidth={1}
        />
      ))}
      {ticks.map((t) => (
        <Line
          key={`h${t}`}
          x1={0}
          y1={py(t)}
          x2={size}
          y2={py(t)}
          stroke="#E8E8E4"
          strokeWidth={1}
        />
      ))}
      <Line x1={cx} y1={0} x2={cx} y2={size} stroke="#94A3B8" strokeWidth={1} />
      <Line x1={0} y1={cy} x2={size} y2={cy} stroke="#94A3B8" strokeWidth={1} />

      {stats && (
        <>
          <Ellipse
            cx={px(stats.avgLateralOffset)}
            cy={py(stats.avgDistanceOffset)}
            rx={stats.cone95.lateral * scale}
            ry={stats.cone95.distance * scale}
            fill="rgba(29,158,117,0.08)"
            stroke="#1D9E75"
            strokeDasharray="4 4"
            strokeWidth={1}
          />
          <Ellipse
            cx={px(stats.avgLateralOffset)}
            cy={py(stats.avgDistanceOffset)}
            rx={stats.cone68.lateral * scale}
            ry={stats.cone68.distance * scale}
            fill="rgba(29,158,117,0.18)"
            stroke="#0F6E56"
            strokeWidth={1.5}
          />
          <Circle
            cx={px(stats.avgLateralOffset)}
            cy={py(stats.avgDistanceOffset)}
            r={3}
            fill="#0F6E56"
          />
        </>
      )}

      <Circle cx={cx} cy={cy} r={5} fill="none" stroke="#0F172A" strokeWidth={1.5} />
      <Line x1={cx - 8} y1={cy} x2={cx + 8} y2={cy} stroke="#0F172A" strokeWidth={1.5} />
      <Line x1={cx} y1={cy - 8} x2={cx} y2={cy + 8} stroke="#0F172A" strokeWidth={1.5} />

      {points.map((p, i) => (
        <Circle
          key={i}
          cx={px(p.lateralOffsetYards)}
          cy={py(p.distanceOffsetYards)}
          r={4}
          fill={pointColor(p.shotResult)}
          fillOpacity={0.7}
        />
      ))}

      <SvgText x={cx + 6} y={12} fontSize={9} fill="#475569">
        long
      </SvgText>
      <SvgText x={cx + 6} y={size - 4} fontSize={9} fill="#475569">
        short
      </SvgText>
      <SvgText x={4} y={cy - 4} fontSize={9} fill="#475569">
        L
      </SvgText>
      <SvgText x={size - 12} y={cy - 4} fontSize={9} fill="#475569">
        R
      </SvgText>
    </Svg>
  )
}
