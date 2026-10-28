import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { resumeHoleNumber } from '@oga/core'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

export interface ActiveRound {
  id: string
  courseName: string
  currentHole: number
}

// Port of mobile's useActiveRound: not finalized, no score yet, played in the
// last day, so an abandoned round doesn't haunt Home.
export function useActiveRound() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['active-round', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<ActiveRound | null> => {
      const q = supabase
        .from('rounds')
        .select('id, played_at, courses(name)')
        .eq('user_id', user!.id)
        .is('completed_at', null)
        .is('total_score', null)
        .gte('played_at', new Date(Date.now() - 864e5).toISOString().slice(0, 10))
      const { data, error } = await q.order('played_at', { ascending: false }).limit(1)
      if (error) throw error
      const round = data?.[0] as { id: string; courses?: { name: string | null } | null } | undefined
      if (!round) return null
      const { data: hs } = await supabase
        .from('hole_scores')
        .select('score, finished_at, holes(number)')
        .eq('round_id', round.id)
      const rows = ((hs ?? []) as Array<{
        score: number | null
        finished_at: string | null
        holes?: { number?: number | null } | null
      }>).flatMap((r) =>
        typeof r.holes?.number === 'number'
          ? [{ number: r.holes.number, score: r.score, finished_at: r.finished_at }]
          : [],
      )
      return { id: round.id, courseName: round.courses?.name ?? 'Round', currentHole: resumeHoleNumber(rows) }
    },
  })
}

// Mobile's ResumeRoundBanner: a raised paper tile with a breathing amber edge,
// standing in for Start live round while a round is open (SHL-04).
export function ResumeRoundBanner({ round }: { round: ActiveRound }) {
  const to = `/rounds/${round.id}?view=map`
  return (
    <div className="paper-tile relative overflow-hidden" style={{ marginBottom: 14 }}>
      <span className="dash-live-bar absolute inset-y-0 left-0" style={{ width: 4 }} />
      <div className="flex items-center justify-between" style={{ gap: 12, padding: '14px 14px 16px 20px' }}>
        <Link to={to} tabIndex={-1} className="min-w-0 flex-1">
          <div className="text-caddie-warn" style={{ fontSize: 12, marginBottom: 2 }}>
            Active round
          </div>
          <div className="font-serif text-caddie-ink truncate" style={{ fontSize: 18, fontStyle: 'italic', fontWeight: 500 }}>
            {round.courseName}
          </div>
          <div className="text-caddie-ink-dim" style={{ fontSize: 13, marginTop: 1 }}>
            Hole <span className="font-serif" style={{ fontStyle: 'italic', fontSize: 15 }}>{round.currentHole}</span> next
          </div>
        </Link>
        <Link
          to={to}
          className="key"
          style={{ minHeight: 42, flexShrink: 0 }}
          aria-label={`Resume active round at ${round.courseName}, hole ${round.currentHole}`}
        >
          Resume →
        </Link>
      </div>
    </div>
  )
}
