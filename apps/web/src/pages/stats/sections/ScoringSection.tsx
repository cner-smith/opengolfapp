import type { DetailedStats } from '@oga/core'
import { Section, Subkicker } from '../components/Section'
import { StatTile } from '../components/StatTiles'
import { ScoringDistributionBar } from '../components/PatternLists'
import { fmtInt, fmtNumber } from '../format'

export function ScoringSection({ data }: { data: DetailedStats }) {
  const s = data.scoring
  return (
    <Section kicker="Scoring">
      <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 14, marginBottom: 22 }}>
        <StatTile label="Avg score" value={fmtNumber(s.avgScore, 1)} />
        <StatTile label="Avg par 3" value={fmtNumber(s.avgPar3, 2)} />
        <StatTile label="Avg par 4" value={fmtNumber(s.avgPar4, 2)} />
        <StatTile label="Avg par 5" value={fmtNumber(s.avgPar5, 2)} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 14, marginBottom: 22 }}>
        <StatTile label="Front 9" value={fmtNumber(s.front9Avg, 1)} />
        <StatTile label="Back 9" value={fmtNumber(s.back9Avg, 1)} />
        <StatTile label="Best round" value={fmtInt(s.bestRound)} />
        <StatTile label="Worst round" value={fmtInt(s.worstRound)} />
      </div>

      <Subkicker>Scoring distribution</Subkicker>
      <ScoringDistributionBar slices={data.scoringDistribution.slices} total={data.scoringDistribution.total} />
    </Section>
  )
}
