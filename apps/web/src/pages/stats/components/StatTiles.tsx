import { formatSG, formatBandLabel, type ApproachBandStat, type RecoveryRateStat } from '@oga/core'
import { useUnits } from '../../../hooks/useUnits'
import { fmtPct } from '../format'

export function SgTile({
  label,
  color,
  value,
}: {
  label: string
  color: string
  value: number | null
}) {
  const tone = value == null ? '#5C6356' : value > 0 ? '#1F3D2C' : value < 0 ? '#A33A2A' : '#5C6356'
  return (
    <div
      className="bg-caddie-surface"
      style={{
        border: '1px solid #D9D2BF',
        borderRadius: 4,
        padding: 18,
      }}
    >
      <div className="flex items-center" style={{ gap: 8, marginBottom: 10 }}>
        <span style={{ width: 10, height: 2, backgroundColor: color }} />
        <span className="text-caddie-ink-dim" style={{ fontSize: 13 }}>{label}</span>
      </div>
      <div
        className="font-serif tabular"
        style={{
          fontSize: 32,
          fontStyle: 'italic',
          fontWeight: 500,
          color: tone,
          lineHeight: 1.05,
        }}
      >
        {value == null ? '—' : formatSG(value)}
      </div>
    </div>
  )
}

export function StatTile({
  label,
  value,
  subtle,
}: {
  label: string
  value: string
  subtle?: string
}) {
  return (
    <div
      className="bg-caddie-surface"
      style={{
        border: '1px solid #D9D2BF',
        borderRadius: 4,
        padding: 18,
      }}
    >
      <div className="text-caddie-ink-dim" style={{ fontSize: 13, marginBottom: 10 }}>
        {label}
      </div>
      <div
        className="font-serif tabular text-caddie-ink"
        style={{
          fontSize: 28,
          fontWeight: 500,
          lineHeight: 1.05,
        }}
      >
        {value}
      </div>
      {subtle && (
        <div
          className="text-caddie-ink-mute"
          style={{
            fontSize: 11,
            marginTop: 6,
            lineHeight: 1.3,
          }}
        >
          {subtle}
        </div>
      )}
    </div>
  )
}

const sgTone = (v: number | null) =>
  v == null || v === 0 ? '#5C6356' : v > 0 ? '#1F3D2C' : '#A33A2A'

// One divided row: sentence-case label left, serif number right (DESIGN.md
// Stat tile: tiles for the headline numbers, this for the rest).
export function StatRow({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div
      className="flex items-baseline justify-between"
      style={{ gap: 12, padding: '10px 0', borderBottom: '1px solid #E4DCC8' }}
    >
      <div>
        <div className="text-caddie-ink" style={{ fontSize: 15 }}>{label}</div>
        {note && <div className="text-caddie-ink-dim" style={{ fontSize: 12, marginTop: 2 }}>{note}</div>}
      </div>
      <div className="font-serif tabular text-caddie-ink" style={{ fontSize: 22, fontWeight: 500 }}>{value}</div>
    </div>
  )
}

// Approach band as a bar either side of zero, scaled to `max` (the largest
// magnitude among the bands) so the bars compare.
export function ApproachBandRow({ band, max }: { band: ApproachBandStat; max: number }) {
  const { unit, toDisplay } = useUnits()
  const v = band.avgSg
  const half = v == null ? 0 : Math.min(1, Math.abs(v) / max) * 50
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(96px, 1fr) minmax(0, 2fr) 64px',
        alignItems: 'center',
        gap: 12,
        padding: '10px 0',
        borderBottom: '1px solid #E4DCC8',
      }}
    >
      <div>
        <div className="text-caddie-ink" style={{ fontSize: 15 }}>{formatBandLabel(band, unit, toDisplay)}</div>
        <div className="text-caddie-ink-dim" style={{ fontSize: 12 }}>
          {band.shots > 0 ? `${band.shots} shot${band.shots === 1 ? '' : 's'}` : 'No shots yet'}
        </div>
      </div>
      <div style={{ position: 'relative', height: 14 }}>
        <div style={{ position: 'absolute', left: '50%', top: -4, bottom: -4, width: 1, background: '#8A8B7E' }} />
        {v != null && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              height: 14,
              background: sgTone(v),
              left: v >= 0 ? '50%' : `${50 - half}%`,
              width: `${half}%`,
            }}
          />
        )}
      </div>
      <div className="font-serif tabular" style={{ fontSize: 22, fontWeight: 500, textAlign: 'right', color: sgTone(v) }}>
        {v == null ? '—' : formatSG(v)}
      </div>
    </div>
  )
}

export function RecoveryStat({ stat }: { stat: RecoveryRateStat }) {
  return (
    <div
      style={{
        border: '1px solid #D9D2BF',
        borderRadius: 4,
        padding: 18,
        background: '#FBF8F1',
      }}
    >
      <div className="flex items-baseline" style={{ gap: 18 }}>
        <span
          className="font-serif tabular"
          style={{
            fontSize: 32,
            fontStyle: 'italic',
            fontWeight: 500,
            color: '#1F3D2C',
            lineHeight: 1.05,
          }}
        >
          {fmtPct(stat.recoveryPct)}
        </span>
        <span
          className="font-serif text-caddie-ink-dim"
          style={{ fontSize: 17 }}
        >
          {stat.totalRoughShots > 0
            ? `${stat.totalRoughShots} rough shot${stat.totalRoughShots === 1 ? '' : 's'} → fairway or green next`
            : 'Need shots logged from rough'}
        </span>
      </div>
    </div>
  )
}
