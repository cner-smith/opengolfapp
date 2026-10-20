import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import Svg, { Circle, Ellipse, Path } from 'react-native-svg'
import { PressableTouch } from '../ui/PressableTouch'
import { TYPE } from '../../lib/typography'
import { FONT_CAP, P } from '../paper/tokens'
import type { Layer } from './layers'

// The chart's layer bar and legend (direction D), as compact rows of
// icon-and-word toggles. A layer shows or hides one kind of mark; a legend
// entry shows or hides one group of shots. Each says what it hides.

const MUTE = '#8A8B7E'

export const LAYER_INFO: Record<Layer, { label: string; hides: string }> = {
  rings: { label: 'Rings', hides: 'the two rings (two shots in three, and nearly all)' },
  average: { label: 'Average', hides: 'the average finish and its line from the aim' },
  shots: { label: 'Shots', hides: 'the dot where each shot finished' },
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

function Toggle({ on, onPress, label, hint, children }: { on: boolean; onPress: () => void; label: string; hint: string; children: ReactNode }) {
  return (
    <PressableTouch
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        minHeight: 40,
        paddingHorizontal: 8,
        borderRadius: 2,
        borderWidth: 1,
        borderStyle: on ? 'solid' : 'dashed',
        borderColor: P.line,
        backgroundColor: on ? P.raised : 'transparent',
        opacity: on ? 1 : 0.75,
      }}
    >
      {children}
    </PressableTouch>
  )
}

export function LayerBar({ layers, available, onToggle }: { layers: Record<Layer, boolean>; available: Layer[]; onToggle: (l: Layer) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
      {available.map((l) => {
        const on = layers[l]
        return (
          <Toggle key={l} on={on} onPress={() => onToggle(l)} label={LAYER_INFO[l].label} hint={`${on ? 'Hides' : 'Shows'} ${LAYER_INFO[l].hides}`}>
            <View style={{ opacity: on ? 1 : 0.35 }}>
              <Glyph layer={l} />
            </View>
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 12, color: on ? P.ink : MUTE, textDecorationLine: on ? 'none' : 'line-through' }]}>
              {LAYER_INFO[l].label}
            </Text>
          </Toggle>
        )
      })}
    </View>
  )
}

export interface LegendEntry {
  key: string
  label: string
  color: string
  count: number
  open?: boolean
}

export function Legend({ entries, hidden, onToggle }: { entries: LegendEntry[]; hidden: Set<string>; onToggle: (k: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
      {entries.map((e) => {
        const on = !hidden.has(e.key)
        return (
          <Toggle key={e.key} on={on} onPress={() => onToggle(e.key)} label={`${e.label}, ${e.count}`} hint={`${on ? 'Hides' : 'Shows'} these ${e.count} shots`}>
            <View
              style={{
                width: 9,
                height: 9,
                borderRadius: 5,
                backgroundColor: e.open ? P.raised : e.color,
                borderWidth: e.open ? 1.4 : 0,
                borderColor: e.color,
              }}
            />
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 12, color: on ? P.ink : MUTE, textDecorationLine: on ? 'none' : 'line-through' }]}>
              {e.label}
            </Text>
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serifUpright, { fontSize: 13, color: on ? P.ink : MUTE }]}>{e.count}</Text>
          </Toggle>
        )
      })}
    </View>
  )
}
