import { useEffect, useMemo, useState } from 'react'
import { Linking, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native'
import Svg, { Line as SvgLine, Polyline, Text as SvgText } from 'react-native-svg'
import {
  clubDistanceStats,
  computeDetailedStats,
  DEFAULT_HANDICAP,
  formatClubLabel,
  formatSG,
  isPartialRound,
  roundHolesPlayed,
  sgStandouts,
  symmetricNiceTicks,
  YARDS_TO_METERS,
  type ApproachBandStat,
  type DetailedRound,
  type DetailedStats,
  type SGAverages,
  parseLocalDate,
} from '@oga/core'
import { getProfile, getRoundsWithDetails } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { getCached, setCached } from '../../lib/screenCache'
import { useUnits } from '../../hooks/useUnits'
import { AppBar } from '../../components/ui/AppBar'
import { Entrance } from '../../components/ui/Entrance'
import { HelpButton } from '../../components/help/HelpButton'
import { FONT, TYPE } from '../../lib/typography'
import { PaperTile, SectionHead, StatTile } from '../../components/paper/Section'
import { PaperSurface } from '../../components/paper/Paper'
import { FONT_CAP, P } from '../../components/paper/tokens'
import { StatsEmpty, StatsPartialOnly } from '../../components/stats/StatsPreview'

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

// Two stat tiles per row.
const TILE = { width: '47%' } as const

const SERIES = [
  { key: 'sg_off_tee', label: 'Off tee', color: '#1F3D2C', dash: '0' },
  { key: 'sg_approach', label: 'Approach', color: '#A33A2A', dash: '6,3' },
  { key: 'sg_around_green', label: 'Around green', color: '#A66A1F', dash: '2,3' },
  { key: 'sg_putting', label: 'Putting', color: '#1C211C', dash: '6,3,2,3' },
] as const

export default function Stats() {
  const { user } = useAuth()
  const [n, setN] = useState<number>(10)
  // Fetch the max window (L20) once and slice client-side per toggle — the
  // L5/L10/L20 chips used to refire the whole nested query (#599). Seeded
  // from the screen cache so a revisit renders instantly.
  const [allRounds, setAllRounds] = useState<DetailedRound[]>(
    () => getCached<DetailedRound[]>('stats:rounds') ?? [],
  )
  const [loading, setLoading] = useState(
    () => getCached<DetailedRound[]>('stats:rounds') == null,
  )
  // Player's handicap for SG baselines. Web (useDetailedStats) already uses
  // the profile value; hardcoding DEFAULT_HANDICAP here benchmarked every
  // player against the default bracket and made mobile disagree with web on
  // the same rounds (#673).
  const [handicap, setHandicap] = useState<number | null>(null)

  useEffect(() => {
    if (!user) return
    let active = true
    getProfile(supabase, user.id).then(({ data, error }) => {
      if (!active) return
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[stats/getProfile]', error.message)
      }
      setHandicap(
        (data as { handicap_index?: number | null } | null)?.handicap_index ??
          null,
      )
    })
    return () => {
      active = false
    }
  }, [user?.id])
  const { width: screenWidth } = useWindowDimensions()
  const { unit, toDisplay } = useUnits()

  useEffect(() => {
    if (!user) return
    let active = true
    // Spinner only on a cold cache — a cached render revalidates silently.
    if (getCached<DetailedRound[]>('stats:rounds') == null) setLoading(true)
    // 2× buffer so L20 can still reach 20 whole rounds past any partials;
    // a user with >20 partials in their last 40 gets a shorter L20.
    getRoundsWithDetails(supabase, user.id, 40).then(({ data, error }) => {
      if (!active) return
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[stats/getRoundsWithDetails]', error.message)
      }
      const rows = (data as unknown as DetailedRound[] | null) ?? []
      setAllRounds(rows)
      if (!error) setCached('stats:rounds', rows)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [user?.id])

  // The visible window runs back to the n-th most recent WHOLE round (#932).
  // Round-level numbers (SG cards, trend, headline) read only the whole
  // rounds; partials inside the span still feed per-hole stats, matching
  // computeDetailedStats' contract (packages/core/src/stats.ts).
  const rounds = useMemo(() => {
    let whole = 0
    const end = allRounds.findIndex((r) => !isPartialRound(r.hole_scores) && ++whole === n)
    return end === -1 ? allRounds : allRounds.slice(0, end + 1)
  }, [allRounds, n])
  const wholeRounds = useMemo(
    () => rounds.filter((r) => !isPartialRound(r.hole_scores)),
    [rounds],
  )

  const avgs = useMemo(
    () =>
      SERIES.map((s) => {
        const values = wholeRounds.map((r) => r[s.key]).filter((v): v is number => v !== null)
        const a = values.length === 0 ? 0 : values.reduce((x, y) => x + y, 0) / values.length
        return { ...s, value: a }
      }),
    [wholeRounds],
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
    const ordered = [...wholeRounds].reverse()
    return SERIES.map((s) => ({
      key: s.key,
      color: s.color,
      dash: s.dash,
      data: ordered.flatMap((r) => {
        const v = r[s.key]
        return v == null ? [] : [{ x: parseLocalDate(r.played_at).getTime(), y: v }]
      }),
    }))
  }, [wholeRounds])

  // Symmetric Y domain + ticks scaled to the actual data peak, so the axis
  // labels always match the plotted lines (a fixed [-1.5..1.5] tick set got
  // crammed into the middle once an outlier round blew out the auto-domain).
  const sgAxis = useMemo(
    () => symmetricNiceTicks(chartSeries.flatMap((s) => s.data.map((d) => d.y))),
    [chartSeries],
  )

  // Chart plot geometry. X domain spans every series' data — series skip
  // null rounds, so first/last x differ per series and a single-series
  // domain would clip the others.
  const chartWidth = screenWidth - 36
  const chartPad = { top: 16, right: 12, bottom: CHART_BOTTOM, left: 32 }
  const chartPlotW = chartWidth - chartPad.left - chartPad.right
  const chartPlotH = CHART_HEIGHT - chartPad.top - chartPad.bottom
  const chartAllX = chartSeries.flatMap((s) => s.data.map((d) => d.x))
  const chartXMin = chartAllX.length ? Math.min(...chartAllX) : 0
  const chartXMax = chartAllX.length ? Math.max(...chartAllX) : 1
  const chartXSpan = chartXMax - chartXMin || 1
  const chartYMax = sgAxis.max || 1
  const chartPx = (x: number) => chartPad.left + ((x - chartXMin) / chartXSpan) * chartPlotW
  const chartPy = (y: number) =>
    chartPad.top + (1 - (y + chartYMax) / (2 * chartYMax)) * chartPlotH

  // Per-club total distance (max/min/avg), from every tracked shot's
  // start→end across the loaded rounds.
  const clubDistances = useMemo(
    () =>
      clubDistanceStats(
        rounds.flatMap((r) => (r.hole_scores ?? []).flatMap((hs) => hs.shots ?? [])),
      ),
    [rounds],
  )

  const stats: DetailedStats | null = useMemo(
    () =>
      rounds.length > 0
        ? computeDetailedStats(rounds, handicap ?? DEFAULT_HANDICAP)
        : null,
    [rounds, handicap],
  )

  return (
    <PaperSurface style={{ flex: 1 }}>
      <AppBar
        eyebrow="Performance"
        title="Strokes Gained"
        right={
          <View style={{ alignItems: 'flex-end', gap: 10 }}>
            {/* "?" sits inline with the web link so the header keeps its
                two-row height (QA 2026-08 — a third stacked row grew the bar). */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <HelpButton topicId="stats" />
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Open the full dashboard on the web at oga.golf"
              onPress={() => Linking.openURL('https://oga.golf')}
              hitSlop={8}
            >
              <Text
                numberOfLines={1}
                style={[TYPE.body, {
                  color: 'rgba(242,238,229,0.4)',
                  fontSize: 11,
                  lineHeight: 16,
                }]}
              >
                Full dashboard → oga.golf ↗
              </Text>
            </Pressable>
            </View>
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
          </View>
        }
      />

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        {loading ? (
          <Text style={[TYPE.body, { color: '#8A8B7E', fontSize: 13 }]}>Loading…</Text>
        ) : rounds.length === 0 ? (
          <StatsEmpty />
        ) : wholeRounds.length === 0 ? (
          // Partial rounds only (#1078): the averages would read 0.00.
          <StatsPartialOnly
            holes={roundHolesPlayed(rounds[0]!.hole_scores)?.played ?? null}
            course={(rounds[0] as { courses?: { name: string } | null }).courses?.name ?? null}
          />
        ) : (
          <>
            {stats && <StandoutCallout sg={stats.sg} />}

            <Entrance index={0}>
            <Section title={`Avg — last ${wholeRounds.length} rounds`}>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 14,
                }}
              >
                {avgs.map((s) => (
                  <PaperTile key={s.key} style={{ width: '47%' }}>
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
                      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12 }]}>
                        {s.label}
                      </Text>
                    </View>
                    <Text
                      maxFontSizeMultiplier={FONT_CAP}
                      style={[TYPE.serif, {
                        fontSize: 26,
                        color:
                          s.value > 0
                            ? P.forest
                            : s.value < 0
                              ? P.neg
                              : P.inkDim,
                        fontVariant: ['tabular-nums'],
                      }]}
                    >
                      {formatSG(s.value)}
                    </Text>
                  </PaperTile>
                ))}
              </View>
            </Section>
            </Entrance>

            <Entrance index={1}>
            <Section title={`SG trend — last ${wholeRounds.length} rounds`}>
              <Svg width={chartWidth} height={CHART_HEIGHT}>
                {/* Y gridlines + tick labels */}
                {sgAxis.ticks.map((t) => (
                  <SvgLine
                    key={`g${t}`}
                    x1={chartPad.left}
                    x2={chartWidth - chartPad.right}
                    y1={chartPy(t)}
                    y2={chartPy(t)}
                    stroke="#EBE5D6"
                    strokeWidth={1}
                  />
                ))}
                {sgAxis.ticks.map((t) => (
                  <SvgText
                    key={`l${t}`}
                    x={chartPad.left - 6}
                    y={chartPy(t) + 3}
                    fontSize={9}
                    fontFamily={FONT.mono}
                    fill="#8A8B7E"
                    textAnchor="end"
                  >
                    {String(t)}
                  </SvgText>
                ))}
                {/* axes */}
                <SvgLine
                  x1={chartPad.left}
                  x2={chartWidth - chartPad.right}
                  y1={CHART_HEIGHT - chartPad.bottom}
                  y2={CHART_HEIGHT - chartPad.bottom}
                  stroke="#D9D2BF"
                  strokeWidth={1}
                />
                <SvgLine
                  x1={chartPad.left}
                  x2={chartPad.left}
                  y1={chartPad.top}
                  y2={CHART_HEIGHT - chartPad.bottom}
                  stroke="#D9D2BF"
                  strokeWidth={1}
                />
                {/* Zero reference line */}
                {chartSeries.some((s) => s.data.length >= 2) && (
                  <SvgLine
                    x1={chartPad.left}
                    x2={chartWidth - chartPad.right}
                    y1={chartPy(0)}
                    y2={chartPy(0)}
                    stroke="#9F9580"
                    strokeWidth={1}
                    strokeDasharray="3,3"
                  />
                )}
                {/* first/last date ticks, across the combined X domain */}
                {chartSeries.some((s) => s.data.length >= 2) && (
                  <>
                    <SvgText
                      x={chartPx(chartXMin)}
                      y={CHART_HEIGHT - chartPad.bottom + 14}
                      fontSize={9}
                      fontFamily={FONT.mono}
                      fill="#8A8B7E"
                      textAnchor="start"
                    >
                      {new Date(chartXMin).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </SvgText>
                    <SvgText
                      x={chartPx(chartXMax)}
                      y={CHART_HEIGHT - chartPad.bottom + 14}
                      fontSize={9}
                      fontFamily={FONT.mono}
                      fill="#8A8B7E"
                      textAnchor="end"
                    >
                      {new Date(chartXMax).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </SvgText>
                  </>
                )}
                {/* SG lines, one per category */}
                {chartSeries.map(
                  (s) =>
                    s.data.length >= 2 && (
                      <Polyline
                        key={s.key}
                        points={s.data.map((d) => `${chartPx(d.x)},${chartPy(d.y)}`).join(' ')}
                        fill="none"
                        stroke={s.color}
                        strokeWidth={1.5}
                        strokeDasharray={s.dash}
                      />
                    ),
                )}
              </Svg>
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
            </Entrance>

            {stats && (
              <Entrance index={2}>
              <Section title="Scoring">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                  <StatTile style={TILE} label="Avg score" value={fmtNum(stats.scoring.avgScore, 1)} />
                  <StatTile style={TILE} label="Par 3 avg" value={fmtNum(stats.scoring.avgPar3, 2)} />
                  <StatTile style={TILE} label="Par 4 avg" value={fmtNum(stats.scoring.avgPar4, 2)} />
                  <StatTile style={TILE} label="Par 5 avg" value={fmtNum(stats.scoring.avgPar5, 2)} />
                  <StatTile style={TILE} label="Front 9" value={fmtNum(stats.scoring.front9Avg, 1)} />
                  <StatTile style={TILE} label="Back 9" value={fmtNum(stats.scoring.back9Avg, 1)} />
                  <StatTile style={TILE} label="Best round" value={fmtInt(stats.scoring.bestRound)} />
                  <StatTile style={TILE} label="Worst round" value={fmtInt(stats.scoring.worstRound)} />
                </View>
                <ScoringDistBar
                  slices={stats.scoringDistribution.slices}
                  total={stats.scoringDistribution.total}
                />
              </Section>
              </Entrance>
            )}

            {stats && (
              <Entrance index={3}>
              <Section title="Ball striking">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  <StatTile style={TILE} label="Fairways" value={fmtPct(stats.ballStriking.fairwayPct)} />
                  <StatTile style={TILE} label="GIR" value={fmtPct(stats.ballStriking.girPct)} />
                  <StatTile
                    style={TILE}
                    label="Drive avg"
                    value={stats.ballStriking.drivingDistanceAvg != null ? toDisplay(stats.ballStriking.drivingDistanceAvg) : '—'}
                  />
                  <StatTile
                    style={TILE}
                    label="Proximity"
                    value={stats.ballStriking.proximityAvg != null ? toDisplay(stats.ballStriking.proximityAvg, 1) : '—'}
                  />
                </View>
              </Section>
              </Entrance>
            )}

            {stats && (
              <Entrance index={4}>
              <Section title="Short game">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  <StatTile style={TILE} label="Putts/round" value={fmtNum(stats.shortGame.puttsPerRound, 1)} />
                  <StatTile style={TILE} label="Putts/GIR" value={fmtNum(stats.shortGame.puttsPerGir, 2)} />
                  <StatTile style={TILE} label="3-putt rate" value={fmtPct(stats.shortGame.threePuttPct)} />
                  <StatTile style={TILE} label="Up & down" value={fmtPct(stats.shortGame.upAndDownPct)} />
                  <StatTile style={TILE} label="Scrambling" value={fmtPct(stats.shortGame.scramblingPct)} />
                  <StatTile style={TILE} label="Sand save" value={fmtPct(stats.shortGame.sandSavePct)} />
                </View>
              </Section>
              </Entrance>
            )}

            {stats && (
              <Entrance index={5}>
              <Section title="Patterns">
                <SubHead>Miss tendency</SubHead>
                {stats.missTendency.length === 0 ? (
                  <Insufficient note="Need shot results logged to detect a tendency." />
                ) : (
                  <View style={{ borderTopWidth: 1, borderColor: P.line }}>
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

                <SubHead style={{ marginTop: 18 }}>Most costly lies</SubHead>
                {stats.costlyLies.length === 0 ? (
                  <Insufficient note="Need ≥5 shots per lie type with results." />
                ) : (
                  <View style={{ borderTopWidth: 1, borderColor: P.line }}>
                    {stats.costlyLies.slice(0, 5).map((e) => (
                      <StatRow
                        key={e.lie}
                        label={e.lie.replace(/_/g, ' ')}
                        sub={`${e.shots} shots`}
                        value={e.avgQuality.toFixed(2)}
                        valueColor={e.avgQuality < 0 ? P.neg : P.inkDim}
                      />
                    ))}
                  </View>
                )}

                <SubHead style={{ marginTop: 18 }}>Club accuracy</SubHead>
                {stats.clubAccuracy.length === 0 ? (
                  <Insufficient note="Need shots with start, aim, and end coords (≥3 per club)." />
                ) : (
                  <View style={{ flexDirection: 'row', gap: 14 }}>
                    <View style={{ flex: 1 }}>
                      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12, marginBottom: 8 }]}>Most accurate</Text>
                      <View style={{ borderTopWidth: 1, borderColor: P.line }}>
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
                        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12, marginBottom: 8 }]}>Least accurate</Text>
                        <View style={{ borderTopWidth: 1, borderColor: P.line }}>
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

                <SubHead style={{ marginTop: 18 }}>Slope impact</SubHead>
                {stats.slopeImpact.forward.length === 0 && stats.slopeImpact.side.length === 0 ? (
                  <Insufficient note="Need shots with slope logged (≥3 per type)." />
                ) : (
                  <View style={{ flexDirection: 'row', gap: 14 }}>
                    {stats.slopeImpact.forward.length > 0 && (
                      <View style={{ flex: 1 }}>
                        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12, marginBottom: 8 }]}>Forward</Text>
                        <View style={{ borderTopWidth: 1, borderColor: P.line }}>
                          {stats.slopeImpact.forward.map((e) => (
                            <StatRow
                              key={e.slope}
                              label={e.slope.replace(/_/g, ' ')}
                              sub={`${e.shots} shots`}
                              value={e.avgQuality.toFixed(2)}
                              valueColor={e.avgQuality < 0 ? P.neg : P.inkDim}
                            />
                          ))}
                        </View>
                      </View>
                    )}
                    {stats.slopeImpact.side.length > 0 && (
                      <View style={{ flex: 1 }}>
                        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12, marginBottom: 8 }]}>Side</Text>
                        <View style={{ borderTopWidth: 1, borderColor: P.line }}>
                          {stats.slopeImpact.side.map((e) => (
                            <StatRow
                              key={e.slope}
                              label={e.slope.replace(/_/g, ' ')}
                              sub={`${e.shots} shots`}
                              value={e.avgQuality.toFixed(2)}
                              valueColor={e.avgQuality < 0 ? P.neg : P.inkDim}
                            />
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                )}

                <SubHead style={{ marginTop: 18 }}>Recovery from rough</SubHead>
                {stats.recovery.totalRoughShots === 0 ? (
                  <Insufficient note="Need rough shots logged to compute recovery rate." />
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                    <StatTile style={TILE} label="Recovery rate" value={fmtPct(stats.recovery.recoveryPct)} />
                    <StatTile style={TILE} label="Rough shots" value={String(stats.recovery.totalRoughShots)} />
                  </View>
                )}
              </Section>
              </Entrance>
            )}

            {clubDistances.length > 0 && (
              <Entrance index={6}>
              <Section title="Club distances">
                <Text
                  style={[TYPE.body, {
                    color: '#8A8B7E',
                    fontSize: 12,
                    marginTop: -4,
                    marginBottom: 12,
                  }]}
                >
                  Total distance, not carry · avg (min–max)
                </Text>
                <View style={{ gap: 10 }}>
                  {clubDistances.map((c) => {
                    const conv = (y: number) =>
                      unit === 'meters' ? Math.round(y * YARDS_TO_METERS) : Math.round(y)
                    return (
                      <View
                        key={c.club}
                        style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}
                      >
                        <Text
                          style={[TYPE.bodyBold, {
                            flex: 1,
                            color: '#1C211C',
                            fontSize: 14,
                            textTransform: 'capitalize',
                          }]}
                          numberOfLines={1}
                        >
                          {formatClubLabel({ club_type: c.club })}
                        </Text>
                        <Text
                          style={[TYPE.serif, {
                            color: '#1C211C',
                            fontSize: 16,
                            fontVariant: ['tabular-nums'],
                          }]}
                        >
                          {toDisplay(c.avg)}
                        </Text>
                        <Text
                          style={[TYPE.body, {
                            width: 84,
                            textAlign: 'right',
                            color: '#5C6356',
                            fontSize: 12,
                            fontVariant: ['tabular-nums'],
                          }]}
                        >
                          {conv(c.min)}–{conv(c.max)}
                        </Text>
                        <Text
                          style={[TYPE.body, {
                            width: 26,
                            textAlign: 'right',
                            color: '#8A8B7E',
                            fontSize: 11,
                            fontVariant: ['tabular-nums'],
                          }]}
                        >
                          {c.count}
                        </Text>
                      </View>
                    )
                  })}
                </View>
              </Section>
              </Entrance>
            )}
          </>
        )}
      </ScrollView>
    </PaperSurface>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <View style={{ marginBottom: 28 }}>
      <SectionHead title={title} />
      {children}
    </View>
  )
}

function SubHead({ children, style }: { children: React.ReactNode; style?: import('react-native').ViewStyle }) {
  return (
    <View style={style}>
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { color: P.ink, fontSize: 16, marginBottom: 8 }]}>
        {children}
      </Text>
    </View>
  )
}

function StatRow({
  label,
  sub,
  value,
  valueColor = P.ink,
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
        borderColor: P.line,
        paddingVertical: 10,
      }}
    >
      <Text
        maxFontSizeMultiplier={FONT_CAP}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={[TYPE.body, {
          color: P.ink,
          fontSize: 15,
          textTransform: 'capitalize',
          flex: 1,
        }]}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12 }]}>{sub}</Text>
        <Text
          maxFontSizeMultiplier={FONT_CAP}
          style={[TYPE.serif, {
            color: valueColor,
            fontSize: 20,
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
              <Text style={[TYPE.bodyBold, { color: '#F2EEE5', fontSize: 11, fontVariant: ['tabular-nums'] }]}>
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
    <Text style={[TYPE.bodyItalic, { color: '#8A8B7E', fontSize: 13, marginBottom: 8 }]}>
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

// Prose callout naming the leak (worst SG category) and, when distinct and
// positive, the strength. Co-located: single caller, no closure-per-render.
function StandoutCallout({ sg }: { sg: SGAverages }) {
  const { weakest, strongest } = sgStandouts(sg)
  if (!weakest) return null
  const showStrength =
    strongest != null && strongest.key !== weakest.key && strongest.value > 0
  const leak =
    weakest.value < 0
      ? `Your biggest leak is ${SG_STANDOUT_LABEL[weakest.key]} — ${formatSG(weakest.value)} a round.`
      : `Your softest area is ${SG_STANDOUT_LABEL[weakest.key]} (${formatSG(weakest.value)} a round).`
  const strength = showStrength
    ? ` ${SG_STANDOUT_LABEL[strongest.key]} is a strength, ${formatSG(strongest.value)} a round.`
    : ''
  return (
    <View style={{ borderLeftWidth: 2, borderColor: '#1F3D2C', paddingLeft: 14, marginBottom: 22 }}>
      <Text
        style={[TYPE.serif, {
          color: '#1C211C',
          fontSize: 17,
          lineHeight: 24,
        }]}
      >
        {leak}
        {strength}
      </Text>
    </View>
  )
}
