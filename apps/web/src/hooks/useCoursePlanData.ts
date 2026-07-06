import { useAuth } from './useAuth'
import { useHolesForCourse } from './useCourses'
import { useClubDispersion } from '../pages/rounds/hooks/useClubDispersion'

export function useCoursePlanData(courseId: string | undefined) {
  const { user } = useAuth()
  const holesQuery = useHolesForCourse(courseId)
  const dispersion = useClubDispersion(user?.id)
  const holes = holesQuery.data ?? []
  const isMapped = holes.some((h) => h.tee_lat != null && h.pin_lat != null)
  return {
    holes,
    loading: holesQuery.isLoading || dispersion.loading,
    isMapped,
    dispersion,
  }
}
