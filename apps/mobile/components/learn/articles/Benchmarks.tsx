import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import {
  computeDetailedStats,
  DEFAULT_HANDICAP,
  type DetailedRound,
  type DetailedStats,
} from '@oga/core'
import { getProfile, getRoundsWithDetails } from '@oga/supabase'
import { ArticleHeader, C, P, Subhead } from '../primitives'
import { FONT } from '../../../lib/typography'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../hooks/useAuth'
import { useUnits } from '../../../hooks/useUnits'

// ── data shapes ──────────────────────────────────────────────────────────────
const BRACKETS = ['PGA Tour', 'Scratch', '5', '10', '15', '20', '25+'] as const
type BracketLabel = (typeof BRACKETS)[number]

interface BenchmarkRow {
  key: string
  label: string
  values: [number, number, number, number, number, number, number]
  format: (v: number) => string
  lowerIsBetter?: boolean
  meValue?: number | null
}

// ── strokes-gained format (matches web fmtSG) ────────────────────────────────
function fmtSG(v: number): string {
  const s = v.toFixed(1)
  return v > 0 ? `+${s}` : s
}

export function BenchmarksArticle() {
  const { user } = useAuth()
  const { toDisplay, toDisplayFt } = useUnits()
  const [rounds, setRounds] = useState<DetailedRound[]>([])
  const [handicap, setHandicap] = useState<number | null>(null)
  const [view, setView] = useState<'chart' | 'table'>('chart')

  // Read-only fetch — mirrors apps/mobile/app/(app)/stats.tsx exactly
  // (getRoundsWithDetails → computeDetailedStats over the last 10 rounds).
  // Signed-out / no-data simply leaves `me` null and the charts render
  // static for everyone; the amber "you" dot is a personalized bonus.
  useEffect(() => {
    if (!user) return
    let active = true
    getRoundsWithDetails(supabase, user.id, 10).then(({ data, error }) => {
      if (!active) return
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[benchmarks/getRoundsWithDetails]', error.message)
      }
      setRounds((data as unknown as DetailedRound[] | null) ?? [])
    })
    return () => {
      active = false
    }
  }, [user?.id])

  useEffect(() => {
    if (!user) return
    let active = true
    getProfile(supabase, user.id).then(({ data, error }) => {
      if (!active) return
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('[benchmarks/getProfile]', error.message)
        return
      }
      setHandicap(data?.handicap_index ?? null)
    })
    return () => {
      active = false
    }
  }, [user?.id])

  const me: DetailedStats | null = useMemo(
    () => (rounds.length > 0 ? computeDetailedStats(rounds, DEFAULT_HANDICAP) : null),
    [rounds],
  )

  const sg = me?.sg
  const ball = me?.ballStriking
  const scoring = me?.scoring
  const short = me?.shortGame

  const sgRows: BenchmarkRow[] = [
    {
      key: 'sg_off_tee',
      label: 'SG · Off the tee',
      values: [1.0, 0.0, -0.3, -0.6, -0.9, -1.2, -1.6],
      format: fmtSG,
      meValue: sg?.offTee ?? null,
    },
    {
      key: 'sg_approach',
      label: 'SG · Approach',
      values: [1.4, 0.0, -0.5, -1.1, -1.7, -2.3, -3.0],
      format: fmtSG,
      meValue: sg?.approach ?? null,
    },
    {
      key: 'sg_around',
      label: 'SG · Around the green',
      values: [0.6, 0.0, -0.3, -0.6, -0.9, -1.2, -1.5],
      format: fmtSG,
      meValue: sg?.aroundGreen ?? null,
    },
    {
      key: 'sg_putting',
      label: 'SG · Putting',
      values: [0.3, 0.0, -0.2, -0.5, -0.8, -1.1, -1.4],
      format: fmtSG,
      meValue: sg?.putting ?? null,
    },
    {
      key: 'sg_total',
      label: 'SG · Total',
      values: [3.3, 0.0, -1.3, -2.8, -4.3, -5.8, -7.5],
      format: fmtSG,
      meValue:
        sg?.offTee != null &&
        sg.approach != null &&
        sg.aroundGreen != null &&
        sg.putting != null
          ? (sg.offTee ?? 0) +
            (sg.approach ?? 0) +
            (sg.aroundGreen ?? 0) +
            (sg.putting ?? 0)
          : null,
    },
  ]

  const scoringRows: BenchmarkRow[] = [
    {
      key: 'avg_score',
      label: 'Avg score',
      values: [69.5, 72, 77, 82, 87, 92, 99],
      format: (v) => v.toFixed(1),
      lowerIsBetter: true,
      meValue: scoring?.avgScore ?? null,
    },
    {
      key: 'gir',
      label: 'GIR %',
      values: [67, 50, 40, 30, 22, 15, 9],
      format: (v) => `${v.toFixed(0)}%`,
      meValue: ball?.girPct ?? null,
    },
    {
      key: 'fairways',
      label: 'Fairways hit',
      values: [62, 55, 50, 44, 38, 32, 26],
      format: (v) => `${v.toFixed(0)}%`,
      meValue: ball?.fairwayPct ?? null,
    },
  ]

  const puttingRows: BenchmarkRow[] = [
    {
      key: 'putts',
      label: 'Putts / round',
      values: [29, 32, 33, 34, 35, 36, 37],
      format: (v) => v.toFixed(1),
      lowerIsBetter: true,
      meValue: short?.puttsPerRound ?? null,
    },
    {
      key: 'three_putt',
      label: '3-putt rate',
      values: [2, 5, 8, 12, 17, 22, 28],
      format: (v) => `${v.toFixed(0)}%`,
      lowerIsBetter: true,
      meValue: short?.threePuttPct ?? null,
    },
    {
      key: 'make_5ft',
      label: 'Make % from 5 ft / 152 cm',
      values: [96, 85, 75, 63, 52, 42, 33],
      format: (v) => `${v.toFixed(0)}%`,
      meValue: null,
    },
    {
      key: 'make_10ft',
      label: 'Make % from 10 ft / 305 cm',
      values: [55, 38, 28, 20, 14, 10, 7],
      format: (v) => `${v.toFixed(0)}%`,
      meValue: null,
    },
  ]

  const ballStrikingRows: BenchmarkRow[] = [
    {
      key: 'driving',
      label: 'Driving distance',
      values: [294, 250, 235, 220, 205, 190, 175],
      format: (v) => toDisplay(v),
      meValue: ball?.drivingDistanceAvg ?? null,
    },
    {
      key: 'proximity',
      label: 'Proximity to pin',
      values: [25, 42, 52, 65, 82, 105, 130],
      format: (v) => toDisplayFt(v),
      lowerIsBetter: true,
      meValue: ball?.proximityAvg != null ? ball.proximityAvg * 3 : null,
    },
  ]

  const userBracketIndex = bracketIndexForHandicap(handicap)

  return (
    <View>
      <ArticleHeader
        kicker="Understanding the game · By the numbers"
        title="Where you sit in the field."
      />

      <P>
        These bars show where each stat lands across the bell curve, from a
        25-handicap weekend round all the way up to the PGA Tour. Your average
        for the last ten rounds is plotted as a burnt-amber dot — when one is
        missing it is because the app does not have enough rounds to compute it
        yet.
      </P>

      <ViewTabs value={view} onChange={setView} />

      {view === 'chart' ? (
        <View>
          <BenchmarkGroup title="Strokes gained" rows={sgRows} highlightScratch />
          <BenchmarkGroup title="Scoring + ball striking" rows={scoringRows} />
          <BenchmarkGroup title="Putting" rows={puttingRows} />
          <BenchmarkGroup title="Ball striking" rows={ballStrikingRows} />
        </View>
      ) : (
        <BenchmarkTable
          groups={[
            { title: 'Strokes gained', rows: sgRows, isSg: true },
            { title: 'Scoring + ball striking', rows: scoringRows },
            { title: 'Putting', rows: puttingRows },
            { title: 'Ball striking', rows: ballStrikingRows },
          ]}
          userBracketIndex={userBracketIndex}
        />
      )}
    </View>
  )
}

// ── chart ↔ table toggle ─────────────────────────────────────────────────────
function ViewTabs({
  value,
  onChange,
}: {
  value: 'chart' | 'table'
  onChange: (v: 'chart' | 'table') => void
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: C.line,
        marginTop: 14,
        marginBottom: 18,
      }}
    >
      {(['chart', 'table'] as const).map((v) => {
        const active = value === v
        return (
          <Pressable
            key={v}
            onPress={() => onChange(v)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderBottomWidth: 2,
              borderBottomColor: active ? C.accent : 'transparent',
              marginBottom: -1,
            }}
          >
            <Text
              style={{
                fontFamily: FONT.mono,
                fontSize: 10,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                color: active ? C.ink : C.mute,
              }}
            >
              {v}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

// ── bell-curve bar group ─────────────────────────────────────────────────────
function BenchmarkGroup({
  title,
  rows,
  highlightScratch,
}: {
  title: string
  rows: BenchmarkRow[]
  highlightScratch?: boolean
}) {
  return (
    <View style={{ marginTop: 22 }}>
      <Subhead>{title}</Subhead>
      <View style={{ gap: 18 }}>
        {rows.map((r) => (
          <BenchmarkBar key={r.key} row={r} highlightScratch={highlightScratch} />
        ))}
      </View>
    </View>
  )
}

const TRACK_HEIGHT = 36
const DOT_SIZE = 14

function BenchmarkBar({
  row,
  highlightScratch,
}: {
  row: BenchmarkRow
  highlightScratch?: boolean
}) {
  const [trackWidth, setTrackWidth] = useState(0)
  const min = Math.min(...row.values)
  const max = Math.max(...row.values)
  const project = (value: number): number => {
    if (max === min) return 50
    // x=0 = worst (left), x=100 = best (right).
    const best = row.lowerIsBetter ? min : max
    const worst = row.lowerIsBetter ? max : min
    const t = (value - worst) / (best - worst)
    return Math.max(0, Math.min(1, t)) * 100
  }

  const ordered = BRACKETS.map((bracket, i) => ({
    bracket,
    value: row.values[i]!,
    pct: project(row.values[i]!),
  })).sort((a, b) => a.pct - b.pct)

  const me = row.meValue
  const meValid = me != null && Number.isFinite(me)
  const mePct = meValid ? project(me!) : null
  const scratchValue = row.values[1]!

  // px helper — RN can't do "calc(%-7px)"; resolve against measured width.
  const pxFor = (pct: number) => (trackWidth * pct) / 100

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <Text
          style={{
            fontFamily: FONT.mono,
            fontSize: 10,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            color: C.mute,
            flexShrink: 1,
          }}
        >
          {row.label}
        </Text>
        {highlightScratch && (
          <Text
            style={{
              fontFamily: FONT.serifItalic,
              fontSize: 13,
              color: C.inkDim,
            }}
          >
            Scratch · {row.format(scratchValue)}
          </Text>
        )}
      </View>

      {/* track — flat fallback (expo-linear-gradient not installed): a light
          worst-side base with an accent-tinted best-side overlay to suggest
          the left→right worst→best direction. */}
      <View
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        style={{
          position: 'relative',
          height: TRACK_HEIGHT,
          backgroundColor: C.surface,
          borderWidth: 1,
          borderColor: C.line,
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            position: 'absolute',
            left: '50%',
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: C.boxBg,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: '78%',
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: 'rgba(31,61,44,0.45)',
          }}
        />
        {trackWidth > 0 &&
          ordered.map((b) => (
            <View
              key={b.bracket}
              style={{
                position: 'absolute',
                left: pxFor(b.pct),
                top: 0,
                bottom: 0,
                width: 1,
                backgroundColor: 'rgba(28,33,28,0.35)',
              }}
            />
          ))}
        {trackWidth > 0 && mePct != null && (
          <View
            style={{
              position: 'absolute',
              left: pxFor(mePct) - DOT_SIZE / 2,
              top: TRACK_HEIGHT / 2 - DOT_SIZE / 2,
              width: DOT_SIZE,
              height: DOT_SIZE,
              borderRadius: 999,
              backgroundColor: C.amber,
              borderWidth: 2,
              borderColor: C.surface,
            }}
          />
        )}
      </View>

      {/* bracket tick labels */}
      <View style={{ position: 'relative', height: 14, marginTop: 4 }}>
        {trackWidth > 0 &&
          ordered.map((b) => (
            <Text
              key={b.bracket}
              style={{
                position: 'absolute',
                left: pxFor(b.pct) - 14,
                width: 28,
                textAlign: 'center',
                fontFamily: FONT.mono,
                fontSize: 9,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                color: C.mute,
                fontVariant: ['tabular-nums'],
              }}
            >
              {labelForBracket(b.bracket)}
            </Text>
          ))}
      </View>

      {/* end labels */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginTop: 18,
        }}
      >
        <Text style={{ color: C.mute, fontFamily: FONT.body, fontSize: 11 }}>
          25+ HCP{' '}
          <Text
            style={{
              fontFamily: FONT.serifItalic,
            }}
          >
            {row.format(row.values[6]!)}
          </Text>
        </Text>
        <Text style={{ color: C.mute, fontFamily: FONT.body, fontSize: 11 }}>
          PGA Tour{' '}
          <Text
            style={{
              fontFamily: FONT.serifItalic,
            }}
          >
            {row.format(row.values[0]!)}
          </Text>
        </Text>
      </View>

      {mePct != null && (
        <Text
          style={{
            color: C.amber,
            fontFamily: FONT.body,
            fontSize: 12,
            fontWeight: '500',
            marginTop: 6,
          }}
        >
          You ·{' '}
          <Text
            style={{
              fontFamily: FONT.serifItalic,
            }}
          >
            {row.format(me!)}
          </Text>
        </Text>
      )}
    </View>
  )
}

function labelForBracket(b: BracketLabel): string {
  if (b === 'PGA Tour') return 'PGA'
  if (b === 'Scratch') return 'SCR'
  return b
}

// ── table view ───────────────────────────────────────────────────────────────
interface BenchmarkGroupSpec {
  title: string
  rows: BenchmarkRow[]
  isSg?: boolean
}

const STAT_COL_WIDTH = 188
const VAL_COL_WIDTH = 60

function BenchmarkTable({
  groups,
  userBracketIndex,
}: {
  groups: BenchmarkGroupSpec[]
  userBracketIndex: number | null
}) {
  const headerLabels = ['25+', '20', '15', '10', '5', 'SCR', 'PGA']
  // BRACKETS goes PGA → 25+; headerLabels here is 25+ → PGA.
  const reorderIdx = [6, 5, 4, 3, 2, 1, 0]

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View>
        {/* header row */}
        <View
          style={{
            flexDirection: 'row',
            borderBottomWidth: 1,
            borderBottomColor: '#9F9580',
          }}
        >
          <View style={{ width: STAT_COL_WIDTH, paddingVertical: 10, paddingHorizontal: 8 }}>
            <Text style={MONO_HEAD}>Stat</Text>
          </View>
          {headerLabels.map((h, i) => {
            const highlighted = userBracketIndex != null && i === userBracketIndex
            return (
              <View
                key={h}
                style={{
                  width: VAL_COL_WIDTH,
                  paddingVertical: 10,
                  paddingHorizontal: 8,
                  backgroundColor: highlighted ? 'rgba(31,61,44,0.15)' : 'transparent',
                }}
              >
                <Text style={[MONO_HEAD, { textAlign: 'right', fontVariant: ['tabular-nums'] }]}>
                  {h}
                </Text>
              </View>
            )
          })}
        </View>

        {groups.map((g) => (
          <View key={g.title}>
            {/* group title row */}
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: C.line,
                paddingTop: 14,
                paddingBottom: 6,
                paddingHorizontal: 8,
              }}
            >
              <Text
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 10,
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                  color: C.mute,
                }}
              >
                {g.title}
              </Text>
            </View>

            {g.rows.map((r) => (
              <View key={r.key} style={{ flexDirection: 'row' }}>
                <View style={{ width: STAT_COL_WIDTH, paddingVertical: 10, paddingHorizontal: 8 }}>
                  <Text
                    style={{
                      fontFamily: FONT.serif,
                      fontSize: 14,
                      fontWeight: '500',
                      color: C.ink,
                    }}
                  >
                    {r.label}
                  </Text>
                </View>
                {reorderIdx.map((origIdx, headIdx) => {
                  const v = r.values[origIdx]!
                  const tone = g.isSg
                    ? v > 0
                      ? C.accent
                      : v < 0
                        ? '#A33A2A'
                        : '#5C6356'
                    : C.ink
                  const highlighted =
                    userBracketIndex != null && headIdx === userBracketIndex
                  return (
                    <View
                      key={origIdx}
                      style={{
                        width: VAL_COL_WIDTH,
                        paddingVertical: 10,
                        paddingHorizontal: 8,
                        backgroundColor: highlighted
                          ? 'rgba(31,61,44,0.15)'
                          : 'transparent',
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: g.isSg ? FONT.serifItalic : FONT.serif,
                          fontStyle: g.isSg ? 'italic' : 'normal',
                          fontSize: 14,
                          textAlign: 'right',
                          color: tone,
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        {r.format(v)}
                      </Text>
                    </View>
                  )
                })}
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

const MONO_HEAD = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: 1.4,
  textTransform: 'uppercase',
  color: C.mute,
} as const

function bracketIndexForHandicap(h: number | null): number | null {
  if (h == null || !Number.isFinite(h)) return null
  if (h >= 25) return 0
  if (h >= 18) return 1
  if (h >= 13) return 2
  if (h >= 8) return 3
  if (h >= 3) return 4
  return 5 // scratch
}
