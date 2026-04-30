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
import { AppBar } from '../../components/ui/AppBar'

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getShotsByClub(supabase, user.id, club).then(({ data }: { data: any }) => {
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
    <View style={{ flex: 1, backgroundColor: '#F2EEE5' }}>
      <AppBar eyebrow={`Club ${club}`} title="Shot Patterns" />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        <Section kicker="Club">
          <ChipRow
            value={club}
            options={CLUBS}
            onChange={(v) => v && setClub(v)}
          />
        </Section>

        <Section kicker="Lie type">
          <ChipRow
            value={lieType}
            options={[ANY, ...LIE_TYPES] as const}
            onChange={(v) => setLieType(v as LieType | typeof ANY)}
            labelFor={(v) => (v === ANY ? 'any' : (v as string).replace(/_/g, ' '))}
          />
        </Section>

        <Section kicker="Lie slope">
          <ChipRow
            value={lieSlope}
            options={[ANY, ...LIE_SLOPES] as const}
            onChange={(v) => setLieSlope(v as LieSlope | typeof ANY)}
            labelFor={(v) => (v === ANY ? 'any' : (v as string).replace(/_/g, ' '))}
          />
        </Section>

        <Section kicker="Pattern">
          {loading ? (
            <Text style={{ color: '#8A8B7E', fontSize: 13 }}>Loading…</Text>
          ) : points.length === 0 ? (
            <Text style={{ color: '#8A8B7E', fontSize: 13 }}>
              No shots yet for {club}
              {lieType !== ANY ? ` (${lieType})` : ''}
              {lieSlope !== ANY ? ` (${lieSlope})` : ''}.
            </Text>
          ) : (
            <DispersionPlot points={points} stats={stats} />
          )}
        </Section>

        <Section kicker="Pattern summary">
          {stats ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18 }}>
              <Stat label="Sample" value={`${stats.sampleSize} shots`} />
              <Stat
                label="Avg lateral"
                value={`${stats.avgLateralOffset.toFixed(1)} yd`}
              />
              <Stat
                label="Distance bias"
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
            <Text
              style={{
                color: '#1C211C',
                fontSize: 15,
                lineHeight: 22,
                fontStyle: 'italic',
              }}
            >
              Need at least <Text style={{ fontWeight: '500' }}>five shots</Text>{' '}
              with aim and landing coords to compute a pattern.
            </Text>
          )}
        </Section>

        {stats && (
          <View
            style={{
              borderTopWidth: 1,
              borderColor: '#D9D2BF',
              paddingTop: 14,
            }}
          >
            <Text style={{ ...KICKER, marginBottom: 10 }}>Aim correction</Text>
            <Text
              style={{
                color: '#1C211C',
                fontSize: 15,
                lineHeight: 22,
              }}
            >
              {getAimCorrection(stats)}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

function Section({
  kicker,
  children,
}: {
  kicker: string
  children: React.ReactNode
}) {
  return (
    <View style={{ marginBottom: 22 }}>
      <View
        style={{
          borderTopWidth: 1,
          borderColor: '#D9D2BF',
          paddingTop: 14,
          marginBottom: 12,
        }}
      >
        <Text style={KICKER}>{kicker}</Text>
      </View>
      {children}
    </View>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ minWidth: 110 }}>
      <Text style={{ ...KICKER, marginBottom: 6 }}>{label}</Text>
      <Text
        style={{
          color: '#1C211C',
          fontSize: 17,
          fontWeight: '500',
          textTransform: 'capitalize',
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
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
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {options.map((opt) => {
          const active = value === opt
          return (
            <Pressable
              key={opt}
              onPress={() => onChange(opt)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 2,
                backgroundColor: active ? '#1F3D2C' : '#EBE5D6',
              }}
            >
              <Text
                style={{
                  color: active ? '#F2EEE5' : '#1C211C',
                  fontSize: 12,
                  fontWeight: active ? '500' : '400',
                }}
              >
                {labelFor ? labelFor(opt) : opt}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </ScrollView>
  )
}

const SVG_SIZE = 320

function pointColor(result: string | undefined): { fill: string; opacity: number } {
  if (result === 'solid') return { fill: '#1C211C', opacity: 0.75 }
  if (result === 'push_right' || result === 'pull_left')
    return { fill: '#A66A1F', opacity: 0.75 }
  if (result === undefined) return { fill: '#8A8B7E', opacity: 0.5 }
  return { fill: '#A33A2A', opacity: 0.8 }
}

function DispersionPlot({
  points,
  stats,
}: {
  points: DispersionPoint[]
  stats: DispersionStats | null
}) {
  const screenWidth = Dimensions.get('window').width
  const size = Math.min(SVG_SIZE, screenWidth - 56)

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
      <Rect x={0} y={0} width={size} height={size} fill="#F2EEE5" rx={2} ry={2} />
      {ticks.map((t) => (
        <Line
          key={`v${t}`}
          x1={px(t)}
          y1={0}
          x2={px(t)}
          y2={size}
          stroke="#EBE5D6"
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
          stroke="#EBE5D6"
          strokeWidth={1}
        />
      ))}
      <Line x1={cx} y1={0} x2={cx} y2={size} stroke="#9F9580" strokeWidth={1} />
      <Line x1={0} y1={cy} x2={size} y2={cy} stroke="#9F9580" strokeWidth={1} />

      {stats && (
        <>
          <Ellipse
            cx={px(stats.avgLateralOffset)}
            cy={py(stats.avgDistanceOffset)}
            rx={stats.cone95.lateral * scale}
            ry={stats.cone95.distance * scale}
            fill="rgba(31,61,44,0.06)"
            stroke="#1F3D2C"
            strokeDasharray="5 4"
            strokeWidth={1}
          />
          <Ellipse
            cx={px(stats.avgLateralOffset)}
            cy={py(stats.avgDistanceOffset)}
            rx={stats.cone68.lateral * scale}
            ry={stats.cone68.distance * scale}
            fill="rgba(31,61,44,0.12)"
            stroke="#1F3D2C"
            strokeDasharray="4 3"
            strokeWidth={1}
          />
        </>
      )}

      <Circle cx={cx} cy={cy} r={3} fill="#A66A1F" />
      <SvgText x={cx + 6} y={cy + 14} fontSize={9} fill="#A66A1F">
        AIM
      </SvgText>

      {points.map((p, i) => {
        const c = pointColor(p.shotResult)
        return (
          <Circle
            key={i}
            cx={px(p.lateralOffsetYards)}
            cy={py(p.distanceOffsetYards)}
            r={3.5}
            fill={c.fill}
            fillOpacity={c.opacity}
          />
        )
      })}

      <SvgText x={cx + 6} y={12} fontSize={9} fill="#8A8B7E">
        LONG
      </SvgText>
      <SvgText x={cx + 6} y={size - 4} fontSize={9} fill="#8A8B7E">
        SHORT
      </SvgText>
      <SvgText x={4} y={cy - 4} fontSize={9} fill="#8A8B7E">
        L
      </SvgText>
      <SvgText x={size - 12} y={cy - 4} fontSize={9} fill="#8A8B7E">
        R
      </SvgText>
    </Svg>
  )
}
