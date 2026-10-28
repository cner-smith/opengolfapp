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


      <Subhead style={{ marginTop: 30 }}>Club accuracy</Subhead>
      <ClubAccuracyList entries={data.clubAccuracy} />

      <Subhead style={{ marginTop: 30 }}>Slope impact</Subhead>
      <SlopeImpactBlock impact={data.slopeImpact} />

      <div className="grid lg:grid-cols-2 items-start" style={{ columnGap: 44, rowGap: 30, marginTop: 30 }}>
        <div>
          <Subhead>Most costly lies</Subhead>
          <CostlyLiesList entries={data.costlyLies} />
        </div>
        <div>
          <Subhead>Recovery from rough</Subhead>
          <RecoveryStat stat={data.recovery} />
        </div>
      </div>
    </Section>
  )
}
