import type { DetailedStats } from '@oga/core'
import { Section, Subkicker } from '../components/Section'
import { RecoveryStat } from '../components/StatTiles'
import {
  ClubAccuracyList,
  CostlyLiesList,
  MissTendencyList,
  SlopeImpactBlock,
} from '../components/PatternLists'

export function PatternsSection({ data }: { data: DetailedStats }) {
  return (
    <Section kicker="Patterns">
      <Subkicker>Miss tendency</Subkicker>
      <MissTendencyList entries={data.missTendency} />

      <Subkicker style={{ marginTop: 22 }}>Most costly lies</Subkicker>
      <CostlyLiesList entries={data.costlyLies} />

      <Subkicker style={{ marginTop: 22 }}>Club accuracy</Subkicker>
      <ClubAccuracyList entries={data.clubAccuracy} />

      <Subkicker style={{ marginTop: 22 }}>Slope impact</Subkicker>
      <SlopeImpactBlock impact={data.slopeImpact} />

      <Subkicker style={{ marginTop: 22 }}>Recovery from rough</Subkicker>
      <RecoveryStat stat={data.recovery} />
    </Section>
  )
}
