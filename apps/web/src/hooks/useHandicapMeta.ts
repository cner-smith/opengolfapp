import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

// Returns whether the user's handicap was last set by the auto-recompute
// path (i.e. at least one finalized round has a score_differential), so
// the UI can stamp an "Official" badge instead of "Manually entered".
export function useHandicapMeta() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['handicap-meta', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('rounds')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .not('score_differential', 'is', null)
      if (error) throw error
      return {
        differentialsCount: count ?? 0,
        official: (count ?? 0) > 0,
      }
    },
  })
}
