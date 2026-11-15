import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { MIN_SAMPLES_FOR_STATS, clubLadderNotes, clubNoun, type Club, type DistanceUnit } from '@oga/core'
import { PressableTouch } from '../ui/PressableTouch'
import { haptic } from '../../lib/haptics'
import { TYPE } from '../../lib/typography'
import { FONT_CAP, P } from '../paper/tokens'

// Shot Patterns drawn like a yardage book: the club row as a gapping chart and
// the two chart tabs. The charts are in AimPlot.tsx and TeePlot.tsx.

const short = (c: Club) => (c === 'driver' ? 'dr' : c === 'putter' ? 'Putter' : c)

// The club row as a printed gapping chart: club over its typical distance, or
// how far it is from a pattern, with the gap to the next club printed on the
// rule between them. One row that scrolls sideways (as on the web) and keeps
// the chosen club in view when the page opens and when it changes. The web's
// two notes under the row (what the gap numbers are, the widest gap) sit
// behind a small ⓘ here: the gap numbers ride the rules between the club keys,
// too small and too close to the keys to be their own tap target.
const CELL = 54

export function ClubLadder({
  clubs,
  value,
  onChange,
  typical,
  aimed,
  unit,
  width,
  missedPutts,
}: {
  clubs: readonly Club[]
  value: Club
  onChange: (c: Club) => void
  /** Typical distance in the player's unit; null under five aimed shots. */
  typical: (c: Club) => number | null
  aimed: (c: Club) => number
  unit: DistanceUnit
  width: number
  /** The Putter stop's number: missed putts with a result (#747). */
  missedPutts?: number | null
}) {
  const row = useRef<ScrollView>(null)
  const scrollX = useRef(0)
  const [tipOpen, setTipOpen] = useState(false)
  const unitWords = unit === 'meters' ? 'metres' : 'yards'
  const notes = clubLadderNotes(clubs, typical, unit)
  const hasNotes = notes.key != null || notes.widest != null
  const cellW = Math.max(CELL, Math.floor((width - 1) / Math.max(clubs.length, 1)))
  const i = clubs.indexOf(value)
  const reveal = (animated: boolean) => {
    if (i < 0) return
    const left = i * cellW
    if (left < scrollX.current) row.current?.scrollTo({ x: Math.max(0, left - 8), animated })
    else if (left + cellW > scrollX.current + width) row.current?.scrollTo({ x: left + cellW - width + 9, animated })
  }
  useEffect(() => reveal(true), [i, cellW, width])
  return (
    <View>
      <ScrollView
        ref={row}
        horizontal
        onLayout={() => reveal(false)}
        onScroll={(e) => {
          scrollX.current = e.nativeEvent.contentOffset.x
        }}
        scrollEventThrottle={16}
        accessibilityRole="radiogroup"
        accessibilityLabel="Club"
        style={{ width }}
        contentContainerStyle={{ borderTopWidth: 1, borderLeftWidth: 1, borderTopColor: P.lineStrong, borderLeftColor: P.line }}
      >
        {clubs.map((c, j) => {
          const on = c === value
          const putter = c === 'putter'
          // The putter's number is its missed putts, not a distance.
          const t = putter ? missedPutts ?? null : typical(c)
          const n = putter ? 0 : aimed(c)
          const prev = j > 0 && !putter ? typical(clubs[j - 1]!) : null
          const a11y = putter
            ? `Putter, ${missedPutts ?? 0} missed putt${missedPutts === 1 ? '' : 's'} with a result`
            : t != null ? `${clubNoun(c)}, ${t} ${unitWords}` : n > 0 ? `${clubNoun(c)}, ${n} of ${MIN_SAMPLES_FOR_STATS} aimed shots` : `${clubNoun(c)}, no aimed shots yet`
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
              {/* The gap from the club before, printed on the rule between them. */}
              {t != null && prev != null && (
                <View pointerEvents="none" style={{ position: 'absolute', left: -13, bottom: 3, width: 24, alignItems: 'center' }}>
                  <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serifUpright, { fontSize: 11, lineHeight: 13, color: P.inkDim, backgroundColor: P.chrome }]}>
                    {prev - t}
                  </Text>
                </View>
              )}
            </PressableTouch>
          )
        })}
      </ScrollView>
      {hasNotes && <GapTip notes={notes} open={tipOpen} onToggle={() => setTipOpen((o) => !o)} />}
    </View>
  )
}

/** The ⓘ under the ladder's right end, and the web's gap notes as a tip
 *  under it while open; a second tap on either closes it. */
function GapTip({ notes, open, onToggle }: { notes: { key: string | null; widest: string | null }; open: boolean; onToggle: () => void }) {
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <PressableTouch
        accessibilityRole="button"
        accessibilityLabel="About the gap numbers"
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        hitSlop={8}
        style={{ minWidth: 44, minHeight: 30, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 2 }}
      >
        <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.2, borderColor: open ? P.ink : P.inkDim, backgroundColor: open ? P.ink : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          <Text maxFontSizeMultiplier={1} style={[TYPE.serif, { fontSize: 13, lineHeight: 16, color: open ? P.chrome : P.inkDim }]}>i</Text>
        </View>
      </PressableTouch>
      {open && (
        <PressableTouch
          accessibilityRole="button"
          accessibilityLabel={[notes.key, notes.widest].filter(Boolean).join(' ')}
          accessibilityHint="Closes the note"
          accessibilityLiveRegion="polite"
          onPress={onToggle}
          style={{ alignSelf: 'stretch', marginTop: 2, paddingHorizontal: 12, paddingVertical: 10, gap: 6, backgroundColor: P.raised, borderWidth: 1, borderColor: P.lineStrong, borderRadius: 3 }}
        >
          {/* The tip's point, up at the ⓘ. */}
          <View pointerEvents="none" style={{ position: 'absolute', right: 6, top: -6, width: 10, height: 10, backgroundColor: P.raised, borderLeftWidth: 1, borderTopWidth: 1, borderColor: P.lineStrong, transform: [{ rotate: '45deg' }] }} />
          {notes.key && <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 12, lineHeight: 18, color: P.inkDim }]}>{notes.key}</Text>}
          {notes.widest && <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 13, lineHeight: 19, color: P.ink }]}>{notes.widest}</Text>}
        </PressableTouch>
      )}
    </View>
  )
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
