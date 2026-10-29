import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { rankPlanCourses } from '@oga/core'
import { getHoleCoordsForCourses, getRoundCourseIds } from '@oga/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useCourseSearch } from '../../hooks/useCourses'
import { supabase } from '../../lib/supabase'

// Course Planner landing page — search an already-imported course, then
// navigate to the hole-by-hole planner. Read-only: no round/shot writes.
// Only `local` (already-imported) search hits are shown — planning needs
// a real `courses` row (id) to route on; OpenGolfAPI hits aren't rows yet
// and importing one is a separate, heavier flow (see CourseSearch.tsx).
//
// Course names repeat (seven "Bear Creek Golf Club"s, #1223), so each row says
// how much of the course is mapped, and courses the player has played lead.
export default function CoursePlanPage() {
  const [query, setQuery] = useState('')
  const { user } = useAuth()
  // Ranking only (#898), as in CourseSearch: where the player is, when the
  // browser already allows it. Search never asks.
  const [near, setNear] = useState<{ lat: number; lng: number } | null>(null)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions) return
    let live = true
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((s) => {
        if (s.state !== 'granted') return
        navigator.geolocation.getCurrentPosition(
          (pos) => live && setNear({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => {},
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 600_000 },
        )
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])
  const { data, isLoading } = useCourseSearch(query, near)
  const navigate = useNavigate()

  const courses = data?.local ?? []
  const ids = courses.map((c) => c.id)
  const detail = useQuery({
    queryKey: ['plan-courses', ids, user?.id],
    enabled: ids.length > 0 && !!user,
    queryFn: async () => {
      const [holes, rounds] = await Promise.all([
        getHoleCoordsForCourses(supabase, ids),
        getRoundCourseIds(supabase, user!.id, ids),
      ])
      if (holes.error) throw holes.error
      if (rounds.error) throw rounds.error
      return { holes: holes.data ?? [], played: rounds.data }
    },
  })
  useEffect(() => {
    if (detail.error) console.error('[CoursePlanPage/detail] counts failed; showing the unranked list', detail.error)
  }, [detail.error])
  // Until the counts land (or if they fail) the rows keep the search's order
  // and say nothing about mapping.
  const rows = detail.data
    ? rankPlanCourses(courses, detail.data.holes, detail.data.played)
    : courses.map((c) => ({ ...c, counts: null }))
  const hasQuery = query.trim().length > 0

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-serif text-caddie-ink" style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.15 }}>
        Plan a round
      </h1>
      <p
        className="font-serif text-caddie-ink-dim"
        style={{ fontSize: 17, fontStyle: 'italic', lineHeight: 1.4, marginTop: 6, marginBottom: 18 }}
      >
        Pick a course, then walk it hole by hole with the distances your clubs really go.
      </p>

      <input
        type="text"
        placeholder="Search courses…"
        aria-label="Search courses"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full bg-caddie-surface text-caddie-ink"
        style={{ border: '1px solid #9F9580', borderRadius: 3, height: 44, padding: '0 14px', fontSize: 15 }}
      />

      {hasQuery && (
        <div style={{ marginTop: 14 }}>
          {isLoading && (
            <div className="text-caddie-ink-dim" style={{ padding: '14px 0', fontSize: 13 }}>
              Searching…
            </div>
          )}

          {!isLoading && courses.length === 0 && (
            <div className="text-caddie-ink-dim" style={{ padding: '14px 0', fontSize: 13 }}>
              No courses found.
            </div>
          )}

          {!isLoading &&
            rows.map((c) => {
              const counts = 'counts' in c ? null : c
              const where = [c.city, c.state].filter(Boolean).join(', ')
              const unmapped = counts != null && counts.mappedCount === 0
              const mapped =
                counts == null
                  ? null
                  : unmapped
                    ? 'Not mapped yet'
                    : counts.mappedCount === counts.holeCount
                      ? `${counts.holeCount} holes mapped`
                      : `${counts.mappedCount} of ${counts.holeCount} holes mapped`
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => navigate(`/plan/${c.id}/1`)}
                  className="block w-full text-left transition-colors hover:bg-caddie-surface"
                  style={{ padding: '12px 4px', borderTop: '1px solid #D9D2BF' }}
                >
                  <div className={unmapped ? 'text-caddie-ink-dim' : 'text-caddie-ink'} style={{ fontSize: 15, fontWeight: 500 }}>
                    {c.name}
                  </div>
                  <div className={unmapped ? 'text-caddie-ink-mute' : 'text-caddie-ink-dim'} style={{ fontSize: 13, marginTop: 2 }}>
                    {[where, mapped].filter(Boolean).join(' · ')}
                  </div>
                  {counts?.played && (
                    <div className="font-serif text-caddie-ink" style={{ fontSize: 14, fontStyle: 'italic', marginTop: 2 }}>
                      You&rsquo;ve played here
                    </div>
                  )}
                </button>
              )
            })}
        </div>
      )}
    </div>
  )
}
