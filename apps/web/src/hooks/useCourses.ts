import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCourse,
  createHoles,
  defaultHolesForCourse,
  getHolesForCourse,
  searchCourses,
} from '@oga/supabase'
import { supabase } from '../lib/supabase'

export function useCourseSearch(query: string) {
  return useQuery({
    queryKey: ['courses', 'search', query],
    queryFn: async () => {
      const { data, error } = await searchCourses(supabase, query)
      if (error) throw error
      return data ?? []
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

interface CreateCourseArgs {
  name: string
  location?: string | null
}

export function useCreateCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, location }: CreateCourseArgs) => {
      const { data: course, error: courseError } = await createCourse(supabase, {
        name: name.trim(),
        location: location?.trim() || null,
      })
      if (courseError) throw courseError
      if (!course) throw new Error('Course insert returned no row')

      const holes = defaultHolesForCourse(course.id)
      const { error: holesError } = await createHoles(supabase, holes)
      if (holesError) throw holesError

      return course
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['courses'] }),
  })
}
