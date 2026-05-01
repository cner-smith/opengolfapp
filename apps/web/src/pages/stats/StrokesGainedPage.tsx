import { useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useDetailedStats } from '../../hooks/useDetailedStats'
import { useUnits } from '../../hooks/useUnits'
import type {
  ApproachBandStat,
  ClubAccuracyEntry,
  CostlyLieEntry,
  DetailedStats,
  MissTendencyEntry,
  RecoveryRateStat,
  ScoringDistributionSlice,
  SlopeImpact,
} from '../../lib/statsCalculations'

const N_OPTIONS: readonly number[] = [5, 10, 20]

const TICK_STYLE = { fontSize: 11, fill: '#8A8B7E' } as const
const TOOLTIP_STYLE = {
  backgroundColor: '#FBF8F1',
  border: '1px solid #D9D2BF',
  borderRadius: 4,
  fontSize: 11,
  padding: '8px 10px',
  fontFamily: 'Inter, sans-serif',
} as const

const SG_SERIES = [
  { key: 'offTee', label: 'Off tee', color: '#1F3D2C' },
  { key: 'approach', label: 'Approach', color: '#A33A2A' },
  { key: 'aroundGreen', label: 'Around green', color: '#A66A1F' },
  { key: 'putting', label: 'Putting', color: '#5C6356' },
] as const

export function StrokesGainedPage() {
  const [n, setN] = useState<number>(10)
  const stats = useDetailedStats(n)

  return (
    <div>
      <div
        className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3"
        style={{ marginBottom: 28 }}
      >
        <div>
          <div className="kicker" style={{ marginBottom: 8 }}>
            Performance ledger
          </div>
          <h1
            className="font-serif text-caddie-ink"
            style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.15 }}
          >
            Stats
          </h1>
          <div
            className="text-caddie-ink-dim"
            style={{ fontSize: 15, marginTop: 6, maxWidth: 560 }}
          >
            {stats.data
              ? `Across the last ${stats.data.rounds} round${stats.data.rounds === 1 ? '' : 's'} · ${stats.data.holesPlayed} holes scored.`
              : 'Per-category strokes vs. the bracket baseline.'}
          </div>
        </div>
        <Segmented
          value={n}
          options={N_OPTIONS}
          onChange={setN}
          renderLabel={(v) => `Last ${v}`}
        />
      </div>

      {stats.isLoading ? (
        <Skeleton />
      ) : !stats.data ? (
        <EmptyState />
      ) : (
        <>
          <StrokesGainedSection data={stats.data} />
          <ScoringSection data={stats.data} />
          <BallStrikingSection data={stats.data} />
          <ShortGameSection data={stats.data} />
          <PatternsSection data={stats.data} />
        </>
      )}
    </div>
  )
}

// ===========================================================================
// SECTION 1: STROKES GAINED
// ===========================================================================
function StrokesGainedSection({ data }: { data: DetailedStats }) {
  const series = SG_SERIES.map((s) => ({
    ...s,
    value: data.sg[s.key as 'offTee' | 'approach' | 'aroundGreen' | 'putting'],
  }))
  const trendData = data.sgTrend.map((t) => ({
    date: t.date,
    offTee: t.offTee,
    approach: t.approach,
    aroundGreen: t.aroundGreen,
    putting: t.putting,
  }))

  return (
    <Section kicker="Strokes gained">
      <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 14, marginBottom: 22 }}>
        {series.map((s) => (
          <SgTile key={s.key} label={s.label} color={s.color} value={s.value} />
        ))}
      </div>

      {trendData.length === 0 ? (
        <Insufficient note="Trend chart needs at least one round with strokes gained logged." />
      ) : (
        <div
          style={{
            border: '1px solid #D9D2BF',
            borderRadius: 4,
            background: '#FBF8F1',
            padding: 14,
            marginBottom: 22,
          }}
        >
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={trendData}
                margin={{ top: 8, right: 8, bottom: 4, left: -16 }}
              >
                <CartesianGrid stroke="#EBE5D6" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={TICK_STYLE}
                  tickLine={false}
                  axisLine={{ stroke: '#D9D2BF' }}
                />
                <YAxis
                  tick={TICK_STYLE}
                  tickLine={false}
                  axisLine={{ stroke: '#D9D2BF' }}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: '#8A8B7E' }}
                />
                <Legend
                  iconType="plainline"
                  wrapperStyle={{
                    fontSize: 11,
                    color: '#5C6356',
                    fontFamily: 'Inter, sans-serif',
                  }}
                />
                {SG_SERIES.map((s) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label}
                    stroke={s.color}
                    strokeWidth={1.5}
                    dot={{ r: 2.5, fill: s.color, strokeWidth: 0 }}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <Subkicker>Approach by distance</Subkicker>
      <div className="grid grid-cols-2" style={{ gap: 14 }}>
        {data.approachByDistance.map((b) => (
          <ApproachBandTile key={b.key} band={b} />
        ))}
      </div>
    </Section>
  )
}

// ===========================================================================
// SECTION 2: SCORING
// ===========================================================================
function ScoringSection({ data }: { data: DetailedStats }) {
  const s = data.scoring
  return (
    <Section kicker="Scoring">
      <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 14, marginBottom: 22 }}>
        <StatTile label="Avg score" value={fmtNumber(s.avgScore, 1)} />
        <StatTile label="Avg par 3" value={fmtNumber(s.avgPar3, 2)} />
        <StatTile label="Avg par 4" value={fmtNumber(s.avgPar4, 2)} />
        <StatTile label="Avg par 5" value={fmtNumber(s.avgPar5, 2)} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 14, marginBottom: 22 }}>
        <StatTile label="Front 9" value={fmtNumber(s.front9Avg, 1)} />
        <StatTile label="Back 9" value={fmtNumber(s.back9Avg, 1)} />
        <StatTile label="Best round" value={fmtInt(s.bestRound)} />
        <StatTile label="Worst round" value={fmtInt(s.worstRound)} />
      </div>

      <Subkicker>Scoring distribution</Subkicker>
      <ScoringDistributionBar slices={data.scoringDistribution.slices} total={data.scoringDistribution.total} />
    </Section>
  )
}

// ===========================================================================
// SECTION 3: BALL STRIKING
// ===========================================================================
function BallStrikingSection({ data }: { data: DetailedStats }) {
  const b = data.ballStriking
  const { toDisplay } = useUnits()
  return (
    <Section kicker="Ball striking">
      <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 14, marginBottom: 14 }}>
        <StatTile label="Fairways hit" value={fmtPct(b.fairwayPct)} />
        <StatTile label="GIR" value={fmtPct(b.girPct)} />
        <StatTile
          label="Drive avg"
          value={b.drivingDistanceAvg != null ? toDisplay(b.drivingDistanceAvg) : '—'}
          subtle={
            b.drivingSampleSize > 0
              ? `${b.drivingSampleSize} drive${b.drivingSampleSize === 1 ? '' : 's'}`
              : 'Need driver tee shots with GPS'
          }
        />
        <StatTile
          label="Proximity"
          value={b.proximityAvg != null ? toDisplay(b.proximityAvg, 1) : '—'}
          subtle={
            b.proximitySampleRounds > 0
              ? `Based on ${b.proximitySampleRounds} round${b.proximitySampleRounds === 1 ? '' : 's'} with pin logged`
              : 'Need approach shots with end coords + pin'
          }
        />
      </div>
    </Section>
  )
}

// ===========================================================================
// SECTION 4: SHORT GAME
// ===========================================================================
function ShortGameSection({ data }: { data: DetailedStats }) {
  const sg = data.shortGame
  return (
    <Section kicker="Short game">
      <div className="grid grid-cols-2 sm:grid-cols-3" style={{ gap: 14 }}>
        <StatTile label="Putts / round" value={fmtNumber(sg.puttsPerRound, 1)} />
        <StatTile label="Putts per GIR" value={fmtNumber(sg.puttsPerGir, 2)} />
        <StatTile label="3-putt rate" value={fmtPct(sg.threePuttPct)} />
        <StatTile label="Up & down" value={fmtPct(sg.upAndDownPct)} />
        <StatTile label="Scrambling" value={fmtPct(sg.scramblingPct)} />
        <StatTile label="Sand save" value={fmtPct(sg.sandSavePct)} />
      </div>
    </Section>
  )
}

// ===========================================================================
// SECTION 5: PATTERNS
// ===========================================================================
function PatternsSection({ data }: { data: DetailedStats }) {
  return (
    <Section kicker="Patterns">
      <Subkicker>Miss tendency</Subkicker>
      <MissTendencyList entries={data.missTendency} />

      <Subkicker style={{ marginTop: 22 }}>Most costly lies</Subkicker>
      <CostlyLiesList entries={data.costlyLies} />

      <Subkicker style={{ marginTop: 22 }}>Club accuracy</Subkicker>
      <ClubAccuracyList entries={data.clubAccuracy} />

      <Subkicker style={{ marginTop: 22 }}>Slope impact</Subkicker>
      <SlopeImpactBlock impact={data.slopeImpact} />

      <Subkicker style={{ marginTop: 22 }}>Recovery from rough</Subkicker>
      <RecoveryStat stat={data.recovery} />
    </Section>
  )
}

function SlopeImpactBlock({ impact }: { impact: SlopeImpact }) {
  if (impact.forward.length === 0 && impact.side.length === 0) {
    return (
      <Insufficient note="Need shots logged with a forward or side slope (≥3 each) to score impact." />
    )
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 22 }}>
      <SlopeAxisBlock title="Forward" entries={impact.forward} />
      <SlopeAxisBlock title="Side" entries={impact.side} />
    </div>
  )
}

function SlopeAxisBlock({
  title,
  entries,
}: {
  title: string
  entries: SlopeImpact['forward'] | SlopeImpact['side']
}) {
  return (
    <div>
      <div
        className="font-mono uppercase text-caddie-ink-mute"
        style={{
          fontSize: 10,
          letterSpacing: '0.14em',
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {entries.length === 0 ? (
        <Insufficient note={`Need ≥3 ${title.toLowerCase()}-slope shots.`} />
      ) : (
        <div style={{ borderTop: '1px solid #D9D2BF' }}>
          {entries.map((e) => (
            <div
              key={e.slope}
              className="flex items-baseline justify-between"
              style={{ borderBottom: '1px solid #D9D2BF', padding: '12px 0' }}
            >
              <span
                className="font-serif text-caddie-ink"
                style={{
                  fontSize: 17,
                  fontWeight: 500,
                  textTransform: 'capitalize',
                }}
              >
                {e.slope.replace('_', ' ')}
              </span>
              <span className="flex items-baseline" style={{ gap: 14 }}>
                <span
                  className="font-mono uppercase tabular text-caddie-ink-mute"
                  style={{ fontSize: 10, letterSpacing: '0.14em' }}
                >
                  {e.shots} shots
                </span>
                <span
                  className="font-serif tabular"
                  style={{
                    fontSize: 22,
                    fontStyle: 'italic',
                    fontWeight: 500,
                    color: e.avgQuality < 0 ? '#A33A2A' : '#5C6356',
                  }}
                >
                  {e.avgQuality.toFixed(2)}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ===========================================================================
// Reusable bits
// ===========================================================================

function Section({
  kicker,
  children,
}: {
  kicker: string
  children: React.ReactNode
}) {
  return (
    <section
      style={{
        borderTop: '1px solid #D9D2BF',
        paddingTop: 18,
        marginBottom: 32,
      }}
    >
      <div className="kicker" style={{ marginBottom: 18 }}>
        {kicker}
      </div>
      {children}
    </section>
  )
}

function Subkicker({
  children,
  style,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div
      className="kicker"
      style={{
        marginBottom: 12,
        color: '#5C6356',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function Segmented<T extends number | string>({
  value,
  options,
  onChange,
  renderLabel,
}: {
  value: T
  options: readonly T[]
  onChange: (v: T) => void
  renderLabel: (v: T) => string
}) {
  return (
    <div
      style={{
        border: '1px solid #D9D2BF',
        borderRadius: 2,
        display: 'inline-flex',
      }}
    >
      {options.map((opt, i) => {
        const active = opt === value
        return (
          <button
            key={String(opt)}
            type="button"
            onClick={() => onChange(opt)}
            style={{
              backgroundColor: active ? '#1F3D2C' : 'transparent',
              color: active ? '#F2EEE5' : '#5C6356',
              border: 'none',
              borderLeft: i === 0 ? 'none' : '1px solid #D9D2BF',
              padding: '8px 14px',
              fontSize: 12,
              fontWeight: active ? 600 : 500,
              letterSpacing: '0.02em',
              cursor: 'pointer',
            }}
          >
            {renderLabel(opt)}
          </button>
        )
      })}
    </div>
  )
}

function SgTile({
  label,
  color,
  value,
}: {
  label: string
  color: string
  value: number | null
}) {
  const tone = value == null ? '#5C6356' : value > 0 ? '#1F3D2C' : value < 0 ? '#A33A2A' : '#5C6356'
  return (
    <div
      className="bg-caddie-surface"
      style={{
        border: '1px solid #D9D2BF',
        borderRadius: 4,
        padding: 18,
      }}
    >
      <div className="flex items-center" style={{ gap: 8, marginBottom: 10 }}>
        <span style={{ width: 10, height: 2, backgroundColor: color }} />
        <span className="kicker">{label}</span>
      </div>
      <div
        className="font-serif tabular"
        style={{
          fontSize: 32,
          fontStyle: 'italic',
          fontWeight: 500,
          color: tone,
          lineHeight: 1.05,
        }}
      >
        {value == null
          ? '—'
          : `${value > 0 ? '+' : ''}${value.toFixed(2)}`}
      </div>
    </div>
  )
}

function StatTile({
  label,
  value,
  subtle,
}: {
  label: string
  value: string
  subtle?: string
}) {
  return (
    <div
      className="bg-caddie-surface"
      style={{
        border: '1px solid #D9D2BF',
        borderRadius: 4,
        padding: 18,
      }}
    >
      <div className="kicker" style={{ marginBottom: 10 }}>
        {label}
      </div>
      <div
        className="font-serif tabular text-caddie-ink"
        style={{
          fontSize: 28,
          fontWeight: 500,
          lineHeight: 1.05,
        }}
      >
        {value}
      </div>
      {subtle && (
        <div
          className="text-caddie-ink-mute"
          style={{
            fontSize: 11,
            marginTop: 6,
            lineHeight: 1.3,
          }}
        >
          {subtle}
        </div>
      )}
    </div>
  )
}

function ApproachBandTile({ band }: { band: ApproachBandStat }) {
  const { unit, toDisplay } = useUnits()
  const tone =
    band.avgSg == null
      ? '#5C6356'
      : band.avgSg > 0
        ? '#1F3D2C'
        : band.avgSg < 0
          ? '#A33A2A'
          : '#5C6356'
  const label = formatBandLabel(band, unit, toDisplay)
  return (
    <div
      style={{
        border: '1px solid #D9D2BF',
        borderRadius: 4,
        padding: 14,
        background: '#FBF8F1',
      }}
    >
      <div className="kicker" style={{ marginBottom: 8 }}>
        {label}
      </div>
      <div
        className="font-serif tabular"
        style={{
          fontSize: 22,
          fontStyle: 'italic',
          fontWeight: 500,
          color: tone,
          lineHeight: 1.1,
        }}
      >
        {band.avgSg == null
          ? '—'
          : `${band.avgSg > 0 ? '+' : ''}${band.avgSg.toFixed(2)}`}
      </div>
      <div
        className="text-caddie-ink-mute"
        style={{ fontSize: 11, marginTop: 6 }}
      >
        {band.shots > 0
          ? `${band.shots} shot${band.shots === 1 ? '' : 's'}`
          : 'Need shots in this band'}
      </div>
    </div>
  )
}

function ScoringDistributionBar({
  slices,
  total,
}: {
  slices: ScoringDistributionSlice[]
  total: number
}) {
  if (total === 0) {
    return <Insufficient note="Need scored holes to plot the distribution." />
  }
  const visible = slices.filter((s) => s.count > 0)
  return (
    <div>
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: 56,
          border: '1px solid #D9D2BF',
          borderRadius: 4,
          overflow: 'hidden',
          marginBottom: 14,
        }}
      >
        {visible.map((s) => (
          <div
            key={s.key}
            title={`${s.label} · ${s.count} (${s.pct.toFixed(1)}%)`}
            style={{
              width: `${s.pct}%`,
              background: s.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Fraunces, serif',
              fontStyle: 'italic',
              fontWeight: 500,
              color: '#F2EEE5',
              fontSize: 14,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {s.pct >= 8 ? `${s.pct.toFixed(0)}%` : ''}
          </div>
        ))}
      </div>
      <div
        className="flex flex-wrap"
        style={{ gap: 18, fontSize: 12, color: '#5C6356' }}
      >
        {slices.map((s) => (
          <div
            key={s.key}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <span
              style={{ width: 10, height: 10, background: s.color, borderRadius: 2 }}
            />
            <span>
              {s.label}{' '}
              <span className="font-mono tabular text-caddie-ink-mute">
                {s.count} · {s.pct.toFixed(1)}%
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MissTendencyList({ entries }: { entries: MissTendencyEntry[] }) {
  if (entries.length === 0)
    return <Insufficient note="Need shot results logged to detect a tendency." />
  return (
    <div style={{ borderTop: '1px solid #D9D2BF' }}>
      {entries.map((e) => (
        <div
          key={e.result}
          className="flex items-baseline justify-between"
          style={{
            borderBottom: '1px solid #D9D2BF',
            padding: '14px 0',
          }}
        >
          <span
            className="font-serif text-caddie-ink"
            style={{
              fontSize: 17,
              fontWeight: 500,
              textTransform: 'capitalize',
            }}
          >
            {e.result.replace(/_/g, ' ')}
          </span>
          <span className="flex items-baseline" style={{ gap: 14 }}>
            <span
              className="font-mono uppercase tabular text-caddie-ink-mute"
              style={{ fontSize: 10, letterSpacing: '0.14em' }}
            >
              {e.count} shots
            </span>
            <span
              className="font-serif tabular text-caddie-ink"
              style={{
                fontSize: 22,
                fontStyle: 'italic',
                fontWeight: 500,
              }}
            >
              {e.pct.toFixed(0)}%
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}

function CostlyLiesList({ entries }: { entries: CostlyLieEntry[] }) {
  if (entries.length === 0)
    return <Insufficient note="Need at least 5 shots per lie type with results." />
  return (
    <div style={{ borderTop: '1px solid #D9D2BF' }}>
      {entries.slice(0, 5).map((e) => (
        <div
          key={e.lie}
          className="flex items-baseline justify-between"
          style={{
            borderBottom: '1px solid #D9D2BF',
            padding: '14px 0',
          }}
        >
          <span
            className="font-serif text-caddie-ink"
            style={{
              fontSize: 17,
              fontWeight: 500,
              textTransform: 'capitalize',
            }}
          >
            {e.lie.replace(/_/g, ' ')}
          </span>
          <span className="flex items-baseline" style={{ gap: 14 }}>
            <span
              className="font-mono uppercase tabular text-caddie-ink-mute"
              style={{ fontSize: 10, letterSpacing: '0.14em' }}
            >
              {e.shots} shots
            </span>
            <span
              className="font-serif tabular"
              style={{
                fontSize: 22,
                fontStyle: 'italic',
                fontWeight: 500,
                color: e.avgQuality < 0 ? '#A33A2A' : '#5C6356',
              }}
            >
              {e.avgQuality.toFixed(2)}
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}

function ClubAccuracyList({ entries }: { entries: ClubAccuracyEntry[] }) {
  if (entries.length === 0)
    return (
      <Insufficient note="Need shots with start, aim, and end coords (≥3 per club)." />
    )
  const top = entries.slice(0, 5)
  const bottom = entries.slice(-5).reverse()
  return (
    <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 22 }}>
      <div>
        <div
          className="font-mono uppercase text-caddie-ink-mute"
          style={{
            fontSize: 10,
            letterSpacing: '0.14em',
            marginBottom: 10,
          }}
        >
          Most accurate
        </div>
        <ClubRows entries={top} />
      </div>
      <div>
        <div
          className="font-mono uppercase text-caddie-ink-mute"
          style={{
            fontSize: 10,
            letterSpacing: '0.14em',
            marginBottom: 10,
          }}
        >
          Least accurate
        </div>
        <ClubRows entries={bottom} />
      </div>
    </div>
  )
}

function ClubRows({ entries }: { entries: ClubAccuracyEntry[] }) {
  const { toDisplay } = useUnits()
  return (
    <div style={{ borderTop: '1px solid #D9D2BF' }}>
      {entries.map((e) => (
        <div
          key={e.club}
          className="flex items-baseline justify-between"
          style={{ borderBottom: '1px solid #D9D2BF', padding: '12px 0' }}
        >
          <span
            className="font-serif text-caddie-ink"
            style={{
              fontSize: 17,
              fontWeight: 500,
              textTransform: 'uppercase',
            }}
          >
            {e.club}
          </span>
          <span className="flex items-baseline" style={{ gap: 14 }}>
            <span
              className="font-mono uppercase tabular text-caddie-ink-mute"
              style={{ fontSize: 10, letterSpacing: '0.14em' }}
            >
              {e.shots} shots
            </span>
            <span
              className="font-serif tabular text-caddie-ink"
              style={{
                fontSize: 22,
                fontStyle: 'italic',
                fontWeight: 500,
              }}
            >
              {toDisplay(e.avgLateralYards, 1)}
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}

function RecoveryStat({ stat }: { stat: RecoveryRateStat }) {
  return (
    <div
      style={{
        border: '1px solid #D9D2BF',
        borderRadius: 4,
        padding: 18,
        background: '#FBF8F1',
      }}
    >
      <div className="flex items-baseline" style={{ gap: 18 }}>
        <span
          className="font-serif tabular"
          style={{
            fontSize: 32,
            fontStyle: 'italic',
            fontWeight: 500,
            color: '#1F3D2C',
            lineHeight: 1.05,
          }}
        >
          {fmtPct(stat.recoveryPct)}
        </span>
        <span
          className="font-serif text-caddie-ink-dim"
          style={{ fontSize: 17 }}
        >
          {stat.totalRoughShots > 0
            ? `${stat.totalRoughShots} rough shot${stat.totalRoughShots === 1 ? '' : 's'} → fairway or green next`
            : 'Need shots logged from rough'}
        </span>
      </div>
    </div>
  )
}

function Insufficient({ note }: { note: string }) {
  return (
    <div
      className="text-caddie-ink-mute"
      style={{
        border: '1px dashed #D9D2BF',
        borderRadius: 4,
        padding: '18px 22px',
        fontSize: 13,
      }}
    >
      {note}
    </div>
  )
}

function EmptyState() {
  return (
    <div
      className="bg-caddie-surface text-center"
      style={{
        border: '1px solid #D9D2BF',
        borderRadius: 4,
        padding: '40px 24px',
      }}
    >
      <div
        className="font-serif text-caddie-ink"
        style={{ fontSize: 22, fontWeight: 500 }}
      >
        No rounds in this window.
      </div>
      <div
        className="text-caddie-ink-dim"
        style={{ fontSize: 15, marginTop: 8, maxWidth: 360, marginInline: 'auto' }}
      >
        Finalize a round to see the full breakdown — strokes gained,
        scoring, ball striking, short game, and patterns.
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            borderTop: '1px solid #D9D2BF',
            paddingTop: 18,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              height: 10,
              width: 120,
              background: '#EBE5D6',
              marginBottom: 18,
            }}
          />
          <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 14 }}>
            {[0, 1, 2, 3].map((j) => (
              <div
                key={j}
                style={{
                  border: '1px solid #D9D2BF',
                  background: '#FBF8F1',
                  borderRadius: 4,
                  padding: 18,
                  height: 96,
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ===========================================================================
// Formatters — never return NaN/undefined to the DOM.
// ===========================================================================

function fmtNumber(v: number | null, digits: number): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return v.toFixed(digits)
}

function fmtInt(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return Math.round(v).toString()
}

function fmtPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${v.toFixed(0)}%`
}

function formatBandLabel(
  band: ApproachBandStat,
  unit: 'yards' | 'meters',
  toDisplay: (yards: number, decimals?: number) => string,
): string {
  if (!Number.isFinite(band.maxYards)) {
    return `${toDisplay(band.minYards)}+`
  }
  // Show range as "min–max <unit>" by stripping the unit off the lower bound.
  const upper = toDisplay(band.maxYards)
  const lowerNumeric = unit === 'meters'
    ? (band.minYards * 0.9144).toFixed(0)
    : band.minYards.toFixed(0)
  return `${lowerNumeric}–${upper}`
}
