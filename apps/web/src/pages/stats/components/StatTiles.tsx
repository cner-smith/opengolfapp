import { formatSG, type ApproachBandStat, type RecoveryRateStat } from '@oga/core'
import { useUnits } from '../../../hooks/useUnits'
import { fmtPct, formatBandLabel } from '../format'

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
        <span className="kicker">{label}</span>
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
      <div className="kicker" style={{ marginBottom: 10 }}>
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

export function ApproachBandTile({ band }: { band: ApproachBandStat }) {
  const { unit, toDisplay } = useUnits()
  const tone =
    band.avgSg == null
      ? '#5C6356'
      : band.avgSg > 0
        ? '#1F3D2C'
        : band.avgSg < 0
          ? '#A33A2A'
          : '#5C6356'
  const label = formatBandLabel(band, unit, toDisplay)
  return (
    <div
      style={{
        border: '1px solid #D9D2BF',
        borderRadius: 4,
        padding: 14,
        background: '#FBF8F1',
      }}
    >
      <div className="kicker" style={{ marginBottom: 8 }}>
        {label}
      </div>
      <div
        className="font-serif tabular"
        style={{
          fontSize: 22,
          fontStyle: 'italic',
          fontWeight: 500,
          color: tone,
          lineHeight: 1.1,
        }}
      >
        {band.avgSg == null ? '—' : formatSG(band.avgSg)}
      </div>
      <div
        className="text-caddie-ink-mute"
        style={{ fontSize: 11, marginTop: 6 }}
      >
        {band.shots > 0
          ? `${band.shots} shot${band.shots === 1 ? '' : 's'}`
          : 'Need shots in this band'}
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
