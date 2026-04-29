import { Link } from 'react-router-dom'
import { useRounds } from '../../hooks/useRounds'

function formatSG(value: number | null): string {
  if (value === null) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}`
}

export function RoundsPage() {
  const { data: rounds, isLoading, error } = useRounds()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-fairway-700">Rounds</h1>
        <Link
          to="/rounds/new"
          className="rounded bg-fairway-500 px-4 py-2 text-sm text-white hover:bg-fairway-700"
        >
          + New round
        </Link>
      </div>

      {isLoading && <div className="text-sm text-gray-500">Loading rounds…</div>}
      {error && (
        <div className="rounded bg-red-50 p-3 text-sm text-red-700">
          {(error as Error).message}
        </div>
      )}

      {!isLoading && rounds && rounds.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-200 bg-white p-8 text-center">
          <p className="text-gray-600">No rounds yet.</p>
          <Link
            to="/rounds/new"
            className="mt-3 inline-block text-sm text-fairway-700 hover:underline"
          >
            Log your first round →
          </Link>
        </div>
      )}

      <ul className="space-y-2">
        {rounds?.map((r) => (
          <li key={r.id}>
            <Link
              to={`/rounds/${r.id}`}
              className="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm hover:bg-fairway-50"
            >
              <div>
                <div className="font-semibold text-gray-900">
                  {r.courses?.name ?? 'Round'}
                </div>
                <div className="text-xs text-gray-500">
                  {r.played_at}
                  {r.tee_color ? ` · ${r.tee_color} tees` : ''}
                </div>
              </div>
              <div className="text-right text-sm">
                <div className="font-semibold">
                  {r.total_score ?? '—'}{' '}
                  <span className="text-xs text-gray-500">score</span>
                </div>
                <div
                  className={
                    r.sg_total === null
                      ? 'text-gray-400'
                      : r.sg_total >= 0
                        ? 'text-emerald-700'
                        : 'text-red-700'
                  }
                >
                  SG {formatSG(r.sg_total)}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
