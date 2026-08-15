import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '@oga/supabase'

// Dev-only Course Editor data layer. Everything here goes through the local
// vite-plugins/dev-course-api.ts backend (fetch('/api/dev/...'), backed by
// the service-role key server-side) rather than the anon Supabase browser
// client used by useCourses.ts — courses/holes have no UPDATE/DELETE RLS
// policy at all, and facilities require service_role for every write, so
// the anon client simply can't do what this editor needs. Kept in a
// separate file so it's obvious which functions are prod-safe (useCourses)
// vs. dev-only (here).
//
// Query keys mostly reuse useCourses.ts's conventions (['holes', courseId],
// ['course-tees', courseId], ['hole-tees', courseId]) so editing a course
// here invalidates the same cache entries the rest of the app reads from —
// those are safe to share because both the prod and dev-editor queries
// fetch the same full row shape for holes/tees.
//
// Courses are the one exception: the prod useCourse hook (useCourses.ts)
// intentionally selects a NARROW column subset (COURSE_COLUMNS — no
// website/address/country), while the editor needs every column. Sharing
// ['course', id] between them meant whichever query last populated the
// cache "won" for both — if a round-detail view cached the narrow shape
// first, opening the editor within staleTime showed blank website/address/
// country instead of refetching. useEditorCourse uses its own key
// (['editor-course', id]) to avoid that; useUpdateCourse still invalidates
// both keys so the rest of the app still picks up edits made here.

type CourseRow = Database['public']['Tables']['courses']['Row']
type CourseUpdate = Database['public']['Tables']['courses']['Update']
type CourseInsert = Database['public']['Tables']['courses']['Insert']
type FacilityRow = Database['public']['Tables']['facilities']['Row']
type FacilityUpdate = Database['public']['Tables']['facilities']['Update']
type FacilityInsert = Database['public']['Tables']['facilities']['Insert']
type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleInsert = Database['public']['Tables']['holes']['Insert']
type CourseTeeRow = Database['public']['Tables']['course_tees']['Row']
type CourseTeeInsert = Database['public']['Tables']['course_tees']['Insert']
type CourseTeeUpdate = Database['public']['Tables']['course_tees']['Update']
type HoleTeeRow = Database['public']['Tables']['hole_tees']['Row']
type HoleTeeInsert = Database['public']['Tables']['hole_tees']['Insert']

export interface OsmImportSummary {
  courseId: string
  created: boolean
  holesImported: number
  refsFound: number[]
  missingRefs: number[]
  greenMatches: number
  teeMatches: number
  missingGreenRefs: number[]
  missingTeeRefs: number[]
  missingParRefs: number[]
  missingYardsRefs: number[]
  dedupedRefs: number[]
  wipedHoles: number
}

async function devFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/dev${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `${res.status} ${res.statusText}`)
  }
  return res.json()
}

// --- Courses ---------------------------------------------------------------

export function useEditorCourse(id: string | undefined) {
  return useQuery({
    queryKey: ['editor-course', id],
    enabled: !!id,
    queryFn: () => devFetch<CourseRow>(`/courses/${id}`),
  })
}

export function useCreateCourseEditor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (course: CourseInsert) =>
      devFetch<CourseRow>('/courses', { method: 'POST', body: JSON.stringify(course) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['courses'] }),
  })
}

export function useUpdateCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CourseUpdate }) =>
      devFetch<CourseRow>(`/courses/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['editor-course', vars.id] })
      qc.invalidateQueries({ queryKey: ['course', vars.id] })
      qc.invalidateQueries({ queryKey: ['courses'] })
    },
  })
}

// --- Facilities --------------------------------------------------------------

export function useEditorFacility(id: string | undefined) {
  return useQuery({
    queryKey: ['facility', id],
    enabled: !!id,
    queryFn: () => devFetch<FacilityRow>(`/facilities/${id}`),
  })
}

export function useCreateFacility() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (facility: FacilityInsert) =>
      devFetch<FacilityRow>('/facilities', { method: 'POST', body: JSON.stringify(facility) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['facilities'] }),
  })
}

export function useUpdateFacility() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: FacilityUpdate }) =>
      devFetch<FacilityRow>(`/facilities/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['facility', vars.id] })
      qc.invalidateQueries({ queryKey: ['facilities'] })
    },
  })
}

// --- Holes -------------------------------------------------------------------

export function useEditorHoles(courseId: string | undefined) {
  return useQuery({
    queryKey: ['holes', courseId],
    enabled: !!courseId,
    queryFn: () => devFetch<HoleRow[]>(`/holes?courseId=${courseId}`),
  })
}

export function useUpsertHoles() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ courseId, holes }: { courseId: string; holes: HoleInsert[] }) =>
      devFetch<HoleRow[]>('/holes', {
        method: 'POST',
        body: JSON.stringify(holes.length === 1 ? holes[0] : holes),
      }).then((data) => ({ courseId, data })),
    onSuccess: ({ courseId }) => qc.invalidateQueries({ queryKey: ['holes', courseId] }),
  })
}

export function useDeleteHole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; courseId: string }) =>
      devFetch<{ ok: true }>(`/holes/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['holes', vars.courseId] }),
  })
}

// --- Course tees ---------------------------------------------------------------

export function useEditorCourseTees(courseId: string | undefined) {
  return useQuery({
    queryKey: ['course-tees', courseId],
    enabled: !!courseId,
    queryFn: () => devFetch<CourseTeeRow[]>(`/course-tees?courseId=${courseId}`),
  })
}

export function useUpsertCourseTee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ courseId, tee }: { courseId: string; tee: CourseTeeInsert }) =>
      devFetch<CourseTeeRow[]>('/course-tees', { method: 'POST', body: JSON.stringify(tee) }).then(
        (data) => ({ courseId, data }),
      ),
    onSuccess: ({ courseId }) => qc.invalidateQueries({ queryKey: ['course-tees', courseId] }),
  })
}

// Editing an EXISTING tee — update by id, not upsert-by-(course_id,tee_color).
// The upsert path (useUpsertCourseTee) resolves conflicts on tee_color, so if
// the color field is touched during an edit, Postgres no longer recognizes
// the payload as "the same row" and attempts a fresh INSERT — which then
// collides with the row's own id on the primary key. Update-by-id has no
// such ambiguity: it always targets the exact row being edited.
export function useUpdateCourseTeeById() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, courseId, patch }: { id: string; courseId: string; patch: CourseTeeUpdate }) =>
      devFetch<CourseTeeRow>(`/course-tees/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }).then(
        (data) => ({ courseId, data }),
      ),
    onSuccess: ({ courseId }) => qc.invalidateQueries({ queryKey: ['course-tees', courseId] }),
  })
}

export function useDeleteCourseTee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; courseId: string }) =>
      devFetch<{ ok: true }>(`/course-tees/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['course-tees', vars.courseId] }),
  })
}

// Marks a tee as the course's primary — the tee whose data IS the base
// `holes` row in the Course Editor, replacing the old unlabeled "Base"
// concept. Un-sets any previous primary on the same course.
export function useSetPrimaryCourseTee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, courseId }: { id: string; courseId: string }) =>
      devFetch<CourseTeeRow>(`/course-tees/${id}/set-primary`, {
        method: 'POST',
        body: JSON.stringify({ courseId }),
      }).then((data) => ({ courseId, data })),
    onSuccess: ({ courseId }) => qc.invalidateQueries({ queryKey: ['course-tees', courseId] }),
  })
}

// Auto-promotes a newly created tee to primary, but only if the course has
// no primary yet — re-checked against the database server-side rather than
// trusting the caller's local `tees` array, which can be stale (e.g. a
// second tee added before an earlier "set primary" refetch lands). A stale
// client-side "is this the first tee?" check would otherwise silently
// steal primary status from an existing tee.
export function useSetPrimaryIfNone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, courseId }: { id: string; courseId: string }) =>
      devFetch<CourseTeeRow | null>(`/course-tees/${id}/set-primary-if-none`, {
        method: 'POST',
        body: JSON.stringify({ courseId }),
      }).then((data) => ({ courseId, data })),
    onSuccess: ({ courseId }) => qc.invalidateQueries({ queryKey: ['course-tees', courseId] }),
  })
}

// --- Hole tees (per-tee overrides: yards/par/stroke_index/tee location) -------

export function useEditorHoleTees(courseId: string | undefined) {
  return useQuery({
    queryKey: ['hole-tees', courseId],
    enabled: !!courseId,
    // getHoleTeesForCourse joins through `holes` to scope by course_id
    // (hole_tees has no course_id column of its own) — the API echoes
    // Postgrest's response verbatim, so strip the nested `holes` object
    // here rather than leaking the join shape to consumers.
    queryFn: async () => {
      const rows = await devFetch<Array<HoleTeeRow & { holes?: unknown }>>(
        `/hole-tees?courseId=${courseId}`,
      )
      return rows.map(({ holes: _holes, ...row }) => row as HoleTeeRow)
    },
  })
}

export function useUpsertHoleTees() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ courseId, rows }: { courseId: string; rows: HoleTeeInsert[] }) =>
      devFetch<HoleTeeRow[]>('/hole-tees', {
        method: 'POST',
        body: JSON.stringify(rows.length === 1 ? rows[0] : rows),
      }).then((data) => ({ courseId, data })),
    onSuccess: ({ courseId }) => qc.invalidateQueries({ queryKey: ['hole-tees', courseId] }),
  })
}

export function useDeleteHoleTee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; courseId: string }) =>
      devFetch<{ ok: true }>(`/hole-tees/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['hole-tees', vars.courseId] }),
  })
}

// --- OSM refetch ---------------------------------------------------------------

export function useRefetchOsm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      courseId,
      lat,
      lng,
      radius,
    }: {
      courseId: string
      lat?: number
      lng?: number
      radius?: number
    }) =>
      devFetch<OsmImportSummary>(`/courses/${courseId}/refetch-osm`, {
        method: 'POST',
        body: JSON.stringify({ lat, lng, radius }),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['holes', vars.courseId] })
      qc.invalidateQueries({ queryKey: ['editor-course', vars.courseId] })
      qc.invalidateQueries({ queryKey: ['course', vars.courseId] })
    },
  })
}
