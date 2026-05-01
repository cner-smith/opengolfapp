import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CourseSearch } from '../../components/courses/CourseSearch'
import { TeeSelector } from '../../components/courses/TeeSelector'
import { useCreateRound } from '../../hooks/useRounds'
import { useAuth } from '../../hooks/useAuth'

const TEE_COLORS = ['black', 'blue', 'white', 'gold', 'red'] as const

type RoundMode = 'live' | 'past'

export function NewRoundPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const createRoundMutation = useCreateRound()
  const [courseId, setCourseId] = useState<string | null>(null)
  const [courseName, setCourseName] = useState('')
  const [playedAt, setPlayedAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [teeColor, setTeeColor] = useState<string>('white')
  const [courseTeeId, setCourseTeeId] = useState<string | null>(null)
  const [mode, setMode] = useState<RoundMode>('past')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!user) return
    if (!courseId) {
      setError('Pick a course first.')
      return
    }
    try {
      const round = await createRoundMutation.mutateAsync({
        user_id: user.id,
        course_id: courseId,
        played_at: playedAt,
        tee_color: teeColor,
        course_tee_id: courseTeeId,
      })
      if (!round) throw new Error('Round insert returned no row')
      // Live rounds open the map view directly so the user can start
      // dropping shots; past-round entry stays on the scorecard.
      navigate(
        mode === 'live' ? `/rounds/${round.id}?view=map` : `/rounds/${round.id}`,
      )
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div style={{ marginBottom: 18 }}>
        <h1
          className="text-oga-text-primary"
          style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.3 }}
        >
          New round
        </h1>
        <div className="text-oga-text-muted" style={{ fontSize: 13, marginTop: 2 }}>
          Pick a course and we'll set up the scorecard
        </div>
      </div>
      <form
        onSubmit={handleSubmit}
        className="bg-oga-bg-card flex flex-col gap-5"
        style={{ border: '0.5px solid #E4E4E0', borderRadius: 10, padding: 20 }}
      >
        <section>
          <FieldLabel>Are you logging this round live or after the fact?</FieldLabel>
          <div style={{ display: 'flex', gap: 8 }}>
            <ModeChip
              active={mode === 'past'}
              onClick={() => setMode('past')}
              title="After the fact"
              subtitle="No GPS · enter on scorecard or map"
            />
            <ModeChip
              active={mode === 'live'}
              onClick={() => setMode('live')}
              title="Live"
              subtitle="GPS-tracked, shot-by-shot on the map"
            />
          </div>
        </section>

        <section>
          <FieldLabel>Course</FieldLabel>
          <CourseSearch
            selectedCourseId={courseId}
            onSelect={(id, name) => {
              setCourseId(id)
              setCourseName(name)
              setCourseTeeId(null)
            }}
          />
          {courseName && courseId && (
            <p
              className="text-oga-green-dark"
              style={{ fontSize: 13, marginTop: 8 }}
            >
              Selected: {courseName}
            </p>
          )}
        </section>

        {courseId && (
          <section>
            <FieldLabel>Tee</FieldLabel>
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

        <section className="grid grid-cols-2 gap-4">
          <label className="block">
            <FieldLabel>Date</FieldLabel>
            <input
              type="date"
              required
              value={playedAt}
              onChange={(e) => setPlayedAt(e.target.value)}
              className="w-full bg-oga-bg-input text-oga-text-primary"
              style={{ border: '0.5px solid #E4E4E0', borderRadius: 7, padding: '8px 10px', fontSize: 13 }}
            />
          </label>
          <label className="block">
            <FieldLabel>Tees</FieldLabel>
            <select
              value={teeColor}
              onChange={(e) => setTeeColor(e.target.value)}
              className="w-full bg-oga-bg-input text-oga-text-primary capitalize"
              style={{ border: '0.5px solid #E4E4E0', borderRadius: 7, padding: '8px 10px', fontSize: 13 }}
            >
              {TEE_COLORS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </section>

        {error && (
          <div className="text-oga-red-dark" style={{ fontSize: 13 }}>
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => navigate('/rounds')}
            className="bg-oga-bg-card text-oga-text-primary transition-colors hover:bg-oga-bg-input"
            style={{
              border: '0.5px solid #E4E4E0',
              borderRadius: 10,
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createRoundMutation.isPending || !courseId}
            className="bg-oga-black text-white transition-colors hover:bg-oga-text-primary/90 disabled:opacity-50"
            style={{
              borderRadius: 10,
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {createRoundMutation.isPending ? 'Creating…' : 'Start round'}
          </button>
        </div>
      </form>
    </div>
  )
}

function ModeChip({
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
      className={
        active
          ? 'bg-oga-black text-white'
          : 'bg-oga-bg-card text-oga-text-primary hover:bg-oga-bg-input'
      }
      style={{
        flex: 1,
        textAlign: 'left',
        border: active ? '0.5px solid transparent' : '0.5px solid #E4E4E0',
        borderRadius: 10,
        padding: '12px 14px',
        fontSize: 13,
        fontWeight: 500,
        transition: 'background 120ms',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{title}</div>
      <div
        style={{
          fontSize: 11,
          opacity: active ? 0.85 : 0.7,
        }}
      >
        {subtitle}
      </div>
    </button>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-oga-text-muted uppercase"
      style={{
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: 0.4,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  )
}
