import { clubNoun, type Club, type DispersionPoint, type DispersionStats } from '@oga/core'
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
  fontFamily: '"Inconsolata", monospace',
  fontWeight: 500,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
}

const SERIF = '"Fraunces", Georgia, serif'

interface ShotPatternsShareCardProps {
  points: DispersionPoint[]
  stats: DispersionStats
  club: Club
  /** The page's finding sentence, so the card says what the page says. */
  finding: string
  /** The recorded shape's verdict ("Mostly draws", "Mixed", "—"). */
  shape: string
  toDisplay: (yards: number, decimals?: number) => string
}

export function ShotPatternsShareCard({
  points,
  stats,
  club,
  finding,
  shape,
  toDisplay,
}: ShotPatternsShareCardProps) {
  const pair = (a: number, b: number) => `${toDisplay(a).replace(/ (yd|m)$/, '')} × ${toDisplay(b)}`
  return (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        backgroundColor: C.bg,
        color: C.ink,
        fontFamily: 'Epilogue, system-ui, sans-serif',
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
            oga<span style={{ fontStyle: 'normal' }}>.</span>
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
          <div style={{ fontSize: 15, color: C.inkDim, marginBottom: 10 }}>
            {stats.sampleSize} shots with a {clubNoun(club)}, measured from the aim
          </div>
          <div
            style={{
              fontFamily: SERIF,
              fontStyle: 'italic',
              fontWeight: 500,
              fontSize: 32,
              lineHeight: 1.2,
              color: C.ink,
              marginBottom: 30,
            }}
          >
            {finding}
          </div>
          <div style={{ display: 'flex', gap: 40 }}>
            <Stat label="Two in three" value={pair(stats.cone68.lateral * 2, stats.cone68.distance * 2)} />
            <Stat label="Nearly all" value={pair(stats.cone95.lateral * 2, stats.cone95.distance * 2)} />
            <Stat label="Shape" value={shape} />
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
      <div style={{ fontSize: 15, color: C.inkDim, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 26, color: C.ink }}>
        {value}
      </div>
    </div>
  )
}
