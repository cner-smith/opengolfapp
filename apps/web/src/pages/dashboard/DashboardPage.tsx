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
import { useRecentSG } from '../../hooks/useRounds'
import { useProfile } from '../../hooks/useProfile'

const SG_KEYS = [
  { key: 'sg_off_tee', label: 'Off tee' },
  { key: 'sg_approach', label: 'Approach' },
  { key: 'sg_around_green', label: 'Around green' },
  { key: 'sg_putting', label: 'Putting' },
] as const

const TICK_STYLE = { fontSize: 11, fill: '#888880' } as const

const TOOLTIP_STYLE = {
  backgroundColor: '#FFFFFF',
  border: '0.5px solid #E4E4E0',
  borderRadius: 10,
  fontSize: 11,
  padding: '8px 10px',
} as const

export function DashboardPage() {
  const profile = useProfile()
  const sg = useRecentSG(20)
  const rounds = sg.data ?? []

  if (sg.isLoading) {
    return <div className="text-oga-text-muted">Loading…</div>
  }

  if (rounds.length === 0) {
    return (
      <div>
        <PageHeader title="Dashboard" subtitle="Track your strokes gained over time" />
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

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`Based on your last ${rounds.length} round${rounds.length === 1 ? '' : 's'}${
          profile.data?.handicap_index != null ? ` · Handicap ${profile.data.handicap_index}` : ''
        }`}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" style={{ marginBottom: 12 }}>
        <MetricTile
          label="Avg score"
          value={avgScore > 0 ? avgScore.toFixed(1) : '—'}
        />
        <MetricTile
          label="SG total"
          value={`${totalSG > 0 ? '+' : ''}${totalSG.toFixed(2)}`}
          tone={totalSG > 0 ? 'positive' : totalSG < 0 ? 'negative' : 'neutral'}
        />
        <MetricTile
          label="Rounds"
          value={rounds.length.toString()}
        />
        <MetricTile
          label="Categories tracked"
          value={SG_KEYS.length.toString()}
        />
      </div>

      <Card label="SG breakdown" style={{ marginBottom: 12 }}>
        <div className="flex flex-col gap-2">
          {avgs.map((a) => (
            <SGBar key={a.key} label={a.label} value={a.value} max={maxAbs} />
          ))}
        </div>
      </Card>

      <Card label="SG total trend" style={{ marginBottom: 12 }}>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
              <CartesianGrid stroke="#F0F0EC" vertical={false} />
              <XAxis
                dataKey="date"
                tick={TICK_STYLE}
                tickLine={false}
                axisLine={{ stroke: '#E4E4E0' }}
              />
              <YAxis
                tick={TICK_STYLE}
                tickLine={false}
                axisLine={{ stroke: '#E4E4E0' }}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: '#888880' }}
              />
              <Line
                type="monotone"
                dataKey="sg"
                stroke="#1D9E75"
                strokeWidth={2}
                dot={{ r: 3, fill: '#1D9E75', strokeWidth: 0 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card label="Recent rounds">
        <ul className="divide-y divide-oga-border">
          {rounds.slice(0, 5).map((r) => (
            <li key={r.id}>
              <Link
                to={`/rounds/${r.id}`}
                className="flex items-center justify-between py-2 text-sm transition-colors hover:bg-oga-bg-input"
              >
                <div>
                  <div className="font-medium text-oga-text-primary">
                    {r.courses?.name ?? 'Round'}
                  </div>
                  <div className="text-oga-text-muted" style={{ fontSize: 11 }}>
                    {r.played_at}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className="font-medium tabular text-oga-text-primary"
                    style={{ fontSize: 14 }}
                  >
                    {r.total_score ?? '—'}
                  </div>
                  <SGPill value={r.sg_total} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h1
        className="text-oga-text-primary"
        style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.3 }}
      >
        {title}
      </h1>
      {subtitle && (
        <div
          className="text-oga-text-muted"
          style={{ fontSize: 13, marginTop: 2 }}
        >
          {subtitle}
        </div>
      )}
    </div>
  )
}

function Card({
  label,
  children,
  style,
}: {
  label?: string
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div
      className="bg-oga-bg-card"
      style={{
        border: '0.5px solid #E4E4E0',
        borderRadius: 10,
        padding: '12px 14px',
        ...style,
      }}
    >
      {label && (
        <div
          className="text-oga-text-muted uppercase"
          style={{
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: 0.4,
            marginBottom: 8,
          }}
        >
          {label}
        </div>
      )}
      {children}
    </div>
  )
}

function MetricTile({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'positive' | 'negative' | 'neutral'
}) {
  const color =
    tone === 'positive'
      ? '#0F6E56'
      : tone === 'negative'
        ? '#A32D2D'
        : '#111111'
  return (
    <div
      className="bg-oga-bg-card"
      style={{
        border: '0.5px solid #E4E4E0',
        borderRadius: 10,
        padding: '12px 14px',
      }}
    >
      <div
        className="text-oga-text-muted"
        style={{ fontSize: 10, marginBottom: 3 }}
      >
        {label}
      </div>
      <div className="tabular" style={{ fontSize: 22, fontWeight: 500, color }}>
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
  const color = value > 0 ? '#1D9E75' : value < 0 ? '#E24B4A' : '#AAAAAA'
  const textColor = value > 0 ? '#0F6E56' : value < 0 ? '#A32D2D' : '#888880'
  return (
    <div className="flex items-center gap-3">
      <div
        className="text-oga-text-muted"
        style={{ width: 100, fontSize: 12, flexShrink: 0 }}
      >
        {label}
      </div>
      <div
        className="relative flex-1 rounded"
        style={{ height: 7, backgroundColor: '#F0F0EC' }}
      >
        <div
          className="absolute inset-y-0"
          style={{ left: '50%', width: 1, backgroundColor: '#E4E4E0' }}
        />
        <div
          className="absolute inset-y-0 rounded"
          style={{
            left: isPositive ? '50%' : `${50 - pct}%`,
            width: `${pct}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <div
        className="tabular text-right"
        style={{
          width: 44,
          fontSize: 12,
          fontWeight: 500,
          color: textColor,
        }}
      >
        {value > 0 ? '+' : ''}
        {value.toFixed(2)}
      </div>
    </div>
  )
}

function SGPill({ value }: { value: number | null }) {
  if (value === null) return <span className="text-oga-text-hint" style={{ fontSize: 11 }}>—</span>
  const pos = value > 0
  const neg = value < 0
  const bg = pos ? '#E1F5EE' : neg ? '#FCEBEB' : '#F1EFE8'
  const fg = pos ? '#0F6E56' : neg ? '#A32D2D' : '#5F5E5A'
  return (
    <span
      className="tabular"
      style={{
        backgroundColor: bg,
        color: fg,
        fontSize: 10,
        fontWeight: 500,
        padding: '2px 8px',
        borderRadius: 8,
        display: 'inline-block',
      }}
    >
      SG {value > 0 ? '+' : ''}
      {value.toFixed(2)}
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
      className="bg-oga-bg-card text-center"
      style={{
        border: '0.5px solid #E4E4E0',
        borderRadius: 10,
        padding: '32px 24px',
      }}
    >
      <div className="font-medium" style={{ fontSize: 15 }}>
        {headline}
      </div>
      <div className="text-oga-text-muted" style={{ fontSize: 13, marginTop: 6 }}>
        {body}
      </div>
      <Link
        to={ctaTo}
        className="mt-4 inline-block rounded-card bg-oga-black text-white transition-colors hover:bg-oga-text-primary/90"
        style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500, marginTop: 16 }}
      >
        {ctaLabel}
      </Link>
    </div>
  )
}
