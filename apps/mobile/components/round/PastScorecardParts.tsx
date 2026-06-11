import { useEffect, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { FONT, TYPE } from '../../lib/typography'

// Leaf presentational pieces of the editable past-round scorecard (#514),
// split out of the route screen to keep it under the 1000-line limit.

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
  fontFamily: FONT.mono,
}

// Scorecard ⇄ Map segmented control. Sits in the dark header band.
export function TabSwitcher({
  view,
  onChange,
}: {
  view: 'scorecard' | 'map'
  onChange: (v: 'scorecard' | 'map') => void
}) {
  const tabs: { key: 'scorecard' | 'map'; label: string }[] = [
    { key: 'scorecard', label: 'Scorecard' },
    { key: 'map', label: 'Map' },
  ]
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: '#1C211C',
        paddingHorizontal: 14,
        paddingBottom: 10,
        gap: 8,
      }}
    >
      {tabs.map((t) => {
        const active = view === t.key
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t.label}
            onPress={() => onChange(t.key)}
            style={{
              flex: 1,
              paddingVertical: 9,
              alignItems: 'center',
              borderRadius: 2,
              backgroundColor: active ? '#F2EEE5' : 'transparent',
              borderWidth: 1,
              borderColor: active ? '#F2EEE5' : 'rgba(242,238,229,0.3)',
            }}
          >
            <Text
              style={{
                ...KICKER,
                color: active ? '#1C211C' : 'rgba(242,238,229,0.8)',
              }}
            >
              {t.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

// Inline numeric cell for the editable scorecard. Score 0 / null renders as
// the em-dash placeholder — a fresh past round seeds every hole_score at 0,
// so 0 means "not entered yet", not "scored zero".
export function ScoreCell({
  value,
  onCommit,
  label,
  width,
  color,
}: {
  value: number | null
  onCommit: (n: number) => void
  label: string
  width: number
  color?: string
}) {
  const [text, setText] = useState(value && value > 0 ? String(value) : '')
  // Re-sync when the persisted value changes from elsewhere (e.g. a
  // Save-SG recompute or a sibling edit) so the cell never goes stale.
  useEffect(() => {
    setText(value && value > 0 ? String(value) : '')
  }, [value])
  return (
    <TextInput
      value={text}
      onChangeText={(t) => setText(t.replace(/[^0-9]/g, '').slice(0, 2))}
      onEndEditing={() => {
        const n = text === '' ? 0 : parseInt(text, 10)
        if (n !== (value ?? 0)) onCommit(n)
      }}
      keyboardType="number-pad"
      returnKeyType="done"
      placeholder="—"
      placeholderTextColor="#C4BCA8"
      selectTextOnFocus
      accessibilityLabel={label}
      style={[TYPE.kicker, {
        width,
        textAlign: 'right',
        fontSize: 15,
        paddingVertical: 12,
        color: color ?? '#1C211C',
        fontVariant: ['tabular-nums'],
      }]}
    />
  )
}
