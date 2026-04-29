import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
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

const CATEGORIES = [
  { key: 'sg_off_tee', label: 'Off tee' },
  { key: 'sg_approach', label: 'Approach' },
  { key: 'sg_around_green', label: 'Around green' },
  { key: 'sg_putting', label: 'Putting' },
] as const

export function DashboardPage() {
  const profile = useProfile()
  const sg = useRecentSG(20)
  const rounds = sg.data ?? []

  if (sg.isLoading) {
    return <div className="text-fairway-700">Loading…</div>
  }
  if (rounds.length === 0) {
    return (
      <div>
        <h1 className="mb-2 text-2xl font-bold text-fairway-700">Dashboard</h1>
        <div className="rounded-lg border border-dashed border-gray-200 bg-white p-8 text-center">
          <p className="text-gray-600">
            Log a round to see strokes-gained data here.
          </p>
          <Link
            to="/rounds/new"
            className="mt-3 inline-block text-sm text-fairway-700 hover:underline"
          >
            Log your first round →
          </Link>
        </div>
      </div>
    )
  }

  const breakdown = CATEGORIES.map((c) => {
    const values = rounds.map((r) => r[c.key]).filter((v): v is number => v !== null)
    const avg = values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length
    return { label: c.label, value: Number(avg.toFixed(2)) }
  })

  const trend = [...rounds]
    .reverse()
    .map((r) => ({
      date: r.played_at,
      sg_total: r.sg_total ?? 0,
      score: r.total_score ?? 0,
    }))

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fairway-700">Dashboard</h1>
          {profile.data?.handicap_index !== null && profile.data?.handicap_index !== undefined && (
            <div className="text-sm text-gray-500">
              Handicap {profile.data.handicap_index} · {profile.data.skill_level ?? '—'}
            </div>
          )}
        </div>
        <div className="text-sm text-gray-500">
          Based on last <span className="font-semibold">{rounds.length}</span> rounds
        </div>
      </div>

      <div className="rounded-lg bg-white p-5 shadow-sm">
        <div className="mb-3 text-sm font-semibold text-gray-700">SG breakdown (avg)</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={breakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#3f8d5a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg bg-white p-5 shadow-sm">
        <div className="mb-3 text-sm font-semibold text-gray-700">SG total trend</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="sg_total"
                stroke="#23613b"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-semibold text-gray-700">Recent rounds</span>
          <Link to="/rounds" className="text-fairway-700 hover:underline">
            All rounds →
          </Link>
        </div>
        <ul className="divide-y divide-gray-100">
          {rounds.slice(0, 5).map((r) => (
            <li key={r.id}>
              <Link
                to={`/rounds/${r.id}`}
                className="flex items-center justify-between py-2 text-sm hover:bg-fairway-50"
              >
                <div>
                  <div className="font-medium text-gray-900">
                    {r.courses?.name ?? 'Round'}
                  </div>
                  <div className="text-xs text-gray-500">{r.played_at}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{r.total_score ?? '—'}</div>
                  <div
                    className={
                      r.sg_total === null
                        ? 'text-gray-400'
                        : r.sg_total >= 0
                          ? 'text-emerald-700'
                          : 'text-red-700'
                    }
                  >
                    SG {r.sg_total === null ? '—' : (r.sg_total > 0 ? '+' : '') + r.sg_total.toFixed(2)}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
