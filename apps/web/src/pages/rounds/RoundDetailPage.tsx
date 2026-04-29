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
    return <div className="p-4 text-fairway-700">Loading round…</div>
  }
  if (round.error) {
    return <div className="p-4 text-red-600">Error: {(round.error as Error).message}</div>
  }
  if (!round.data) {
    return <div className="p-4">Round not found.</div>
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate('/rounds')}
            className="text-sm text-fairway-700 hover:underline"
          >
            ← All rounds
          </button>
          <h1 className="mt-1 text-2xl font-bold text-fairway-700">
            {round.data.courses?.name ?? 'Round'}
          </h1>
          <div className="text-sm text-gray-500">
            {round.data.played_at}
            {round.data.tee_color ? ` · ${round.data.tee_color} tees` : ''}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-xs text-gray-500">{holesPlayed}/18 holes scored</div>
          <button
            type="button"
            onClick={handleComplete}
            disabled={completeMutation.isPending || holesPlayed === 0}
            className="rounded bg-fairway-500 px-4 py-2 text-sm text-white hover:bg-fairway-700 disabled:opacity-50"
          >
            {completeMutation.isPending ? 'Calculating…' : 'Save SG + finalize'}
          </button>
        </div>
      </div>

      {completeError && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
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

      <div className="rounded-lg bg-white shadow-sm">
        <div className="grid grid-cols-12 gap-2 border-b border-gray-100 px-3 py-2 text-xs font-semibold uppercase text-gray-500">
          <div className="col-span-2">Hole</div>
          <div className="col-span-2 text-center">Score</div>
          <div className="col-span-2 text-center">Putts</div>
          <div className="col-span-2 text-center">FH</div>
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
