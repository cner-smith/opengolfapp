import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CourseSearch } from '../../components/courses/CourseSearch'
import { useCreateRound } from '../../hooks/useRounds'
import { useAuth } from '../../hooks/useAuth'

const TEE_COLORS = ['black', 'blue', 'white', 'gold', 'red'] as const

export function NewRoundPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const createRoundMutation = useCreateRound()
  const [courseId, setCourseId] = useState<string | null>(null)
  const [courseName, setCourseName] = useState('')
  const [playedAt, setPlayedAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [teeColor, setTeeColor] = useState<string>('white')
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
      })
      if (!round) throw new Error('Round insert returned no row')
      navigate(`/rounds/${round.id}`)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-fairway-700">New round</h1>
      <form onSubmit={handleSubmit} className="space-y-6 rounded-lg bg-white p-6 shadow-sm">
        <section>
          <label className="mb-2 block text-sm font-medium text-gray-700">Course</label>
          <CourseSearch
            selectedCourseId={courseId}
            onSelect={(id, name) => {
              setCourseId(id)
              setCourseName(name)
            }}
          />
          {courseName && courseId && (
            <p className="mt-2 text-sm text-fairway-700">Selected: {courseName}</p>
          )}
        </section>

        <section className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="mb-1 block text-gray-700">Date</span>
            <input
              type="date"
              required
              value={playedAt}
              onChange={(e) => setPlayedAt(e.target.value)}
              className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-gray-700">Tees</span>
            <select
              value={teeColor}
              onChange={(e) => setTeeColor(e.target.value)}
              className="w-full rounded border border-gray-200 px-3 py-2 text-sm capitalize"
            >
              {TEE_COLORS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </section>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => navigate('/rounds')}
            className="rounded border border-gray-200 px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createRoundMutation.isPending || !courseId}
            className="rounded bg-fairway-500 px-4 py-2 text-sm text-white hover:bg-fairway-700 disabled:opacity-50"
          >
            {createRoundMutation.isPending ? 'Creating…' : 'Start round'}
          </button>
        </div>
      </form>
    </div>
  )
}
