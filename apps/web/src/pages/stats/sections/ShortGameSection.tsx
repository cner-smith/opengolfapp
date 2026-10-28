import type { DetailedStats } from '@oga/core'
import { Section } from '../components/Section'
import { StatRow, StatTile } from '../components/StatTiles'
import { fmtNumber, fmtPct } from '../format'

export function ShortGameSection({ data }: { data: DetailedStats }) {
  const sg = data.shortGame
  return (
    <Section title="Short game">
      <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-start" style={{ columnGap: 44, rowGap: 14 }}>
      <div className="grid grid-cols-2" style={{ gap: 16 }}>
        <StatTile label="Putts a round" value={fmtNumber(sg.puttsPerRound, 1)} />
        <StatTile label="Up and down" value={fmtPct(sg.upAndDownPct)} />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-1" style={{ columnGap: 32 }}>
        <div>
          <StatRow label="Putts per green hit" value={fmtNumber(sg.puttsPerGir, 2)} />
          <StatRow label="Three-putts" value={fmtPct(sg.threePuttPct)} />
        </div>
        <div>
          <StatRow label="Scrambling" value={fmtPct(sg.scramblingPct)} />
          <StatRow label="Sand saves" value={fmtPct(sg.sandSavePct)} />
        </div>
      </div>
      </div>
    </Section>
  )
}
