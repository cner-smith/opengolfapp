import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { resumeHoleNumber } from '@oga/core'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { dropRoundCaches, isNetworkFailure, offlineKeys, readCache, writeCache } from '../lib/offlineCache'

export interface ActiveRound {
  id: string
  courseName: string
  currentHole: number
}

type CachedActiveRound = ActiveRound & { playedAt: string }

// Active = not finalized (completed_at IS NULL) AND no score yet
// (total_score IS NULL) AND played_at within the last day, so a round
// abandoned a week ago doesn't haunt the home screen forever. completed_at
// is the canonical finalized flag; the total_score guard also keeps seeded
// past rounds (scored, but no completed_at) out of the banner.
// The current hole is resumeHoleNumber's pick — the hole the player was
// actually on, mid-hole included (#902) — so resuming jumps back to where
// they left off, not hole 1.
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
        const cacheKey = offlineKeys.activeRound(user.id)
        const { data, error, status } = await supabase
          .from('rounds')
          .select('id, played_at, course_id, courses(name)')
          .eq('user_id', user.id)
          .is('completed_at', null)
          .is('total_score', null)
          .gte('played_at', oneDayAgo)
          .order('played_at', { ascending: false })
          .limit(1)
        if (!active) return
        if (error && isNetworkFailure(error, status)) {
          // Offline (#993): show the last banner this device saw, under the
          // same one-day window as the query.
          const cached = await readCache<CachedActiveRound>(cacheKey)
          if (!active) return
          setActiveRound(cached && cached.playedAt >= oneDayAgo ? cached : null)
          return
        }
        if (error || !data?.[0]) {
          setActiveRound(null)
          // No active round: drop every cached round of this user.
          if (!error) void dropRoundCaches(user.id, () => true)
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
        // resumeHoleNumber the round's true hole count to clamp against.
        const { data: hs } = await supabase
          .from('hole_scores')
          .select('score, finished_at, holes(number)')
          .eq('round_id', round.id)
        if (!active) return
        const rows = (hs ?? []) as Array<{
          score: number | null
          finished_at: string | null
          holes?: { number?: number | null } | null
        }>
        const next = resumeHoleNumber(
          rows.flatMap((row) =>
            typeof row.holes?.number === 'number'
              ? [{ number: row.holes.number, score: row.score, finished_at: row.finished_at }]
              : [],
          ),
        )
        const found: CachedActiveRound = {
          id: round.id,
          courseName: round.courses?.name ?? 'Round',
          currentHole: next,
          playedAt: round.played_at,
        }
        setActiveRound(found)
        // Sequential: the drop reads the banner entry back.
        void writeCache(cacheKey, found).then(() =>
          dropRoundCaches(user.id, (roundId) => roundId !== round.id),
        )
      })()
      return () => {
        active = false
      }
    }, [user?.id]),
  )

  return activeRound
}
