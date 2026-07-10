import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native'
import Svg, { Circle, Ellipse, Line, Rect, Text as SvgText } from 'react-native-svg'
import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import {
  CLUBS,
  LIE_SLOPES,
  LIE_TYPES,
  YARDS_TO_METERS,
  clubDistanceStats,
  computeDispersion,
  computeDispersionStats,
  dispersionVerdict,
  filterDispersionByLie,
  getAimCorrection,
  type Club,
  type DispersionPoint,
  type DispersionStats,
  type DistanceUnit,
  type LieSlope,
  type LieType,
  type Shot,
} from '@oga/core'
import { getShotsByClub } from '@oga/supabase'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { PressableTouch } from '../../components/ui/PressableTouch'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useUnits } from '../../hooks/useUnits'
import { AppBar } from '../../components/ui/AppBar'
import { Entrance } from '../../components/ui/Entrance'
import { FONT, TYPE } from '../../lib/typography'

const KICKER: import('react-native').TextStyle = {
  ...TYPE.kicker,
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
  const { unit, toDisplay } = useUnits()
  const [club, setClub] = useState<Club>('7i')
  const [lieType, setLieType] = useState<LieType | typeof ANY>(ANY)
  const [lieSlope, setLieSlope] = useState<LieSlope | typeof ANY>(ANY)
  const [shots, setShots] = useState<ShotRowMin[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    let active = true
    setLoading(true)
    getShotsByClub(supabase, user.id, club).then(({ data, error }) => {
      if (!active) return
      if (error) {
        // eslint-disable-next-line no-console -- dev diagnostic; mobile has no logger/toast primitive
        console.error('[patterns/getShotsByClub]', error.message)
      }
      setShots((data as ShotRowMin[] | null) ?? [])
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [user?.id, club])

  const points = useMemo(() => {
    let pts = computeDispersion(shots.map(rowToShot))
    if (lieType !== ANY || lieSlope !== ANY) {
      pts = filterDispersionByLie(pts, {
        lieSlope: lieSlope === ANY ? undefined : lieSlope,
        lieType: lieType === ANY ? undefined : lieType,
      })
    }
    return pts
  }, [shots, lieType, lieSlope])

  const stats = useMemo(() => computeDispersionStats(points), [points])

  // Total distance for the selected club (across all its shots, not the
  // lie-filtered dispersion set). null until there are tracked shots.
  const clubDist = useMemo(() => clubDistanceStats(shots)[0] ?? null, [shots])

  const shareCardRef = useRef<View>(null)
  const [sharing, setSharing] = useState(false)

  // Capture the off-screen 1200×630 share card and hand it to the native
  // share sheet via expo-sharing — same path as the scorecard share.
  async function handleShare() {
    if (sharing || !shareCardRef.current) return
    setSharing(true)
    try {
      const uri = await captureRef(shareCardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      })
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing unavailable', 'This device cannot share files.')
        return
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share shot pattern',
      })
    } catch (err) {
      // eslint-disable-next-line no-console -- dev diagnostic; the user sees the Alert below
      console.error('[patterns/share]', err)
      Alert.alert('Share failed', (err as Error).message)
    } finally {
      setSharing(false)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F2EEE5' }}>
      <AppBar eyebrow={`Club ${club}`} title="Shot Patterns" />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        <Entrance index={0}>
        <Section kicker="Club">
          <ChipRow
            value={club}
            options={CLUBS}
            onChange={(v) => v && setClub(v)}
          />
        </Section>
        </Entrance>

        <Entrance index={1}>
        <Section kicker="Lie type">
          <ChipRow
            value={lieType}
            options={[ANY, ...LIE_TYPES] as const}
            onChange={(v) => setLieType(v as LieType | typeof ANY)}
            labelFor={(v) => (v === ANY ? 'any' : (v as string).replace(/_/g, ' '))}
          />
        </Section>
        </Entrance>

        <Entrance index={2}>
        <Section kicker="Lie slope">
          <ChipRow
            value={lieSlope}
            options={[ANY, ...LIE_SLOPES] as const}
            onChange={(v) => setLieSlope(v as LieSlope | typeof ANY)}
            labelFor={(v) => (v === ANY ? 'any' : (v as string).replace(/_/g, ' '))}
          />
        </Section>
        </Entrance>

        <Entrance index={3}>
        <Section kicker="Pattern">
          {loading ? (
            <Text style={[TYPE.body, { color: '#8A8B7E', fontSize: 13 }]}>Loading…</Text>
          ) : points.length === 0 ? (
            <Text style={[TYPE.body, { color: '#8A8B7E', fontSize: 13 }]}>
              No shots yet for {club}
              {lieType !== ANY ? ` (${lieType})` : ''}
              {lieSlope !== ANY ? ` (${lieSlope})` : ''}.
            </Text>
          ) : (
            <>
              <DispersionPlot points={points} stats={stats} />
              <PatternLegend hasStats={!!stats} />
              {stats && (
                <PressableTouch
                  accessibilityRole="button"
                  accessibilityLabel="Export shot pattern image"
                  accessibilityState={{ disabled: sharing }}
                  onPress={handleShare}
                  disabled={sharing}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  android_ripple={{ color: 'rgba(31,61,44,0.12)' }}
                  style={{
                    alignSelf: 'flex-start',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 7,
                    marginTop: 22,
                    marginBottom: 4,
                    paddingVertical: 11,
                    paddingHorizontal: 16,
                    backgroundColor: '#EBE5D6',
                    borderWidth: 1,
                    borderColor: '#1F3D2C',
                    borderRadius: 2,
                    // Disabled-while-sharing dim; PressableTouch adds the
                    // iOS press dim on top.
                    opacity: sharing ? 0.6 : 1,
                  }}
                >
                  <MaterialCommunityIcons
                    name="tray-arrow-down"
                    size={15}
                    color="#1F3D2C"
                  />
                  {/* fontSize +1 over the 10px KICKER: deliberate, this is a
                      tappable action label beside an icon, not a section eyebrow. */}
                  <Text style={{ ...KICKER, color: '#1F3D2C', fontSize: 11 }}>
                    {sharing ? 'Rendering…' : 'Export image'}
                  </Text>
                </PressableTouch>
              )}
            </>
          )}
        </Section>
        </Entrance>

        <Entrance index={4}>
        <Section kicker="Pattern summary">
          {clubDist && (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 18,
                marginBottom: 18,
              }}
            >
              <Stat label="Avg distance" value={toDisplay(clubDist.avg)} />
              <Stat
                label="Range"
                value={`${Math.round(unit === 'meters' ? clubDist.min * YARDS_TO_METERS : clubDist.min)}–${Math.round(unit === 'meters' ? clubDist.max * YARDS_TO_METERS : clubDist.max)}`}
              />
            </View>
          )}
          {stats ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18 }}>
              <Stat label="Sample" value={`${stats.sampleSize} shots`} />
              <Stat
                label="Avg lateral"
                value={toDisplay(stats.avgLateralOffset, 1)}
              />
              <Stat
                label="Distance bias"
                value={toDisplay(stats.avgDistanceOffset, 1)}
              />
              <Stat label="Shape" value={stats.shotShape} />
              <Stat label="Dominant miss" value={stats.dominantMiss} />
              <Stat
                label="68% spread"
                value={`±${toDisplay(stats.cone68.lateral, 1)} / ${toDisplay(stats.cone68.distance, 1)}`}
              />
            </View>
          ) : (
            <Text
              style={[TYPE.bodyItalic, {
                color: '#1C211C',
                fontSize: 15,
                lineHeight: 22,
              }]}
            >
              Need at least <Text style={[TYPE.bodyItalic, { fontWeight: '500' }]}>five shots</Text>{' '}
              with aim and landing coords to compute a pattern.
            </Text>
          )}
        </Section>
        </Entrance>

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
              style={[TYPE.body, {
                color: '#1C211C',
                fontSize: 15,
                lineHeight: 22,
              }]}
            >
              {getAimCorrection(stats, unit)}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Off-screen render target for react-native-view-shot. Laid out
          far off the left edge so it's never visible; collapsable={false}
          keeps RN from optimising out the subtree the rasteriser reads. */}
      {stats && (
        <View
          pointerEvents="none"
          collapsable={false}
          style={{ position: 'absolute', left: -10000, top: 0 }}
        >
          <View ref={shareCardRef} collapsable={false}>
            <ShotPatternsShareCard
              points={points}
              stats={stats}
              club={club}
              unit={unit}
              toDisplay={toDisplay}
            />
          </View>
        </View>
      )}
    </View>
  )
}

// Off-screen 1200×630 social share card — mobile parity of the web card
// (apps/web ShotPatternsShareCard). Captured via react-native-view-shot.
// Stats only — no username, email, or avatar.
const SHARE_C = {
  bg: '#FBF8F1',
  surface: '#F2EEE5',
  line: '#D9D2BF',
  ink: '#1C211C',
  inkDim: '#5C6356',
  inkMute: '#8A8B7E',
  accent: '#1F3D2C',
} as const

const SHARE_KICKER: import('react-native').TextStyle = {
  ...TYPE.kicker,
  fontWeight: '500',
  letterSpacing: 2,
  textTransform: 'uppercase',
}

function ShotPatternsShareCard({
  points,
  stats,
  club,
  unit,
  toDisplay,
}: {
  points: DispersionPoint[]
  stats: DispersionStats
  club: Club
  unit: DistanceUnit
  toDisplay: (yards: number, decimals?: number) => string
}) {
  const c = SHARE_C
  return (
    <View
      style={{
        width: 1200,
        height: 630,
        backgroundColor: c.bg,
        paddingVertical: 44,
        paddingHorizontal: 56,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          paddingBottom: 22,
          borderBottomWidth: 1,
          borderColor: c.line,
        }}
      >
        <View>
          <Text
            style={{ ...SHARE_KICKER, fontSize: 14, color: c.inkMute, marginBottom: 8 }}
          >
            Open Golf App
          </Text>
          <Text
            style={{
              ...TYPE.serif,
              fontWeight: '500',
              fontSize: 44,
              color: c.ink,
            }}
          >
            OGA
          </Text>
        </View>
        <Text style={{ ...SHARE_KICKER, fontSize: 14, color: c.inkMute }}>
          Shot Pattern
        </Text>
      </View>

      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 48,
          paddingVertical: 16,
        }}
      >
        <View
          style={{
            padding: 14,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.line,
            borderRadius: 4,
          }}
        >
          <DispersionPlot points={points} stats={stats} size={350} />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={{ ...SHARE_KICKER, fontSize: 15, color: c.inkMute, marginBottom: 10 }}
          >
            {club}
          </Text>
          <Text
            style={{
              ...TYPE.serifUpright,
              fontWeight: '500',
              fontSize: 46,
              color: c.ink,
              marginBottom: 30,
            }}
          >
            {dispersionVerdict(stats)}
          </Text>
          <View style={{ flexDirection: 'row', gap: 40, marginBottom: 30 }}>
            <ShareStat label="Sample" value={`${stats.sampleSize} shots`} c={c} />
            <ShareStat
              label="68% spread"
              value={`±${toDisplay(stats.cone68.lateral, 1)} / ${toDisplay(stats.cone68.distance, 1)}`}
              c={c}
            />
            <ShareStat label="Dominant miss" value={stats.dominantMiss} c={c} />
          </View>
          <Text
            style={{
              ...TYPE.serifUpright,
              fontSize: 22,
              lineHeight: 33,
              color: c.inkDim,
            }}
          >
            {getAimCorrection(stats, unit)}
          </Text>
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 20,
          borderTopWidth: 1,
          borderColor: c.line,
        }}
      >
        <Text style={{ ...SHARE_KICKER, fontSize: 15, color: c.accent }}>oga.golf</Text>
        <Text style={{ ...SHARE_KICKER, fontSize: 13, color: c.inkMute }}>
          Free forever · no paywalls
        </Text>
      </View>
    </View>
  )
}

function ShareStat({
  label,
  value,
  c,
}: {
  label: string
  value: string
  c: typeof SHARE_C
}) {
  return (
    <View>
      <Text style={{ ...SHARE_KICKER, fontSize: 12, color: c.inkMute, marginBottom: 6 }}>
        {label}
      </Text>
      <Text
        style={{
          ...TYPE.serifUpright,
          fontWeight: '500',
          fontSize: 26,
          color: c.ink,
        }}
      >
        {value}
      </Text>
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
        style={[TYPE.serifUpright, {
          color: '#1C211C',
          fontSize: 17,
          fontWeight: '500',
          textTransform: 'capitalize',
          fontVariant: ['tabular-nums'],
        }]}
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
                style={[TYPE.body, {
                  color: active ? '#F2EEE5' : '#1C211C',
                  fontSize: 12,
                  fontWeight: active ? '500' : '400',
                }]}
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

function PatternLegend({ hasStats }: { hasStats: boolean }) {
  return (
    <View style={{ marginTop: 12, gap: 6 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <LegendDot color="#1C211C" label="Solid" />
        <LegendDot color="#A66A1F" label="Push / pull" />
        <LegendDot color="#A33A2A" label="Miss" />
        <LegendDot color="#8A8B7E" label="Unspecified" />
      </View>
      {hasStats && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <LegendEllipse opacity={0.35} label="68% of shots" />
          <LegendEllipse opacity={0.10} label="95% of shots" />
        </View>
      )}
    </View>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
        }}
      />
      <Text style={[TYPE.body, { color: '#5C6356', fontSize: 11 }]}>{label}</Text>
    </View>
  )
}

function LegendEllipse({ opacity, label }: { opacity: number; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: 18,
          height: 12,
          borderRadius: 6,
          backgroundColor: `rgba(31,61,44,${opacity})`,
          borderWidth: 1,
          borderColor: '#1F3D2C',
        }}
      />
      <Text style={[TYPE.body, { color: '#1C211C', fontSize: 12 }]}>{label}</Text>
    </View>
  )
}

function DispersionPlot({
  points,
  stats,
  size: sizeProp,
}: {
  points: DispersionPoint[]
  stats: DispersionStats | null
  // Fixed size for the share card; omitted on-screen → responsive width.
  size?: number
}) {
  const { width: screenWidth } = useWindowDimensions()
  const size = sizeProp ?? Math.min(SVG_SIZE, screenWidth - 56)

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
      <SvgText x={cx + 6} y={cy + 14} fontSize={9} fill="#A66A1F" fontFamily={FONT.mono}>
        AIM
      </SvgText>

      {points.map((p) => {
        const c = pointColor(p.shotResult)
        return (
          <Circle
            key={p.id}
            cx={px(p.lateralOffsetYards)}
            cy={py(p.distanceOffsetYards)}
            r={3.5}
            fill={c.fill}
            fillOpacity={c.opacity}
          />
        )
      })}

      <SvgText x={cx + 6} y={12} fontSize={9} fill="#8A8B7E" fontFamily={FONT.mono}>
        LONG
      </SvgText>
      <SvgText x={cx + 6} y={size - 4} fontSize={9} fill="#8A8B7E" fontFamily={FONT.mono}>
        SHORT
      </SvgText>
      <SvgText x={4} y={cy - 4} fontSize={9} fill="#8A8B7E" fontFamily={FONT.mono}>
        L
      </SvgText>
      <SvgText x={size - 12} y={cy - 4} fontSize={9} fill="#8A8B7E" fontFamily={FONT.mono}>
        R
      </SvgText>
    </Svg>
  )
}
