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
      className="bg-oga-bg-card"
      style={{
        border: '0.5px solid #E4E4E0',
        borderRadius: 10,
        padding: '14px 16px',
      }}
    >
      <div className="flex items-baseline justify-between" style={{ marginBottom: 14 }}>
        <div>
          <div
            className="text-oga-text-muted uppercase"
            style={{ fontSize: 11, fontWeight: 500, letterSpacing: 0.4 }}
          >
            Round summary
          </div>
          <div className="font-medium tabular text-oga-text-primary" style={{ fontSize: 28 }}>
            {score || '—'}
            {toPar !== null && (
              <span
                className="text-oga-text-muted"
                style={{ fontSize: 13, fontWeight: 400, marginLeft: 8 }}
              >
                ({toPar > 0 ? `+${toPar}` : toPar === 0 ? 'E' : toPar})
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" style={{ marginBottom: 12 }}>
        {SG_KEYS.map((c) => (
          <SGCell key={c.key} label={c.label} value={round[c.key]} />
        ))}
      </div>

      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        style={{
          paddingTop: 12,
          borderTop: '0.5px solid #E4E4E0',
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
        <div className="mt-4 grid grid-cols-2 gap-3">
          {best && <HighlightCard tone="positive" label="Best hole" hole={best.number} diff={best.diff} />}
          {worst && <HighlightCard tone="negative" label="Worst hole" hole={worst.number} diff={worst.diff} />}
        </div>
      )}

      {totalRoundsLogged >= 3 && (
        <div className="mt-4">
          <Link
            to="/practice"
            className="inline-block rounded-card bg-oga-black text-white transition-colors hover:bg-oga-text-primary/90"
            style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500 }}
          >
            Generate practice plan
          </Link>
        </div>
      )}
    </div>
  )
}

function signTone(value: number | null | undefined): 'positive' | 'negative' | undefined {
  if (value === null || value === undefined) return undefined
  if (value > 0) return 'positive'
  if (value < 0) return 'negative'
  return undefined
}

function SGCell({ label, value }: { label: string; value: number | null | undefined }) {
  const num = value ?? 0
  const tone = num > 0 ? 'positive' : num < 0 ? 'negative' : 'neutral'
  const color =
    tone === 'positive' ? '#0F6E56' : tone === 'negative' ? '#A32D2D' : '#888880'
  return (
    <div
      className="bg-oga-bg-page"
      style={{
        borderRadius: 8,
        padding: '10px 12px',
      }}
    >
      <div
        className="text-oga-text-muted"
        style={{ fontSize: 10, marginBottom: 3 }}
      >
        {label}
      </div>
      <div className="tabular" style={{ fontSize: 18, fontWeight: 500, color }}>
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
  tone?: 'positive' | 'negative'
}) {
  const color =
    tone === 'positive' ? '#0F6E56' : tone === 'negative' ? '#A32D2D' : '#111111'
  return (
    <div>
      <div className="text-oga-text-muted" style={{ fontSize: 10 }}>
        {label}
      </div>
      <div className="font-medium tabular" style={{ fontSize: 15, color }}>
        {value}
      </div>
    </div>
  )
}

function HighlightCard({
  tone,
  label,
  hole,
  diff,
}: {
  tone: 'positive' | 'negative'
  label: string
  hole: number
  diff: number
}) {
  const bg = tone === 'positive' ? '#E1F5EE' : '#FCEBEB'
  const fg = tone === 'positive' ? '#0F6E56' : '#A32D2D'
  return (
    <div
      style={{
        backgroundColor: bg,
        borderRadius: 8,
        padding: '10px 12px',
      }}
    >
      <div style={{ color: fg, fontSize: 10, fontWeight: 500 }}>{label}</div>
      <div className="font-medium tabular" style={{ color: fg, fontSize: 15 }}>
        Hole {hole} ({diff > 0 ? `+${diff}` : diff === 0 ? 'E' : diff})
      </div>
    </div>
  )
}
