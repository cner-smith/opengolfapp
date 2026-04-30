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
import { useRecentSG } from '../../hooks/useRounds'

const N_OPTIONS = [5, 10, 20] as const

// Single saturated color (accent forest) plus muted brick/amber and an
// ink-dim fourth — keeps the chart inside the editorial palette.
const SERIES = [
  { key: 'sg_off_tee', label: 'Off tee', color: '#1F3D2C' },
  { key: 'sg_approach', label: 'Approach', color: '#A33A2A' },
  { key: 'sg_around_green', label: 'Around green', color: '#A66A1F' },
  { key: 'sg_putting', label: 'Putting', color: '#5C6356' },
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

export function StrokesGainedPage() {
  const [n, setN] = useState<number>(10)
  const sg = useRecentSG(n)
  const rounds = sg.data ?? []

  const trend = [...rounds].reverse().map((r) => ({
    date: r.played_at,
    sg_off_tee: r.sg_off_tee ?? 0,
    sg_approach: r.sg_approach ?? 0,
    sg_around_green: r.sg_around_green ?? 0,
    sg_putting: r.sg_putting ?? 0,
  }))

  const avg = SERIES.map((s) => {
    const values = rounds.map((r) => r[s.key]).filter((v): v is number => v !== null)
    const a = values.length === 0 ? 0 : values.reduce((x, y) => x + y, 0) / values.length
    return { ...s, value: a }
  })

  return (
    <div>
      <div
        className="flex items-end justify-between"
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
            Strokes Gained
          </h1>
          <div
            className="text-caddie-ink-dim"
            style={{ fontSize: 15, marginTop: 6, maxWidth: 560 }}
          >
            Per-category strokes vs. the bracket baseline.
          </div>
        </div>
        <Segmented
          value={n}
          options={N_OPTIONS as unknown as readonly number[]}
          onChange={setN}
          renderLabel={(v) => `Last ${v}`}
        />
      </div>

      {sg.isLoading ? (
        <div className="text-caddie-ink-mute" style={{ fontSize: 13 }}>
          Loading…
        </div>
      ) : rounds.length === 0 ? (
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
            No rounds with strokes gained yet
          </div>
          <div
            className="text-caddie-ink-dim"
            style={{ fontSize: 15, marginTop: 8 }}
          >
            Finalize a round to see SG trends per category.
          </div>
        </div>
      ) : (
        <>
          <Section kicker="By the numbers">
            <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 14 }}>
              {avg.map((s) => (
                <CategoryTile
                  key={s.key}
                  label={s.label}
                  color={s.color}
                  value={s.value}
                />
              ))}
            </div>
          </Section>

          <Section kicker={`SG by category — last ${rounds.length} rounds`}>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
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
                  {SERIES.map((s) => (
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
          </Section>
        </>
      )}
    </div>
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

function CategoryTile({
  label,
  color,
  value,
}: {
  label: string
  color: string
  value: number
}) {
  const tone = value > 0 ? '#1F3D2C' : value < 0 ? '#A33A2A' : '#5C6356'
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
        <span
          style={{
            width: 10,
            height: 2,
            backgroundColor: color,
          }}
        />
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
        {value > 0 ? '+' : ''}
        {value.toFixed(2)}
      </div>
    </div>
  )
}
