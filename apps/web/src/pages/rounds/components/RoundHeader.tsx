import type { Database } from '@oga/supabase'
import { formatToPar, isFinishedRound, resolveCourseTee } from '@oga/core'

type RoundRow = Database['public']['Tables']['rounds']['Row']
type CourseTeeRow = Database['public']['Tables']['course_tees']['Row']

interface RoundHeaderProps {
  round: RoundRow & {
    courses?: {
      name?: string | null
      facilities?: { name?: string | null } | null
    } | null
  }
  tees: CourseTeeRow[]
  holesPlayed: number
  holeCount: number
  /** The running total and its to-par, for the subtitle. */
  score?: number
  toPar?: number | null
  completePending: boolean
  onBack: () => void
  /** Opens the share card chooser; no Share key when undefined (nothing scored). */
  onShare?: () => void
  onComplete: () => void
}

export function RoundHeader({
  round,
  tees,
  holesPlayed,
  holeCount,
  score,
  toPar,
  completePending,
  onBack,
  onShare,
  onComplete,
}: RoundHeaderProps) {

  const finalized = isFinishedRound(round)
  const name = round.courses?.facilities?.name ?? round.courses?.name ?? 'Round'
  return (
    <header className="flex items-start" style={{ gap: 6 }}>
      <button
        type="button"
        onClick={onBack}
        aria-label="All rounds"
        title="All rounds"
        className="flex shrink-0 items-center justify-center text-caddie-ink hover:bg-caddie-surface"
        style={{ width: 44, height: 44, marginLeft: -10, borderRadius: 3, background: 'transparent', border: 'none' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M19 12H5M11 6l-6 6 6 6" />
        </svg>
      </button>

      <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
        <h1
          className="font-serif italic text-caddie-ink truncate"
          style={{ fontSize: 'clamp(22px, 2.6vw, 32px)', fontWeight: 500, lineHeight: 1.15 }}
        >
          {name}
        </h1>
        {round.courses?.facilities?.name && (
          <div className="font-serif italic text-caddie-ink-dim truncate" style={{ fontSize: 16, marginTop: 1 }}>
            {round.courses?.name}
          </div>
        )}
        <div className="text-caddie-ink" style={{ fontSize: 13, marginTop: 4, lineHeight: 1.4 }}>
          {playedOn(round.played_at)}
          {round.tee_color ? ` · ${round.tee_color[0]!.toUpperCase()}${round.tee_color.slice(1)} tees` : ''}
          {' · '}
          {holesPlayed === holeCount ? `${holeCount} holes` : `${holesPlayed} of ${holeCount} holes`}
          {score != null && score > 0 && (
            <>
              {' · '}
              <span className="font-serif italic tabular" style={{ fontSize: 16, fontWeight: 500 }}>
                {score}
              </span>
              {toPar != null && ` (${formatToPar(toPar)})`}
            </>
          )}
        </div>
        <RoundRatingLine round={round} tees={tees} />
      </div>

      <div className="flex shrink-0 items-center" style={{ gap: 10 }}>
        {!finalized && (
          <button
            type="button"
            onClick={onComplete}
            disabled={completePending || holesPlayed === 0}
            className="key key-primary hidden sm:inline-flex"
          >
            {completePending ? 'Saving…' : 'Save SG'}
          </button>
        )}
        {onShare && (
          <button
            type="button"
            onClick={onShare}
            aria-haspopup="dialog"
            className="key"
            style={{ padding: '0 12px', gap: 6 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
            </svg>
            Share
          </button>
        )}
      </div>
    </header>
  )
}

// "Sun 18 Oct", from the round's local yyyy-mm-dd date.
function playedOn(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return date
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function RoundRatingLine({
  round,
  tees,
}: {
  round: RoundRow
  tees: CourseTeeRow[]
}) {
  const tee = resolveCourseTee(tees, round.course_tee_id, round.tee_color)
  const hasRating =
    tee && tee.course_rating != null && tee.slope_rating != null
  const diff = round.score_differential

  if (!tee && diff == null) return null

  return (
    <div className="hidden sm:block text-caddie-ink-dim tabular" style={{ fontSize: 13, marginTop: 2 }}>
      {hasRating
        ? `Rating ${tee.course_rating?.toFixed(1)} · slope ${tee.slope_rating}`
        : tee
          ? 'No course rating on file'
          : 'Add course rating to calculate handicap differential'}
      {diff != null
        ? ` · differential ${diff >= 0 ? '+' : ''}${diff.toFixed(1)}`
        : ''}
    </div>
  )
}
