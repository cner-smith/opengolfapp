import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { inferHoleCount } from '@oga/core'
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
// on, +1 (capped at the round's hole count, not a hardcoded 18) — so
// resuming jumps back to where they left off, not hole 1.
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
        // Fetch ALL hole_scores (not just scored ones): the round's hole
        // rows are batch-created at round start, so their hole numbers give
        // the round's true hole count. maxHole (highest SCORED hole) drives
        // where to resume; holeCount clamps it so a fully-played 9-hole
        // round resumes at 9, not a phantom hole 10 whose error screen used
        // to offer a one-tap round deletion (#650).
        const { data: hs } = await supabase
          .from('hole_scores')
          .select('score, holes(number)')
          .eq('round_id', round.id)
        if (!active) return
        const rows = (hs ?? []) as Array<{
          score: number | null
          holes?: { number?: number | null } | null
        }>
        const holeNumbers = rows
          .map((row) => row.holes?.number)
          .filter((n): n is number => typeof n === 'number')
        const holeCount = inferHoleCount(holeNumbers)
        const maxHole = rows.reduce<number>((acc, row) => {
          const n = row.holes?.number
          return (row.score ?? 0) > 0 && typeof n === 'number' && n > acc
            ? n
            : acc
        }, 0)
        const next = Math.min(holeCount, Math.max(1, maxHole + 1))
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
