import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native'
import { VictoryAxis, VictoryChart, VictoryLine } from 'victory-native'
import Svg, { Line as SvgLine } from 'react-native-svg'
import {
  computeDetailedStats,
  DEFAULT_HANDICAP,
  formatSG,
  sgStandouts,
  YARDS_TO_METERS,
  type ApproachBandStat,
  type DetailedRound,
  type DetailedStats,
  type SGAverages,
} from '@oga/core'
import { getRoundsWithDetails } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useUnits } from '../../hooks/useUnits'
import { AppBar } from '../../components/ui/AppBar'
import { TYPE } from '../../lib/typography'

const N_OPTIONS = [5, 10, 20] as const
// Short labels for the standout callout, keyed to SGAverages (camelCase);
// kept identical to the web stats page so the prose reads the same. #522
const SG_STANDOUT_LABEL: Record<keyof SGAverages, string> = {
  offTee: 'Off tee',
  approach: 'Approach',
  aroundGreen: 'Around green',
  putting: 'Putting',
}
// Pin x-axis to chart bottom regardless of where y=0 falls in domain.
const CHART_HEIGHT = 260
const CHART_BOTTOM = 28

const SERIES = [
  { key: 'sg_off_tee', label: 'Off tee', color: '#1F3D2C', dash: '0' },
  { key: 'sg_approach', label: 'Approach', color: '#A33A2A', dash: '6,3' },
  { key: 'sg_around_green', label: 'Around green', color: '#A66A1F', dash: '2,3' },
  { key: 'sg_putting', label: 'Putting', color: '#1C211C', dash: '6,3,2,3' },
] as const

const KICKER: import('react-native').TextStyle = {
  ...TYPE.kicker,
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

export default function Stats() {
  const { user } = useAuth()
  const [n, setN] = useState<number>(10)
  const [rounds, setRounds] = useState<DetailedRound[]>([])
  const [loading, setLoading] = useState(true)
  const { width: screenWidth } = useWindowDimensions()
  const { unit, toDisplay } = useUnits()

  useEffect(() => {
    if (!user) return
    let active = true
    setLoading(true)
    getRoundsWithDetails(supabase, user.id, n).then(({ data, error }) => {
      if (!active) return
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[stats/getRoundsWithDetails]', error.message)
      }
      setRounds((data as unknown as DetailedRound[] | null) ?? [])
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [user?.id, n])

  const avgs = useMemo(
    () =>
      SERIES.map((s) => {
        const values = rounds.map((r) => r[s.key]).filter((v): v is number => v !== null)
        const a = values.length === 0 ? 0 : values.reduce((x, y) => x + y, 0) / values.length
        return { ...s, value: a }
      }),
    [rounds],
  )

  // Pre-build the chart series once per rounds change. The inline
  // ordered.map(...) inside <VictoryLine> previously rebuilt every
  // chart-data array on every parent render (window resize, focus,
  // etc.) and Victory then re-tessellated the lines.
  // Skip rounds with null SG for a category — coercing null → 0
  // here would anchor the line at zero on rounds where that
  // category wasn't logged, and the by-the-numbers averages
  // (which filter nulls) would no longer match what's drawn.
  // Cumulative running average per category. Each point = average of all
  // rounds up to and including that date, so the rightmost point matches
  // the card value exactly.
  const chartSeries = useMemo(() => {
    const ordered = [...rounds].reverse()
    return SERIES.map((s) => ({
      key: s.key,
      color: s.color,
      dash: s.dash,
      data: ordered.flatMap((r) => {
        const v = r[s.key]
        return v == null ? [] : [{ x: new Date(r.played_at).getTime(), y: v }]
      }),
    }))
  }, [rounds])

  const stats: DetailedStats | null = useMemo(
    () => (rounds.length > 0 ? computeDetailedStats(rounds, DEFAULT_HANDICAP) : null),
    [rounds],
  )

  return (
    <View style={{ flex: 1, backgroundColor: '#F2EEE5' }}>
      <AppBar
        eyebrow="Performance"
        title="Strokes Gained"
        right={
          <View
            style={{
              flexDirection: 'row',
              borderWidth: 1,
              borderColor: 'rgba(242,238,229,0.25)',
            }}
          >
            {N_OPTIONS.map((opt, i) => {
              const active = n === opt
              return (
                <Pressable
                  key={opt}
                  onPress={() => setN(opt)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    backgroundColor: active ? '#1F3D2C' : 'transparent',
                    borderLeftWidth: i === 0 ? 0 : 1,
                    borderColor: 'rgba(242,238,229,0.25)',
                  }}
                >
                  <Text
                    style={[TYPE.bodyBold, {
                      color: active ? '#F2EEE5' : 'rgba(242,238,229,0.6)',
                      fontSize: 11,
                      fontWeight: '600',
                      letterSpacing: 0.3,
                    }]}
                  >
                    L{opt}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        }
      />

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        {loading ? (
          <Text style={[TYPE.body, { color: '#8A8B7E', fontSize: 13 }]}>Loading…</Text>
        ) : rounds.length === 0 ? (
          <View
            style={{
              backgroundColor: '#FBF8F1',
              borderWidth: 1,
              borderColor: '#D9D2BF',
              borderRadius: 4,
              padding: 22,
            }}
          >
            <Text
              style={[TYPE.serif, {
                color: '#1C211C',
                fontSize: 22,
                fontStyle: 'italic',
                fontWeight: '500',
              }]}
            >
              No rounds yet.
            </Text>
            <Text
              style={[TYPE.body, {
                color: '#5C6356',
                fontSize: 14,
                marginTop: 8,
                lineHeight: 20,
              }]}
            >
              Finalize a round to see SG trends per category.
            </Text>
          </View>
        ) : (
          <>
            {stats &&
              (() => {
                const { weakest, strongest } = sgStandouts(stats.sg)
                if (!weakest) return null
                const showStrength =
                  strongest != null &&
                  strongest.key !== weakest.key &&
                  strongest.value > 0
                const leak =
                  weakest.value < 0
                    ? `Your biggest leak is ${SG_STANDOUT_LABEL[weakest.key]} — ${formatSG(weakest.value)} a round.`
                    : `Your softest area is ${SG_STANDOUT_LABEL[weakest.key]} (${formatSG(weakest.value)} a round).`
                const strength = showStrength
                  ? ` ${SG_STANDOUT_LABEL[strongest.key]} is a strength, ${formatSG(strongest.value)} a round.`
                  : ''
                return (
                  <View
                    style={{
                      borderLeftWidth: 2,
                      borderColor: '#1F3D2C',
                      paddingLeft: 14,
                      marginBottom: 22,
                    }}
                  >
                    <Text
                      style={[TYPE.serif, {
                        color: '#1C211C',
                        fontSize: 17,
                        fontStyle: 'italic',
                        fontWeight: '500',
                        lineHeight: 24,
                      }]}
                    >
                      {leak}
                      {strength}
                    </Text>
                  </View>
                )
              })()}

            <Section kicker={`Avg — last ${rounds.length} rounds`}>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 14,
                }}
              >
                {avgs.map((s) => (
                  <View
                    key={s.key}
                    style={{
                      width: '47%',
                      backgroundColor: '#FBF8F1',
                      borderWidth: 1,
                      borderColor: '#D9D2BF',
                      borderRadius: 4,
                      padding: 14,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      <View
                        style={{
                          width: 10,
                          height: 2,
                          backgroundColor: s.color,
                        }}
                      />
                      <Text style={KICKER}>{s.label}</Text>
                    </View>
                    <Text
                      style={[TYPE.serif, {
                        fontSize: 26,
                        fontStyle: 'italic',
                        fontWeight: '500',
                        color:
                          s.value > 0
                            ? '#1F3D2C'
                            : s.value < 0
                              ? '#A33A2A'
                              : '#5C6356',
                        fontVariant: ['tabular-nums'],
                      }]}
                    >
                      {formatSG(s.value)}
                    </Text>
                  </View>
                ))}
              </View>
            </Section>

            <Section kicker={`SG trend — last ${rounds.length} rounds`}>
              <VictoryChart
                height={CHART_HEIGHT}
                width={screenWidth - 36}
                padding={{ top: 16, right: 12, bottom: CHART_BOTTOM, left: 32 }}
              >
                <VictoryAxis
                  offsetY={CHART_BOTTOM}
                  tickFormat={(t) =>
                    new Date(t).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })
                  }
                  style={{
                    axis: { stroke: '#D9D2BF' },
                    tickLabels: { fontSize: 9, fill: '#8A8B7E' },
                    grid: { stroke: 'transparent' },
                  }}
                />
                <VictoryAxis
                  dependentAxis
                  tickValues={[-1.5, -1, -0.5, 0, 0.5, 1, 1.5]}
                  style={{
                    axis: { stroke: '#D9D2BF' },
                    tickLabels: { fontSize: 9, fill: '#8A8B7E' },
                    grid: { stroke: '#EBE5D6' },
                  }}
                />
                {/* Zero reference line */}
                {(chartSeries[0]?.data.length ?? 0) >= 2 && (
                  <VictoryLine
                    data={[
                      { x: chartSeries[0]!.data[0]!.x, y: 0 },
                      { x: chartSeries[0]!.data[chartSeries[0]!.data.length - 1]!.x, y: 0 },
                    ]}
                    style={{ data: { stroke: '#9F9580', strokeWidth: 1, strokeDasharray: '3,3' } }}
                  />
                )}
                {chartSeries.map((s) => (
                  <VictoryLine
                    key={s.key}
                    data={s.data}
                    interpolation="monotoneX"
                    style={{
                      data: {
                        stroke: s.color,
                        strokeWidth: 1.5,
                        strokeDasharray: s.dash,
                      },
                    }}
                  />
                ))}
              </VictoryChart>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 14,
                  marginTop: 8,
                }}
              >
                {SERIES.map((s) => (
                  <View
                    key={s.key}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  >
                    <Svg width={16} height={4}>
                      <SvgLine
                        x1={0}
                        y1={2}
                        x2={16}
                        y2={2}
                        stroke={s.color}
                        strokeWidth={1.5}
                        strokeDasharray={s.dash}
                      />
                    </Svg>
                    <Text style={[TYPE.body, { color: '#5C6356', fontSize: 11 }]}>
                      {s.label}
                    </Text>
                  </View>
                ))}
              </View>
            </Section>

            {stats && (
              <Section kicker="Scoring">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                  <StatTile label="Avg score" value={fmtNum(stats.scoring.avgScore, 1)} />
                  <StatTile label="Par 3 avg" value={fmtNum(stats.scoring.avgPar3, 2)} />
                  <StatTile label="Par 4 avg" value={fmtNum(stats.scoring.avgPar4, 2)} />
                  <StatTile label="Par 5 avg" value={fmtNum(stats.scoring.avgPar5, 2)} />
                  <StatTile label="Front 9" value={fmtNum(stats.scoring.front9Avg, 1)} />
                  <StatTile label="Back 9" value={fmtNum(stats.scoring.back9Avg, 1)} />
                  <StatTile label="Best round" value={fmtInt(stats.scoring.bestRound)} />
                  <StatTile label="Worst round" value={fmtInt(stats.scoring.worstRound)} />
                </View>
                <ScoringDistBar
                  slices={stats.scoringDistribution.slices}
                  total={stats.scoringDistribution.total}
                />
              </Section>
            )}

            {stats && (
              <Section kicker="Ball striking">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  <StatTile label="Fairways" value={fmtPct(stats.ballStriking.fairwayPct)} />
                  <StatTile label="GIR" value={fmtPct(stats.ballStriking.girPct)} />
                  <StatTile
                    label="Drive avg"
                    value={stats.ballStriking.drivingDistanceAvg != null ? toDisplay(stats.ballStriking.drivingDistanceAvg) : '—'}
                  />
                  <StatTile
                    label="Proximity"
                    value={stats.ballStriking.proximityAvg != null ? toDisplay(stats.ballStriking.proximityAvg, 1) : '—'}
                  />
                </View>
              </Section>
            )}

            {stats && (
              <Section kicker="Short game">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  <StatTile label="Putts/round" value={fmtNum(stats.shortGame.puttsPerRound, 1)} />
                  <StatTile label="Putts/GIR" value={fmtNum(stats.shortGame.puttsPerGir, 2)} />
                  <StatTile label="3-putt rate" value={fmtPct(stats.shortGame.threePuttPct)} />
                  <StatTile label="Up & down" value={fmtPct(stats.shortGame.upAndDownPct)} />
                  <StatTile label="Scrambling" value={fmtPct(stats.shortGame.scramblingPct)} />
                  <StatTile label="Sand save" value={fmtPct(stats.shortGame.sandSavePct)} />
                </View>
              </Section>
            )}

            {stats && (
              <Section kicker="Patterns">
                <Subkicker>Miss tendency</Subkicker>
                {stats.missTendency.length === 0 ? (
                  <Insufficient note="Need shot results logged to detect a tendency." />
                ) : (
                  <View style={{ borderTopWidth: 1, borderColor: '#D9D2BF' }}>
                    {stats.missTendency.map((e) => (
                      <StatRow
                        key={e.result}
                        label={e.result.replace(/_/g, ' ')}
                        sub={`${e.count} shots`}
                        value={`${e.pct.toFixed(0)}%`}
                      />
                    ))}
                  </View>
                )}

                <Subkicker style={{ marginTop: 18 }}>Most costly lies</Subkicker>
                {stats.costlyLies.length === 0 ? (
                  <Insufficient note="Need ≥5 shots per lie type with results." />
                ) : (
                  <View style={{ borderTopWidth: 1, borderColor: '#D9D2BF' }}>
                    {stats.costlyLies.slice(0, 5).map((e) => (
                      <StatRow
                        key={e.lie}
                        label={e.lie.replace(/_/g, ' ')}
                        sub={`${e.shots} shots`}
                        value={e.avgQuality.toFixed(2)}
                        valueColor={e.avgQuality < 0 ? '#A33A2A' : '#5C6356'}
                      />
                    ))}
                  </View>
                )}

                <Subkicker style={{ marginTop: 18 }}>Club accuracy</Subkicker>
                {stats.clubAccuracy.length === 0 ? (
                  <Insufficient note="Need shots with start, aim, and end coords (≥3 per club)." />
                ) : (
                  <View style={{ flexDirection: 'row', gap: 14 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...KICKER, marginBottom: 8 }}>Most accurate</Text>
                      <View style={{ borderTopWidth: 1, borderColor: '#D9D2BF' }}>
                        {stats.clubAccuracy.slice(0, 5).map((e) => (
                          <StatRow
                            key={e.club}
                            label={e.club.toUpperCase()}
                            sub={`${e.shots} shots`}
                            value={toDisplay(e.avgLateralYards, 1)}
                          />
                        ))}
                      </View>
                    </View>
                    {stats.clubAccuracy.length > 5 && (
                      <View style={{ flex: 1 }}>
                        <Text style={{ ...KICKER, marginBottom: 8 }}>Least accurate</Text>
                        <View style={{ borderTopWidth: 1, borderColor: '#D9D2BF' }}>
                          {[...stats.clubAccuracy].reverse().slice(0, 5).map((e) => (
                            <StatRow
                              key={e.club}
                              label={e.club.toUpperCase()}
                              sub={`${e.shots} shots`}
                              value={toDisplay(e.avgLateralYards, 1)}
                            />
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                )}

                <Subkicker style={{ marginTop: 18 }}>Slope impact</Subkicker>
                {stats.slopeImpact.forward.length === 0 && stats.slopeImpact.side.length === 0 ? (
                  <Insufficient note="Need shots with slope logged (≥3 per type)." />
                ) : (
                  <View style={{ flexDirection: 'row', gap: 14 }}>
                    {stats.slopeImpact.forward.length > 0 && (
                      <View style={{ flex: 1 }}>
                        <Text style={{ ...KICKER, marginBottom: 8 }}>Forward</Text>
                        <View style={{ borderTopWidth: 1, borderColor: '#D9D2BF' }}>
                          {stats.slopeImpact.forward.map((e) => (
                            <StatRow
                              key={e.slope}
                              label={e.slope.replace(/_/g, ' ')}
                              sub={`${e.shots} shots`}
                              value={e.avgQuality.toFixed(2)}
                              valueColor={e.avgQuality < 0 ? '#A33A2A' : '#5C6356'}
                            />
                          ))}
                        </View>
                      </View>
                    )}
                    {stats.slopeImpact.side.length > 0 && (
                      <View style={{ flex: 1 }}>
                        <Text style={{ ...KICKER, marginBottom: 8 }}>Side</Text>
                        <View style={{ borderTopWidth: 1, borderColor: '#D9D2BF' }}>
                          {stats.slopeImpact.side.map((e) => (
                            <StatRow
                              key={e.slope}
                              label={e.slope.replace(/_/g, ' ')}
                              sub={`${e.shots} shots`}
                              value={e.avgQuality.toFixed(2)}
                              valueColor={e.avgQuality < 0 ? '#A33A2A' : '#5C6356'}
                            />
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                )}

                <Subkicker style={{ marginTop: 18 }}>Recovery from rough</Subkicker>
                {stats.recovery.totalRoughShots === 0 ? (
                  <Insufficient note="Need rough shots logged to compute recovery rate." />
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                    <StatTile label="Recovery rate" value={fmtPct(stats.recovery.recoveryPct)} />
                    <StatTile label="Rough shots" value={String(stats.recovery.totalRoughShots)} />
                  </View>
                )}
              </Section>
            )}
          </>
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
    <View style={{ marginBottom: 28 }}>
      <View
        style={{
          borderTopWidth: 1,
          borderColor: '#D9D2BF',
          paddingTop: 14,
          marginBottom: 14,
        }}
      >
        <Text style={KICKER}>{kicker}</Text>
      </View>
      {children}
    </View>
  )
}

function Subkicker({ children, style }: { children: React.ReactNode; style?: import('react-native').ViewStyle }) {
  return (
    <View style={style}>
      <Text style={{ ...KICKER, marginBottom: 8 }}>{children}</Text>
    </View>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        width: '47%',
        backgroundColor: '#FBF8F1',
        borderWidth: 1,
        borderColor: '#D9D2BF',
        borderRadius: 4,
        padding: 12,
      }}
    >
      <Text style={{ ...KICKER, marginBottom: 6 }}>{label}</Text>
      <Text
        style={[TYPE.serif, {
          color: '#1C211C',
          fontSize: 20,
          fontStyle: 'italic',
          fontWeight: '500',
          fontVariant: ['tabular-nums'],
        }]}
      >
        {value}
      </Text>
    </View>
  )
}

function StatRow({
  label,
  sub,
  value,
  valueColor = '#1C211C',
}: {
  label: string
  sub: string
  value: string
  valueColor?: string
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderColor: '#D9D2BF',
        paddingVertical: 10,
      }}
    >
      <Text
        style={[TYPE.body, {
          color: '#1C211C',
          fontSize: 15,
          fontWeight: '500',
          textTransform: 'capitalize',
          flex: 1,
        }]}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
        <Text style={{ ...KICKER, color: '#8A8B7E' }}>{sub}</Text>
        <Text
          style={[TYPE.serif, {
            color: valueColor,
            fontSize: 20,
            fontStyle: 'italic',
            fontWeight: '500',
            fontVariant: ['tabular-nums'],
          }]}
        >
          {value}
        </Text>
      </View>
    </View>
  )
}

function ScoringDistBar({
  slices,
  total,
}: {
  slices: import('@oga/core').ScoringDistributionSlice[]
  total: number
}) {
  if (total === 0) return <Insufficient note="Need scored holes to plot the distribution." />
  const visible = slices.filter((s) => s.count > 0)
  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          height: 44,
          borderWidth: 1,
          borderColor: '#D9D2BF',
          borderRadius: 4,
          overflow: 'hidden',
          marginBottom: 10,
        }}
      >
        {visible.map((s) => (
          <View key={s.key} style={{ flex: s.count, backgroundColor: s.color, justifyContent: 'center', alignItems: 'center' }}>
            {s.pct >= 8 && (
              <Text style={[TYPE.body, { color: '#F2EEE5', fontSize: 11, fontWeight: '500', fontVariant: ['tabular-nums'] }]}>
                {s.pct.toFixed(0)}%
              </Text>
            )}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {slices.map((s) => (
          <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, backgroundColor: s.color, borderRadius: 2 }} />
            <Text style={[TYPE.body, { color: '#5C6356', fontSize: 11 }]}>
              {s.label} {s.count} · {s.pct.toFixed(1)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function Insufficient({ note }: { note: string }) {
  return (
    <Text style={[TYPE.bodyItalic, { color: '#8A8B7E', fontSize: 13, fontStyle: 'italic', marginBottom: 8 }]}>
      {note}
    </Text>
  )
}

function fmtNum(v: number | null, d: number): string {
  return v != null ? v.toFixed(d) : '—'
}

function fmtInt(v: number | null): string {
  return v != null ? String(Math.round(v)) : '—'
}

function fmtPct(v: number | null): string {
  return v != null ? `${v.toFixed(1)}%` : '—'
}
