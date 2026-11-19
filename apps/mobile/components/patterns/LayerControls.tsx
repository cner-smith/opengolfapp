import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import Svg, { Circle, Ellipse, Path } from 'react-native-svg'
import { PressableTouch } from '../ui/PressableTouch'
import { haptic } from '../../lib/haptics'
import { TYPE } from '../../lib/typography'
import { FONT_CAP, P } from '../paper/tokens'
import { Marker } from './chartParts'
import { NOT_RECORDED, countWord, type ColourBy } from '@oga/core'
import { COLOUR_BY, type Category, type Layer } from './layers'

// The chart's controls, as the web page draws them: a layer bar of
// icon-and-word toggles, "Colour" and "All N | Latest 20" as radio words, and
// under the chart a legend band ("Show") whose entries each show or hide one
// group of shots. Each toggle says what it hides. Off = a solid hairline and
// a faded icon; dashed only for "needs five shots"; on = the web's fill.

export const LAYER_INFO: Record<Layer, { label: string; hides: string }> = {
  shots: { label: 'Shots', hides: 'the dot where each shot finished' },
  rings: { label: 'Rings', hides: 'the two rings (two shots in three, and nearly all)' },
  average: { label: 'Average', hides: 'the average finish and its line from the aim' },
  flights: { label: 'Flights', hides: 'the line of each shot from where it was hit' },
}

function Glyph({ layer }: { layer: Layer }) {
  return (
    <Svg width={16} height={11} viewBox="0 0 20 14" fill="none">
      {layer === 'rings' && (
        <>
          <Ellipse cx={10} cy={7} rx={9} ry={6} stroke={P.forest} strokeDasharray="2.5,2" />
          <Ellipse cx={10} cy={7} rx={5} ry={3.4} stroke={P.forest} strokeWidth={1.3} fill="rgba(31,61,44,0.1)" />
        </>
      )}
      {layer === 'average' && (
        <>
          <Path d="M3 12 L13 4" stroke={P.ink} strokeDasharray="2,2" />
          <Circle cx={14} cy={4} r={3} fill={P.raised} stroke={P.forest} strokeWidth={1.6} />
        </>
      )}
      {layer === 'shots' && (
        <>
          <Circle cx={5} cy={9} r={2.4} fill={P.ink} />
          <Circle cx={11} cy={4.5} r={2.4} fill={P.ink} />
          <Circle cx={15.5} cy={10} r={2.4} fill={P.ink} />
        </>
      )}
      {layer === 'flights' && <Path d="M4 13 Q4 3 16 1.5" stroke={P.ink} strokeWidth={1.4} strokeLinecap="round" />}
    </Svg>
  )
}

function Toggle({ on, onPress, label, hint, disabled, children }: { on: boolean; onPress: () => void; label: string; hint: string; disabled?: boolean; children: ReactNode }) {
  return (
    <PressableTouch
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled }}
      accessibilityLabel={label}
      accessibilityHint={hint}
      disabled={disabled}
      onPress={() => {
        haptic(on ? 'toggleOff' : 'toggleOn')
        onPress()
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 44,
        paddingHorizontal: 10,
        borderRadius: 2,
        borderWidth: 1,
        borderStyle: disabled ? 'dashed' : 'solid',
        borderColor: on && !disabled ? P.lineStrong : P.line,
        backgroundColor: on && !disabled ? ON_FILL : 'transparent',
      }}
    >
      {children}
    </PressableTouch>
  )
}

// The web toggle's on fill (#EBE5D6).
const ON_FILL = '#EBE5D6'

const word = (on: boolean, disabled?: boolean) => [TYPE.body, { fontSize: 13, color: disabled ? P.ink35 : on ? P.ink : P.inkDim }]

export function LayerBar({ layers, available, disabled, onToggle }: { layers: Record<Layer, boolean>; available: Layer[]; disabled: Set<Layer>; onToggle: (l: Layer) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {available.map((l) => {
        const off = disabled.has(l)
        const on = layers[l] && !off
        return (
          <Toggle
            key={l}
            on={on}
            disabled={off}
            onPress={() => onToggle(l)}
            label={LAYER_INFO[l].label}
            hint={off ? 'Needs five shots' : `${on ? 'Hides' : 'Shows'} ${LAYER_INFO[l].hides}`}
          >
            <View style={{ opacity: on ? 1 : 0.35 }}>
              <Glyph layer={l} />
            </View>
            <Text maxFontSizeMultiplier={FONT_CAP} style={word(on, off)}>
              {LAYER_INFO[l].label}
            </Text>
          </Toggle>
        )
      })}
    </View>
  )
}

export interface LegendEntry extends Category {
  count: number
}

function Swatch({ e }: { e: LegendEntry }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12">
      <Marker x={6} y={6} r={3.4} glyph={e.key === NOT_RECORDED ? 'unrecorded' : e.glyph} color={e.color} />
    </Svg>
  )
}

/** Underlined radio words, the web's: the chosen one inked and underlined. */
function RadioWords<T extends string>({ label, options, value, onChange, underline }: {
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  underline: string
}) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 14 }}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <PressableTouch
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={o.label}
            onPress={() => {
              if (on) return
              haptic('tick')
              onChange(o.value)
            }}
            style={{ minHeight: 44, justifyContent: 'center', borderBottomWidth: 2, borderColor: on ? underline : 'transparent' }}
          >
            <Text maxFontSizeMultiplier={FONT_CAP} style={[on ? TYPE.bodyBold : TYPE.body, { fontSize: 13, color: on ? P.ink : P.inkDim }]}>{o.label}</Text>
          </PressableTouch>
        )
      })}
    </View>
  )
}

/** "Colour  None · Shape · Start line · Contact", always shown. */
export function ColourControl({ value, onChange }: { value: ColourBy; onChange: (c: ColourBy) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 14 }}>
      <Text importantForAccessibility="no" maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 13, color: P.inkDim }]}>Colour</Text>
      <RadioWords label="Colour the shots by" options={COLOUR_BY} value={value} onChange={onChange} underline={P.ink} />
    </View>
  )
}

export type Scope = 'all' | 'recent'

/** "All 24 | Latest 20": every shot, or the latest against a ghost of all. */
export function ScopeControl({ value, onChange, total, latest }: { value: Scope; onChange: (s: Scope) => void; total: number; latest: number }) {
  const options = [
    { value: 'all' as const, label: `All ${total}` },
    { value: 'recent' as const, label: `Latest ${latest}` },
  ]
  return <RadioWords label="Which shots" options={options} value={value} onChange={onChange} underline={P.inkDim} />
}

/** Under the chart: "Show" and one toggle per group with its count. The first
 *  tap brings a group forward, the second hides it (the web's touch rule). */
export function LegendBand({ entries, hidden, focus, onTap, note }: { entries: LegendEntry[]; hidden: Set<string>; focus: string | null; onTap: (k: string) => void; note: string }) {
  return (
    <View style={{ paddingHorizontal: 10, paddingTop: 10, paddingBottom: 12, borderTopWidth: 1, borderColor: '#ECE6D8', gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <Text importantForAccessibility="no" maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 13, color: P.inkDim, marginRight: 2 }]}>Show</Text>
        {entries.map((e) => {
          const on = !hidden.has(e.key)
          const group = e.key === NOT_RECORDED ? `${e.count} not recorded` : countWord(e.key, e.label, e.count)
          const shots = `${group} shot${e.count === 1 ? '' : 's'}`
          const hint = !on ? `Shows the ${shots}` : focus === e.key ? `Hides the ${shots}` : `Brings the ${shots} forward; tap again to hide them`
          return (
            <Toggle key={e.key} on={on} onPress={() => onTap(e.key)} label={`${e.label}, ${e.count}`} hint={hint}>
              <View style={{ opacity: on ? 1 : 0.35 }}>
                <Swatch e={e} />
              </View>
              <Text maxFontSizeMultiplier={FONT_CAP} style={word(on)}>
                {e.label}
              </Text>
              <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serifUpright, { fontSize: 13, color: on ? P.ink : P.inkDim }]}>{e.count}</Text>
            </Toggle>
          )
        })}
      </View>
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12, lineHeight: 17 }]}>{note} Tap a group once to bring it forward, twice to hide it.</Text>
    </View>
  )
}
