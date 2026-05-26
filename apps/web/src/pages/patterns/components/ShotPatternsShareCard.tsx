import {
  getAimCorrection,
  type Club,
  type DispersionPoint,
  type DispersionStats,
  type DistanceUnit,
} from '@oga/core'
import { DispersionPlot } from './DispersionPlot'

// Off-screen 1200×630 social share card (Twitter/Facebook OG size).
// Self-contained inline styles so the rasteriser needs no external
// stylesheet at capture time. Stats only — no username, email, or avatar
// ever reaches this card.
const CARD_W = 1200
const CARD_H = 630
// Plot is square; the card is short (630). Sized so the header, plot
// panel, and footer all fit the fixed height without clipping.
const PLOT_SIZE = 350

const C = {
  bg: '#FBF8F1',
  surface: '#F2EEE5',
  line: '#D9D2BF',
  ink: '#1C211C',
  inkDim: '#5C6356',
  inkMute: '#8A8B7E',
  accent: '#1F3D2C',
} as const

const KICKER: React.CSSProperties = {
  fontFamily: '"JetBrains Mono", monospace',
  fontWeight: 500,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
}

const SERIF = '"Fraunces", Georgia, serif'

// One-line verdict from the dispersion shape + dominant miss.
function verdictHeadline(stats: DispersionStats): string {
  const { shotShape, dominantMiss } = stats
  if (shotShape === 'straight' && dominantMiss === 'straight') return 'Dead straight'
  if (dominantMiss === 'straight') return `A consistent ${shotShape}`
  if (shotShape === 'straight') return `Straight, missing ${dominantMiss}`
  return `A ${shotShape} that leaks ${dominantMiss}`
}

interface ShotPatternsShareCardProps {
  points: DispersionPoint[]
  stats: DispersionStats
  club: Club
  unit: DistanceUnit
  toDisplay: (yards: number, decimals?: number) => string
}

export function ShotPatternsShareCard({
  points,
  stats,
  club,
  unit,
  toDisplay,
}: ShotPatternsShareCardProps) {
  return (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        backgroundColor: C.bg,
        color: C.ink,
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '44px 56px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          paddingBottom: 22,
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        <div>
          <div style={{ ...KICKER, fontSize: 12, color: C.inkMute, marginBottom: 8 }}>
            Open Golf App
          </div>
          <div
            style={{
              fontFamily: SERIF,
              fontStyle: 'italic',
              fontWeight: 500,
              fontSize: 44,
              lineHeight: 1,
              color: C.ink,
            }}
          >
            OGA
          </div>
        </div>
        <div style={{ ...KICKER, fontSize: 12, color: C.inkMute, textAlign: 'right' }}>
          Shot Pattern
        </div>
      </header>

      <div
        style={{
          display: 'flex',
          gap: 48,
          alignItems: 'center',
          flex: 1,
          paddingTop: 16,
          paddingBottom: 16,
        }}
      >
        <div
          style={{
            flexShrink: 0,
            padding: 14,
            backgroundColor: C.surface,
            border: `1px solid ${C.line}`,
            borderRadius: 4,
            lineHeight: 0,
          }}
        >
          <DispersionPlot points={points} stats={stats} size={PLOT_SIZE} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...KICKER, fontSize: 13, color: C.inkMute, marginBottom: 10 }}>
            {club}
          </div>
          <div
            style={{
              fontFamily: SERIF,
              fontWeight: 500,
              fontSize: 46,
              lineHeight: 1.1,
              color: C.ink,
              marginBottom: 30,
            }}
          >
            {verdictHeadline(stats)}
          </div>
          <div style={{ display: 'flex', gap: 40, marginBottom: 30 }}>
            <Stat label="Sample" value={`${stats.sampleSize} shots`} />
            <Stat
              label="68% spread"
              value={`±${toDisplay(stats.cone68.lateral, 1)} / ${toDisplay(stats.cone68.distance, 1)}`}
            />
            <Stat label="Dominant miss" value={stats.dominantMiss} />
          </div>
          <div
            style={{
              fontFamily: SERIF,
              fontSize: 22,
              lineHeight: 1.5,
              color: C.inkDim,
              maxWidth: 540,
            }}
          >
            {getAimCorrection(stats, unit)}
          </div>
        </div>
      </div>

      <footer
        style={{
          paddingTop: 20,
          borderTop: `1px solid ${C.line}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <div style={{ ...KICKER, fontSize: 13, color: C.accent }}>oga.golf</div>
        <div style={{ ...KICKER, fontSize: 11, color: C.inkMute }}>
          Free forever · no paywalls
        </div>
      </footer>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ ...KICKER, fontSize: 11, color: C.inkMute, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 26, color: C.ink }}>
        {value}
      </div>
    </div>
  )
}
