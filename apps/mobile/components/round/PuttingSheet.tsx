import { useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { GreenDiagram, type BreakDirection } from './GreenDiagram'

type PuttResult = 'made' | 'short' | 'long' | 'missed_left' | 'missed_right'
type GreenSpeed = 'slow' | 'medium' | 'fast'

export interface PuttingValue {
  puttDistanceFt?: number
  puttResult?: PuttResult
  breakDirection?: BreakDirection
  puttSlopePct?: number // 0-4 intensity bucket
  greenSpeed?: GreenSpeed
  aimOffsetInches?: number
  notes?: string
}

interface PuttingSheetProps {
  shotNumber: number
  initialDistanceFt?: number
  initial?: PuttingValue
  onSave: (value: PuttingValue) => void
  onClose: () => void
}

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

const RESULT_GRID_ROW1: PuttResult[] = ['made', 'short', 'long']
const RESULT_GRID_ROW2: PuttResult[] = ['missed_left', 'missed_right']
const RESULT_LABEL: Record<PuttResult, string> = {
  made: 'Made',
  short: 'Short',
  long: 'Long',
  missed_left: 'Missed left',
  missed_right: 'Missed right',
}

const BREAK_OPTIONS: { value: BreakDirection; label: string }[] = [
  { value: 'left_to_right', label: 'L → R' },
  { value: 'straight', label: 'Straight' },
  { value: 'right_to_left', label: 'R → L' },
  { value: 'uphill', label: 'Uphill' },
  { value: 'downhill', label: 'Downhill' },
]

const SLOPE_INTENSITY_LABELS = ['Flat', 'Slight', 'Moderate', 'Strong', 'Severe']

const SPEED_OPTIONS: { value: GreenSpeed; label: string }[] = [
  { value: 'slow', label: 'Slow' },
  { value: 'medium', label: 'Medium' },
  { value: 'fast', label: 'Fast' },
]

export function PuttingSheet({
  shotNumber,
  initialDistanceFt,
  initial,
  onSave,
  onClose,
}: PuttingSheetProps) {
  const [value, setValue] = useState<PuttingValue>({
    puttDistanceFt: initial?.puttDistanceFt ?? initialDistanceFt ?? 0,
    puttResult: initial?.puttResult,
    breakDirection: initial?.breakDirection ?? 'straight',
    puttSlopePct: initial?.puttSlopePct ?? 0,
    greenSpeed: initial?.greenSpeed,
    aimOffsetInches: initial?.aimOffsetInches ?? 0,
    notes: initial?.notes,
  })
  const [distanceText, setDistanceText] = useState(
    String(initial?.puttDistanceFt ?? initialDistanceFt ?? 0),
  )

  useEffect(() => {
    if (initialDistanceFt != null && initial?.puttDistanceFt == null) {
      setValue((v) => ({ ...v, puttDistanceFt: initialDistanceFt }))
      setDistanceText(String(initialDistanceFt))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDistanceFt])

  function commitDistance(text: string) {
    setDistanceText(text)
    const n = parseFloat(text)
    setValue((v) => ({
      ...v,
      puttDistanceFt: Number.isFinite(n) ? n : undefined,
    }))
  }

  function set<K extends keyof PuttingValue>(k: K, v: PuttingValue[K]) {
    setValue((prev) => ({ ...prev, [k]: v }))
  }

  function commit(makeOverride?: boolean) {
    const finalResult: PuttResult | undefined = makeOverride
      ? 'made'
      : makeOverride === false && !value.puttResult
        ? 'missed_left'
        : value.puttResult
    onSave({ ...value, puttResult: finalResult ?? value.puttResult })
  }

  const distance = value.puttDistanceFt ?? 0

  return (
    <View
      style={{
        backgroundColor: '#FBF8F1',
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        paddingHorizontal: 18,
        paddingTop: 10,
        paddingBottom: 24,
        maxHeight: '90%',
      }}
    >
      <View
        style={{
          alignSelf: 'center',
          width: 32,
          height: 4,
          borderRadius: 2,
          backgroundColor: '#D9D2BF',
          marginBottom: 14,
        }}
      />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          paddingBottom: 14,
          borderBottomWidth: 1,
          borderColor: '#D9D2BF',
        }}
      >
        <View>
          <Text style={{ ...KICKER, marginBottom: 4 }}>Putt {shotNumber}</Text>
          <Text
            style={{
              color: '#1C211C',
              fontSize: 22,
              fontStyle: 'italic',
              fontWeight: '500',
            }}
          >
            On the green.
          </Text>
        </View>
        <Pressable onPress={onClose}>
          <Text
            style={{ ...KICKER, color: '#8A8B7E', padding: 6 }}
          >
            Close
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingTop: 14, paddingBottom: 8 }}>
        <GreenDiagram
          distanceFt={distance}
          aimOffsetInches={value.aimOffsetInches ?? 0}
          breakDirection={value.breakDirection ?? 'straight'}
          onAimChange={(n) => set('aimOffsetInches', n)}
        />

        <View style={{ marginTop: 14 }}>
          <Text style={{ ...KICKER, marginBottom: 6 }}>Distance override (ft)</Text>
          <TextInput
            keyboardType="numeric"
            value={distanceText}
            onChangeText={commitDistance}
            style={inputStyle}
          />
        </View>

        <Section title="Result">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {RESULT_GRID_ROW1.map((r) => (
              <ResultCell
                key={r}
                label={RESULT_LABEL[r]}
                made={r === 'made'}
                active={value.puttResult === r}
                onPress={() => set('puttResult', r)}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            {RESULT_GRID_ROW2.map((r) => (
              <ResultCell
                key={r}
                label={RESULT_LABEL[r]}
                made={false}
                active={value.puttResult === r}
                onPress={() => set('puttResult', r)}
              />
            ))}
            <View style={{ flex: 1 }} />
          </View>
        </Section>

        <Section title="Break">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {BREAK_OPTIONS.map((b) => (
              <Chip
                key={b.value}
                label={b.label}
                active={value.breakDirection === b.value}
                onPress={() => set('breakDirection', b.value)}
              />
            ))}
          </View>
        </Section>

        <Section title="How much">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {SLOPE_INTENSITY_LABELS.map((label, idx) => (
              <Chip
                key={label}
                label={label}
                active={value.puttSlopePct === idx}
                onPress={() => set('puttSlopePct', idx)}
              />
            ))}
          </View>
        </Section>

        <Section title="Speed">
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {SPEED_OPTIONS.map((s) => (
              <Chip
                key={s.value}
                label={s.label}
                active={value.greenSpeed === s.value}
                onPress={() => set('greenSpeed', s.value)}
              />
            ))}
          </View>
        </Section>

        <Section title="Notes">
          <TextInput
            value={value.notes ?? ''}
            onChangeText={(t) => set('notes', t || undefined)}
            style={inputStyle}
            placeholder="Optional"
          />
        </Section>

        <View style={{ marginTop: 22 }}>
          <Pressable
            onPress={() => commit(true)}
            style={{
              backgroundColor: '#1F3D2C',
              borderRadius: 2,
              paddingVertical: 18,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: '#F2EEE5',
                fontSize: 16,
                fontWeight: '700',
                letterSpacing: 0.4,
              }}
            >
              Holed it →
            </Text>
          </Pressable>
          <Pressable
            onPress={() => commit(false)}
            style={{
              borderWidth: 1,
              borderColor: '#1F3D2C',
              borderRadius: 2,
              paddingVertical: 14,
              alignItems: 'center',
              marginTop: 10,
            }}
          >
            <Text
              style={{
                color: '#1F3D2C',
                fontSize: 14,
                fontWeight: '600',
                letterSpacing: 0.3,
              }}
            >
              Missed →
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderColor: '#D9D2BF',
        paddingTop: 14,
        marginTop: 14,
      }}
    >
      <Text style={{ ...KICKER, marginBottom: 10 }}>{title}</Text>
      {children}
    </View>
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
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: active ? '#1F3D2C' : '#EBE5D6',
        borderRadius: 2,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <Text
        style={{
          color: active ? '#F2EEE5' : '#1C211C',
          fontSize: 12,
          fontWeight: active ? '600' : '400',
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function ResultCell({
  label,
  made,
  active,
  onPress,
}: {
  label: string
  made: boolean
  active: boolean
  onPress: () => void
}) {
  // "Made" cell uses accent fill always (the celebrated outcome). Misses
  // are surface with caddie-line border; active state inverts to accent.
  const fill = made
    ? '#1F3D2C'
    : active
      ? '#1F3D2C'
      : '#FBF8F1'
  const fg = made || active ? '#F2EEE5' : '#1C211C'
  const border = made
    ? '#1F3D2C'
    : active
      ? '#1F3D2C'
      : '#D9D2BF'
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        backgroundColor: fill,
        borderWidth: 1,
        borderColor: border,
        borderRadius: 2,
        paddingVertical: 16,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          color: fg,
          fontSize: 14,
          fontWeight: made || active ? '600' : '500',
          letterSpacing: 0.3,
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

const inputStyle = {
  backgroundColor: '#FBF8F1',
  borderWidth: 1,
  borderColor: '#D9D2BF',
  borderRadius: 2,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: 15,
  color: '#1C211C',
} as const
