import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
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
  getHolesForCourse,
  searchCourses,
} from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { supabase } from '../lib/supabase'

type CourseRow = Database['public']['Tables']['courses']['Row']
type HoleInsert = Database['public']['Tables']['holes']['Insert']

// Hybrid search: queries OpenGolfAPI for global hits, plus the local
// Supabase courses table so already-imported / user-created courses
// always surface even if OpenGolfAPI has no match. Deduped by
// external_id and name.
export function useCourseSearch(query: string) {
  const [debounced, setDebounced] = useState(query)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 300)
    return () => clearTimeout(id)
  }, [query])

  return useQuery({
    queryKey: ['courses', 'search', debounced],
    enabled: debounced.trim().length > 0,
    queryFn: async ({ signal }) => {
      const [api, local] = await Promise.allSettled([
        searchOpenGolfApi(debounced, signal),
        searchCourses(supabase, debounced, 10),
      ])
      const apiHits: OpenGolfApiSearchResult[] =
        api.status === 'fulfilled' ? api.value : []
      const localRows: CourseRow[] =
        local.status === 'fulfilled' ? local.value.data ?? [] : []
      return {
        api: apiHits,
        local: localRows,
        apiAvailable: api.status === 'fulfilled',
      }
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
  return useMutation({
    mutationFn: async (args: ImportFromApiArgs) => {
      const { data: existing } = await getCourseByExternalId(supabase, args.apiId)
      if (existing) return existing as CourseRow

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

      const location =
        [detail?.city, detail?.state].filter(Boolean).join(', ') ||
        args.fallbackLocation ||
        null

      const { data: course, error } = await createCourse(supabase, {
        name: detail?.name ?? args.fallbackName,
        location,
        external_id: args.apiId,
      })
      if (error || !course) throw error ?? new Error('Course insert failed')

      const holeRows = holes.map((h) => ({ ...h, course_id: course.id }))
      const { error: holesError } = await createHoles(supabase, holeRows)
      if (holesError) throw holesError

      return course as CourseRow
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['courses'] }),
  })
}

interface ManualCourseArgs {
  name: string
  location: string | null
  pars: number[]
  gpsTeeCoords?: { lat: number; lng: number } | null
}

// Used by "Course not found? Add it →" form. pars.length determines 9-vs-18.
export function useCreateManualCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: ManualCourseArgs) => {
      const { data: course, error: courseError } = await createCourse(supabase, {
        name: args.name.trim(),
        location: args.location?.trim() || null,
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
