import { useState } from 'react'
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import Svg, { Circle, Line as SvgLine } from 'react-native-svg'
import {
  CLUBS,
  LIE_TYPES,
  SHOT_RESULTS,
  type Club,
  type LieSlopeForward,
  type LieSlopeSide,
  type LieType,
  type ShotResult,
} from '@oga/core'

type PuttResult = 'made' | 'short' | 'long' | 'missed_left' | 'missed_right'

export interface ShotLoggerValue {
  club?: Club
  lieType?: LieType
  lieSlopeForward?: LieSlopeForward
  lieSlopeSide?: LieSlopeSide
  shotResult?: ShotResult
  puttResult?: PuttResult
  puttDistanceFt?: number
  notes?: string
}

interface ShotLoggerProps {
  visible: boolean
  shotNumber: number
  isPutt: boolean
  initial?: ShotLoggerValue
  onSave: (value: ShotLoggerValue) => void
  onSkip: () => void
  onClose: () => void
}

type PuttKey = PuttResult | 'spacer'

const SLOPE_FORWARD_ROW: LieSlopeForward[] = ['uphill', 'level', 'downhill']
const SLOPE_SIDE_ROW: (LieSlopeSide | 'spacer')[] = [
  'ball_above',
  'spacer',
  'ball_below',
]

const FORWARD_LABEL: Record<LieSlopeForward, string> = {
  uphill: 'Uphill',
  level: 'Level',
  downhill: 'Downhill',
}

const SIDE_LABEL: Record<LieSlopeSide, string> = {
  ball_above: 'Ball above',
  ball_below: 'Ball below',
}

const PUTT_GRID: PuttKey[] = [
  'made',
  'short',
  'long',
  'missed_left',
  'spacer',
  'missed_right',
]

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

export function ShotLogger({
  visible,
  shotNumber,
  isPutt,
  initial,
  onSave,
  onSkip,
  onClose,
}: ShotLoggerProps) {
  const [value, setValue] = useState<ShotLoggerValue>(initial ?? {})
  const set = <K extends keyof ShotLoggerValue>(key: K, v: ShotLoggerValue[K]) =>
    setValue((prev) => ({ ...prev, [key]: prev[key] === v ? undefined : v }))

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(28,33,28,0.55)',
        }}
      >
        <View
          style={{
            backgroundColor: '#FBF8F1',
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
            paddingHorizontal: 18,
            paddingTop: 10,
            paddingBottom: 28,
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
              <Text style={{ ...KICKER, marginBottom: 4 }}>
                Shot {shotNumber}
              </Text>
              <Text
                style={{
                  color: '#1C211C',
                  fontSize: 22,
                  fontWeight: '500',
                  fontStyle: 'italic',
                }}
              >
                Log it.
              </Text>
            </View>
            <Pressable onPress={onSkip}>
              <Text
                style={{
                  ...KICKER,
                  color: '#A66A1F',
                  fontSize: 10,
                }}
              >
                Skip all →
              </Text>
            </Pressable>
          </View>

          <ScrollView
            style={{ maxHeight: 480 }}
            contentContainerStyle={{ paddingTop: 14 }}
          >
            <Section title="Club">
              <ChipRow
                value={value.club}
                options={CLUBS}
                onChange={(v) => set('club', v)}
              />
            </Section>

            <Section title="Lie type">
              <ChipRow
                value={value.lieType}
                options={LIE_TYPES}
                onChange={(v) => set('lieType', v)}
              />
            </Section>

            <Section title="Lie slope">
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 6,
                  maxWidth: 360,
                }}
              >
                <View
                  accessibilityRole="radiogroup"
                  accessibilityLabel="Forward slope"
                  style={{
                    flexDirection: 'row',
                    gap: 6,
                    width: '100%',
                  }}
                >
                  {SLOPE_FORWARD_ROW.map((key) => {
                    const active = value.lieSlopeForward === key
                    return (
                      <Pressable
                        key={key}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active }}
                        onPress={() =>
                          setValue((prev) => ({
                            ...prev,
                            lieSlopeForward: active ? undefined : key,
                          }))
                        }
                        style={[gridButtonStyle(active), { flex: 1 }]}
                      >
                        <SlopeForwardIcon
                          kind={key}
                          color={active ? '#F2EEE5' : '#5C6356'}
                        />
                        <Text style={gridButtonTextStyle(active)}>
                          {FORWARD_LABEL[key]}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
                <View
                  accessibilityRole="radiogroup"
                  accessibilityLabel="Side slope"
                  style={{
                    flexDirection: 'row',
                    gap: 6,
                    width: '100%',
                  }}
                >
                  {SLOPE_SIDE_ROW.map((key, i) => {
                    if (key === 'spacer') {
                      return <View key={`s${i}`} style={{ flex: 1 }} />
                    }
                    const active = value.lieSlopeSide === key
                    return (
                      <Pressable
                        key={key}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active }}
                        onPress={() =>
                          setValue((prev) => ({
                            ...prev,
                            lieSlopeSide: active ? undefined : key,
                          }))
                        }
                        style={[gridButtonStyle(active), { flex: 1 }]}
                      >
                        <SlopeSideIcon
                          kind={key}
                          color={active ? '#F2EEE5' : '#5C6356'}
                        />
                        <Text style={gridButtonTextStyle(active)}>
                          {SIDE_LABEL[key]}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            </Section>

            {isPutt ? (
              <>
                <Section title="Putt distance (ft)">
                  <TextInput
                    keyboardType="numeric"
                    value={value.puttDistanceFt?.toString() ?? ''}
                    onChangeText={(t) =>
                      setValue((prev) => ({
                        ...prev,
                        puttDistanceFt: t ? Number(t) : undefined,
                      }))
                    }
                    style={inputStyle}
                  />
                </Section>

                <Section title="Putt result">
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: 6,
                      maxWidth: 360,
                    }}
                  >
                    {PUTT_GRID.map((key, i) => (
                      <View
                        key={`${key}-${i}`}
                        style={{ width: '32%', maxWidth: 116 }}
                      >
                        {key === 'spacer' ? null : (
                          <Pressable
                            onPress={() => set('puttResult', key)}
                            style={gridButtonStyle(value.puttResult === key)}
                          >
                            <Text style={gridButtonTextStyle(value.puttResult === key)}>
                              {key.replace('_', ' ')}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    ))}
                  </View>
                </Section>
              </>
            ) : (
              <Section title="Shot result">
                <ChipRow
                  value={value.shotResult}
                  options={SHOT_RESULTS}
                  onChange={(v) => set('shotResult', v)}
                />
              </Section>
            )}

            <Section title="Notes">
              <TextInput
                value={value.notes ?? ''}
                onChangeText={(t) =>
                  setValue((prev) => ({ ...prev, notes: t || undefined }))
                }
                style={[inputStyle, { width: '100%' }]}
              />
            </Section>
          </ScrollView>

          <View
            style={{
              flexDirection: 'row',
              gap: 10,
              paddingTop: 14,
              borderTopWidth: 1,
              borderColor: '#D9D2BF',
              marginTop: 4,
            }}
          >
            <Pressable
              onPress={onClose}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 14,
                borderRadius: 2,
                borderWidth: 1,
                borderColor: '#1F3D2C',
                backgroundColor: 'transparent',
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
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onSave(value)}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 14,
                borderRadius: 2,
                backgroundColor: '#1F3D2C',
              }}
            >
              <Text
                style={{
                  color: '#F2EEE5',
                  fontSize: 14,
                  fontWeight: '600',
                  letterSpacing: 0.3,
                }}
              >
                Save + next →
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const inputStyle = {
  backgroundColor: '#FBF8F1',
  borderWidth: 1,
  borderColor: '#D9D2BF',
  borderRadius: 2,
  paddingHorizontal: 10,
  paddingVertical: 10,
  fontSize: 15,
  color: '#1C211C',
  width: 140,
} as const

function gridButtonStyle(active: boolean) {
  return {
    alignItems: 'center' as const,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 2,
    backgroundColor: active ? '#1F3D2C' : '#EBE5D6',
    borderWidth: 0,
    gap: 6,
  }
}

function SlopeForwardIcon({
  kind,
  color,
}: {
  kind: LieSlopeForward
  color: string
}) {
  const stroke = {
    stroke: color,
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
  }
  switch (kind) {
    case 'uphill':
      return (
        <Svg width={32} height={24} viewBox="0 0 32 24">
          <SvgLine x1={4} y1={18} x2={28} y2={6} {...stroke} />
          <Circle cx={6} cy={15} r={2} fill={color} />
        </Svg>
      )
    case 'level':
      return (
        <Svg width={32} height={24} viewBox="0 0 32 24">
          <SvgLine x1={4} y1={16} x2={28} y2={16} {...stroke} />
          <Circle cx={16} cy={12} r={2} fill={color} />
        </Svg>
      )
    case 'downhill':
      return (
        <Svg width={32} height={24} viewBox="0 0 32 24">
          <SvgLine x1={4} y1={6} x2={28} y2={18} {...stroke} />
          <Circle cx={26} cy={15} r={2} fill={color} />
        </Svg>
      )
  }
}

function SlopeSideIcon({
  kind,
  color,
}: {
  kind: LieSlopeSide
  color: string
}) {
  const stroke = {
    stroke: color,
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
  }
  if (kind === 'ball_above') {
    return (
      <Svg width={32} height={24} viewBox="0 0 32 24">
        <SvgLine x1={4} y1={18} x2={28} y2={18} {...stroke} />
        <Circle cx={16} cy={8} r={2} fill={color} />
      </Svg>
    )
  }
  return (
    <Svg width={32} height={24} viewBox="0 0 32 24">
      <SvgLine x1={4} y1={8} x2={28} y2={8} {...stroke} />
      <Circle cx={16} cy={18} r={2} fill={color} />
    </Svg>
  )
}

function gridButtonTextStyle(active: boolean) {
  return {
    color: active ? '#F2EEE5' : '#1C211C',
    fontSize: 12,
    fontWeight: (active ? '500' : '400') as '400' | '500',
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderColor: '#D9D2BF',
        paddingTop: 14,
        marginBottom: 18,
      }}
    >
      <Text style={{ ...KICKER, marginBottom: 12 }}>{title}</Text>
      {children}
    </View>
  )
}

interface ChipRowProps<T extends string> {
  value: T | undefined
  options: readonly T[]
  onChange: (v: T) => void
}

function ChipRow<T extends string>({ value, options, onChange }: ChipRowProps<T>) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {options.map((opt) => {
          const active = value === opt
          return (
            <Pressable
              key={opt}
              onPress={() => onChange(opt)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 2,
                backgroundColor: active ? '#1F3D2C' : '#EBE5D6',
              }}
            >
              <Text
                style={{
                  color: active ? '#F2EEE5' : '#1C211C',
                  fontSize: 12,
                  fontWeight: active ? '500' : '400',
                }}
              >
                {opt.replace(/_/g, ' ')}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </ScrollView>
  )
}
