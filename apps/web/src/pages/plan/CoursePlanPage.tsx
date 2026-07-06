import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCourseSearch } from '../../hooks/useCourses'

// Course Planner landing page — search an already-imported course, then
// navigate to the hole-by-hole planner. Read-only: no round/shot writes.
// Only `local` (already-imported) search hits are shown — planning needs
// a real `courses` row (id) to route on; OpenGolfAPI hits aren't rows yet
// and importing one is a separate, heavier flow (see CourseSearch.tsx).
export default function CoursePlanPage() {
  const [query, setQuery] = useState('')
  const { data, isLoading } = useCourseSearch(query)
  const navigate = useNavigate()

  const courses = data?.local ?? []
  const hasQuery = query.trim().length > 0

  return (
    <div className="mx-auto max-w-2xl">
      <div style={{ marginBottom: 18 }}>
        <h1
          className="text-caddie-ink"
          style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.3 }}
        >
          Course Planner
        </h1>
        <div className="text-caddie-ink-dim" style={{ fontSize: 13, marginTop: 2 }}>
          Plan your strategy before you play
        </div>
      </div>

      <div
        className="bg-caddie-surface flex flex-col gap-4"
        style={{ border: '0.5px solid #D9D2BF', borderRadius: 10, padding: 20 }}
      >
        <input
          type="text"
          placeholder="Search courses…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-caddie-surface-2 text-caddie-ink"
          style={{
            border: '0.5px solid #D9D2BF',
            borderRadius: 7,
            padding: '10px 12px',
            fontSize: 14,
          }}
        />

        {hasQuery && (
          <div
            className="bg-caddie-surface"
            style={{ border: '0.5px solid #D9D2BF', borderRadius: 7, overflow: 'hidden' }}
          >
            {isLoading && (
              <div className="text-caddie-ink-dim" style={{ padding: 14, fontSize: 13 }}>
                Searching…
              </div>
            )}

            {!isLoading && courses.length === 0 && (
              <div className="text-caddie-ink-dim" style={{ padding: 14, fontSize: 13 }}>
                No courses found.
              </div>
            )}

            {!isLoading &&
              courses.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => navigate(`/plan/${c.id}/1`)}
                  className="block w-full text-left transition-colors hover:bg-caddie-surface-2"
                  style={{ padding: '12px 14px', borderTop: '0.5px solid #D9D2BF' }}
                >
                  <div className="text-caddie-ink" style={{ fontSize: 15, fontWeight: 500 }}>
                    {c.name}
                  </div>
                  {(c.city || c.state) && (
                    <div className="text-caddie-ink-dim" style={{ fontSize: 12, marginTop: 2 }}>
                      {[c.city, c.state].filter(Boolean).join(', ')}
                    </div>
                  )}
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
