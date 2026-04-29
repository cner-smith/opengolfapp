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
    <div className="space-y-2">
      <input
        type="text"
        placeholder="Search course by name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
      />
      <div className="max-h-48 overflow-y-auto rounded border border-gray-100">
        {search.isLoading && <div className="p-3 text-sm text-gray-500">Searching…</div>}
        {!search.isLoading &&
          courses.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id, c.name)}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-fairway-50 ${
                selectedCourseId === c.id ? 'bg-fairway-100 font-medium' : ''
              }`}
            >
              <div>{c.name}</div>
              {c.location && <div className="text-xs text-gray-500">{c.location}</div>}
            </button>
          ))}
        {noMatch && !creating && (
          <button
            type="button"
            onClick={() => {
              setCreating(true)
              setNewName(query)
            }}
            className="block w-full px-3 py-2 text-left text-sm text-fairway-700 hover:bg-fairway-50"
          >
            + Add "{query}" as a new course
          </button>
        )}
      </div>

      {creating && (
        <div className="space-y-2 rounded border border-fairway-100 bg-fairway-50 p-3">
          <div className="text-sm font-medium text-fairway-900">Add new course</div>
          <input
            type="text"
            placeholder="Course name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Location (city, state)"
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={!newName.trim() || createMutation.isPending}
              className="rounded bg-fairway-500 px-3 py-1.5 text-sm text-white hover:bg-fairway-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating…' : 'Create + use'}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded border border-gray-200 px-3 py-1.5 text-sm"
            >
              Cancel
            </button>
          </div>
          {createMutation.error && (
            <div className="text-xs text-red-600">
              {(createMutation.error as Error).message}
            </div>
          )}
          <p className="text-xs text-gray-600">
            Creates an 18-hole par-72 layout. Edit individual holes later.
          </p>
        </div>
      )}
    </div>
  )
}
