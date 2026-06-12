import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface ActiveRound {
  id: string
  courseName: string
  currentHole: number
}

// Active = not finalized (completed_at IS NULL) AND no score yet
// (total_score IS NULL) AND played_at within the last day, so a round
// abandoned a week ago doesn't haunt the home screen forever. completed_at
// is the canonical finalized flag; the total_score guard also keeps seeded
// past rounds (scored, but no completed_at) out of the banner.
// The current hole is the highest hole the player has logged a score
// on, +1 (capped at 18) — so resuming jumps back to where they left
// off, not hole 1.
//
// Re-runs every time the host screen gains focus. Without that,
// deleting the active round from the hole/end-round screens left a
// stale banner on home until the app reloaded.
export function useActiveRound(): ActiveRound | null {
  const { user } = useAuth()
  const [activeRound, setActiveRound] = useState<ActiveRound | null>(null)

  useFocusEffect(
    useCallback(() => {
      if (!user) return
      let active = true
      ;(async () => {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10)
        const { data, error } = await supabase
          .from('rounds')
          .select('id, played_at, course_id, courses(name)')
          .eq('user_id', user.id)
          .is('completed_at', null)
          .is('total_score', null)
          .gte('played_at', oneDayAgo)
          .order('played_at', { ascending: false })
          .limit(1)
        if (!active) return
        if (error || !data?.[0]) {
          setActiveRound(null)
          return
        }
        const round = data[0] as {
          id: string
          played_at: string
          course_id: string
          courses?: { name: string | null } | null
        }
        const { data: hs } = await supabase
          .from('hole_scores')
          .select('score, holes(number)')
          .eq('round_id', round.id)
          .gt('score', 0)
        if (!active) return
        const maxHole = (hs ?? []).reduce<number>((acc, row) => {
          const n = (row as { holes?: { number?: number | null } | null })
            .holes?.number
          return typeof n === 'number' && n > acc ? n : acc
        }, 0)
        const next = Math.min(18, Math.max(1, maxHole + 1))
        setActiveRound({
          id: round.id,
          courseName: round.courses?.name ?? 'Round',
          currentHole: next,
        })
      })()
      return () => {
        active = false
      }
    }, [user?.id]),
  )

  return activeRound
}
