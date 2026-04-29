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
  { key: 'sg_off_tee', label: 'Off tee', color: '#3f8d5a' },
  { key: 'sg_approach', label: 'Approach', color: '#23613b' },
  { key: 'sg_around_green', label: 'Around green', color: '#a16207' },
  { key: 'sg_putting', label: 'Putting', color: '#1e3a8a' },
] as const

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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-fairway-700">Strokes Gained</h1>
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1 text-sm">
          {N_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setN(opt)}
              className={`rounded px-3 py-1 ${
                n === opt
                  ? 'bg-fairway-500 text-white'
                  : 'text-gray-700 hover:bg-fairway-50'
              }`}
            >
              Last {opt}
            </button>
          ))}
        </div>
      </div>

      {sg.isLoading ? (
        <div className="text-fairway-700">Loading…</div>
      ) : rounds.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-white p-8 text-center text-gray-600">
          No rounds with strokes-gained data yet.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {avg.map((s) => (
              <div key={s.key} className="rounded-lg border border-gray-100 bg-white p-4">
                <div className="text-xs text-gray-500">{s.label}</div>
                <div
                  className={`text-2xl font-bold ${
                    s.value > 0
                      ? 'text-emerald-700'
                      : s.value < 0
                        ? 'text-red-700'
                        : 'text-gray-700'
                  }`}
                >
                  {s.value > 0 ? '+' : ''}
                  {s.value.toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-white p-5 shadow-sm">
            <div className="mb-3 text-sm font-semibold text-gray-700">
              Per-category SG over last {rounds.length} rounds
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  {SERIES.map((s) => (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.label}
                      stroke={s.color}
                      strokeWidth={2}
                      dot={{ r: 2 }}
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
