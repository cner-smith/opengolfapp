import type { Database } from '@oga/supabase'

type RoundRow = Database['public']['Tables']['rounds']['Row']
type CourseTeeRow = Database['public']['Tables']['course_tees']['Row']

interface RoundHeaderProps {
  round: RoundRow & { courses?: { name?: string | null } | null }
  tees: CourseTeeRow[]
  holesPlayed: number
  shareTone: 'light' | 'dark'
  sharing: boolean
  completePending: boolean
  deletePending: boolean
  onBack: () => void
  onShare: () => void
  onToggleShareTone: () => void
  onComplete: () => void
  onConfirmDelete: () => void
}

export function RoundHeader({
  round,
  tees,
  holesPlayed,
  shareTone,
  sharing,
  completePending,
  deletePending,
  onBack,
  onShare,
  onToggleShareTone,
  onComplete,
  onConfirmDelete,
}: RoundHeaderProps) {
  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="font-mono uppercase text-caddie-ink-mute hover:text-caddie-ink"
        style={{
          fontSize: 10,
          letterSpacing: '0.14em',
          marginBottom: 18,
        }}
      >
        ← All rounds
      </button>

      <div
        className="flex flex-col sm:flex-row sm:items-end sm:justify-between"
        style={{ marginBottom: 28, gap: 14 }}
      >
        <div>
          <div className="kicker" style={{ marginBottom: 8 }}>
            Round detail
          </div>
          <h1
            className="font-serif text-caddie-ink"
            style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.15 }}
          >
            {round.courses?.name ?? 'Round'}
          </h1>
          <div
            className="font-mono uppercase tabular text-caddie-ink-mute"
            style={{
              fontSize: 10,
              letterSpacing: '0.14em',
              marginTop: 6,
            }}
          >
            {round.played_at}
            {round.tee_color ? ` · ${round.tee_color} tees` : ''} ·{' '}
            {holesPlayed}/18 holes scored
          </div>
          <RoundRatingLine round={round} tees={tees} />
        </div>
        <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onConfirmDelete}
            disabled={deletePending}
            className="text-caddie-neg hover:bg-caddie-neg/10 disabled:opacity-40"
            style={{
              background: 'transparent',
              border: '1px solid #A33A2A',
              borderRadius: 2,
              padding: '12px 14px',
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: '0.02em',
            }}
          >
            Delete round
          </button>
          <button
            type="button"
            onClick={onShare}
            disabled={sharing || holesPlayed === 0}
            className="text-caddie-accent hover:bg-caddie-accent/10 disabled:opacity-40"
            style={{
              background: 'transparent',
              border: '1px solid #1F3D2C',
              borderRadius: 2,
              padding: '12px 14px',
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: '0.02em',
            }}
          >
            {sharing ? 'Rendering…' : 'Share scorecard'}
          </button>
          <button
            type="button"
            onClick={onToggleShareTone}
            className="text-caddie-ink-mute hover:text-caddie-ink"
            style={{
              background: 'transparent',
              border: 'none',
              padding: '12px 6px',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              fontFamily: '"Inconsolata", monospace',
              cursor: 'pointer',
            }}
            title="Toggle share card tone"
          >
            {shareTone === 'light' ? 'Light' : 'Dark'}
          </button>
          <button
            type="button"
            onClick={onComplete}
            disabled={completePending || holesPlayed === 0}
            className="bg-caddie-accent text-caddie-accent-ink hover:opacity-90 disabled:opacity-40"
            style={{
              borderRadius: 2,
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.02em',
            }}
          >
            {completePending ? 'Calculating…' : 'Save SG + finalize'}
          </button>
        </div>
      </div>
    </>
  )
}

function RoundRatingLine({
  round,
  tees,
}: {
  round: RoundRow
  tees: CourseTeeRow[]
}) {
  const teeColor = round.tee_color?.toLowerCase()
  const tee =
    tees.find((t) => t.id === round.course_tee_id) ??
    (teeColor ? tees.find((t) => t.tee_color === teeColor) : null) ??
    null
  const hasRating =
    tee && tee.course_rating != null && tee.slope_rating != null
  const diff = round.score_differential

  if (!tee && diff == null) return null

  return (
    <div
      className="font-mono uppercase tabular text-caddie-ink-mute"
      style={{
        fontSize: 10,
        letterSpacing: '0.14em',
        marginTop: 4,
      }}
    >
      {hasRating
        ? `Rating ${tee.course_rating?.toFixed(1)} · slope ${tee.slope_rating}`
        : tee
          ? 'No course rating on file'
          : 'Add course rating to calculate handicap differential'}
      {diff != null
        ? ` · diff ${diff >= 0 ? '+' : ''}${diff.toFixed(1)}`
        : ''}
    </div>
  )
}
