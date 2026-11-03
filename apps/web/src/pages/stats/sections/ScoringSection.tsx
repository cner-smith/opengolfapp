import type { DetailedStats } from '@oga/core'
import { Section } from '../components/Section'
import { StatRow, StatTile } from '../components/StatTiles'
import { ScoringDistributionBar } from '../components/PatternLists'
import { fmtInt, fmtNumber } from '../format'

export function ScoringSection({ data }: { data: DetailedStats }) {
  const s = data.scoring
  return (
    <Section title="Scoring">
      <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-start" style={{ columnGap: 44, rowGap: 14, marginBottom: 26 }}>
      <div className="grid grid-cols-2" style={{ gap: 16 }}>
        <StatTile label="Average score" value={fmtNumber(s.avgScore, 1)} />
        <StatTile label="Best round" value={fmtInt(s.bestRound)} />
      </div>
      <div className="grid sm:grid-cols-2" style={{ columnGap: 32 }}>
        <div>
          <StatRow label="Worst round" value={fmtInt(s.worstRound)} />
          <StatRow label="Front nine" value={fmtNumber(s.front9Avg, 1)} note="Per hole" />
          <StatRow label="Back nine" value={fmtNumber(s.back9Avg, 1)} note="Per hole" />
        </div>
        <div>
          <StatRow label="Par 3s" value={fmtNumber(s.avgPar3, 2)} />
          <StatRow label="Par 4s" value={fmtNumber(s.avgPar4, 2)} />
          <StatRow label="Par 5s" value={fmtNumber(s.avgPar5, 2)} />
        </div>
      </div>
      </div>
      <ScoringDistributionBar slices={data.scoringDistribution.slices} total={data.scoringDistribution.total} />
    </Section>
  )
}
