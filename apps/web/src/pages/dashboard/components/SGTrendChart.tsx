import { formatSG } from '@oga/core'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface SGTrendPoint {
  date: string
  sg: number
}

interface SGTrendChartProps {
  data: SGTrendPoint[]
}

const TICK_STYLE = { fontSize: 11, fill: '#8A8B7E' } as const

// A paper tag, like the map's plates: ink edge, hard offset, no blur.
const TOOLTIP_STYLE = {
  backgroundColor: '#FBF8F1',
  border: '1px solid #1C211C',
  borderRadius: 3,
  boxShadow: '2px 2px 0 rgba(28,33,28,.55)',
  fontSize: 12,
  padding: '6px 10px',
  fontFamily: 'Epilogue, sans-serif',
} as const

const signColor = (v: number) => (v > 0 ? '#1F3D2C' : v < 0 ? '#A33A2A' : '#5C6356')

// Each round's dot takes its sign's colour, so a bad round reads at a glance.
function SignDot(props: { cx?: number; cy?: number; payload?: SGTrendPoint }) {
  const { cx, cy, payload } = props
  if (cx == null || cy == null || !payload) return null
  return <circle cx={cx} cy={cy} r={3} fill={signColor(payload.sg)} stroke="#F2EEE5" strokeWidth={1.5} />
}

// Extracted from DashboardPage so recharts (~150KB gzip) loads
// asynchronously on the dashboard route — without this split, recharts
// rides eagerly on the first authenticated paint.
export function SGTrendChart({ data }: SGTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
        <CartesianGrid stroke="#EBE5D6" vertical={false} />
        <XAxis
          dataKey="date"
          tick={TICK_STYLE}
          tickLine={false}
          axisLine={{ stroke: '#D9D2BF' }}
          minTickGap={24}
        />
        <YAxis
          tick={TICK_STYLE}
          tickLine={false}
          axisLine={{ stroke: '#D9D2BF' }}
        />
        <ReferenceLine y={0} stroke="#9F9580" strokeDasharray="3 3" />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: '#5C6356', marginBottom: 2 }}
          cursor={{ stroke: '#9F9580', strokeDasharray: '2 3' }}
          formatter={(v: number) => [
            <span key="v" style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontSize: 15, color: signColor(v) }}>
              {formatSG(v)}
            </span>,
            'Strokes gained',
          ]}
        />
        <Line
          type="linear"
          dataKey="sg"
          name="Strokes gained"
          stroke="#1C211C"
          strokeWidth={1.5}
          dot={<SignDot />}
          activeDot={{ r: 5, fill: '#1C211C', stroke: '#F2EEE5', strokeWidth: 2 }}
          animationDuration={700}
          animationEasing="ease-out"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
