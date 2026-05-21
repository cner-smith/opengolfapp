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
import type { DetailedStats } from '@oga/core'
import { Insufficient, Section, Subkicker } from '../components/Section'
import { ApproachBandTile, SgTile } from '../components/StatTiles'

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
  { key: 'offTee', label: 'Off tee', color: '#1F3D2C', dashed: false },
  { key: 'approach', label: 'Approach', color: '#A33A2A', dashed: false },
  { key: 'aroundGreen', label: 'Around green', color: '#A66A1F', dashed: false },
  { key: 'putting', label: 'Putting', color: '#5C6356', dashed: true },
] as const

function SGLegend() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        justifyContent: 'center',
        flexWrap: 'wrap',
        fontSize: 11,
        fontFamily: 'Inter, sans-serif',
        paddingTop: 8,
      }}
    >
      {SG_SERIES.map((s) => (
        <span key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#5C6356' }}>
          <svg width="16" height="10" style={{ flexShrink: 0 }}>
            <line
              x1="0" y1="5" x2="16" y2="5"
              stroke={s.color}
              strokeWidth="1.5"
              strokeDasharray={s.dashed ? '4 3' : undefined}
            />
          </svg>
          {s.label}
        </span>
      ))}
    </div>
  )
}

export function StrokesGainedSection({ data }: { data: DetailedStats }) {
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
                <Legend content={<SGLegend />} />
                {SG_SERIES.map((s) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label}
                    stroke={s.color}
                    strokeWidth={1.5}
                    strokeDasharray={s.dashed ? '4 3' : undefined}
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
