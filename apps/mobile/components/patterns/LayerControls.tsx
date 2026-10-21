import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import Svg, { Circle, Ellipse, Path } from 'react-native-svg'
import { PressableTouch } from '../ui/PressableTouch'
import { haptic } from '../../lib/haptics'
import { TYPE } from '../../lib/typography'
import { FONT_CAP, P } from '../paper/tokens'
import { Marker } from './chartParts'
import { COLOUR_BY, NOT_RECORDED, countWord, type Category, type ColourBy, type Layer } from './layers'

// The chart's layer bar and colour row, as compact rows of icon-and-word
// toggles. A layer shows or hides one kind of mark; once a colour is chosen
// the colour row becomes the legend, and each entry shows or hides one group
// of shots. Each says what it hides.

export const LAYER_INFO: Record<Layer, { label: string; hides: string }> = {
  shots: { label: 'Shots', hides: 'the dot where each shot finished' },
  rings: { label: 'Rings', hides: 'the two rings (two shots in three, and nearly all)' },
  average: { label: 'Average', hides: 'the average finish and its line from the aim' },
  flights: { label: 'Flights', hides: 'the line of each shot from where it was hit' },
  recent: { label: 'Recent 20', hides: 'the rings of your 20 most recent shots, drawn over all of them' },
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
      {layer === 'recent' && (
        <>
          <Ellipse cx={10} cy={7} rx={9} ry={6} stroke={P.lineStrong} strokeDasharray="2,2" />
          <Ellipse cx={10} cy={7} rx={5.5} ry={4} stroke={P.forest} strokeWidth={1.4} />
        </>
      )}
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
        borderColor: P.line,
        backgroundColor: on && !disabled ? P.raised : 'transparent',
      }}
    >
      {children}
    </PressableTouch>
  )
}

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

/** "Colour  None · Shape · Start line · Contact"; with a colour chosen, the
 *  same row is the legend: one toggle per group with its count, and ✕. */
export function ColourRow({ colourBy, onColourBy, entries, hidden, onToggle }: {
  colourBy: ColourBy
  onColourBy: (c: ColourBy) => void
  entries: LegendEntry[]
  hidden: Set<string>
  onToggle: (k: string) => void
}) {
  if (colourBy === 'none') {
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 13, color: P.inkDim, marginRight: 2 }]}>Colour</Text>
        {COLOUR_BY.filter((o) => o.value !== 'none').map((o) => (
          <PressableTouch
            key={o.value}
            accessibilityRole="button"
            accessibilityLabel={`Colour by ${o.label.toLowerCase()}`}
            accessibilityHint="Colours each shot, and lists the groups to show or hide"
            onPress={() => {
              haptic('tick')
              onColourBy(o.value)
            }}
            style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderColor: P.line, borderRadius: 2 }}
          >
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 13, color: P.ink }]}>{o.label}</Text>
          </PressableTouch>
        ))}
      </View>
    )
  }
  const by = COLOUR_BY.find((o) => o.value === colourBy)!.label
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.bodyBold, { fontSize: 13, color: P.ink, marginRight: 2 }]}>{by}</Text>
      {entries.map((e) => {
        const on = !hidden.has(e.key)
        const group = e.key === NOT_RECORDED ? `${e.count} not recorded` : countWord(e.key, e.label, e.count)
        return (
          <Toggle key={e.key} on={on} onPress={() => onToggle(e.key)} label={`${e.label}, ${e.count}`} hint={`${on ? 'Hides' : 'Shows'} the ${group} shot${e.count === 1 ? '' : 's'}`}>
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
      <PressableTouch
        accessibilityRole="button"
        accessibilityLabel="Stop colouring the shots"
        onPress={() => {
          haptic('tick')
          onColourBy('none')
        }}
        hitSlop={4}
        style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 16, color: P.inkDim }]}>✕</Text>
      </PressableTouch>
    </View>
  )
}
