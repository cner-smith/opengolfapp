import { Link } from 'react-router-dom'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatSG } from '@oga/core'
import { useRecentSG } from '../../hooks/useRounds'
import { useProfile } from '../../hooks/useProfile'

const SG_KEYS = [
  { key: 'sg_off_tee', label: 'Off tee' },
  { key: 'sg_approach', label: 'Approach' },
  { key: 'sg_around_green', label: 'Around green' },
  { key: 'sg_putting', label: 'Putting' },
] as const

const TICK_STYLE = { fontSize: 11, fill: '#8A8B7E' } as const

const TOOLTIP_STYLE = {
  backgroundColor: '#FBF8F1',
  border: '1px solid #D9D2BF',
  borderRadius: 4,
  fontSize: 11,
  padding: '8px 10px',
  fontFamily: 'Inter, sans-serif',
} as const

export function DashboardPage() {
  const profile = useProfile()
  const sg = useRecentSG(20)
  const rounds = sg.data ?? []

  const firstName =
    profile.data?.username?.split(/\s+/)[0] ?? null

  if (sg.isLoading) {
    return <div className="text-caddie-ink-mute">Loading…</div>
  }

  if (rounds.length === 0) {
    return (
      <div>
        <Masthead greeting={firstName} subtitle="Log a round to start tracking your strokes gained." />
        <EmptyState
          headline="No rounds logged yet"
          body="Log your first round to see your strokes gained breakdown."
          ctaLabel="Log a round"
          ctaTo="/rounds/new"
        />
      </div>
    )
  }

  const avgs = SG_KEYS.map((c) => {
    const values = rounds.map((r) => r[c.key]).filter((v): v is number => v !== null)
    const avg = values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length
    return { ...c, value: Number(avg.toFixed(2)) }
  })

  const maxAbs = Math.max(...avgs.map((a) => Math.abs(a.value)), 0.5)

  const trendData = [...rounds].reverse().map((r) => ({
    date: r.played_at,
    sg: r.sg_total ?? 0,
  }))

  const totalScore = rounds.reduce((s, r) => s + (r.total_score ?? 0), 0)
  const totalScoreCount = rounds.filter((r) => r.total_score !== null).length
  const avgScore = totalScoreCount > 0 ? totalScore / totalScoreCount : 0

  const totalSG = avgs.reduce((s, a) => s + a.value, 0)

  const weakest = [...avgs].sort((a, b) => a.value - b.value)[0]!
  const strongest = [...avgs].sort((a, b) => b.value - a.value)[0]!

  return (
    <div>
      <Masthead
        greeting={firstName}
        subtitle={`Last ${rounds.length} round${rounds.length === 1 ? '' : 's'}${
          profile.data?.handicap_index != null ? ` · Handicap ${profile.data.handicap_index}` : ''
        }`}
      />

      <Lede strongest={strongest} weakest={weakest} />

      <Section kicker="By the numbers">
        <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 14 }}>
          <StatTile
            label="Avg score"
            value={avgScore > 0 ? avgScore.toFixed(1) : '—'}
          />
          <StatTile
            label="SG total"
            value={formatSG(totalSG)}
            tone={totalSG > 0 ? 'pos' : totalSG < 0 ? 'neg' : 'neutral'}
          />
          <StatTile label="Rounds" value={rounds.length.toString()} />
          <StatTile label="Categories" value={SG_KEYS.length.toString()} />
        </div>
      </Section>

      <Section kicker="SG breakdown">
        <div className="flex flex-col" style={{ gap: 14 }}>
          {avgs.map((a) => (
            <SGBar key={a.key} label={a.label} value={a.value} max={maxAbs} />
          ))}
        </div>
      </Section>

      <Section kicker="SG total trend">
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
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
              <Line
                type="monotone"
                dataKey="sg"
                stroke="#1F3D2C"
                strokeWidth={1.5}
                dot={{ r: 2.5, fill: '#1F3D2C', strokeWidth: 0 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section kicker="Recent rounds">
        <ul>
          {rounds.slice(0, 5).map((r, i) => (
            <li
              key={r.id}
              style={{
                borderTop: i === 0 ? 'none' : '1px solid #D9D2BF',
              }}
            >
              <Link
                to={`/rounds/${r.id}`}
                className="flex items-center justify-between transition-colors hover:bg-caddie-surface"
                style={{ padding: '14px 0' }}
              >
                <div>
                  <div
                    className="font-serif text-caddie-ink"
                    style={{ fontSize: 17, fontWeight: 500 }}
                  >
                    {r.courses?.name ?? 'Round'}
                  </div>
                  <div
                    className="font-mono uppercase text-caddie-ink-mute tabular"
                    style={{ fontSize: 10, letterSpacing: '0.14em', marginTop: 4 }}
                  >
                    {r.played_at}
                  </div>
                </div>
                <div className="flex items-baseline" style={{ gap: 18 }}>
                  <div
                    className="font-serif tabular text-caddie-ink"
                    style={{ fontSize: 22, fontWeight: 500 }}
                  >
                    {r.total_score ?? '—'}
                  </div>
                  <SGValue value={r.sg_total} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

function Masthead({ greeting, subtitle }: { greeting: string | null; subtitle: string }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h1
        className="font-serif text-caddie-ink"
        style={{
          fontSize: 38,
          fontWeight: 500,
          fontStyle: 'italic',
          letterSpacing: '-0.025em',
          lineHeight: 1.05,
        }}
      >
        {greeting ? `Good round, ${greeting}.` : 'Good round.'}
      </h1>
      <div
        className="text-caddie-ink-dim"
        style={{ fontSize: 15, marginTop: 8 }}
      >
        {subtitle}
      </div>
    </div>
  )
}

function Lede({
  strongest,
  weakest,
}: {
  strongest: { label: string; value: number }
  weakest: { label: string; value: number }
}) {
  if (weakest.value >= 0) {
    return (
      <p
        className="font-serif text-caddie-ink"
        style={{
          fontSize: 17,
          fontWeight: 400,
          lineHeight: 1.55,
          maxWidth: 640,
          marginBottom: 28,
        }}
      >
        Everything is net positive right now. <em>{strongest.label}</em> leads
        the four at {fmtSG(strongest.value)} a round — keep doing what you are doing.
      </p>
    )
  }
  return (
    <p
      className="font-serif text-caddie-ink"
      style={{
        fontSize: 17,
        fontWeight: 400,
        lineHeight: 1.55,
        maxWidth: 640,
        marginBottom: 28,
      }}
    >
      <em>{weakest.label}.</em> Your biggest leak — costing about{' '}
      {fmtAbs(weakest.value)} a round. {strongest.label.toLowerCase()} is the
      one bright spot at {fmtSG(strongest.value)}.
    </p>
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
    <section style={{ marginBottom: 28 }}>
      <div
        style={{
          borderTop: '1px solid #D9D2BF',
          paddingTop: 14,
          marginBottom: 14,
        }}
      >
        <div className="kicker">{kicker}</div>
      </div>
      {children}
    </section>
  )
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'pos' | 'neg' | 'neutral'
}) {
  const color =
    tone === 'pos' ? '#1F3D2C' : tone === 'neg' ? '#A33A2A' : '#1C211C'
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
        className="font-serif tabular"
        style={{ fontSize: 32, fontWeight: 500, color, lineHeight: 1.05 }}
      >
        {value}
      </div>
    </div>
  )
}

function SGBar({
  label,
  value,
  max,
}: {
  label: string
  value: number
  max: number
}) {
  const pct = Math.min(Math.abs(value) / max, 1) * 50
  const isPositive = value > 0
  const color = value > 0 ? '#1F3D2C' : value < 0 ? '#A33A2A' : '#8A8B7E'
  return (
    <div className="flex items-center" style={{ gap: 14 }}>
      <div
        className="text-caddie-ink"
        style={{ width: 130, fontSize: 13, flexShrink: 0 }}
      >
        {label}
      </div>
      <div
        className="relative flex-1"
        style={{ height: 8 }}
      >
        <div
          className="absolute inset-x-0"
          style={{ top: '50%', height: 1, backgroundColor: '#D9D2BF' }}
        />
        <div
          className="absolute"
          style={{ left: '50%', top: 0, bottom: 0, width: 1, backgroundColor: '#9F9580' }}
        />
        <div
          className="absolute"
          style={{
            left: isPositive ? '50%' : `${50 - pct}%`,
            top: 1,
            bottom: 1,
            width: `${pct}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <div
        className="font-serif tabular text-right"
        style={{
          width: 60,
          fontSize: 17,
          fontStyle: 'italic',
          fontWeight: 500,
          color,
        }}
      >
        {formatSG(value)}
      </div>
    </div>
  )
}

function SGValue({ value }: { value: number | null }) {
  if (value === null)
    return (
      <span className="text-caddie-ink-mute font-serif" style={{ fontSize: 17 }}>
        —
      </span>
    )
  const color = value > 0 ? '#1F3D2C' : value < 0 ? '#A33A2A' : '#5C6356'
  return (
    <span
      className="font-serif tabular"
      style={{
        color,
        fontSize: 17,
        fontStyle: 'italic',
        fontWeight: 500,
      }}
    >
      {formatSG(value)}
    </span>
  )
}

function EmptyState({
  headline,
  body,
  ctaLabel,
  ctaTo,
}: {
  headline: string
  body: string
  ctaLabel: string
  ctaTo: string
}) {
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
        {headline}
      </div>
      <div
        className="text-caddie-ink-dim"
        style={{ fontSize: 15, marginTop: 8, maxWidth: 360, marginInline: 'auto' }}
      >
        {body}
      </div>
      <Link
        to={ctaTo}
        className="bg-caddie-accent text-caddie-accent-ink hover:opacity-90"
        style={{
          display: 'inline-block',
          padding: '12px 16px',
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: '0.02em',
          borderRadius: 2,
          marginTop: 22,
        }}
      >
        {ctaLabel} <span className="font-serif" style={{ fontStyle: 'italic' }}>→</span>
      </Link>
    </div>
  )
}

function fmtSG(value: number): string {
  if (value === 0) return 'even'
  return `${formatSG(value)} strokes`
}

function fmtAbs(value: number): string {
  return `${Math.abs(value).toFixed(1)} strokes`
}
