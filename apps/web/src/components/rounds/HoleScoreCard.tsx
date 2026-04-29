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

interface BubbleStyle {
  bg: string
  fg: string
  border?: string
}

function bubbleStyle(score: number | null | undefined, par: number): BubbleStyle | null {
  if (!score) return null
  const d = score - par
  if (d <= -2) return { bg: '#1D9E75', fg: '#FFFFFF' }
  if (d === -1) return { bg: '#E1F5EE', fg: '#0F6E56', border: '#1D9E75' }
  if (d === 0) return { bg: 'transparent', fg: '#888880' }
  if (d === 1) return { bg: '#FCEBEB', fg: '#A32D2D' }
  if (d === 2) return { bg: '#E24B4A', fg: '#FFFFFF' }
  return { bg: '#A32D2D', fg: '#FFFFFF' }
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
    state === true ? '#1D9E75' : state === false ? '#FCEBEB' : '#F4F4F0'
  const color =
    state === true ? '#FFFFFF' : state === false ? '#A32D2D' : '#888880'
  const border =
    state === true ? 'transparent' : state === false ? '#FCEBEB' : '#E4E4E0'
  return (
    <button
      type="button"
      onClick={cycle}
      style={{
        backgroundColor: bg,
        color,
        border: `0.5px solid ${border}`,
        borderRadius: 7,
        padding: '5px 10px',
        fontSize: 11,
        fontWeight: 500,
        minWidth: 56,
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
      className="grid grid-cols-12 items-center gap-3 border-t border-oga-border"
      style={{ padding: '10px 14px' }}
    >
      <div className="col-span-2">
        <div
          className="font-medium tabular text-oga-text-primary"
          style={{ fontSize: 14 }}
        >
          Hole {hole.number}
        </div>
        <div className="text-oga-text-muted tabular" style={{ fontSize: 11 }}>
          Par {hole.par}
          {hole.yards ? ` · ${hole.yards} yd` : ''}
        </div>
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
        className="col-span-1 tabular bg-oga-bg-input text-oga-text-primary"
        style={{
          border: '0.5px solid #E4E4E0',
          borderRadius: 7,
          padding: '6px 8px',
          fontSize: 14,
          textAlign: 'center',
          fontWeight: 500,
        }}
      />

      <div className="col-span-1 flex justify-center">
        {bubble && (
          <span
            className="inline-flex items-center justify-center tabular"
            style={{
              backgroundColor: bubble.bg,
              color: bubble.fg,
              border: bubble.border ? `1.5px solid ${bubble.border}` : 'none',
              borderRadius: 9999,
              width: 28,
              height: 28,
              fontSize: 13,
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
        className="col-span-2 tabular bg-oga-bg-input text-oga-text-primary"
        style={{
          border: '0.5px solid #E4E4E0',
          borderRadius: 7,
          padding: '6px 8px',
          fontSize: 13,
          textAlign: 'center',
        }}
      />

      <div className="col-span-2 flex justify-center">
        {isPar3 ? (
          <span className="text-oga-text-hint" style={{ fontSize: 11 }}>
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
          className="text-oga-text-primary transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            backgroundColor: '#FFFFFF',
            border: '0.5px solid #E4E4E0',
            borderRadius: 7,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 500,
          }}
          title={holeScore ? 'Edit shots' : 'Enter a score to log shots'}
        >
          {shotCount > 0 ? `${shotCount} shots` : 'Add shots'}
        </button>
      </div>
    </div>
  )
}
