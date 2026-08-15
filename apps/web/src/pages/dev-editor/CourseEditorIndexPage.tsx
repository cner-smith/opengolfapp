import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getFacilityUnits, searchCourses, searchFacilities } from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { useDebounce } from '../../hooks/useDebounce'
import { useCreateCourseEditor } from '../../hooks/useCourseEditor'

type CourseRow = Database['public']['Tables']['courses']['Row']
type FacilityRow = Database['public']['Tables']['facilities']['Row']

// Read-only search — goes through the plain anon client (same as
// CourseSearch), not the dev-only /api/dev/* backend. Deliberately simpler
// than CourseSearch: no OpenGolfAPI import flow, since this tool only needs
// to find courses that already exist locally.
function useDevCourseSearch(query: string) {
  const debounced = useDebounce(query, 300)
  return useQuery({
    queryKey: ['dev-editor', 'search', debounced],
    enabled: debounced.trim().length > 0,
    queryFn: async () => {
      const [coursesRes, facilitiesRes] = await Promise.all([
        searchCourses(supabase, debounced, 15),
        searchFacilities(supabase, debounced, 10),
      ])
      return {
        courses: (coursesRes.data ?? []) as unknown as CourseRow[],
        facilities: (facilitiesRes.data ?? []) as unknown as FacilityRow[],
      }
    },
  })
}

export default function CourseEditorIndexPage() {
  const [query, setQuery] = useState('')
  const [openFacility, setOpenFacility] = useState<FacilityRow | null>(null)
  const [units, setUnits] = useState<CourseRow[]>([])
  const [newName, setNewName] = useState('')
  const search = useDevCourseSearch(query)
  const createCourse = useCreateCourseEditor()
  const navigate = useNavigate()

  async function pickFacility(f: FacilityRow) {
    setOpenFacility(f)
    const { data } = await getFacilityUnits(supabase, f.id)
    setUnits((data ?? []) as unknown as CourseRow[])
  }

  async function createNew() {
    if (!newName.trim()) return
    const course = await createCourse.mutateAsync({ name: newName.trim() })
    navigate(`/dev/courses/${course.id}/edit`)
  }

  const courses = search.data?.courses ?? []
  const facilities = search.data?.facilities ?? []
  const standaloneCourses = courses.filter((c) => !c.facility_id)
  const noMatches = !search.isLoading && courses.length === 0 && facilities.length === 0

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 className="font-serif text-caddie-ink" style={{ fontSize: 24, fontWeight: 500 }}>
          Course Editor
        </h1>
        <div className="text-caddie-ink-mute" style={{ fontSize: 13, marginTop: 4 }}>
          Dev-only. Edit any course, hole, tee, or facility record directly.
        </div>
      </div>

      <input
        type="text"
        placeholder="Search courses or facilities…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpenFacility(null)
        }}
        className="bg-caddie-surface text-caddie-ink"
        style={{ border: '1px solid #D9D2BF', borderRadius: 2, padding: '10px 12px', fontSize: 14 }}
      />

      {openFacility ? (
        <div className="bg-caddie-surface" style={{ border: '1px solid #D9D2BF', borderRadius: 2 }}>
          <div
            className="kicker"
            style={{ padding: '10px 14px', borderBottom: '1px solid #D9D2BF', display: 'flex', gap: 8, alignItems: 'center' }}
          >
            <button
              type="button"
              onClick={() => setOpenFacility(null)}
              className="text-caddie-accent"
              style={{ background: 'transparent', border: 'none', fontSize: 11 }}
            >
              ‹ Back
            </button>
            <span>{openFacility.name}</span>
          </div>
          {units.map((u) => (
            <ResultRow
              key={u.id}
              title={u.unit_name ?? u.name}
              onClick={() => navigate(`/dev/courses/${u.id}/edit`)}
            />
          ))}
          {units.length === 0 && (
            <div className="text-caddie-ink-mute" style={{ padding: 14, fontSize: 13 }}>
              No courses linked to this facility yet.
            </div>
          )}
        </div>
      ) : (
        query.trim() && (
          <div className="bg-caddie-surface" style={{ border: '1px solid #D9D2BF', borderRadius: 2 }}>
            {search.isLoading && (
              <div className="text-caddie-ink-mute" style={{ padding: 14, fontSize: 13 }}>
                Searching…
              </div>
            )}
            {facilities.map((f) => (
              <ResultRow
                key={f.id}
                title={f.name}
                subtitle={[f.city, f.state].filter(Boolean).join(', ') || undefined}
                onClick={() => pickFacility(f)}
              />
            ))}
            {standaloneCourses.map((c) => (
              <ResultRow
                key={c.id}
                title={c.name}
                subtitle={[c.city, c.state].filter(Boolean).join(', ') || undefined}
                onClick={() => navigate(`/dev/courses/${c.id}/edit`)}
              />
            ))}
            {noMatches && (
              <div className="text-caddie-ink-mute" style={{ padding: 14, fontSize: 13 }}>
                No matches.
              </div>
            )}
          </div>
        )
      )}

      <div style={{ borderTop: '1px solid #D9D2BF', paddingTop: 20, display: 'flex', gap: 10 }}>
        <input
          type="text"
          placeholder="New course name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="bg-caddie-surface text-caddie-ink"
          style={{ flex: 1, border: '1px solid #D9D2BF', borderRadius: 2, padding: '10px 12px', fontSize: 14 }}
        />
        <button
          type="button"
          onClick={createNew}
          disabled={createCourse.isPending || !newName.trim()}
          className="bg-caddie-accent text-caddie-accent-ink disabled:opacity-50"
          style={{ borderRadius: 2, padding: '10px 16px', fontSize: 14, fontWeight: 600 }}
        >
          {createCourse.isPending ? 'Creating…' : 'Create course'}
        </button>
      </div>
    </div>
  )
}

function ResultRow({ title, subtitle, onClick }: { title: string; subtitle?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full text-left hover:bg-caddie-bg"
      style={{ padding: '12px 14px', borderTop: '1px solid #D9D2BF' }}
    >
      <div className="font-serif text-caddie-ink" style={{ fontSize: 15 }}>
        {title}
      </div>
      {subtitle && (
        <div className="text-caddie-ink-mute" style={{ fontSize: 12 }}>
          {subtitle}
        </div>
      )}
    </button>
  )
}
