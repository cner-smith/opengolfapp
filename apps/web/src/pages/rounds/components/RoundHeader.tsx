import { useEffect, useRef, useState } from 'react'
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
  shareTone: 'light' | 'dark'
  sharing: boolean
  completePending: boolean
  onBack: () => void
  onShare: () => void
  onToggleShareTone: () => void
  onComplete: () => void
}

export function RoundHeader({
  round,
  tees,
  holesPlayed,
  holeCount,
  score,
  toPar,
  shareTone,
  sharing,
  completePending,
  onBack,
  onShare,
  onToggleShareTone,
  onComplete,
}: RoundHeaderProps) {
  const [shareOpen, setShareOpen] = useState(false)
  const shareRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!shareOpen) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !shareRef.current?.contains(e.target as Node))
        setShareOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [shareOpen])

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
        <div ref={shareRef} className="relative">
          <button
            type="button"
            onClick={() => setShareOpen((o) => !o)}
            disabled={holesPlayed === 0}
            aria-expanded={shareOpen}
            aria-haspopup="dialog"
            className="key"
            style={{ padding: '0 12px', gap: 6 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
            </svg>
            Share
          </button>
          {shareOpen && (
            <div
              role="dialog"
              aria-label="Share your card"
              className="paper-tile absolute right-0 z-20"
              style={{ top: 'calc(100% + 12px)', width: 248, padding: 14 }}
            >
              <div className="font-serif italic text-caddie-ink" style={{ fontSize: 18, fontWeight: 500 }}>
                Share your card
              </div>
              <div className="text-caddie-ink-dim" style={{ fontSize: 13, margin: '2px 0 12px' }}>
                An image of the card, ready for the group chat.
              </div>
              <div
                role="radiogroup"
                aria-label="Card paper"
                className="flex overflow-hidden"
                style={{ border: '1px solid #1C211C', borderRadius: 3 }}
              >
                {(['light', 'dark'] as const).map((tone, i) => {
                  const on = tone === shareTone
                  return (
                    <button
                      key={tone}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => !on && onToggleShareTone()}
                      className="relative flex-1 text-caddie-ink"
                      style={{
                        minHeight: 40,
                        fontSize: 14,
                        fontWeight: on ? 600 : 400,
                        background: on ? '#E4DCCA' : '#FBF8F1',
                        borderLeft: i ? '1px solid #1C211C' : 'none',
                        boxShadow: on
                          ? 'inset 0 0 0 2px #1C211C, inset 0 5px 0 0 rgba(28,33,28,.28)'
                          : 'inset 0 -3px 0 0 #1C211C',
                      }}
                    >
                      {tone === 'light' ? 'Light' : 'Dark'}
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={() => {
                  onShare()
                  setShareOpen(false)
                }}
                disabled={sharing}
                className="key"
                style={{ width: '100%', marginTop: 14 }}
              >
                {sharing ? 'Rendering…' : 'Share image'}
              </button>
            </div>
          )}
        </div>
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
