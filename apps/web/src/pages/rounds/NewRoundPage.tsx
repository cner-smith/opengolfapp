import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CAPTURE_MODES,
  CAPTURE_MODE_LABELS,
  todayLocalDate,
  type CaptureMode,
} from '@oga/core'
import { CourseSearch } from '../../components/courses/CourseSearch'
import { TeeSelector } from '../../components/courses/TeeSelector'
import { useCreateRound } from '../../hooks/useRounds'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { toUserMessage } from '../../lib/errors'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Rocker } from '../../components/ui/Rocker'

const TEE_COLORS = ['black', 'blue', 'white', 'gold', 'red'].map((t) => ({
  value: t,
  label: `${t.charAt(0).toUpperCase()}${t.slice(1)}`,
}))

type RoundMode = 'live' | 'past'

export function NewRoundPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const createRoundMutation = useCreateRound()
  const [courseId, setCourseId] = useState<string | null>(null)
  const [courseName, setCourseName] = useState('')
  const [playedAt, setPlayedAt] = useState(() => todayLocalDate())
  const [teeColor, setTeeColor] = useState<string>('white')
  const [courseTeeId, setCourseTeeId] = useState<string | null>(null)
  // Seed from ?mode=live|past so the Home CTAs land on the right mode
  // (defaults to past for a bare /rounds/new).
  const [mode, setMode] = useState<RoundMode>(
    searchParams.get('mode') === 'live' ? 'live' : 'past',
  )
  const [captureMode, setCaptureMode] = useState<CaptureMode>('track_patterns')
  const [error, setError] = useState<string | null>(null)
  // An unfinished round from the last day, found when starting a live one.
  const [unfinishedId, setUnfinishedId] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!user) return
    if (!courseId) {
      setError('Pick a course first.')
      return
    }
    // Block accidental abandonment: if the user already has an
    // unfinished round started in the last day, ask before starting a
    // fresh live round on top of it. Past-round logging is fine — it
    // doesn't compete for the "currently playing" slot.
    if (mode === 'live') {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10)
      const { data: unfinished } = await supabase
        .from('rounds')
        .select('id')
        .eq('user_id', user.id)
        .is('total_score', null)
        .gte('played_at', oneDayAgo)
        .limit(1)
      if (unfinished && unfinished.length > 0) {
        setUnfinishedId(unfinished[0]!.id)
        return
      }
    }
    await create()
  }

  async function create() {
    if (!user || !courseId) return
    setUnfinishedId(null)
    try {
      const round = await createRoundMutation.mutateAsync({
        user_id: user.id,
        course_id: courseId,
        played_at: playedAt,
        tee_color: teeColor,
        course_tee_id: courseTeeId,
        // Capture mode only steers the live flow; past-round entry leaves the
        // column at its 'track_patterns' default.
        ...(mode === 'live' ? { capture_mode: captureMode } : {}),
      })
      if (!round) throw new Error('Round insert returned no row')
      // Live rounds open the map view directly so the user can start
      // dropping shots; past-round entry stays on the scorecard.
      navigate(
        mode === 'live' ? `/rounds/${round.id}?view=map` : `/rounds/${round.id}`,
      )
    } catch (err) {
      setError(toUserMessage(err))
    }
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <h1
        className="font-serif text-caddie-ink"
        style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.15, marginBottom: 6 }}
      >
        New round
      </h1>
      <p className="text-caddie-ink-dim" style={{ fontSize: 15, marginBottom: 28 }}>
        Pick a course and we’ll set up the scorecard.
      </p>
      <form onSubmit={handleSubmit}>
        <Group title="How you’re logging it">
          <ChoiceRow label="How you’re logging it">
            <Choice
              active={mode === 'past'}
              onClick={() => setMode('past')}
              title="After the fact"
              subtitle="No GPS. Enter it on the scorecard or the map."
            />
            <Choice
              active={mode === 'live'}
              onClick={() => setMode('live')}
              title="Live"
              subtitle="GPS-tracked, shot by shot on the map."
            />
          </ChoiceRow>
          {mode === 'live' && (
            <>
              <div className="text-caddie-ink" style={{ fontSize: 15, margin: '18px 0 10px' }}>
                What to track
              </div>
              <ChoiceRow label="What to track">
                {CAPTURE_MODES.map((cm) => (
                  <Choice
                    key={cm}
                    active={captureMode === cm}
                    onClick={() => setCaptureMode(cm)}
                    title={CAPTURE_MODE_LABELS[cm].title}
                    subtitle={CAPTURE_MODE_LABELS[cm].subtitle}
                  />
                ))}
              </ChoiceRow>
            </>
          )}
        </Group>

        <Group title="Where and when">
          <section aria-label="Course" style={{ borderBottom: LINE_RULE, paddingBottom: 14 }}>
            <div style={rowStyle}>
              <span className="text-caddie-ink" style={{ fontSize: 15 }}>
                Course
              </span>
              {courseId && courseName ? (
                <span className="font-serif text-caddie-ink" style={{ fontSize: 18, textAlign: 'right' }}>
                  {courseName}
                </span>
              ) : (
                <span className="text-caddie-ink-dim" style={{ fontSize: 15 }}>
                  Not chosen
                </span>
              )}
            </div>
            <CourseSearch
              selectedCourseId={courseId}
              onSelect={(id, name) => {
                setCourseId(id)
                setCourseName(name)
                setCourseTeeId(null)
              }}
              requestGps={mode === 'live'}
            />
          </section>

          {courseId && (
            <section aria-label="Tee" style={{ borderBottom: LINE_RULE, paddingBottom: 14 }}>
              <div style={rowStyle}>
                <span className="text-caddie-ink" style={{ fontSize: 15 }}>
                  Tee
                </span>
                <span className="text-caddie-ink-dim" style={{ fontSize: 13, textAlign: 'right' }}>
                  Its rating and slope feed your handicap
                </span>
              </div>
              <TeeSelector
                courseId={courseId}
                selectedTeeId={courseTeeId}
                onSelect={(id, color) => {
                  setCourseTeeId(id)
                  setTeeColor(color)
                }}
              />
            </section>
          )}

          <label style={{ ...rowStyle, borderBottom: courseTeeId ? 'none' : LINE_RULE }}>
            <span className="text-caddie-ink" style={{ fontSize: 15 }}>
              Date
            </span>
            <input
              type="date"
              required
              value={playedAt}
              onChange={(e) => setPlayedAt(e.target.value)}
              className="font-serif text-caddie-ink"
              style={{
                fontSize: 17,
                minHeight: 44,
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid #9F9580',
                padding: '0 2px',
              }}
            />
          </label>

          {/* A tee from the course list sets the colour itself. */}
          {!courseTeeId && (
            <div style={{ ...rowStyle, flexWrap: 'wrap' }}>
              <span className="text-caddie-ink" style={{ fontSize: 15 }}>
                Tee colour
              </span>
              <Rocker
                options={TEE_COLORS}
                value={teeColor}
                onChange={setTeeColor}
                label="Tee colour"
                className="w-full sm:w-[380px]"
              />
            </div>
          )}
        </Group>

        {error && (
          <p className="text-caddie-neg" role="alert" style={{ fontSize: 13, marginTop: -14, marginBottom: 18 }}>
            {error}
          </p>
        )}

        <div className="flex items-center" style={{ gap: 18 }}>
          <button
            type="submit"
            disabled={createRoundMutation.isPending}
            className="key key-primary"
            style={{
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.02em',
            }}
          >
            {createRoundMutation.isPending ? (
              'Creating…'
            ) : (
              <>
                Start round{' '}
                <span className="font-serif" style={{ fontStyle: 'italic' }}>
                  →
                </span>
              </>
            )}
          </button>
          {!courseId && (
            <span className="text-caddie-ink-dim" style={{ fontSize: 13 }}>
              Pick a course first
            </span>
          )}
          <button
            type="button"
            onClick={() => navigate('/rounds')}
            className="text-caddie-ink-dim hover:text-caddie-ink"
            style={{ background: 'none', border: 'none', fontSize: 14, cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={!!unfinishedId}
        title="Leave your other round unfinished?"
        message="You started a round in the last day and haven't finished it."
        confirmLabel="Start a new round"
        cancelLabel="Go to that round"
        busy={createRoundMutation.isPending}
        onConfirm={create}
        onCancel={() => navigate(`/rounds/${unfinishedId}?view=map`)}
        onDismiss={() => setUnfinishedId(null)}
      />
    </div>
  )
}

const LINE_RULE = '1px solid #D9D2BF'

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  minHeight: 52,
  padding: '12px 4px',
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2
        className="font-serif text-caddie-ink"
        style={{
          fontSize: 22,
          fontWeight: 500,
          fontStyle: 'italic',
          lineHeight: 1.2,
          paddingBottom: 8,
          borderBottom: LINE_RULE,
          marginBottom: 14,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

export function ChoiceRow({ label, children }: { label: string; children: React.ReactNode }) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const keys = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role=radio]')]
    const i = keys.findIndex((k) => k.getAttribute('aria-checked') === 'true')
    const next = keys[(i + step + keys.length) % keys.length]
    next?.click()
    next?.focus()
  }
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="grid grid-cols-1 sm:grid-cols-2"
      style={{ gap: 12, paddingBottom: 3 }}
    >
      {children}
    </div>
  )
}

// One of the printed options as a letterpress key: raised on its ink ledge,
// latched into the well when picked.
export function Choice({
  active,
  onClick,
  title,
  subtitle,
}: {
  active: boolean
  onClick: () => void
  title: string
  subtitle: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      className="key"
      style={{
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        gap: 3,
        minHeight: 64,
        padding: '12px 16px',
        textAlign: 'left',
      }}
    >
      <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
      <span className="text-caddie-ink-dim" style={{ fontSize: 13, fontWeight: 400, lineHeight: 1.45 }}>
        {subtitle}
      </span>
    </button>
  )
}
