import { Link } from 'react-router-dom'
import type { Database } from '@oga/supabase'

type RoundRow = Database['public']['Tables']['rounds']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']
type HoleRow = Database['public']['Tables']['holes']['Row']

interface RoundSummaryProps {
  round: RoundRow
  holes: HoleRow[]
  holeScores: HoleScoreRow[]
  totalRoundsLogged: number
}

function formatSG(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}`
}

function bestWorstHole(
  holeScores: HoleScoreRow[],
  holes: HoleRow[],
): { best?: { number: number; diff: number }; worst?: { number: number; diff: number } } {
  const byHoleId = new Map(holes.map((h) => [h.id, h]))
  let best: { number: number; diff: number } | undefined
  let worst: { number: number; diff: number } | undefined
  for (const hs of holeScores) {
    const hole = byHoleId.get(hs.hole_id)
    if (!hole) continue
    const diff = hs.score - hole.par
    if (!best || diff < best.diff) best = { number: hole.number, diff }
    if (!worst || diff > worst.diff) worst = { number: hole.number, diff }
  }
  return { best, worst }
}

export function RoundSummary({
  round,
  holes,
  holeScores,
  totalRoundsLogged,
}: RoundSummaryProps) {
  const par = holes.reduce((sum, h) => sum + h.par, 0)
  const score = round.total_score ?? holeScores.reduce((s, hs) => s + hs.score, 0)
  const toPar = score && par ? score - par : null
  const { best, worst } = bestWorstHole(holeScores, holes)

  return (
    <div className="rounded-lg bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-fairway-700">Round summary</h2>
        <div className="text-sm text-gray-500">
          Score{' '}
          <span className="text-base font-bold text-gray-900">{score}</span>
          {toPar !== null && (
            <span className="ml-1">({toPar > 0 ? `+${toPar}` : toPar === 0 ? 'E' : toPar})</span>
          )}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SGCell label="Off tee" value={round.sg_off_tee} />
        <SGCell label="Approach" value={round.sg_approach} />
        <SGCell label="Around green" value={round.sg_around_green} />
        <SGCell label="Putting" value={round.sg_putting} />
      </dl>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Stat label="SG total" value={formatSG(round.sg_total)} />
        <Stat label="Putts" value={round.total_putts?.toString() ?? '—'} />
        <Stat
          label="Fairways"
          value={
            round.fairways_total
              ? `${round.fairways_hit ?? 0}/${round.fairways_total}`
              : '—'
          }
        />
        <Stat label="GIR" value={round.gir?.toString() ?? '—'} />
      </div>

      {(best || worst) && (
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          {best && (
            <div className="rounded bg-emerald-50 px-3 py-2">
              <div className="text-xs text-emerald-700">Best hole</div>
              <div className="font-medium">
                #{best.number} ({best.diff > 0 ? `+${best.diff}` : best.diff === 0 ? 'E' : best.diff})
              </div>
            </div>
          )}
          {worst && (
            <div className="rounded bg-red-50 px-3 py-2">
              <div className="text-xs text-red-700">Worst hole</div>
              <div className="font-medium">
                #{worst.number} ({worst.diff > 0 ? `+${worst.diff}` : worst.diff === 0 ? 'E' : worst.diff})
              </div>
            </div>
          )}
        </div>
      )}

      {totalRoundsLogged >= 3 && (
        <div className="mt-5">
          <Link
            to="/practice"
            className="inline-block rounded bg-fairway-500 px-4 py-2 text-sm text-white hover:bg-fairway-700"
          >
            Generate practice plan →
          </Link>
        </div>
      )}
    </div>
  )
}

function SGCell({ label, value }: { label: string; value: number | null | undefined }) {
  const num = value ?? 0
  const tone = num > 0 ? 'text-emerald-700' : num < 0 ? 'text-red-700' : 'text-gray-500'
  return (
    <div className="rounded border border-gray-100 bg-gray-50 p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-lg font-bold ${tone}`}>{formatSG(value)}</div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-base font-medium text-gray-900">{value}</div>
    </div>
  )
}
