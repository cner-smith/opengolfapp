import { Link } from 'react-router-dom'
import { useRounds } from '../../hooks/useRounds'

export function RoundsPage() {
  const { data: rounds, isLoading, error } = useRounds()

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
            Rounds
          </h1>
          {rounds && rounds.length > 0 && (
            <div
              className="text-oga-text-muted"
              style={{ fontSize: 13, marginTop: 2 }}
            >
              {rounds.length} round{rounds.length === 1 ? '' : 's'} logged
            </div>
          )}
        </div>
        <Link
          to="/rounds/new"
          className="rounded-card bg-oga-black text-white transition-colors hover:bg-oga-text-primary/90"
          style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500 }}
        >
          New round
        </Link>
      </div>

      {isLoading && (
        <div className="text-oga-text-muted" style={{ fontSize: 13 }}>
          Loading rounds…
        </div>
      )}

      {error && (
        <div
          className="bg-oga-red-light text-oga-red-dark"
          style={{
            border: '0.5px solid #E24B4A',
            borderRadius: 10,
            padding: '12px 14px',
            fontSize: 13,
          }}
        >
          {(error as Error).message}
        </div>
      )}

      {!isLoading && rounds && rounds.length === 0 && (
        <div
          className="bg-oga-bg-card text-center"
          style={{
            border: '0.5px solid #E4E4E0',
            borderRadius: 10,
            padding: '32px 24px',
          }}
        >
          <div className="font-medium" style={{ fontSize: 15 }}>
            No rounds logged yet
          </div>
          <div
            className="text-oga-text-muted"
            style={{ fontSize: 13, marginTop: 6 }}
          >
            Log your first round to start tracking strokes gained.
          </div>
          <Link
            to="/rounds/new"
            className="rounded-card bg-oga-black text-white"
            style={{
              display: 'inline-block',
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 500,
              marginTop: 16,
            }}
          >
            Log a round
          </Link>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {rounds?.map((r) => (
          <li key={r.id}>
            <Link
              to={`/rounds/${r.id}`}
              className="flex items-center justify-between bg-oga-bg-card transition-colors hover:bg-oga-bg-input"
              style={{
                border: '0.5px solid #E4E4E0',
                borderRadius: 10,
                padding: '12px 14px',
              }}
            >
              <div>
                <div
                  className="font-medium text-oga-text-primary"
                  style={{ fontSize: 15 }}
                >
                  {r.courses?.name ?? 'Round'}
                </div>
                <div className="text-oga-text-muted" style={{ fontSize: 11 }}>
                  {r.played_at}
                  {r.tee_color ? ` · ${r.tee_color} tees` : ''}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div
                    className="text-oga-text-muted"
                    style={{ fontSize: 10, marginBottom: 2 }}
                  >
                    Score
                  </div>
                  <div
                    className="font-medium tabular text-oga-text-primary"
                    style={{ fontSize: 18 }}
                  >
                    {r.total_score ?? '—'}
                  </div>
                </div>
                <SGPill value={r.sg_total} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SGPill({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span
        className="text-oga-text-hint text-right"
        style={{ fontSize: 11, width: 70 }}
      >
        —
      </span>
    )
  }
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
        fontSize: 11,
        fontWeight: 500,
        padding: '4px 10px',
        borderRadius: 8,
      }}
    >
      SG {value > 0 ? '+' : ''}
      {value.toFixed(2)}
    </span>
  )
}
