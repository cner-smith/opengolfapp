import { formatToPar, type SgAtAim } from '@oga/core'

export interface SGFeedbackCardProps {
  legSG: SgAtAim | null // null when the focused leg has no club/data
  clubLabel: string | null
  holeExpectedScore: number | null
  par: number
}

// Presentational only — no fetching, no map, no state. A paper tile (mobile
// StatTile): sentence-case label, the italic figure straight under it.
export default function SGFeedbackCard({
  legSG,
  clubLabel,
  holeExpectedScore,
  par,
}: SGFeedbackCardProps) {
  if (!legSG) {
    return (
      <div className="paper-tile" style={{ padding: 18 }}>
        <div className="text-caddie-ink-dim" style={{ fontSize: 13, lineHeight: 1.4 }}>
          Log a few rounds with shot data to unlock aim planning.
        </div>
      </div>
    )
  }

  const toPar =
    holeExpectedScore == null
      ? null
      : formatToPar(Math.round((holeExpectedScore - par) * 10) / 10)

  return (
    <div className="paper-tile" style={{ padding: 18 }}>
      <div className="text-caddie-ink-dim" style={{ fontSize: 13 }}>
        Expected strokes
      </div>
      <div
        className="font-serif tabular text-caddie-ink"
        style={{ fontSize: 32, fontStyle: 'italic', fontWeight: 500, lineHeight: 1.05, marginTop: 4 }}
      >
        {legSG.expectedStrokes.toFixed(1)}
      </div>

      <div
        className="flex items-center"
        style={{ gap: 4, flexWrap: 'wrap', marginTop: 10 }}
      >
        <span className="text-caddie-ink-dim" style={{ fontSize: 13 }}>
          {Math.round(legSG.avgDistanceToPinYards)} yd to pin
        </span>
        <span className="text-caddie-ink-dim" style={{ fontSize: 13 }}>
          · {legSG.confidence === 'high' ? 'High confidence' : 'Low confidence'}
        </span>
        {clubLabel && (
          <span className="text-caddie-ink-dim" style={{ fontSize: 13 }}>
            · {clubLabel}
          </span>
        )}
      </div>

      {holeExpectedScore != null && (
        <div style={{ borderTop: '1px solid #D9D2BF', marginTop: 14, paddingTop: 10 }}>
          <span
            className="font-serif tabular text-caddie-ink"
            style={{ fontSize: 15, fontWeight: 500 }}
          >
            {holeExpectedScore.toFixed(1)}
          </span>
          <span className="text-caddie-ink-dim" style={{ marginLeft: 6, fontSize: 13 }}>
            vs par {par} ({toPar})
          </span>
        </div>
      )}
    </div>
  )
}
