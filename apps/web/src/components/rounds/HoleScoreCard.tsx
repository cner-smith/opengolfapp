import { useEffect, useState } from 'react'
import type { Database } from '@oga/supabase'
import { useUpsertHoleScore } from '../../hooks/useHoleScores'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']

interface HoleScoreCardProps {
  roundId: string
  hole: HoleRow
  holeScore?: HoleScoreRow
  shotCount: number
  onEditShots: (holeScoreId: string) => void
}

function diffLabel(score: number | null | undefined, par: number) {
  if (!score) return null
  const d = score - par
  if (d <= -3) return { label: 'Albatross', cls: 'bg-amber-200 text-amber-900' }
  if (d === -2) return { label: 'Eagle', cls: 'bg-emerald-200 text-emerald-900' }
  if (d === -1) return { label: 'Birdie', cls: 'bg-emerald-100 text-emerald-800' }
  if (d === 0) return { label: 'Par', cls: 'bg-gray-100 text-gray-800' }
  if (d === 1) return { label: 'Bogey', cls: 'bg-orange-100 text-orange-800' }
  return { label: `+${d}`, cls: 'bg-red-100 text-red-800' }
}

export function HoleScoreCard({
  roundId,
  hole,
  holeScore,
  shotCount,
  onEditShots,
}: HoleScoreCardProps) {
  const upsert = useUpsertHoleScore(roundId)
  const [score, setScore] = useState<string>(holeScore?.score?.toString() ?? '')
  const [putts, setPutts] = useState<string>(holeScore?.putts?.toString() ?? '')
  const [fairway, setFairway] = useState<boolean | null>(holeScore?.fairway_hit ?? null)
  const [gir, setGir] = useState<boolean | null>(holeScore?.gir ?? null)

  useEffect(() => {
    setScore(holeScore?.score?.toString() ?? '')
    setPutts(holeScore?.putts?.toString() ?? '')
    setFairway(holeScore?.fairway_hit ?? null)
    setGir(holeScore?.gir ?? null)
  }, [holeScore?.id, holeScore?.score, holeScore?.putts, holeScore?.fairway_hit, holeScore?.gir])

  function persist(next: {
    score?: number | null
    putts?: number | null
    fairway_hit?: boolean | null
    gir?: boolean | null
  }) {
    const numericScore =
      next.score !== undefined ? next.score : score ? Number(score) : null
    if (!numericScore) return
    upsert.mutate({
      id: holeScore?.id,
      round_id: roundId,
      hole_id: hole.id,
      score: numericScore,
      putts:
        next.putts !== undefined
          ? next.putts
          : putts === ''
            ? null
            : Number(putts),
      fairway_hit:
        hole.par <= 3
          ? null
          : next.fairway_hit !== undefined
            ? next.fairway_hit
            : fairway,
      gir: next.gir !== undefined ? next.gir : gir,
    })
  }

  const isPar3 = hole.par === 3
  const diff = diffLabel(holeScore?.score, hole.par)

  return (
    <div className="grid grid-cols-12 items-center gap-2 border-b border-gray-100 px-3 py-2 text-sm">
      <div className="col-span-2">
        <div className="font-semibold">Hole {hole.number}</div>
        <div className="text-xs text-gray-500">
          Par {hole.par}
          {hole.yards ? ` · ${hole.yards} yd` : ''}
        </div>
      </div>

      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={15}
        placeholder="Score"
        value={score}
        onChange={(e) => setScore(e.target.value)}
        onBlur={() => {
          const n = score ? Number(score) : null
          if (n) persist({ score: n })
        }}
        className="col-span-2 rounded border border-gray-200 px-2 py-1.5 text-center"
      />

      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={10}
        placeholder="Putts"
        value={putts}
        onChange={(e) => setPutts(e.target.value)}
        onBlur={() => persist({ putts: putts === '' ? null : Number(putts) })}
        className="col-span-2 rounded border border-gray-200 px-2 py-1.5 text-center"
      />

      <div className="col-span-2 flex justify-center">
        {!isPar3 ? (
          <button
            type="button"
            onClick={() => {
              const nextVal = fairway === true ? false : fairway === false ? null : true
              setFairway(nextVal)
              persist({ fairway_hit: nextVal })
            }}
            className={`rounded px-2 py-1 text-xs ${
              fairway === true
                ? 'bg-emerald-500 text-white'
                : fairway === false
                  ? 'bg-red-200 text-red-900'
                  : 'bg-gray-100 text-gray-500'
            }`}
            aria-label="Fairway hit"
          >
            FH {fairway === true ? '✓' : fairway === false ? '✗' : '–'}
          </button>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </div>

      <div className="col-span-1 flex justify-center">
        <button
          type="button"
          onClick={() => {
            const nextVal = gir === true ? false : gir === false ? null : true
            setGir(nextVal)
            persist({ gir: nextVal })
          }}
          className={`rounded px-2 py-1 text-xs ${
            gir === true
              ? 'bg-emerald-500 text-white'
              : gir === false
                ? 'bg-red-200 text-red-900'
                : 'bg-gray-100 text-gray-500'
          }`}
          aria-label="GIR"
        >
          GIR
        </button>
      </div>

      <div className="col-span-3 flex items-center justify-end gap-2">
        {diff && <span className={`rounded px-2 py-0.5 text-xs ${diff.cls}`}>{diff.label}</span>}
        <button
          type="button"
          disabled={!holeScore}
          onClick={() => holeScore && onEditShots(holeScore.id)}
          className="rounded border border-gray-200 px-2 py-1 text-xs hover:bg-fairway-50 disabled:opacity-40"
          title={holeScore ? 'Edit shots' : 'Enter a score to log shots'}
        >
          {shotCount > 0 ? `${shotCount} shots` : 'Add shots'}
        </button>
      </div>
    </div>
  )
}
