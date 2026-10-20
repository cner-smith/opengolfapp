import { Text, View } from 'react-native'
import type { Club } from '@oga/core'
import { PressableTouch } from '../ui/PressableTouch'
import { TYPE } from '../../lib/typography'
import { FONT_CAP, P } from '../paper/tokens'

// Shot Patterns drawn like a yardage book: the club row as a gapping chart and
// the two chart tabs. The charts are in PatternCharts.tsx.


// The club row as a printed gapping chart: club over its typical distance.
// Wraps in rows (a scrolled row reads as the end of the bag, #740).
export function ClubLadder({
  clubs,
  value,
  onChange,
  typical,
  width,
}: {
  clubs: readonly Club[]
  value: Club
  onChange: (c: Club) => void
  typical: (c: Club) => number | null
  width: number
}) {
  const perRow = Math.max(5, Math.min(clubs.length, Math.floor(width / 48)))
  const cellW = Math.floor((width - 1) / perRow)
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderLeftWidth: 1, borderTopColor: P.lineStrong, borderLeftColor: P.line, width: cellW * perRow + 1 }}>
      {clubs.map((c) => {
        const on = c === value
        const t = typical(c)
        return (
          <PressableTouch
            key={c}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t != null ? `${c}, ${t}` : c}
            onPress={() => onChange(c)}
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
              {c === 'driver' ? 'dr' : c}
            </Text>
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serifUpright, { fontSize: 17, lineHeight: 21, color: on ? P.chrome : t != null ? P.ink : '#B7B2A2' }]}>
              {t != null ? t : '·'}
            </Text>
          </PressableTouch>
        )
      })}
    </View>
  )
}

export type ChartView = 'aim' | 'tee'

// Two views of one hero chart, set like printed tabs: the active one inked
// and underlined, no fill (the accent stays on the club).
export function ViewToggle({ value, onChange }: { value: ChartView; onChange: (v: ChartView) => void }) {
  const views: { v: ChartView; label: string }[] = [
    { v: 'aim', label: 'Around the aim' },
    { v: 'tee', label: 'From the tee' },
  ]
  return (
    <View style={{ flexDirection: 'row', gap: 20, borderBottomWidth: 1, borderColor: P.line }}>
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
    </View>
  )
}
