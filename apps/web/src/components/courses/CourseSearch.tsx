import { useState } from 'react'
import { useCourseSearch, useCreateCourse } from '../../hooks/useCourses'

interface CourseSearchProps {
  selectedCourseId: string | null
  onSelect: (courseId: string, courseName: string) => void
}

export function CourseSearch({ selectedCourseId, onSelect }: CourseSearchProps) {
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newLocation, setNewLocation] = useState('')
  const search = useCourseSearch(query)
  const createMutation = useCreateCourse()

  const courses = search.data ?? []
  const noMatch = !search.isLoading && query.trim().length > 0 && courses.length === 0

  async function handleCreate() {
    const trimmed = newName.trim()
    if (!trimmed) return
    const course = await createMutation.mutateAsync({
      name: trimmed,
      location: newLocation || null,
    })
    onSelect(course.id, course.name)
    setCreating(false)
    setNewName('')
    setNewLocation('')
    setQuery('')
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        placeholder="Search course by name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full bg-oga-bg-input text-oga-text-primary"
        style={{ border: '0.5px solid #E4E4E0', borderRadius: 7, padding: '8px 10px', fontSize: 13 }}
      />
      <div
        className="max-h-48 overflow-y-auto bg-oga-bg-card"
        style={{ border: '0.5px solid #E4E4E0', borderRadius: 7 }}
      >
        {search.isLoading && (
          <div className="text-oga-text-muted" style={{ padding: 12, fontSize: 13 }}>
            Searching…
          </div>
        )}
        {!search.isLoading &&
          courses.map((c) => {
            const selected = selectedCourseId === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c.id, c.name)}
                className="block w-full text-left transition-colors hover:bg-oga-bg-input"
                style={{
                  padding: '8px 12px',
                  fontSize: 13,
                  backgroundColor: selected ? '#E1F5EE' : 'transparent',
                  fontWeight: selected ? 500 : 400,
                  color: selected ? '#0F6E56' : '#111111',
                }}
              >
                <div>{c.name}</div>
                {c.location && (
                  <div className="text-oga-text-muted" style={{ fontSize: 11 }}>
                    {c.location}
                  </div>
                )}
              </button>
            )
          })}
        {noMatch && !creating && (
          <button
            type="button"
            onClick={() => {
              setCreating(true)
              setNewName(query)
            }}
            className="block w-full text-left text-oga-green-dark transition-colors hover:bg-oga-bg-input"
            style={{ padding: '8px 12px', fontSize: 13 }}
          >
            + Add &ldquo;{query}&rdquo; as a new course
          </button>
        )}
      </div>

      {creating && (
        <div
          className="bg-oga-green-light"
          style={{
            border: '0.5px solid #1D9E75',
            borderRadius: 10,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div className="text-oga-green-dark" style={{ fontSize: 13, fontWeight: 500 }}>
            Add new course
          </div>
          <input
            type="text"
            placeholder="Course name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full bg-oga-bg-card text-oga-text-primary"
            style={{ border: '0.5px solid #E4E4E0', borderRadius: 7, padding: '8px 10px', fontSize: 13 }}
          />
          <input
            type="text"
            placeholder="Location (city, state)"
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            className="w-full bg-oga-bg-card text-oga-text-primary"
            style={{ border: '0.5px solid #E4E4E0', borderRadius: 7, padding: '8px 10px', fontSize: 13 }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={!newName.trim() || createMutation.isPending}
              className="bg-oga-black text-white transition-colors hover:bg-oga-text-primary/90 disabled:opacity-50"
              style={{ borderRadius: 7, padding: '8px 12px', fontSize: 12, fontWeight: 500 }}
            >
              {createMutation.isPending ? 'Creating…' : 'Create + use'}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="bg-oga-bg-card text-oga-text-primary"
              style={{ border: '0.5px solid #E4E4E0', borderRadius: 7, padding: '8px 12px', fontSize: 12 }}
            >
              Cancel
            </button>
          </div>
          {createMutation.error && (
            <div className="text-oga-red-dark" style={{ fontSize: 11 }}>
              {(createMutation.error as Error).message}
            </div>
          )}
          <p className="text-oga-text-muted" style={{ fontSize: 11 }}>
            Creates an 18-hole par-72 layout. Edit individual holes later.
          </p>
        </div>
      )}
    </div>
  )
}
