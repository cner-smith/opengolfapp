import type { OgaSupabaseClient } from '../client'
import type { Database } from '../types'

type PracticePlanInsert = Database['public']['Tables']['practice_plans']['Insert']
type DrillCategory = NonNullable<
  Database['public']['Tables']['drills']['Row']['category']
>

export function getDrills(
  client: OgaSupabaseClient,
  options: { skillLevel?: string; category?: DrillCategory } = {},
) {
  let query = client.from('drills').select('*')
  if (options.skillLevel) {
    query = query.contains('skill_levels', [options.skillLevel])
  }
  if (options.category) {
    query = query.eq('category', options.category)
  }
  return query.order('name')
}

export function getLatestPracticePlan(client: OgaSupabaseClient, userId: string) {
  return client
    .from('practice_plans')
    .select('*')
    .eq('user_id', userId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
}

export function createPracticePlan(client: OgaSupabaseClient, plan: PracticePlanInsert) {
  return client.from('practice_plans').insert(plan).select().single()
}

export function updatePlanProgress(
  client: OgaSupabaseClient,
  planId: string,
  completedDrillIds: string[],
) {
  return client
    .from('practice_plans')
    .update({ completed_drill_ids: completedDrillIds })
    .eq('id', planId)
    .select()
    .single()
}
