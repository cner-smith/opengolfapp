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
    return <div className="text-oga-text-muted" style={{ fontSize: 13 }}>Loading round…</div>
  }
  if (round.error) {
    return (
      <div
        className="bg-oga-red-light text-oga-red-dark"
        style={{ borderRadius: 10, padding: '12px 14px', fontSize: 13 }}
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
    <div className="flex flex-col gap-3">
      <div>
        <button
          type="button"
          onClick={() => navigate('/rounds')}
          className="text-oga-text-muted hover:text-oga-text-primary"
          style={{ fontSize: 12 }}
        >
          ← All rounds
        </button>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <h1
            className="text-oga-text-primary"
            style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.3 }}
          >
            {round.data.courses?.name ?? 'Round'}
          </h1>
          <div
            className="text-oga-text-muted"
            style={{ fontSize: 13, marginTop: 2 }}
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
          className="bg-oga-black text-white transition-colors hover:bg-oga-text-primary/90 disabled:opacity-50"
          style={{
            borderRadius: 10,
            padding: '10px 16px',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {completeMutation.isPending ? 'Calculating…' : 'Save SG + finalize'}
        </button>
      </div>

      {completeError && (
        <div
          className="bg-oga-red-light text-oga-red-dark"
          style={{
            border: '0.5px solid #E24B4A',
            borderRadius: 10,
            padding: '12px 14px',
            fontSize: 13,
          }}
        >
          {completeError}
        </div>
      )}

      {round.data.sg_total !== null && (
        <RoundSummary
          round={round.data}
          holes={holes}
          holeScores={holeScores}
          totalRoundsLogged={totalRoundsLogged}
        />
      )}

      <div
        className="bg-oga-bg-card overflow-hidden"
        style={{
          border: '0.5px solid #E4E4E0',
          borderRadius: 10,
        }}
      >
        <div
          className="grid grid-cols-12 gap-3 text-oga-text-muted uppercase"
          style={{
            padding: '10px 14px',
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: 0.4,
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
