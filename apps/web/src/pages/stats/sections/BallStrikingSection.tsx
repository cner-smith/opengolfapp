import type { DetailedStats } from '@oga/core'
import { useUnits } from '../../../hooks/useUnits'
import { Section } from '../components/Section'
import { StatRow, StatTile } from '../components/StatTiles'
import { fmtPct } from '../format'

export function BallStrikingSection({ data }: { data: DetailedStats }) {
  const b = data.ballStriking
  const { toDisplay } = useUnits()
  return (
    <Section title="Ball striking">
      <div className="grid grid-cols-2" style={{ gap: 14, maxWidth: 520, marginBottom: 6 }}>
        <StatTile label="Fairways hit" value={fmtPct(b.fairwayPct)} />
        <StatTile label="Greens in regulation" value={fmtPct(b.girPct)} />
      </div>
      <div className="grid sm:grid-cols-2" style={{ columnGap: 32 }}>
        <StatRow
          label="Drive"
          value={b.drivingDistanceAvg != null ? toDisplay(b.drivingDistanceAvg) : '—'}
          note={
            b.drivingSampleSize > 0
              ? `Typical distance, ${b.drivingSampleSize} drive${b.drivingSampleSize === 1 ? '' : 's'}`
              : 'Needs driver tee shots with GPS'
          }
        />
        <StatRow
          label="Approach proximity"
          value={b.proximityAvg != null ? toDisplay(b.proximityAvg, 1) : '—'}
          note={
            b.proximitySampleRounds > 0
              ? `${b.proximitySampleRounds} round${b.proximitySampleRounds === 1 ? '' : 's'} with the pin logged`
              : 'Needs approach shots with the pin logged'
          }
        />
      </div>
    </Section>
  )
}
