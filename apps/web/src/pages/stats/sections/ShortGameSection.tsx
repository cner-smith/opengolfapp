import type { DetailedStats } from '@oga/core'
import { Section } from '../components/Section'
import { StatTile } from '../components/StatTiles'
import { fmtNumber, fmtPct } from '../format'

export function ShortGameSection({ data }: { data: DetailedStats }) {
  const sg = data.shortGame
  return (
    <Section kicker="Short game">
      <div className="grid grid-cols-2 sm:grid-cols-3" style={{ gap: 14 }}>
        <StatTile label="Putts / round" value={fmtNumber(sg.puttsPerRound, 1)} />
        <StatTile label="Putts per GIR" value={fmtNumber(sg.puttsPerGir, 2)} />
        <StatTile label="3-putt rate" value={fmtPct(sg.threePuttPct)} />
        <StatTile label="Up & down" value={fmtPct(sg.upAndDownPct)} />
        <StatTile label="Scrambling" value={fmtPct(sg.scramblingPct)} />
        <StatTile label="Sand save" value={fmtPct(sg.sandSavePct)} />
      </div>
    </Section>
  )
}
