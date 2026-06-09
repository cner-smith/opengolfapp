import { useQuery } from '@tanstack/react-query'
import { handicapProvenance } from '@oga/core'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

// Returns the provenance of the user's stored handicap_index: 'calculated'
// once enough rated rounds exist for the WHS index to have been derived,
// 'provisional' while it's still the entered value. The count of rounds
// with a non-null score_differential is the signal; the threshold lives in
// @oga/core (handicapProvenance) so web + mobile agree. See #521.
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
      const differentialsCount = count ?? 0
      return {
        differentialsCount,
        provenance: handicapProvenance(differentialsCount),
      }
    },
  })
}
