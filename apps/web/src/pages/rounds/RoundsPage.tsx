import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatSG, isPartialRound, parseLocalDate, partialRoundLabel } from '@oga/core'
import { useDeleteRound, useRounds } from '../../hooks/useRounds'
import { useProfile } from '../../hooks/useProfile'
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
  const handicap = useProfile().data?.handicap_index
  // The trend reads whole, scored rounds only, newest 20, oldest first.
  const trend = (rounds ?? [])
    .filter((r) => (r.total_score ?? 0) > 0 && !isPartialRound(r.hole_scores, r.hole_count))
    .slice(0, 20)
    .reverse()
    .map((r) => ({ date: r.played_at, score: r.total_score! }))
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

      {trend.length >= 2 && <ScoreTrend points={trend} handicap={handicap ?? null} />}

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
                      {partialRoundLabel(r.hole_scores, r.hole_count)}
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

// Score by round above the list: one dot per round (the latest in forest),
// a three-round average line in ink-dim, and the average beside it.
function ScoreTrend({ points, handicap }: { points: { date: string; score: number }[]; handicap: number | null }) {
  // Drawn at the box's own width, so the labels stay 11px on any screen.
  const box = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(600)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth || 600))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const H = 150
  const L = 34
  const R = 10
  const T = 10
  const B = 24
  const scores = points.map((p) => p.score)
  const step = Math.max(...scores) - Math.min(...scores) > 20 ? 10 : 5
  const lo = Math.floor((Math.min(...scores) - 1) / step) * step
  const hi = Math.ceil((Math.max(...scores) + 1) / step) * step
  const x = (i: number) => L + (i * (W - L - R)) / (points.length - 1)
  const y = (v: number) => T + ((hi - v) * (H - T - B)) / (hi - lo)
  const ticks = Array.from({ length: (hi - lo) / step + 1 }, (_, i) => lo + i * step)
  const avg3 = points
    .map((_, i) => (i < 2 ? null : (scores[i]! + scores[i - 1]! + scores[i - 2]!) / 3))
    .map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
    .filter(Boolean)
    .join(' ')
  const average = scores.reduce((a, b) => a + b, 0) / scores.length
  const short = (d: string) => parseLocalDate(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return (
    <section
      aria-label="Score by round"
      className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-end"
      style={{ columnGap: 40, rowGap: 14, marginBottom: 28 }}
    >
      <div className="lg:order-2">
        <div className="font-serif italic tabular text-caddie-ink" style={{ fontSize: 38, fontWeight: 500, lineHeight: 1 }}>
          {average.toFixed(1)}
        </div>
        <div className="text-caddie-ink-dim" style={{ fontSize: 13, marginTop: 6 }}>
          average, last {points.length} rounds{handicap != null ? ` · ${handicap} handicap` : ''}
        </div>
      </div>
      <div ref={box} className="min-w-0">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="rounds-trend block" role="img" aria-label={`Scores from ${short(points[0]!.date)} to ${short(points[points.length - 1]!.date)}, averaging ${average.toFixed(1)}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#EBE5D6" strokeWidth={1} />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#8A8B7E">
              {t}
            </text>
          </g>
        ))}
        <polyline points={avg3} fill="none" stroke="#5C6356" strokeWidth={1.5} pathLength={1} className="rounds-trend-line" />
        {points.map((p, i) => {
          const last = i === points.length - 1
          return (
            <circle
              key={i}
              cx={x(i)}
              cy={y(p.score)}
              r={last ? 4.5 : 3.5}
              fill={last ? '#1F3D2C' : '#1C211C'}
              stroke="#F2EEE5"
              strokeWidth={1.5}
              style={{ ['--i' as string]: i }}
            >
              <title>{`${short(p.date)} · ${p.score}`}</title>
            </circle>
          )
        })}
        <text x={L} y={H - 6} fontSize={11} fill="#8A8B7E">
          {short(points[0]!.date)}
        </text>
        <text x={W - R} y={H - 6} textAnchor="end" fontSize={11} fill="#8A8B7E">
          {short(points[points.length - 1]!.date)}
        </text>
      </svg>
      </div>
    </section>
  )
}
