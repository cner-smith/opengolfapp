import { useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TYPE } from '../../../lib/typography'
import { Key, KeyText, PaperSurface } from '../../paper/Paper'
import { SectionHead } from '../../paper/Section'
import { FONT_CAP, P } from '../../paper/tokens'
import { META, inputStyle } from './styles'

interface ManualFormArgs {
  name: string
  city: string
  state: string
  country: string
  pars: number[]
}

export function ManualCourseForm({
  initialName,
  gpsCoords,
  busy,
  onCancel,
  onCreate,
}: {
  initialName: string
  gpsCoords: { lat: number; lng: number } | null
  busy: boolean
  onCancel: () => void
  onCreate: (args: ManualFormArgs) => Promise<void>
}) {
  const insets = useSafeAreaInsets()
  const [name, setName] = useState(initialName)
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [country, setCountry] = useState('')
  const [holeCount, setHoleCount] = useState<9 | 18>(18)
  const [pars, setPars] = useState<number[]>(() => new Array(18).fill(4))

  const visiblePars = useMemo(() => pars.slice(0, holeCount), [pars, holeCount])

  function cyclePar(idx: number) {
    setPars((prev) => {
      const next = prev.slice()
      const cur = next[idx] ?? 4
      next[idx] = cur === 3 ? 4 : cur === 4 ? 5 : 3
      return next
    })
  }

  return (
    <PaperSurface style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: 18, paddingTop: insets.top + 14, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text maxFontSizeMultiplier={FONT_CAP} style={{ ...META, marginBottom: 8 }}>Add course</Text>
        <Text
          maxFontSizeMultiplier={FONT_CAP}
          style={[TYPE.serif, {
            color: P.ink,
            fontSize: 28,
            marginBottom: 18,
          }]}
        >
          New course
        </Text>

        <SectionHead title="Name" />
        <TextInput
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          style={inputStyle}
        />

        <SectionHead title="City" style={{ marginTop: 18 }} />
        <TextInput value={city} onChangeText={setCity} autoCapitalize="words" style={inputStyle} />

        <SectionHead title="State / region" style={{ marginTop: 18 }} />
        <TextInput value={state} onChangeText={setState} autoCapitalize="words" style={inputStyle} />

        <SectionHead title="Country" style={{ marginTop: 18 }} />
        <TextInput
          value={country}
          onChangeText={setCountry}
          autoCapitalize="words"
          style={inputStyle}
        />

        <SectionHead title="Holes" style={{ marginTop: 22 }} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip
            label="18 holes"
            active={holeCount === 18}
            onPress={() => setHoleCount(18)}
          />
          <Chip
            label="9 holes"
            active={holeCount === 9}
            onPress={() => setHoleCount(9)}
          />
        </View>

        <SectionHead title="Par per hole — tap to cycle" style={{ marginTop: 22 }} />
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          {visiblePars.map((p, idx) => (
            <Pressable
              key={idx}
              onPress={() => cyclePar(idx)}
              style={{
                width: '11%',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Text maxFontSizeMultiplier={FONT_CAP} style={{ ...META, fontSize: 11 }}>
                {idx + 1}
              </Text>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  backgroundColor: P.well,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  maxFontSizeMultiplier={FONT_CAP}
                  style={[TYPE.serifUpright, {
                    color: P.ink,
                    fontSize: 15,
                    fontVariant: ['tabular-nums'],
                  }]}
                >
                  {p}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        {gpsCoords && (
          <Text
            maxFontSizeMultiplier={FONT_CAP}
            style={[TYPE.body, {
              color: P.inkDim,
              fontSize: 12,
              marginTop: 18,
            }]}
          >
            Your current location is saved as the course location.
          </Text>
        )}

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
          <Key accessibilityLabel="Cancel" onPress={onCancel} style={{ flex: 1 }} faceStyle={{ minHeight: 48 }}>
            <KeyText size={13}>Cancel</KeyText>
          </Key>
          <Key
            tone="primary"
            accessibilityLabel={busy ? 'Creating…' : 'Create course →'}
            onPress={() =>
              onCreate({ name, city, state, country, pars: visiblePars })
            }
            disabled={busy || !name.trim()}
            style={{ flex: 2 }}
            faceStyle={{ minHeight: 48 }}
          >
            <KeyText tone="primary" bold disabled={busy || !name.trim()}>
              {busy ? 'Creating…' : 'Create course →'}
            </KeyText>
          </Key>
        </View>
      </ScrollView>
    </PaperSurface>
  )
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <Key accessibilityLabel={label} latched={active} onPress={onPress} faceStyle={{ minHeight: 40, paddingHorizontal: 14 }}>
      <KeyText size={13} bold={active}>
        {label}
      </KeyText>
    </Key>
  )
}
