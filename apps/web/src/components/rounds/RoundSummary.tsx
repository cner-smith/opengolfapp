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

const SG_KEYS = [
  { key: 'sg_off_tee', label: 'Off tee' },
  { key: 'sg_approach', label: 'Approach' },
  { key: 'sg_around_green', label: 'Around green' },
  { key: 'sg_putting', label: 'Putting' },
] as const

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
    <div
      className="bg-caddie-surface"
      style={{
        border: '1px solid #D9D2BF',
        borderRadius: 4,
        padding: 22,
      }}
    >
      <div
        className="flex items-baseline justify-between"
        style={{ marginBottom: 18 }}
      >
        <div>
          <div className="kicker" style={{ marginBottom: 8 }}>
            By the numbers
          </div>
          <div className="flex items-baseline" style={{ gap: 14 }}>
            <span
              className="font-serif tabular text-caddie-ink"
              style={{ fontSize: 38, fontWeight: 500, lineHeight: 1 }}
            >
              {score || '—'}
            </span>
            {toPar !== null && (
              <span
                className="font-serif tabular text-caddie-ink-dim"
                style={{ fontSize: 17, fontStyle: 'italic' }}
              >
                ({toPar > 0 ? `+${toPar}` : toPar === 0 ? 'E' : toPar})
              </span>
            )}
          </div>
        </div>
      </div>

      <div
        className="grid grid-cols-2 sm:grid-cols-4"
        style={{ gap: 14, marginBottom: 18 }}
      >
        {SG_KEYS.map((c) => (
          <SGCell key={c.key} label={c.label} value={round[c.key]} />
        ))}
      </div>

      <div
        className="grid grid-cols-2 sm:grid-cols-4"
        style={{
          gap: 14,
          paddingTop: 18,
          borderTop: '1px solid #D9D2BF',
        }}
      >
        <Stat label="SG total" value={formatSG(round.sg_total)} tone={signTone(round.sg_total)} />
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
        <div
          className="grid grid-cols-2"
          style={{
            gap: 14,
            marginTop: 18,
            paddingTop: 18,
            borderTop: '1px solid #D9D2BF',
          }}
        >
          {best && <Highlight tone="pos" label="Best hole" hole={best.number} diff={best.diff} />}
          {worst && <Highlight tone="neg" label="Worst hole" hole={worst.number} diff={worst.diff} />}
        </div>
      )}

      {totalRoundsLogged >= 3 && (
        <div style={{ marginTop: 22 }}>
          <Link
            to="/practice"
            className="bg-caddie-accent text-caddie-accent-ink hover:opacity-90"
            style={{
              display: 'inline-block',
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.02em',
              borderRadius: 2,
            }}
          >
            Generate practice plan{' '}
            <span className="font-serif" style={{ fontStyle: 'italic' }}>
              →
            </span>
          </Link>
        </div>
      )}
    </div>
  )
}

function signTone(value: number | null | undefined): 'pos' | 'neg' | undefined {
  if (value === null || value === undefined) return undefined
  if (value > 0) return 'pos'
  if (value < 0) return 'neg'
  return undefined
}

function SGCell({ label, value }: { label: string; value: number | null | undefined }) {
  const num = value ?? 0
  const color = num > 0 ? '#1F3D2C' : num < 0 ? '#A33A2A' : '#5C6356'
  return (
    <div>
      <div className="kicker" style={{ marginBottom: 8 }}>
        {label}
      </div>
      <div
        className="font-serif tabular"
        style={{
          fontSize: 22,
          fontStyle: 'italic',
          fontWeight: 500,
          color,
          lineHeight: 1.1,
        }}
      >
        {formatSG(value)}
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'pos' | 'neg'
}) {
  const color = tone === 'pos' ? '#1F3D2C' : tone === 'neg' ? '#A33A2A' : '#1C211C'
  return (
    <div>
      <div className="kicker" style={{ marginBottom: 6 }}>
        {label}
      </div>
      <div
        className="font-serif tabular"
        style={{ fontSize: 22, fontWeight: 500, color, lineHeight: 1.1 }}
      >
        {value}
      </div>
    </div>
  )
}

function Highlight({
  tone,
  label,
  hole,
  diff,
}: {
  tone: 'pos' | 'neg'
  label: string
  hole: number
  diff: number
}) {
  const color = tone === 'pos' ? '#1F3D2C' : '#A33A2A'
  return (
    <div>
      <div className="kicker" style={{ marginBottom: 6 }}>
        {label}
      </div>
      <div className="flex items-baseline" style={{ gap: 8 }}>
        <span
          className="font-serif text-caddie-ink"
          style={{ fontSize: 22, fontWeight: 500 }}
        >
          Hole {hole}
        </span>
        <span
          className="font-serif tabular"
          style={{ fontSize: 17, fontStyle: 'italic', color }}
        >
          {diff > 0 ? `+${diff}` : diff === 0 ? 'E' : diff}
        </span>
      </div>
    </div>
  )
}
