import type { Database } from '@oga/supabase'
import { formatSG, formatToPar } from '@oga/core'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']

// Minimal round shape — the page hands us a query result with a
// `courses` join that doesn't quite line up with the generated
// `rounds.Row`, so we narrow to just the fields the card actually
// reads. Keeps the component decoupled from PostgREST shape drift.
export interface ShareableRoundData {
  played_at: string
  tee_color: string | null
  total_score: number | null
  sg_off_tee: number | null
  sg_approach: number | null
  sg_around_green: number | null
  sg_putting: number | null
  sg_total: number | null
  courses?: { name: string | null } | null
  // Played-tee detail (optional): total yardage + course/slope rating, shown
  // alongside the tee colour when the round names a rated tee.
  course_rating?: number | null
  slope_rating?: number | null
  total_yards?: number | null
}

interface ShareableScorecardCardProps {
  round: ShareableRoundData
  holes: HoleRow[]
  scoresByHoleId: Map<string, HoleScoreRow>
  tone?: 'light' | 'dark'
}

// Off-screen render target for html-to-image. Self-contained inline
// styles (no Tailwind class lookups) so the rasteriser doesn't need to
// resolve external stylesheets at capture time. 800px wide is the
// sweet spot for social posts — hits a comfortable size on Twitter /
// iMessage previews without being downscaled into mush.
const CARD_WIDTH = 800

const COLORS = {
  light: {
    bg: '#FBF8F1',
    surface: '#F2EEE5',
    line: '#D9D2BF',
    ink: '#1C211C',
    inkDim: '#5C6356',
    inkMute: '#8A8B7E',
    accent: '#1F3D2C',
    neg: '#A33A2A',
  },
  dark: {
    bg: '#1C211C',
    surface: '#272D27',
    line: 'rgba(217,210,191,0.18)',
    ink: '#F2EEE5',
    inkDim: 'rgba(242,238,229,0.65)',
    inkMute: 'rgba(242,238,229,0.45)',
    accent: '#8FB89A',
    neg: '#D87B6E',
  },
} as const

const KICKER_STYLE: React.CSSProperties = {
  fontFamily: '"Inconsolata", monospace',
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
}

export function ShareableScorecardCard({
  round,
  holes,
  scoresByHoleId,
  tone = 'light',
}: ShareableScorecardCardProps) {
  const c = COLORS[tone]
  const courseName = round.courses?.name ?? 'Round'

  // Stable 1..18 layout regardless of how many holes the array carries.
  // Synthetic holes still get rendered with par 4 placeholders if needed
  // — keeps the card visually balanced for partial rounds.
  const holesByNumber = new Map<number, HoleRow>()
  for (const h of holes) holesByNumber.set(h.number, h)
  const holeNumbers = Array.from({ length: 18 }, (_, i) => i + 1)

  const totalPar = holeNumbers.reduce((sum, n) => {
    const h = holesByNumber.get(n)
    return sum + (h?.par ?? 4)
  }, 0)
  const total = round.total_score ?? null
  const toPar = total != null ? total - totalPar : null

  return (
    <div
      style={{
        width: CARD_WIDTH,
        backgroundColor: c.bg,
        color: c.ink,
        fontFamily: 'Epilogue, system-ui, sans-serif',
        padding: 36,
        boxSizing: 'border-box',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 18,
          borderBottom: `1px solid ${c.line}`,
        }}
      >
        <div>
          <div style={{ ...KICKER_STYLE, color: c.inkMute, marginBottom: 6 }}>
            Open Golf App
          </div>
          <div
            style={{
              fontFamily: '"Fraunces", Georgia, serif',
              fontStyle: 'italic',
              fontWeight: 500,
              fontSize: 32,
              lineHeight: 1,
              color: c.ink,
            }}
          >
            oga<span style={{ fontStyle: 'normal' }}>.</span>
          </div>
        </div>
        <div style={{ ...KICKER_STYLE, color: c.inkMute, textAlign: 'right' }}>
          Scorecard
        </div>
      </header>

      <section style={{ paddingTop: 22, paddingBottom: 22 }}>
        <div
          style={{
            fontFamily: '"Fraunces", Georgia, serif',
            fontWeight: 500,
            fontSize: 30,
            lineHeight: 1.15,
            color: c.ink,
          }}
        >
          {courseName}
        </div>
        <div
          style={{
            ...KICKER_STYLE,
            color: c.inkDim,
            marginTop: 6,
          }}
        >
          {round.played_at}
          {round.tee_color ? ` · ${round.tee_color} tees` : ''}
          {round.total_yards != null ? ` · ${round.total_yards.toLocaleString()} yd` : ''}
          {round.course_rating != null && round.slope_rating != null
            ? ` · ${round.course_rating.toFixed(1)}/${round.slope_rating}`
            : ''}
        </div>
      </section>

      <ScoreGrid
        holeNumbers={holeNumbers.slice(0, 9)}
        holesByNumber={holesByNumber}
        scoresByHoleId={scoresByHoleId}
        colors={c}
        rangeLabel="Out"
      />
      <div style={{ height: 14 }} />
      <ScoreGrid
        holeNumbers={holeNumbers.slice(9)}
        holesByNumber={holesByNumber}
        scoresByHoleId={scoresByHoleId}
        colors={c}
        rangeLabel="In"
      />

      <section
        style={{
          marginTop: 22,
          paddingTop: 18,
          borderTop: `1px solid ${c.line}`,
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ ...KICKER_STYLE, color: c.inkMute }}>Total</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span
            style={{
              fontFamily: '"Fraunces", Georgia, serif',
              fontWeight: 500,
              fontSize: 44,
              fontStyle: 'italic',
              color: c.ink,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {total ?? '—'}
          </span>
          {toPar != null && (
            <span
              style={{
                fontFamily: '"Inconsolata", monospace',
                fontSize: 18,
                fontWeight: 500,
                color: toPar < 0 ? c.accent : toPar > 0 ? c.neg : c.inkDim,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatToPar(toPar)}
            </span>
          )}
        </div>
      </section>

      {round.sg_total !== null && (
        <section
          style={{
            marginTop: 22,
            paddingTop: 18,
            borderTop: `1px solid ${c.line}`,
          }}
        >
          <div
            style={{ ...KICKER_STYLE, color: c.inkMute, marginBottom: 14 }}
          >
            Strokes Gained
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 18,
            }}
          >
            <SGStat label="Off tee" value={round.sg_off_tee} colors={c} />
            <SGStat label="Approach" value={round.sg_approach} colors={c} />
            <SGStat label="Around" value={round.sg_around_green} colors={c} />
            <SGStat label="Putting" value={round.sg_putting} colors={c} />
          </div>
        </section>
      )}

      <footer
        style={{
          marginTop: 28,
          paddingTop: 14,
          borderTop: `1px solid ${c.line}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ ...KICKER_STYLE, color: c.inkMute }}>
          Tracked with OGA
        </div>
        <div
          style={{
            fontFamily: '"Inconsolata", monospace',
            fontSize: 11,
            color: c.inkMute,
          }}
        >
          oga.golf
        </div>
      </footer>
    </div>
  )
}

type ColorPalette = (typeof COLORS)[keyof typeof COLORS]

interface ScoreGridProps {
  holeNumbers: number[]
  holesByNumber: Map<number, HoleRow>
  scoresByHoleId: Map<string, HoleScoreRow>
  colors: ColorPalette
  rangeLabel: string
}

function ScoreGrid({
  holeNumbers,
  holesByNumber,
  scoresByHoleId,
  colors,
  rangeLabel,
}: ScoreGridProps) {
  // Sum par + score for the half so the row totals match a paper card.
  let parSum = 0
  let scoreSum = 0
  let anyScore = false
  for (const n of holeNumbers) {
    const h = holesByNumber.get(n)
    parSum += h?.par ?? 4
    if (h) {
      const hs = scoresByHoleId.get(h.id)
      if (hs?.score != null && hs.score > 0) {
        scoreSum += hs.score
        anyScore = true
      }
    }
  }

  const cellStyle: React.CSSProperties = {
    flex: 1,
    textAlign: 'center',
    fontFamily: '"Inconsolata", monospace',
    fontSize: 14,
    fontWeight: 500,
    fontVariantNumeric: 'tabular-nums',
    padding: '8px 0',
    borderRight: `1px solid ${colors.line}`,
  }
  const labelStyle: React.CSSProperties = {
    ...cellStyle,
    flex: 0.8,
    color: colors.inkMute,
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    fontSize: 10,
    fontWeight: 500,
    textAlign: 'left',
    paddingLeft: 6,
  }
  const totalCellStyle: React.CSSProperties = {
    ...cellStyle,
    flex: 0.7,
    borderRight: 'none',
    color: colors.ink,
    fontFamily: '"Fraunces", Georgia, serif',
    fontStyle: 'italic',
    fontSize: 16,
  }

  return (
    <div
      style={{
        border: `1px solid ${colors.line}`,
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          backgroundColor: colors.surface,
          borderBottom: `1px solid ${colors.line}`,
        }}
      >
        <div style={labelStyle}>Hole</div>
        {holeNumbers.map((n) => (
          <div key={`h-${n}`} style={{ ...cellStyle, color: colors.inkMute }}>
            {n}
          </div>
        ))}
        <div style={{ ...totalCellStyle, color: colors.inkMute, fontStyle: 'normal', fontFamily: '"Inconsolata", monospace', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          {rangeLabel}
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: `1px solid ${colors.line}` }}>
        <div style={labelStyle}>Par</div>
        {holeNumbers.map((n) => {
          const h = holesByNumber.get(n)
          return (
            <div key={`p-${n}`} style={{ ...cellStyle, color: colors.inkDim }}>
              {h?.par ?? 4}
            </div>
          )
        })}
        <div style={{ ...totalCellStyle, color: colors.inkDim, fontStyle: 'normal', fontFamily: '"Inconsolata", monospace', fontSize: 14 }}>
          {parSum}
        </div>
      </div>

      <div style={{ display: 'flex' }}>
        <div style={labelStyle}>Score</div>
        {holeNumbers.map((n) => {
          const h = holesByNumber.get(n)
          const hs = h ? scoresByHoleId.get(h.id) : null
          const score = hs?.score && hs.score > 0 ? hs.score : null
          return (
            <ScoreCell
              key={`s-${n}`}
              cellStyle={cellStyle}
              colors={colors}
              par={h?.par ?? 4}
              score={score}
            />
          )
        })}
        <div style={totalCellStyle}>{anyScore ? scoreSum : '—'}</div>
      </div>
    </div>
  )
}

interface ScoreCellProps {
  cellStyle: React.CSSProperties
  colors: ColorPalette
  par: number
  score: number | null
}

function ScoreCell({ cellStyle, colors, par, score }: ScoreCellProps) {
  if (score == null) {
    return <div style={{ ...cellStyle, color: colors.inkMute }}>—</div>
  }
  const diff = score - par
  // Eagle or better → 2 circles. Birdie → 1 circle. Bogey → 1 square.
  // Double or worse → 2 squares. Par → no decoration. Mirrors the
  // standard scorecard convention.
  const isCircle = diff <= -1
  const isSquare = diff >= 1
  const decorationCount = Math.abs(diff) >= 2 ? 2 : 1
  const color =
    diff < 0 ? colors.accent : diff > 0 ? colors.neg : colors.ink

  const wrap: React.CSSProperties = {
    ...cellStyle,
    color,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  return (
    <div style={wrap}>
      {isCircle && (
        <Decoration shape="circle" count={decorationCount} color={color} />
      )}
      {isSquare && (
        <Decoration shape="square" count={decorationCount} color={color} />
      )}
      <span style={{ position: 'relative', zIndex: 1 }}>{score}</span>
    </div>
  )
}

function Decoration({
  shape,
  count,
  color,
}: {
  shape: 'circle' | 'square'
  count: 1 | 2
  color: string
}) {
  const sizes = count === 1 ? [22] : [22, 28]
  return (
    <>
      {sizes.map((size) => (
        <div
          key={size}
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: shape === 'circle' ? size / 2 : 2,
            border: `1.5px solid ${color}`,
          }}
        />
      ))}
    </>
  )
}

interface SGStatProps {
  label: string
  value: number | null
  colors: ColorPalette
}

function SGStat({ label, value, colors }: SGStatProps) {
  const color =
    value == null
      ? colors.inkMute
      : value > 0
        ? colors.accent
        : value < 0
          ? colors.neg
          : colors.inkDim
  return (
    <div>
      <div
        style={{
          ...KICKER_STYLE,
          color: colors.inkMute,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: '"Fraunces", Georgia, serif',
          fontStyle: 'italic',
          fontWeight: 500,
          fontSize: 26,
          color,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}
      >
        {value != null ? formatSG(value) : '—'}
      </div>
    </div>
  )
}
