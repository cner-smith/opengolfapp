import type { DetailedStats } from '@oga/core'
import { Section, Subhead } from '../components/Section'
import { RecoveryStat } from '../components/StatTiles'
import {
  ClubAccuracyList,
  CostlyLiesList,
  MissTendencyList,
  SlopeImpactBlock,
} from '../components/PatternLists'

export function PatternsSection({ data }: { data: DetailedStats }) {
  return (
    <Section title="Patterns">
      <Subhead>Miss tendency</Subhead>
      <MissTendencyList entries={data.missTendency} />

      <Subhead style={{ marginTop: 22 }}>Most costly lies</Subhead>
      <CostlyLiesList entries={data.costlyLies} />

      <Subhead style={{ marginTop: 22 }}>Club accuracy</Subhead>
      <ClubAccuracyList entries={data.clubAccuracy} />

      <Subhead style={{ marginTop: 22 }}>Slope impact</Subhead>
      <SlopeImpactBlock impact={data.slopeImpact} />

      <Subhead style={{ marginTop: 22 }}>Recovery from rough</Subhead>
      <RecoveryStat stat={data.recovery} />
    </Section>
  )
}
