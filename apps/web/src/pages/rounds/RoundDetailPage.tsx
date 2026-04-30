import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Database } from '@oga/supabase'
import { HoleScoreCard } from '../../components/rounds/HoleScoreCard'
import { ShotEntryModal } from '../../components/rounds/ShotEntryModal'
import { RoundSummary } from '../../components/rounds/RoundSummary'
import { useRound, useRounds } from '../../hooks/useRounds'
import { useHolesForCourse } from '../../hooks/useCourses'
import { useHoleScores } from '../../hooks/useHoleScores'
import { useShotsForRound } from '../../hooks/useShots'
import { useCompleteRound } from '../../hooks/useCompleteRound'
import { useProfile } from '../../hooks/useProfile'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']

export function RoundDetailPage() {
  const { id: roundId } = useParams()
  const navigate = useNavigate()
  const round = useRound(roundId)
  const profile = useProfile()
  const courseId = round.data?.course_id
  const holesQuery = useHolesForCourse(courseId)
  const holeScoresQuery = useHoleScores(roundId)
  const shotsQuery = useShotsForRound(roundId)
  const completeMutation = useCompleteRound()
  const allRounds = useRounds(50)

  const [shotsModalFor, setShotsModalFor] = useState<{
    holeScoreId: string
    holeNumber: number
    holePar: number
  } | null>(null)
  const [completeError, setCompleteError] = useState<string | null>(null)

  const holes = useMemo(() => holesQuery.data ?? [], [holesQuery.data])
  const rawScores: Array<HoleScoreRow & { holes?: HoleRow | null }> = useMemo(
    () => holeScoresQuery.data ?? [],
    [holeScoresQuery.data],
  )
  const holeScores: HoleScoreRow[] = useMemo(
    () =>
      rawScores.map((row) => {
        const { holes: _h, ...rest } = row
        return rest
      }),
    [rawScores],
  )
  const scoresByHoleId = useMemo(() => {
    const m = new Map<string, HoleScoreRow>()
    for (const s of holeScores) m.set(s.hole_id, s)
    return m
  }, [holeScores])
  const shotCountByHoleScore = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of shotsQuery.data ?? []) {
      m.set(s.hole_score_id, (m.get(s.hole_score_id) ?? 0) + 1)
    }
    return m
  }, [shotsQuery.data])

  if (round.isLoading || holesQuery.isLoading) {
    return (
      <div className="text-caddie-ink-mute" style={{ fontSize: 13 }}>
        Loading round…
      </div>
    )
  }
  if (round.error) {
    return (
      <div
        className="text-caddie-neg"
        style={{
          border: '1px solid #A33A2A',
          borderRadius: 4,
          padding: '14px 18px',
          fontSize: 13,
        }}
      >
        Error: {(round.error as Error).message}
      </div>
    )
  }
  if (!round.data) {
    return <div style={{ fontSize: 13 }}>Round not found.</div>
  }

  const holesPlayed = holeScores.length
  const totalRoundsLogged = allRounds.data?.length ?? 0

  async function handleComplete() {
    if (!round.data || !courseId) return
    setCompleteError(null)
    try {
      const handicap = profile.data?.handicap_index ?? 15
      await completeMutation.mutateAsync({
        roundId: round.data.id,
        courseId,
        handicap,
      })
    } catch (err) {
      setCompleteError((err as Error).message)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/rounds')}
        className="font-mono uppercase text-caddie-ink-mute hover:text-caddie-ink"
        style={{
          fontSize: 10,
          letterSpacing: '0.14em',
          marginBottom: 18,
        }}
      >
        ← All rounds
      </button>

      <div
        className="flex items-end justify-between"
        style={{ marginBottom: 28 }}
      >
        <div>
          <div className="kicker" style={{ marginBottom: 8 }}>
            Round detail
          </div>
          <h1
            className="font-serif text-caddie-ink"
            style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.15 }}
          >
            {round.data.courses?.name ?? 'Round'}
          </h1>
          <div
            className="font-mono uppercase tabular text-caddie-ink-mute"
            style={{
              fontSize: 10,
              letterSpacing: '0.14em',
              marginTop: 6,
            }}
          >
            {round.data.played_at}
            {round.data.tee_color ? ` · ${round.data.tee_color} tees` : ''} ·{' '}
            {holesPlayed}/18 holes scored
          </div>
        </div>
        <button
          type="button"
          onClick={handleComplete}
          disabled={completeMutation.isPending || holesPlayed === 0}
          className="bg-caddie-accent text-caddie-accent-ink hover:opacity-90 disabled:opacity-40"
          style={{
            borderRadius: 2,
            padding: '12px 16px',
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '0.02em',
          }}
        >
          {completeMutation.isPending ? 'Calculating…' : 'Save SG + finalize'}
        </button>
      </div>

      {completeError && (
        <div
          className="text-caddie-neg"
          style={{
            border: '1px solid #A33A2A',
            borderRadius: 4,
            padding: '14px 18px',
            fontSize: 13,
            marginBottom: 18,
          }}
        >
          {completeError}
        </div>
      )}

      {round.data.sg_total !== null && (
        <div style={{ marginBottom: 28 }}>
          <RoundSummary
            round={round.data}
            holes={holes}
            holeScores={holeScores}
            totalRoundsLogged={totalRoundsLogged}
          />
        </div>
      )}

      <div style={{ borderTop: '1px solid #D9D2BF', paddingTop: 14 }}>
        <div className="kicker" style={{ marginBottom: 14 }}>
          Scorecard
        </div>
        <div style={{ borderTop: '1px solid #D9D2BF' }}>
          <div
            className="grid grid-cols-12 items-center font-mono uppercase text-caddie-ink-mute"
            style={{
              padding: '10px 0',
              fontSize: 10,
              letterSpacing: '0.14em',
              gap: 12,
              borderBottom: '1px solid #D9D2BF',
            }}
          >
            <div className="col-span-2">Hole</div>
            <div className="col-span-1 text-center">Score</div>
            <div className="col-span-1" />
            <div className="col-span-2 text-center">Putts</div>
            <div className="col-span-2 text-center">Fairway</div>
            <div className="col-span-1 text-center">GIR</div>
            <div className="col-span-3 text-right">Shots</div>
          </div>
          {holes.map((h) => {
            const hs = scoresByHoleId.get(h.id)
            return (
              <HoleScoreCard
                key={h.id}
                roundId={round.data.id}
                hole={h}
                holeScore={hs}
                shotCount={hs ? (shotCountByHoleScore.get(hs.id) ?? 0) : 0}
                onEditShots={(holeScoreId) =>
                  setShotsModalFor({
                    holeScoreId,
                    holeNumber: h.number,
                    holePar: h.par,
                  })
                }
              />
            )
          })}
        </div>
      </div>

      {shotsModalFor && round.data && (
        <ShotEntryModal
          roundId={round.data.id}
          holeScoreId={shotsModalFor.holeScoreId}
          holeNumber={shotsModalFor.holeNumber}
          holePar={shotsModalFor.holePar}
          onClose={() => setShotsModalFor(null)}
        />
      )}
    </div>
  )
}
