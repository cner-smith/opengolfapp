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
    <View style={{ flex: 1, backgroundColor: '#F4F4F0' }}>
      <AppBar eyebrow={`Club ${club}`} title="Shot Patterns" />
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 32 }}>
        <Card label="Club">
          <ChipRow
            value={club}
            options={CLUBS}
            onChange={(v) => v && setClub(v)}
          />
        </Card>
        <View style={{ height: 12 }} />

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Card label="Lie type">
              <ChipRow
                value={lieType}
                options={[ANY, ...LIE_TYPES] as const}
                onChange={(v) => setLieType(v as LieType | typeof ANY)}
                labelFor={(v) => (v === ANY ? 'any' : (v as string).replace(/_/g, ' '))}
              />
            </Card>
          </View>
          <View style={{ flex: 1 }}>
            <Card label="Lie slope">
              <ChipRow
                value={lieSlope}
                options={[ANY, ...LIE_SLOPES] as const}
                onChange={(v) => setLieSlope(v as LieSlope | typeof ANY)}
                labelFor={(v) => (v === ANY ? 'any' : (v as string).replace(/_/g, ' '))}
              />
            </Card>
          </View>
        </View>
        <View style={{ height: 12 }} />

        <Card>
          {loading ? (
            <Text style={{ color: '#888880', fontSize: 13 }}>Loading…</Text>
          ) : points.length === 0 ? (
            <Text style={{ color: '#888880', fontSize: 13 }}>
              No shots yet for {club}
              {lieType !== ANY ? ` (${lieType})` : ''}
              {lieSlope !== ANY ? ` (${lieSlope})` : ''}.
            </Text>
          ) : (
            <DispersionPlot points={points} stats={stats} />
          )}
        </Card>
        <View style={{ height: 12 }} />

        <Card label="Pattern summary">
          {stats ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
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
            <Text style={{ color: '#888880', fontSize: 13 }}>
              Need at least 5 shots with aim and landing coords to compute a pattern.
            </Text>
          )}
        </Card>

        {stats && (
          <View
            style={{
              backgroundColor: '#E1F5EE',
              borderRadius: 10,
              padding: 14,
              marginTop: 12,
            }}
          >
            <Text
              style={{
                color: '#0F6E56',
                fontSize: 11,
                fontWeight: '500',
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              Aim correction
            </Text>
            <Text style={{ color: '#0F6E56', fontSize: 13 }}>
              {getAimCorrection(stats)}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

function Card({
  label,
  children,
}: {
  label?: string
  children: React.ReactNode
}) {
  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderWidth: 0.5,
        borderColor: '#E4E4E0',
        borderRadius: 10,
        padding: 12,
      }}
    >
      {label && (
        <Text
          style={{
            color: '#888880',
            fontSize: 11,
            fontWeight: '500',
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          {label}
        </Text>
      )}
      {children}
    </View>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ minWidth: 110 }}>
      <Text style={{ color: '#888880', fontSize: 11 }}>{label}</Text>
      <Text
        style={{
          color: '#111111',
          fontSize: 13,
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
                paddingVertical: 7,
                borderRadius: 7,
                backgroundColor: active ? '#E1F5EE' : '#F4F4F0',
                borderWidth: 0.5,
                borderColor: active ? '#1D9E75' : '#E0E0DA',
              }}
            >
              <Text
                style={{
                  color: active ? '#0F6E56' : '#111111',
                  fontSize: 11,
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
  if (result === 'solid') return { fill: '#1D9E75', opacity: 0.7 }
  if (result === 'push_right' || result === 'pull_left')
    return { fill: '#EF9F27', opacity: 0.7 }
  if (result === undefined) return { fill: '#888880', opacity: 0.5 }
  return { fill: '#E24B4A', opacity: 0.8 }
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
      <Rect x={0} y={0} width={size} height={size} fill="#F8F8F6" rx={8} ry={8} />
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
      <Line x1={cx} y1={0} x2={cx} y2={size} stroke="#D0D0CA" strokeWidth={1} />
      <Line x1={0} y1={cy} x2={size} y2={cy} stroke="#D0D0CA" strokeWidth={1} />

      {stats && (
        <>
          <Ellipse
            cx={px(stats.avgLateralOffset)}
            cy={py(stats.avgDistanceOffset)}
            rx={stats.cone95.lateral * scale}
            ry={stats.cone95.distance * scale}
            fill="rgba(29,158,117,0.08)"
            stroke="#1D9E75"
            strokeDasharray="5 4"
            strokeWidth={1}
          />
          <Ellipse
            cx={px(stats.avgLateralOffset)}
            cy={py(stats.avgDistanceOffset)}
            rx={stats.cone68.lateral * scale}
            ry={stats.cone68.distance * scale}
            fill="rgba(29,158,117,0.15)"
            stroke="#1D9E75"
            strokeDasharray="4 3"
            strokeWidth={1}
          />
        </>
      )}

      <Circle cx={cx} cy={cy} r={3} fill="#1D9E75" />
      <SvgText x={cx + 6} y={cy + 14} fontSize={9} fill="#1D9E75">
        target
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

      <SvgText x={cx + 6} y={12} fontSize={9} fill="#888880">
        long
      </SvgText>
      <SvgText x={cx + 6} y={size - 4} fontSize={9} fill="#888880">
        short
      </SvgText>
      <SvgText x={4} y={cy - 4} fontSize={9} fill="#888880">
        L
      </SvgText>
      <SvgText x={size - 12} y={cy - 4} fontSize={9} fill="#888880">
        R
      </SvgText>
    </Svg>
  )
}
