import type { DetailedStats } from '@oga/core'
import { useUnits } from '../../../hooks/useUnits'
import { Section } from '../components/Section'
import { StatTile } from '../components/StatTiles'
import { fmtPct } from '../format'

export function BallStrikingSection({ data }: { data: DetailedStats }) {
  const b = data.ballStriking
  const { toDisplay } = useUnits()
  return (
    <Section kicker="Ball striking">
      <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 14, marginBottom: 14 }}>
        <StatTile label="Fairways hit" value={fmtPct(b.fairwayPct)} />
        <StatTile label="GIR" value={fmtPct(b.girPct)} />
        <StatTile
          label="Drive avg"
          value={b.drivingDistanceAvg != null ? toDisplay(b.drivingDistanceAvg) : '—'}
          subtle={
            b.drivingSampleSize > 0
              ? `${b.drivingSampleSize} drive${b.drivingSampleSize === 1 ? '' : 's'}`
              : 'Need driver tee shots with GPS'
          }
        />
        <StatTile
          label="Proximity"
          value={b.proximityAvg != null ? toDisplay(b.proximityAvg, 1) : '—'}
          subtle={
            b.proximitySampleRounds > 0
              ? `Based on ${b.proximitySampleRounds} round${b.proximitySampleRounds === 1 ? '' : 's'} with pin logged`
              : 'Need approach shots with end coords + pin'
          }
        />
      </div>
    </Section>
  )
}
