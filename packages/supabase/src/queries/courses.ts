import type { OgaSupabaseClient } from '../client'

export function getCourses(client: OgaSupabaseClient) {
  return client.from('courses').select('*').order('name')
}

export function getCourseWithHoles(client: OgaSupabaseClient, courseId: string) {
  return client
    .from('courses')
    .select('*, holes(*)')
    .eq('id', courseId)
    .single()
}
