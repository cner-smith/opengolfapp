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

const SERIES = [
  { key: 'sg_off_tee', label: 'Off tee', color: '#1D9E75' },
  { key: 'sg_approach', label: 'Approach', color: '#E24B4A' },
  { key: 'sg_around_green', label: 'Around green', color: '#EF9F27' },
  { key: 'sg_putting', label: 'Putting', color: '#378ADD' },
] as const

const TICK_STYLE = { fontSize: 11, fill: '#888880' } as const
const TOOLTIP_STYLE = {
  backgroundColor: '#FFFFFF',
  border: '0.5px solid #E4E4E0',
  borderRadius: 10,
  fontSize: 11,
  padding: '8px 10px',
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
        style={{ marginBottom: 18 }}
      >
        <div>
          <h1
            className="text-oga-text-primary"
            style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.3 }}
          >
            Strokes Gained
          </h1>
          <div
            className="text-oga-text-muted"
            style={{ fontSize: 13, marginTop: 2 }}
          >
            Per-category strokes vs. the bracket baseline
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
        <div className="text-oga-text-muted" style={{ fontSize: 13 }}>
          Loading…
        </div>
      ) : rounds.length === 0 ? (
        <div
          className="bg-oga-bg-card text-center"
          style={{
            border: '0.5px solid #E4E4E0',
            borderRadius: 10,
            padding: '32px 24px',
          }}
        >
          <div className="font-medium" style={{ fontSize: 15 }}>
            No rounds with strokes gained yet
          </div>
          <div
            className="text-oga-text-muted"
            style={{ fontSize: 13, marginTop: 6 }}
          >
            Finalize a round to see SG trends per category.
          </div>
        </div>
      ) : (
        <>
          <div
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            style={{ marginBottom: 12 }}
          >
            {avg.map((s) => (
              <CategoryTile
                key={s.key}
                label={s.label}
                color={s.color}
                value={s.value}
              />
            ))}
          </div>

          <div
            className="bg-oga-bg-card"
            style={{
              border: '0.5px solid #E4E4E0',
              borderRadius: 10,
              padding: '12px 14px',
            }}
          >
            <div
              className="text-oga-text-muted uppercase"
              style={{
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: 0.4,
                marginBottom: 8,
              }}
            >
              SG by category — last {rounds.length} rounds
            </div>
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
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
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ fontSize: 11, color: '#888880' }}
                  />
                  {SERIES.map((s) => (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.label}
                      stroke={s.color}
                      strokeWidth={2}
                      dot={{ r: 2.5, fill: s.color, strokeWidth: 0 }}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
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
      className="bg-oga-bg-card"
      style={{
        border: '0.5px solid #E4E4E0',
        borderRadius: 10,
        padding: 3,
        display: 'inline-flex',
        gap: 2,
      }}
    >
      {options.map((opt) => {
        const active = opt === value
        return (
          <button
            key={String(opt)}
            type="button"
            onClick={() => onChange(opt)}
            style={{
              backgroundColor: active ? '#111111' : 'transparent',
              color: active ? '#FFFFFF' : '#888880',
              border: 'none',
              borderRadius: 7,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 500,
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
  const tone =
    value > 0 ? '#0F6E56' : value < 0 ? '#A32D2D' : '#888880'
  return (
    <div
      className="bg-oga-bg-card"
      style={{
        border: '0.5px solid #E4E4E0',
        borderRadius: 10,
        padding: '12px 14px',
      }}
    >
      <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 9999,
            backgroundColor: color,
          }}
        />
        <span className="text-oga-text-muted" style={{ fontSize: 11 }}>
          {label}
        </span>
      </div>
      <div className="tabular" style={{ fontSize: 22, fontWeight: 500, color: tone }}>
        {value > 0 ? '+' : ''}
        {value.toFixed(2)}
      </div>
    </div>
  )
}
