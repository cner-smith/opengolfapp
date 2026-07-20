import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  resolveFacilityResults,
  searchOpenGolfApi,
  getOpenGolfApiCourse,
  type OpenGolfApiCourse,
  type OpenGolfApiSearchResult,
} from '@oga/core'
import {
  createCourse,
  createHoles,
  defaultHolesForCourse,
  getCourseByExternalId,
  getCourseById,
  getCourseTees,
  getFacilitiesByIds,
  getHolesForCourse,
  searchCourses,
  searchFacilities,
  upsertCourseTees,
} from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { supabase } from '../lib/supabase'
import { useDebounce } from './useDebounce'
import { useAuth } from './useAuth'

type CourseRow = Database['public']['Tables']['courses']['Row']
type FacilityRow = Database['public']['Tables']['facilities']['Row']
type HoleInsert = Database['public']['Tables']['holes']['Insert']

// Hybrid search: queries OpenGolfAPI for global hits, plus the local
// Supabase courses table so already-imported / user-created courses
// always surface even if OpenGolfAPI has no match. Deduped by
// external_id and name.
//
// Facility-first: local results are split into standalone courses (no
// facility_id) and facility units. Units are never dropped from the
// result set — a unit's facility is re-anchored in via getFacilitiesByIds
// so a search for "Lake Hefner South" still surfaces the "Lake Hefner
// Golf Club" facility card even when the name match wasn't on the
// facility row itself.
export function useCourseSearch(query: string) {
  const debounced = useDebounce(query, 300)

  return useQuery({
    queryKey: ['courses', 'search', debounced],
    enabled: debounced.trim().length > 0,
    queryFn: async ({ signal }) => {
      const [api, local, facilitySearch] = await Promise.allSettled([
        searchOpenGolfApi(debounced, signal),
        searchCourses(supabase, debounced, 10),
        searchFacilities(supabase, debounced, 10),
      ])
      const apiHits: OpenGolfApiSearchResult[] =
        api.status === 'fulfilled' ? api.value : []
      // searchCourses now returns the narrow column subset (created_by /
      // created_at dropped). Cast via unknown to the wider CourseRow so
      // consumers that pick up a course from this list and pass it around
      // with the full row type still typecheck.
      const localRows: CourseRow[] =
        local.status === 'fulfilled'
          ? ((local.value.data ?? []) as unknown as CourseRow[])
          : []
      const facilityRows =
        facilitySearch.status === 'fulfilled'
          ? (facilitySearch.value.data ?? [])
          : []

      const { standalone, facilities } = await resolveFacilityResults(
        localRows,
        facilityRows as unknown as FacilityRow[],
        async (ids) => {
          const r = await getFacilitiesByIds(supabase, ids)
          return (r.data ?? []) as unknown as FacilityRow[]
        },
      )

      return {
        api: apiHits,
        // `local` keeps ALL matching local courses (incl. facility units) for
        // consumers that just need a course row to route on (e.g. CoursePlanPage).
        // `standalone` excludes units — the facility-first picker renders those
        // under their facility card instead.
        local: localRows,
        standalone,
        facilities,
        apiAvailable: api.status === 'fulfilled',
      }
    },
  })
}

// Direct course-row fetch by id. Used by RoundDetailPage to read
// authoritative course lat/lng for the map's fallback camera target —
// the joined courses(...) field on the round query has been
// unreliable for the centroid lookup, so a separate direct read
// avoids the join-shape ambiguity.
export function useCourse(courseId: string | undefined) {
  return useQuery({
    queryKey: ['course', courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await getCourseById(supabase, courseId!)
      if (error) throw error
      return data
    },
  })
}

export function useHolesForCourse(courseId: string | undefined) {
  return useQuery({
    queryKey: ['holes', courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await getHolesForCourse(supabase, courseId!)
      if (error) throw error
      return data ?? []
    },
  })
}

interface ImportFromApiArgs {
  apiId: string
  fallbackName: string
  fallbackLocation?: string | null
  gpsTeeCoords?: { lat: number; lng: number } | null
}

// Picks an existing Supabase course by external_id, or fetches the full
// scorecard from OpenGolfAPI and inserts course + holes.
export function useImportApiCourse() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (args: ImportFromApiArgs) => {
      if (!user) throw new Error('not authenticated')
      const { data: existing, error: existingError } = await getCourseByExternalId(
        supabase,
        args.apiId,
      )
      if (existingError) throw existingError
      if (existing) return existing

      let detail: OpenGolfApiCourse | null = null
      try {
        detail = await getOpenGolfApiCourse(args.apiId)
      } catch {
        detail = null
      }

      const holes: HoleInsert[] =
        detail && detail.holes.length > 0
          ? detail.holes.map((h, idx) => ({
              course_id: '',
              number: h.number,
              par: h.par,
              yards: h.yards ?? null,
              stroke_index: idx + 1,
              tee_lat: idx === 0 ? args.gpsTeeCoords?.lat ?? null : null,
              tee_lng: idx === 0 ? args.gpsTeeCoords?.lng ?? null : null,
            }))
          : defaultHolesForCourse('')

      // Prefer the detail's discrete city/state. If the detail came back
      // empty, fall back to splitting the freeform fallbackLocation on
      // its first comma — same UX as the manual form.
      let city = detail?.city ?? null
      let state = detail?.state ?? null
      if (!city && !state && args.fallbackLocation) {
        const trimmed = args.fallbackLocation.trim()
        const commaIdx = trimmed.indexOf(',')
        city =
          commaIdx >= 0
            ? trimmed.slice(0, commaIdx).trim() || null
            : trimmed || null
        state =
          commaIdx >= 0 ? trimmed.slice(commaIdx + 1).trim() || null : null
      }

      // `created_by` is required by the holes INSERT policy (migration
      // 0026): the immediate `createHoles` call below RLS-fails on
      // courses with `created_by IS NULL`. Stamp the caller's user id
      // so the policy's `c.created_by = auth.uid()` check passes.
      const { data: course, error } = await createCourse(supabase, {
        name: detail?.name ?? args.fallbackName,
        city,
        state,
        external_id: args.apiId,
        created_by: user.id,
      })
      if (error || !course) throw error ?? new Error('Course insert failed')

      const holeRows = holes.map((h) => ({ ...h, course_id: course.id }))
      const { error: holesError } = await createHoles(supabase, holeRows)
      if (holesError) throw holesError

      // Tees are best-effort — failures shouldn't block the round flow.
      if (detail && detail.tees.length > 0) {
        await upsertCourseTees(
          supabase,
          detail.tees.map((t) => ({
            course_id: course.id,
            tee_color: t.color,
            tee_name: t.name ?? null,
            course_rating: t.rating ?? null,
            slope_rating: t.slope ?? null,
            total_yards: t.totalYards ?? null,
            par: t.par ?? null,
          })),
        )
      }

      return course as CourseRow
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['courses'] }),
  })
}

export function useCourseTees(courseId: string | null | undefined) {
  return useQuery({
    queryKey: ['course-tees', courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await getCourseTees(supabase, courseId!)
      if (error) throw error
      return data ?? []
    },
  })
}

interface CreateCourseTeeArgs {
  course_id: string
  tee_color: string
  course_rating?: number | null
  slope_rating?: number | null
  total_yards?: number | null
  par?: number | null
}

export function useCreateCourseTee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: CreateCourseTeeArgs) => {
      const { data, error } = await upsertCourseTees(supabase, [
        {
          course_id: args.course_id,
          tee_color: args.tee_color.toLowerCase(),
          course_rating: args.course_rating ?? null,
          slope_rating: args.slope_rating ?? null,
          total_yards: args.total_yards ?? null,
          par: args.par ?? null,
        },
      ])
      if (error) throw error
      return (data?.[0] ?? null) as
        | { id: string; tee_color: string }
        | null
    },
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: ['course-tees', vars.course_id] }),
  })
}

interface ManualCourseArgs {
  name: string
  // Free-form "City, State" string from the form. Split on the first comma
  // into discrete city + state at insert time.
  location: string | null
  pars: number[]
  gpsTeeCoords?: { lat: number; lng: number } | null
}

// Used by "Course not found? Add it →" form. pars.length determines 9-vs-18.
export function useCreateManualCourse() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (args: ManualCourseArgs) => {
      if (!user) throw new Error('not authenticated')
      const trimmed = args.location?.trim() ?? ''
      const commaIdx = trimmed.indexOf(',')
      const city =
        commaIdx >= 0 ? trimmed.slice(0, commaIdx).trim() || null : trimmed || null
      const state =
        commaIdx >= 0 ? trimmed.slice(commaIdx + 1).trim() || null : null
      // See useImportApiCourse — `created_by` required by holes INSERT
      // policy (migration 0026) so the followup createHoles passes RLS.
      const { data: course, error: courseError } = await createCourse(supabase, {
        name: args.name.trim(),
        city,
        state,
        created_by: user.id,
      })
      if (courseError || !course) {
        throw courseError ?? new Error('Course insert failed')
      }
      const holes: HoleInsert[] = args.pars.map((par, idx) => ({
        course_id: course.id,
        number: idx + 1,
        par,
        stroke_index: idx + 1,
        tee_lat: idx === 0 ? args.gpsTeeCoords?.lat ?? null : null,
        tee_lng: idx === 0 ? args.gpsTeeCoords?.lng ?? null : null,
      }))
      const { error: holesError } = await createHoles(supabase, holes)
      if (holesError) throw holesError
      return course as CourseRow
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['courses'] }),
  })
}
