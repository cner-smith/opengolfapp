import { useState } from 'react'
import type { Database } from '@oga/supabase'
import { HoleScoreCard } from '../../../components/rounds/HoleScoreCard'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']

interface ScorecardViewProps {
  holes: HoleRow[]
  scoresByHoleId: Map<string, HoleScoreRow>
  shotCountByHoleScore: Map<string, number>
  roundId: string
  /** Materialize a synthetic-id hole into a real `holes` row before
   *  any hole_scores write. No-op for real holes. */
  ensureRealHole: (hole: HoleRow) => Promise<string>
  onEditShots: (args: {
    holeScoreId: string
    holeNumber: number
    holePar: number
  }) => void
}

export function ScorecardView({
  holes,
  scoresByHoleId,
  shotCountByHoleScore,
  roundId,
  ensureRealHole,
  onEditShots,
}: ScorecardViewProps) {
  const hasSyntheticHoles = holes.some(
    (h) => !h.yards && h.tee_lat == null,
  )
  const [hintDismissed, setHintDismissed] = useState(false)
  return (
    <div style={{ borderTop: '1px solid #D9D2BF', paddingTop: 14 }}>
      <div className="kicker" style={{ marginBottom: 14 }}>
        Scorecard
      </div>
      {hasSyntheticHoles && !hintDismissed && (
        <div
          role="status"
          style={{
            marginBottom: 14,
            padding: '10px 14px',
            background: '#FBF8F1',
            border: '1px solid #D9D2BF',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 14,
          }}
        >
          <div
            className="text-caddie-ink-dim"
            style={{ flex: 1, fontSize: 13, lineHeight: 1.4 }}
          >
            No course layout found. Par defaults to 4 — tap to edit.
          </div>
          <button
            type="button"
            onClick={() => setHintDismissed(true)}
            aria-label="Dismiss notice"
            className="font-mono uppercase text-caddie-ink-mute hover:text-caddie-ink"
            style={{
              fontSize: 10,
              letterSpacing: '0.14em',
              background: 'transparent',
              border: 'none',
              padding: 4,
            }}
          >
            Dismiss
          </button>
        </div>
      )}
      <div
        style={{
          borderTop: '1px solid #D9D2BF',
          overflowX: 'auto',
        }}
      >
        <div style={{ minWidth: 720 }}>
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
              roundId={roundId}
              hole={h}
              holeScore={hs}
              shotCount={hs ? (shotCountByHoleScore.get(hs.id) ?? 0) : 0}
              ensureRealHole={ensureRealHole}
              onEditShots={(holeScoreId) =>
                onEditShots({
                  holeScoreId,
                  holeNumber: h.number,
                  // Per-round par override (#710) — hole_scores.par wins.
                  holePar: hs?.par ?? h.par,
                })
              }
            />
          )
        })}
        </div>
      </div>
    </div>
  )
}
