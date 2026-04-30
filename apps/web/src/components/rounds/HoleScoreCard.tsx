import { useEffect, useState } from 'react'
import type { Database } from '@oga/supabase'
import { useUpsertHoleScore } from '../../hooks/useHoleScores'
import { useUnits } from '../../hooks/useUnits'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']

interface HoleScoreCardProps {
  roundId: string
  hole: HoleRow
  holeScore?: HoleScoreRow
  shotCount: number
  onEditShots: (holeScoreId: string) => void
}

interface BubbleStyle {
  bg: string
  fg: string
  border?: string
}

// Score bubble palette per DESIGN.md scorecard recipe.
function bubbleStyle(score: number | null | undefined, par: number): BubbleStyle | null {
  if (!score) return null
  const d = score - par
  if (d <= -2) return { bg: '#1F3D2C', fg: '#F2EEE5' }
  if (d === -1) return { bg: '#FBF8F1', fg: '#1F3D2C', border: '#1F3D2C' }
  if (d === 0) return { bg: 'transparent', fg: '#5C6356' }
  if (d === 1) return { bg: '#F1DCD7', fg: '#A33A2A' }
  if (d === 2) return { bg: '#A33A2A', fg: '#F2EEE5' }
  return { bg: '#A33A2A', fg: '#F2EEE5' }
}

function ToggleButton({
  state,
  onChange,
  label,
}: {
  state: boolean | null
  onChange: (v: boolean | null) => void
  label: string
}) {
  const cycle = () => {
    onChange(state === true ? false : state === false ? null : true)
  }
  const bg =
    state === true ? '#1F3D2C' : state === false ? '#F1DCD7' : '#EBE5D6'
  const color =
    state === true ? '#F2EEE5' : state === false ? '#A33A2A' : '#5C6356'
  return (
    <button
      type="button"
      onClick={cycle}
      style={{
        backgroundColor: bg,
        color,
        border: 'none',
        borderRadius: 2,
        padding: '6px 10px',
        fontSize: 12,
        fontWeight: 500,
        minWidth: 56,
        letterSpacing: '0.02em',
      }}
      aria-label={label}
    >
      {label} {state === true ? '✓' : state === false ? '✗' : '–'}
    </button>
  )
}

export function HoleScoreCard({
  roundId,
  hole,
  holeScore,
  shotCount,
  onEditShots,
}: HoleScoreCardProps) {
  const upsert = useUpsertHoleScore(roundId)
  const { toDisplay } = useUnits()
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
  const bubble = bubbleStyle(holeScore?.score, hole.par)

  return (
    <div
      className="grid grid-cols-12 items-center"
      style={{
        padding: '14px 0',
        gap: 12,
        borderBottom: '1px solid #D9D2BF',
      }}
    >
      <div className="col-span-2">
        <div
          className="font-mono uppercase tabular text-caddie-ink-mute"
          style={{ fontSize: 10, letterSpacing: '0.14em' }}
        >
          Hole {hole.number}
        </div>
        <div
          className="font-serif text-caddie-ink"
          style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.2, marginTop: 2 }}
        >
          Par {hole.par}
        </div>
        {hole.yards && (
          <div
            className="font-mono tabular text-caddie-ink-mute"
            style={{
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
            }}
          >
            {toDisplay(hole.yards)}
          </div>
        )}
      </div>

      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={15}
        placeholder="—"
        value={score}
        onChange={(e) => setScore(e.target.value)}
        onBlur={() => {
          const n = score ? Number(score) : null
          if (n) persist({ score: n })
        }}
        className="col-span-1 font-serif tabular text-caddie-ink bg-caddie-surface"
        style={{
          border: '1px solid #D9D2BF',
          borderRadius: 2,
          padding: '8px 6px',
          fontSize: 17,
          textAlign: 'center',
          fontWeight: 500,
        }}
      />

      <div className="col-span-1 flex justify-center">
        {bubble && (
          <span
            className="inline-flex items-center justify-center font-serif tabular"
            style={{
              backgroundColor: bubble.bg,
              color: bubble.fg,
              border: bubble.border ? `1px solid ${bubble.border}` : 'none',
              borderRadius: 2,
              width: 30,
              height: 30,
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {holeScore?.score}
          </span>
        )}
      </div>

      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={10}
        placeholder="Putts"
        value={putts}
        onChange={(e) => setPutts(e.target.value)}
        onBlur={() => persist({ putts: putts === '' ? null : Number(putts) })}
        className="col-span-2 tabular text-caddie-ink bg-caddie-surface"
        style={{
          border: '1px solid #D9D2BF',
          borderRadius: 2,
          padding: '8px 8px',
          fontSize: 13,
          textAlign: 'center',
        }}
      />

      <div className="col-span-2 flex justify-center">
        {isPar3 ? (
          <span className="text-caddie-ink-mute" style={{ fontSize: 11 }}>
            —
          </span>
        ) : (
          <ToggleButton
            label="FH"
            state={fairway}
            onChange={(v) => {
              setFairway(v)
              persist({ fairway_hit: v })
            }}
          />
        )}
      </div>

      <div className="col-span-1 flex justify-center">
        <ToggleButton
          label="GIR"
          state={gir}
          onChange={(v) => {
            setGir(v)
            persist({ gir: v })
          }}
        />
      </div>

      <div className="col-span-3 flex items-center justify-end">
        <button
          type="button"
          disabled={!holeScore}
          onClick={() => holeScore && onEditShots(holeScore.id)}
          className="text-caddie-ink transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            backgroundColor: '#FBF8F1',
            border: '1px solid #1F3D2C',
            color: '#1F3D2C',
            borderRadius: 2,
            padding: '8px 12px',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.02em',
          }}
          title={holeScore ? 'Edit shots' : 'Enter a score to log shots'}
        >
          {shotCount > 0 ? `${shotCount} shots` : 'Add shots'}
        </button>
      </div>
    </div>
  )
}
