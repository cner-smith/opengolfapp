import {
  CartesianGrid,
  Line,
  LineChart,
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

const TOOLTIP_STYLE = {
  backgroundColor: '#FBF8F1',
  border: '1px solid #D9D2BF',
  borderRadius: 4,
  fontSize: 11,
  padding: '8px 10px',
  fontFamily: 'Inter, sans-serif',
} as const

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
  )
}
