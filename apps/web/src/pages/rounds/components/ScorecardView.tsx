import { useState } from 'react'
import type { Database } from '@oga/supabase'
import { formatToPar, type ResolvedHole } from '@oga/core'
import { CARD_COLS, HoleScoreCard } from '../../../components/rounds/HoleScoreCard'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']

interface ScorecardViewProps {
  holes: HoleRow[]
  scoresByHoleId: Map<string, HoleScoreRow>
  shotCountByHoleScore: Map<string, number>
  resolvedHoleByNumber: Map<number, ResolvedHole>
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
  resolvedHoleByNumber,
  roundId,
  ensureRealHole,
  onEditShots,
}: ScorecardViewProps) {
  const hasSyntheticHoles = holes.some(
    (h) => !h.yards && h.tee_lat == null,
  )
  const [hintDismissed, setHintDismissed] = useState(false)

  // Per-nine totals for the title's right side, as on the phone's card.
  const nine = (lo: number, hi: number) => {
    let score = 0
    let par = 0
    for (const h of holes) {
      if (h.number < lo || h.number > hi) continue
      const hs = scoresByHoleId.get(h.id)
      if (hs?.score != null && hs.score > 0) {
        score += hs.score
        par += resolvedHoleByNumber.get(h.number)?.par ?? hs.par ?? h.par
      }
    }
    return score > 0 ? { score, toPar: score - par } : null
  }
  const front = nine(1, 9)
  const back = holes.some((h) => h.number > 9) ? nine(10, 99) : null
  const parts: { label: string; t: { score: number; toPar: number } }[] = []
  if (front) parts.push({ label: holes.length > 9 ? 'Out' : 'Front nine', t: front })
  if (back) parts.push({ label: 'In', t: back })

  const head = 'text-caddie-ink'
  return (
    <section aria-label="Your card">
      <div className="flex items-baseline justify-between" style={{ gap: 8, flexWrap: 'wrap' }}>
        <h2 className="font-serif italic text-caddie-ink" style={{ fontSize: 26, fontWeight: 500 }}>
          Your card
        </h2>
        <div className="text-caddie-ink" style={{ fontSize: 13 }}>
          {parts.map((p, i) => (
            <span key={p.label}>
              {i > 0 ? '  ·  ' : ''}
              {p.label} ·{' '}
              <span className="font-serif italic tabular" style={{ fontSize: 16, fontWeight: 500 }}>
                {p.t.score}
              </span>{' '}
              ({formatToPar(p.t.toPar)})
            </span>
          ))}
        </div>
      </div>
      {hasSyntheticHoles && !hintDismissed && (
        <div
          role="status"
          className="flex items-start"
          style={{ margin: '10px 0 4px', gap: 14, fontSize: 13, lineHeight: 1.45 }}
        >
          <p className="text-caddie-ink-dim" style={{ flex: 1 }}>
            We don’t have this course’s layout, so every par starts at 4. Click a par to change it.
          </p>
          <button
            type="button"
            onClick={() => setHintDismissed(true)}
            className="text-caddie-ink underline"
            style={{ background: 'transparent', border: 'none', padding: 4, fontSize: 13 }}
          >
            Dismiss
          </button>
        </div>
      )}
      <div
        className={`${CARD_COLS} items-end`}
        style={{ fontSize: 12, paddingTop: 10, paddingBottom: 6, borderBottom: '1px solid #1C211C' }}
      >
        <div className={head}>Hole</div>
        <div className={`${head} text-center`}>Par</div>
        <div className={`${head} text-center`}>Score</div>
        <div className={`${head} text-center`}>Putts</div>
        <div className={`${head} text-center`}>Fwy</div>
        <div className={`${head} text-center`}>Green</div>
        <div className={`${head} text-right`}>Shots</div>
      </div>
      {holes.map((h) => {
        const hs = scoresByHoleId.get(h.id)
        const resolved = resolvedHoleByNumber.get(h.number)
        return (
          <HoleScoreCard
            key={h.id}
            roundId={roundId}
            hole={h}
            holeScore={hs}
            shotCount={hs ? (shotCountByHoleScore.get(hs.id) ?? 0) : 0}
            resolvedPar={resolved?.par ?? hs?.par ?? h.par}
            resolvedYards={resolved?.yards ?? null}
            ensureRealHole={ensureRealHole}
            onEditShots={(holeScoreId) =>
              onEditShots({
                holeScoreId,
                holeNumber: h.number,
                // Per-round par override (#710), then tee-resolved par —
                // resolvedHoleByNumber already folds the round override in.
                holePar: resolved?.par ?? hs?.par ?? h.par,
              })
            }
          />
        )
      })}
    </section>
  )
}

