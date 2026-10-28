import { useState, type FormEvent } from 'react'
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

const TEE_COLORS = ['black', 'blue', 'white', 'gold', 'red'] as const

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
        const ok = window.confirm(
          'You have an unfinished round. Starting a new one will leave it incomplete. Continue?',
        )
        if (!ok) return
      }
    }
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
          <ChoiceRow>
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
              <ChoiceRow>
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
              style={inputStyle}
            />
          </label>

          {/* A tee from the course list sets the colour itself. */}
          {!courseTeeId && (
            <label style={rowStyle}>
              <span className="text-caddie-ink" style={{ fontSize: 15 }}>
                Tee colour
              </span>
              <select
                value={teeColor}
                onChange={(e) => setTeeColor(e.target.value)}
                className="capitalize"
                style={{ ...inputStyle, minWidth: 140 }}
              >
                {TEE_COLORS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
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
            disabled={createRoundMutation.isPending || !courseId}
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

const inputStyle: React.CSSProperties = {
  background: '#FBF8F1',
  border: '1px solid #D9D2BF',
  borderRadius: 2,
  padding: '9px 12px',
  fontSize: 14,
  color: '#1C211C',
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

export function ChoiceRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 10 }}>
      {children}
    </div>
  )
}

// One of two printed options: a ringed dot marks the pick, the border firms up around it.
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
      onClick={onClick}
      aria-pressed={active}
      className="hover:bg-caddie-surface"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        textAlign: 'left',
        background: active ? '#FBF8F1' : 'transparent',
        border: `1px solid ${active ? '#1F3D2C' : '#D9D2BF'}`,
        borderRadius: 2,
        padding: '14px 14px',
        cursor: 'pointer',
        transition: 'border-color 120ms, background 120ms',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flex: 'none',
          width: 16,
          height: 16,
          marginTop: 2,
          borderRadius: '50%',
          border: `1px solid ${active ? '#1F3D2C' : '#9F9580'}`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {active && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1F3D2C' }} />}
      </span>
      <span>
        <span className="text-caddie-ink" style={{ display: 'block', fontSize: 15, fontWeight: 500 }}>
          {title}
        </span>
        <span className="text-caddie-ink-dim" style={{ display: 'block', fontSize: 13, marginTop: 3, lineHeight: 1.45 }}>
          {subtitle}
        </span>
      </span>
    </button>
  )
}
