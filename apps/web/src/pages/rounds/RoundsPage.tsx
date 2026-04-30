import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDeleteRound, useRounds } from '../../hooks/useRounds'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'

export function RoundsPage() {
  const { data: rounds, isLoading, error } = useRounds()
  const deleteMutation = useDeleteRound()
  const [pendingDelete, setPendingDelete] = useState<{
    id: string
    name: string
  } | null>(null)

  return (
    <div>
      <div
        className="flex items-end justify-between"
        style={{ marginBottom: 28 }}
      >
        <div>
          <div className="kicker" style={{ marginBottom: 8 }}>
            Logbook
          </div>
          <h1
            className="font-serif text-caddie-ink"
            style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.15 }}
          >
            Rounds
          </h1>
          {rounds && rounds.length > 0 && (
            <div
              className="text-caddie-ink-dim"
              style={{ fontSize: 13, marginTop: 6 }}
            >
              {rounds.length} round{rounds.length === 1 ? '' : 's'} logged
            </div>
          )}
        </div>
        <Link
          to="/rounds/new"
          className="bg-caddie-accent text-caddie-accent-ink hover:opacity-90"
          style={{
            padding: '12px 16px',
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '0.02em',
            borderRadius: 2,
          }}
        >
          New round{' '}
          <span className="font-serif" style={{ fontStyle: 'italic' }}>
            →
          </span>
        </Link>
      </div>

      {isLoading && (
        <div className="text-caddie-ink-mute" style={{ fontSize: 13 }}>
          Loading rounds…
        </div>
      )}

      {error && (
        <div
          className="text-caddie-neg"
          style={{
            border: '1px solid #A33A2A',
            borderRadius: 4,
            padding: '14px 18px',
            fontSize: 13,
          }}
        >
          {(error as Error).message}
        </div>
      )}

      {!isLoading && rounds && rounds.length === 0 && (
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
            No rounds logged yet
          </div>
          <div
            className="text-caddie-ink-dim"
            style={{ fontSize: 15, marginTop: 8 }}
          >
            Log your first round to start tracking strokes gained.
          </div>
          <Link
            to="/rounds/new"
            className="bg-caddie-accent text-caddie-accent-ink"
            style={{
              display: 'inline-block',
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.02em',
              borderRadius: 2,
              marginTop: 22,
            }}
          >
            Log a round{' '}
            <span className="font-serif" style={{ fontStyle: 'italic' }}>
              →
            </span>
          </Link>
        </div>
      )}

      {rounds && rounds.length > 0 && (
        <div style={{ borderTop: '1px solid #D9D2BF' }}>
          {rounds.map((r) => (
            <div
              key={r.id}
              className="flex items-center transition-colors hover:bg-caddie-surface"
              style={{
                padding: '14px 8px',
                borderBottom: '1px solid #D9D2BF',
                gap: 12,
              }}
            >
              <Link
                to={`/rounds/${r.id}`}
                className="flex flex-1 items-center justify-between"
                style={{ gap: 12 }}
              >
                <div className="min-w-0 flex-1">
                  <div
                    className="font-mono uppercase tabular text-caddie-ink-mute truncate"
                    style={{
                      fontSize: 10,
                      letterSpacing: '0.14em',
                      marginBottom: 6,
                    }}
                  >
                    {r.played_at}
                    {r.tee_color ? ` · ${r.tee_color} tees` : ''}
                  </div>
                  <div
                    className="font-serif text-caddie-ink truncate"
                    style={{
                      fontSize: 22,
                      fontWeight: 500,
                      lineHeight: 1.15,
                    }}
                  >
                    {r.courses?.name ?? 'Round'}
                  </div>
                </div>
                <div
                  className="flex items-baseline"
                  style={{ gap: 24 }}
                >
                  <div className="text-right">
                    <div className="kicker" style={{ marginBottom: 4 }}>
                      Score
                    </div>
                    <div
                      className="font-serif tabular text-caddie-ink"
                      style={{ fontSize: 28, fontWeight: 500, lineHeight: 1 }}
                    >
                      {r.total_score ?? '—'}
                    </div>
                  </div>
                  <div className="text-right hidden sm:block" style={{ minWidth: 80 }}>
                    <div className="kicker" style={{ marginBottom: 4 }}>
                      SG
                    </div>
                    <SGValue value={r.sg_total} />
                  </div>
                </div>
              </Link>
              <button
                type="button"
                onClick={() =>
                  setPendingDelete({
                    id: r.id,
                    name: r.courses?.name ?? 'this round',
                  })
                }
                aria-label={`Delete round at ${r.courses?.name ?? 'this round'}`}
                className="text-caddie-ink-mute hover:text-caddie-neg"
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 8,
                  fontSize: 18,
                  lineHeight: 1,
                  cursor: 'pointer',
                }}
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title={`Delete this round?`}
        message={
          pendingDelete
            ? `${pendingDelete.name} will be removed along with its hole scores and shots. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        busy={deleteMutation.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return
          try {
            await deleteMutation.mutateAsync(pendingDelete.id)
            setPendingDelete(null)
          } catch {
            setPendingDelete(null)
          }
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}

function TrashIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <path
        d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m1 0v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6h12Z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 11v6M14 11v6"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  )
}

function SGValue({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span
        className="font-serif text-caddie-ink-mute"
        style={{ fontSize: 22 }}
      >
        —
      </span>
    )
  }
  const color = value > 0 ? '#1F3D2C' : value < 0 ? '#A33A2A' : '#5C6356'
  return (
    <span
      className="font-serif tabular"
      style={{
        color,
        fontSize: 22,
        fontStyle: 'italic',
        fontWeight: 500,
        lineHeight: 1,
      }}
    >
      {value > 0 ? '+' : ''}
      {value.toFixed(2)}
    </span>
  )
}
