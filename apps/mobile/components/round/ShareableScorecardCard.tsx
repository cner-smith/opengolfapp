import { Text, View } from 'react-native'
import { formatSG, formatToPar } from '@oga/core'
import type { Database } from '@oga/supabase'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']

// Minimal round shape — same narrowing as the web card so a PostgREST
// shape drift in one app doesn't break the other.
export interface ShareableRoundData {
  played_at: string
  tee_color: string | null
  total_score: number | null
  sg_off_tee: number | null
  sg_approach: number | null
  sg_around_green: number | null
  sg_putting: number | null
  sg_total: number | null
  courseName: string | null
}

interface ShareableScorecardCardProps {
  round: ShareableRoundData
  holes: HoleRow[]
  scoresByHoleId: Map<string, HoleScoreRow>
  tone?: 'light' | 'dark'
}

const CARD_WIDTH = 360

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

type ColorPalette = (typeof COLORS)[keyof typeof COLORS]

const KICKER: import('react-native').TextStyle = {
  fontSize: 9,
  fontWeight: '500',
  letterSpacing: 1.3,
  textTransform: 'uppercase',
  fontFamily: 'Inconsolata-Medium',
}

export function ShareableScorecardCard({
  round,
  holes,
  scoresByHoleId,
  tone = 'light',
}: ShareableScorecardCardProps) {
  const c = COLORS[tone]
  const courseName = round.courseName ?? 'Round'

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
    <View
      style={{
        width: CARD_WIDTH,
        backgroundColor: c.bg,
        padding: 18,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderColor: c.line,
        }}
      >
        <View>
          <Text style={{ ...KICKER, color: c.inkMute, marginBottom: 4 }}>
            Open Golf App
          </Text>
          <Text
            style={{
              fontFamily: 'Fraunces-MediumItalic',
              fontWeight: '500',
              fontSize: 24,
              color: c.ink,
            }}
          >
            OGA
          </Text>
        </View>
        <Text style={{ ...KICKER, color: c.inkMute }}>Scorecard</Text>
      </View>

      <View style={{ paddingVertical: 14 }}>
        <Text
          style={{
            fontFamily: 'Fraunces-Medium',
            fontWeight: '500',
            fontSize: 22,
            lineHeight: 26,
            color: c.ink,
          }}
        >
          {courseName}
        </Text>
        <Text style={{ ...KICKER, color: c.inkDim, marginTop: 4 }}>
          {round.played_at}
          {round.tee_color ? ` · ${round.tee_color} tees` : ''}
        </Text>
      </View>

      <ScoreGrid
        holeNumbers={holeNumbers.slice(0, 9)}
        holesByNumber={holesByNumber}
        scoresByHoleId={scoresByHoleId}
        colors={c}
        rangeLabel="Out"
      />
      <View style={{ height: 8 }} />
      <ScoreGrid
        holeNumbers={holeNumbers.slice(9)}
        holesByNumber={holesByNumber}
        scoresByHoleId={scoresByHoleId}
        colors={c}
        rangeLabel="In"
      />

      <View
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTopWidth: 1,
          borderColor: c.line,
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ ...KICKER, color: c.inkMute }}>Total</Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: 10,
          }}
        >
          <Text
            style={{
              fontFamily: 'Fraunces-MediumItalic',
              fontWeight: '500',
              fontSize: 32,
              color: c.ink,
              fontVariant: ['tabular-nums'],
            }}
          >
            {total ?? '—'}
          </Text>
          {toPar != null && (
            <Text
              style={{
                fontFamily: 'Inconsolata-Medium',
                fontSize: 14,
                fontWeight: '500',
                color:
                  toPar < 0 ? c.accent : toPar > 0 ? c.neg : c.inkDim,
                fontVariant: ['tabular-nums'],
              }}
            >
              {formatToPar(toPar)}
            </Text>
          )}
        </View>
      </View>

      {round.sg_total !== null && (
        <View
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTopWidth: 1,
            borderColor: c.line,
          }}
        >
          <Text style={{ ...KICKER, color: c.inkMute, marginBottom: 10 }}>
            Strokes Gained
          </Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <SGStat label="Off tee" value={round.sg_off_tee} colors={c} />
            <SGStat label="Approach" value={round.sg_approach} colors={c} />
            <SGStat label="Around" value={round.sg_around_green} colors={c} />
            <SGStat label="Putting" value={round.sg_putting} colors={c} />
          </View>
        </View>
      )}

      <View
        style={{
          marginTop: 16,
          paddingTop: 10,
          borderTopWidth: 1,
          borderColor: c.line,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text style={{ ...KICKER, color: c.inkMute }}>Tracked with OGA</Text>
        <Text
          style={{
            fontFamily: 'Inconsolata-Medium',
            fontSize: 9,
            color: c.inkMute,
          }}
        >
          opengolfapp
        </Text>
      </View>
    </View>
  )
}

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

  const cellNum: import('react-native').TextStyle = {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Inconsolata-Medium',
    fontSize: 11,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    paddingVertical: 6,
  }
  const labelStyle: import('react-native').TextStyle = {
    width: 38,
    fontFamily: 'Inconsolata-Medium',
    fontSize: 9,
    fontWeight: '500',
    color: colors.inkMute,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    paddingVertical: 6,
    paddingLeft: 4,
  }
  const totalCell: import('react-native').TextStyle = {
    width: 32,
    textAlign: 'center',
    fontFamily: 'Fraunces-MediumItalic',
    fontSize: 13,
    fontWeight: '500',
    color: colors.ink,
    paddingVertical: 6,
  }

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderColor: colors.line,
        }}
      >
        <Text style={labelStyle}>Hole</Text>
        {holeNumbers.map((n) => (
          <Text key={`h-${n}`} style={{ ...cellNum, color: colors.inkMute }}>
            {n}
          </Text>
        ))}
        <Text
          style={{
            ...totalCell,
            color: colors.inkMute,
            fontFamily: 'Inconsolata-Medium',
            fontSize: 9,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}
        >
          {rangeLabel}
        </Text>
      </View>

      <View
        style={{
          flexDirection: 'row',
          borderBottomWidth: 1,
          borderColor: colors.line,
        }}
      >
        <Text style={labelStyle}>Par</Text>
        {holeNumbers.map((n) => {
          const h = holesByNumber.get(n)
          return (
            <Text key={`p-${n}`} style={{ ...cellNum, color: colors.inkDim }}>
              {h?.par ?? 4}
            </Text>
          )
        })}
        <Text
          style={{
            ...totalCell,
            color: colors.inkDim,
            fontFamily: 'Inconsolata-Medium',
            fontSize: 11,
          }}
        >
          {parSum}
        </Text>
      </View>

      <View style={{ flexDirection: 'row' }}>
        <Text style={labelStyle}>Score</Text>
        {holeNumbers.map((n) => {
          const h = holesByNumber.get(n)
          const hs = h ? scoresByHoleId.get(h.id) : null
          const score = hs?.score && hs.score > 0 ? hs.score : null
          return (
            <ScoreCell
              key={`s-${n}`}
              cellStyle={cellNum}
              colors={colors}
              par={h?.par ?? 4}
              score={score}
            />
          )
        })}
        <Text style={totalCell}>{anyScore ? scoreSum : '—'}</Text>
      </View>
    </View>
  )
}

interface ScoreCellProps {
  cellStyle: import('react-native').TextStyle
  colors: ColorPalette
  par: number
  score: number | null
}

function ScoreCell({ cellStyle, colors, par, score }: ScoreCellProps) {
  if (score == null) {
    return <Text style={{ ...cellStyle, color: colors.inkMute }}>—</Text>
  }
  const diff = score - par
  const isCircle = diff <= -1
  const isSquare = diff >= 1
  const decorationCount = Math.abs(diff) >= 2 ? 2 : 1
  const color = diff < 0 ? colors.accent : diff > 0 ? colors.neg : colors.ink

  if (!isCircle && !isSquare) {
    return <Text style={{ ...cellStyle, color }}>{score}</Text>
  }

  // RN can't overlay shapes inside flexed Text the way web can; wrap
  // in a positioned View so the decoration sits behind the digit.
  const sizes = decorationCount === 1 ? [16] : [16, 22]
  return (
    <View
      style={{
        flex: 1,
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
      }}
    >
      {sizes.map((size) => (
        <View
          key={size}
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: isCircle ? size / 2 : 1,
            borderWidth: 1.2,
            borderColor: color,
          }}
        />
      ))}
      <Text
        style={{
          fontFamily: 'Inconsolata-Medium',
          fontSize: 11,
          fontWeight: '500',
          color,
          fontVariant: ['tabular-nums'],
        }}
      >
        {score}
      </Text>
    </View>
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
    <View style={{ width: '47%' }}>
      <Text style={{ ...KICKER, color: colors.inkMute, marginBottom: 2 }}>
        {label}
      </Text>
      <Text
        style={{
          fontFamily: 'Fraunces-MediumItalic',
          fontWeight: '500',
          fontSize: 20,
          color,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value != null ? formatSG(value) : '—'}
      </Text>
    </View>
  )
}
