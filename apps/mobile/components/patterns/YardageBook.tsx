import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { MIN_SAMPLES_FOR_STATS, clubNoun, type Club } from '@oga/core'
import { PressableTouch } from '../ui/PressableTouch'
import { haptic } from '../../lib/haptics'
import { TYPE } from '../../lib/typography'
import { FONT_CAP, P } from '../paper/tokens'

// Shot Patterns drawn like a yardage book: the club row as a gapping chart and
// the two chart tabs. The charts are in AimPlot.tsx and TeePlot.tsx.

const short = (c: Club) => (c === 'driver' ? 'dr' : c)

// The club row as a printed gapping chart: club over its typical distance, or
// how far it is from a pattern. Wraps in rows (a scrolled row reads as the end
// of the bag, #740); the last row is filled out so the grid closes.
export function ClubLadder({
  clubs,
  value,
  onChange,
  typical,
  aimed,
  unitWords,
  width,
}: {
  clubs: readonly Club[]
  value: Club
  onChange: (c: Club) => void
  typical: (c: Club) => number | null
  aimed: (c: Club) => number
  unitWords: string
  width: number
}) {
  const perRow = Math.max(5, Math.min(clubs.length, Math.floor(width / 48)))
  const cellW = Math.floor((width - 1) / perRow)
  const filler = (perRow - (clubs.length % perRow)) % perRow
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Club"
      style={{ flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderLeftWidth: 1, borderTopColor: P.lineStrong, borderLeftColor: P.line, width: cellW * perRow + 1 }}
    >
      {clubs.map((c) => {
        const on = c === value
        const t = typical(c)
        const n = aimed(c)
        const a11y = t != null ? `${clubNoun(c)}, ${t} ${unitWords}` : n > 0 ? `${clubNoun(c)}, ${n} of ${MIN_SAMPLES_FOR_STATS} aimed shots` : `${clubNoun(c)}, no aimed shots yet`
        return (
          <PressableTouch
            key={c}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={a11y}
            onPress={() => {
              if (!on) haptic('tick')
              onChange(c)
            }}
            style={{
              width: cellW,
              minHeight: 54,
              alignItems: 'center',
              justifyContent: 'center',
              borderRightWidth: 1,
              borderBottomWidth: 1,
              borderColor: P.line,
              backgroundColor: on ? P.forest : 'transparent',
            }}
          >
            <Text maxFontSizeMultiplier={FONT_CAP} style={[on ? TYPE.bodyBold : TYPE.body, { fontSize: 13, color: on ? P.chrome : P.ink }]}>
              {short(c)}
            </Text>
            {t != null ? (
              <Text maxFontSizeMultiplier={FONT_CAP} style={[on ? TYPE.serif : TYPE.serifUpright, { fontSize: 17, lineHeight: 21, color: on ? P.chrome : P.ink }]}>
                {t}
              </Text>
            ) : (
              <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 12, lineHeight: 21, color: on ? P.chrome : P.inkDim }]}>
                {n > 0 ? `${n} of ${MIN_SAMPLES_FOR_STATS}` : '—'}
              </Text>
            )}
          </PressableTouch>
        )
      })}
      {Array.from({ length: filler }, (_, i) => (
        <View key={`f${i}`} style={{ width: cellW, minHeight: 54, borderRightWidth: 1, borderBottomWidth: 1, borderColor: P.line }} />
      ))}
    </View>
  )
}

/** "65 yd between 3w and 6i": gaps over 25 yd between neighbouring numbered clubs. */
export function ladderGaps(clubs: readonly Club[], typicalYards: (c: Club) => number | null, mag: (yd: number) => string) {
  const numbered = clubs.flatMap((c) => {
    const y = typicalYards(c)
    return y == null ? [] : [{ c, y }]
  })
  const gaps: string[] = []
  for (let i = 1; i < numbered.length; i++) {
    const a = numbered[i - 1]!
    const b = numbered[i]!
    if (a.y - b.y > 25) gaps.push(`${mag(a.y - b.y)} between ${short(a.c)} and ${short(b.c)}`)
  }
  return gaps
}

export type ChartView = 'aim' | 'tee'

// Two views of one hero chart, set like printed tabs: the active one inked
// and underlined, no fill (the accent stays on the club). `trailing` sits at
// the right of the row (the Filters key).
export function ViewToggle({ value, onChange, trailing }: { value: ChartView; onChange: (v: ChartView) => void; trailing?: ReactNode }) {
  const views: { v: ChartView; label: string }[] = [
    { v: 'aim', label: 'Around the aim' },
    { v: 'tee', label: 'From the tee' },
  ]
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: 16, borderBottomWidth: 1, borderColor: P.line }}>
      {views.map(({ v, label }) => {
        const on = v === value
        return (
          <PressableTouch
            key={v}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(v)}
            style={{ minHeight: 44, justifyContent: 'center', borderBottomWidth: 2, borderColor: on ? P.ink : 'transparent', marginBottom: -1 }}
          >
            <Text maxFontSizeMultiplier={FONT_CAP} style={[on ? TYPE.bodyBold : TYPE.body, { fontSize: 14, color: on ? P.ink : P.inkDim }]}>
              {label}
            </Text>
          </PressableTouch>
        )
      })}
      {trailing && <View style={{ marginLeft: 'auto', paddingBottom: 4 }}>{trailing}</View>}
    </View>
  )
}
