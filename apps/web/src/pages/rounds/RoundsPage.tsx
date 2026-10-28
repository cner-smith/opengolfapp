import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatSG, partialRoundLabel } from '@oga/core'
import { useDeleteRound, useRounds } from '../../hooks/useRounds'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { toUserMessage } from '../../lib/errors'
import { formatPlayed } from '../dashboard/DashboardPage'
import './rounds.css'

// Tee names are stored as typed ("black", "Blue"); read them in sentence case.
function teeLabel(tee: string): string {
  return `${tee.charAt(0).toUpperCase()}${tee.slice(1)} tees`
}

export function RoundsPage() {
  // The whole history, as the app's list does (an import can bring years of rounds).
  const { data: rounds, isLoading, error } = useRounds(500)
  const deleteMutation = useDeleteRound()
  const [pendingDelete, setPendingDelete] = useState<{
    id: string
    name: string
  } | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const closeDelete = () => {
    setPendingDelete(null)
    setDeleteError(null)
  }

  return (
    <div>
      <div
        className="flex flex-col sm:flex-row sm:items-end sm:justify-between"
        style={{ marginBottom: 22, gap: 14 }}
      >
        <div>
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
        <div className="flex" style={{ gap: 8 }}>
          <Link to="/rounds/import" className="key">
            Import rounds
          </Link>
          <Link to="/rounds/new" className="key key-primary">
            New round <span className="font-serif" style={{ fontStyle: 'italic' }}>→</span>
          </Link>
        </div>
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
          {toUserMessage(error)}
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
            style={{ fontSize: 15, marginTop: 8, maxWidth: 380, marginInline: 'auto' }}
          >
            Log your first round, or bring your history from another app, to start tracking strokes gained.
          </div>
          <div className="flex flex-wrap justify-center" style={{ gap: 8, marginTop: 22 }}>
            <Link to="/rounds/new" className="key key-primary">
              Log a round <span className="font-serif" style={{ fontStyle: 'italic' }}>→</span>
            </Link>
            <Link to="/rounds/import" className="key">
              Import your history
            </Link>
          </div>
        </div>
      )}

      {rounds && rounds.length > 0 && (
        <ul className="rounds-list" style={{ borderTop: '1px solid #1C211C' }}>
          {rounds.map((r, i) => {
            const name = r.courses?.name ?? 'Round'
            return (
              <li
                key={r.id}
                className="flex items-center"
                style={{ borderBottom: '1px solid #D9D2BF', gap: 6, ['--i' as string]: Math.min(i, 8) }}
              >
                <Link
                  to={`/rounds/${r.id}`}
                  className="flex min-w-0 flex-1 items-center justify-between transition-colors duration-100 hover:bg-caddie-surface"
                  style={{ padding: '14px 4px', gap: 12 }}
                >
                  <div className="min-w-0 flex-1">
                    <div
                      className="font-serif text-caddie-ink"
                      style={{ fontSize: 19, fontStyle: 'italic', fontWeight: 500, lineHeight: 1.25 }}
                    >
                      {name}
                    </div>
                    <div className="text-caddie-ink-dim truncate" style={{ fontSize: 13, marginTop: 3 }}>
                      {formatPlayed(r.played_at)}
                      {r.tee_color ? ` · ${teeLabel(r.tee_color)}` : ''}
                      {partialRoundLabel(r.hole_scores)}
                    </div>
                  </div>
                  <div className="flex items-baseline" style={{ gap: 14 }}>
                    <span
                      className="font-serif tabular text-caddie-ink"
                      style={{ fontSize: 24, fontWeight: 500, lineHeight: 1 }}
                    >
                      {r.total_score ? r.total_score : '—'}
                    </span>
                    <span
                      className="font-serif tabular text-right"
                      style={{
                        fontSize: 14,
                        minWidth: 44,
                        color: r.sg_total == null ? '#5C6356' : r.sg_total >= 0 ? '#1F3D2C' : '#A33A2A',
                      }}
                    >
                      {r.sg_total == null ? '—' : formatSG(r.sg_total)}
                    </span>
                  </div>
                </Link>
                {/* Desktop only, shown on row hover/focus; on a phone it
                    lives on the round's own page, as in the app. */}
                <button
                  type="button"
                  onClick={() => setPendingDelete({ id: r.id, name })}
                  aria-label={`Delete round at ${name}`}
                  className="rounds-del key hidden lg:inline-flex"
                  style={{ minHeight: 34, padding: '0 10px', fontSize: 13, color: '#A33A2A', marginLeft: 4 }}
                >
                  Delete
                </button>
              </li>
            )
          })}
        </ul>
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
        error={deleteError}
        onConfirm={async () => {
          if (!pendingDelete) return
          try {
            await deleteMutation.mutateAsync(pendingDelete.id)
            closeDelete()
          } catch (err) {
            setDeleteError(toUserMessage(err))
          }
        }}
        onCancel={closeDelete}
      />
    </div>
  )
}
