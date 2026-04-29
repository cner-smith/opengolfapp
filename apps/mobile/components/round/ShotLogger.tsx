import { useState } from 'react'
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import Svg, { Circle, Line as SvgLine } from 'react-native-svg'
import {
  CLUBS,
  LIE_TYPES,
  SHOT_RESULTS,
  type Club,
  type LieSlope,
  type LieType,
  type ShotResult,
} from '@oga/core'

type PuttResult = 'made' | 'short' | 'long' | 'missed_left' | 'missed_right'

export interface ShotLoggerValue {
  club?: Club
  lieType?: LieType
  lieSlope?: LieSlope
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

type SlopeKey = LieSlope | 'spacer'
type PuttKey = PuttResult | 'spacer'

const SLOPE_GRID: SlopeKey[] = [
  'uphill',
  'level',
  'downhill',
  'ball_above',
  'spacer',
  'ball_below',
]

const PUTT_GRID: PuttKey[] = [
  'made',
  'short',
  'long',
  'missed_left',
  'missed_right',
  'spacer',
]

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
          backgroundColor: 'rgba(17,17,17,0.4)',
        }}
      >
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            paddingHorizontal: 14,
            paddingTop: 8,
            paddingBottom: 24,
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 32,
              height: 4,
              borderRadius: 2,
              backgroundColor: '#E0E0DA',
              marginBottom: 12,
            }}
          />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 4,
            }}
          >
            <Text style={{ color: '#111111', fontSize: 16, fontWeight: '500' }}>
              Shot #{shotNumber}
            </Text>
            <Pressable onPress={onSkip}>
              <Text style={{ color: '#AAAAAA', fontSize: 11 }}>Skip all →</Text>
            </Pressable>
          </View>

          <ScrollView
            style={{ maxHeight: 480 }}
            contentContainerStyle={{ paddingTop: 14, paddingHorizontal: 4 }}
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
                accessibilityRole="radiogroup"
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 5,
                  maxWidth: 320,
                }}
              >
                {SLOPE_GRID.map((key, i) => (
                  <View
                    key={`${key}-${i}`}
                    style={{ width: '32%', maxWidth: 102 }}
                  >
                    {key === 'spacer' ? null : (
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ checked: value.lieSlope === key }}
                        onPress={() =>
                          setValue((prev) => ({ ...prev, lieSlope: key }))
                        }
                        style={gridButtonStyle(value.lieSlope === key)}
                      >
                        <SlopeIcon
                          kind={key}
                          color={value.lieSlope === key ? '#0F6E56' : '#111111'}
                        />
                        <Text style={gridButtonTextStyle(value.lieSlope === key)}>
                          {key.replace('_', ' ')}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                ))}
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
                      gap: 5,
                      maxWidth: 320,
                    }}
                  >
                    {PUTT_GRID.map((key, i) => (
                      <View
                        key={`${key}-${i}`}
                        style={{ width: '32%', maxWidth: 102 }}
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

          <View style={{ flexDirection: 'row', gap: 8, paddingTop: 8 }}>
            <Pressable
              onPress={onClose}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 13,
                borderRadius: 10,
                borderWidth: 0.5,
                borderColor: '#E4E4E0',
                backgroundColor: '#FFFFFF',
              }}
            >
              <Text style={{ color: '#111111', fontSize: 13, fontWeight: '500' }}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onSave(value)}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 13,
                borderRadius: 10,
                backgroundColor: '#111111',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '500' }}>
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
  backgroundColor: '#F9F9F6',
  borderWidth: 0.5,
  borderColor: '#E4E4E0',
  borderRadius: 7,
  paddingHorizontal: 10,
  paddingVertical: 8,
  fontSize: 13,
  color: '#111111',
  width: 132,
} as const

function gridButtonStyle(active: boolean) {
  return {
    alignItems: 'center' as const,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 7,
    backgroundColor: active ? '#E1F5EE' : '#F4F4F0',
    borderWidth: 0.5,
    borderColor: active ? '#1D9E75' : '#E0E0DA',
    gap: 4,
  }
}

function SlopeIcon({ kind, color }: { kind: LieSlope; color: string }) {
  switch (kind) {
    case 'uphill':
      return (
        <Svg width={32} height={24} viewBox="0 0 32 24">
          <SvgLine
            x1={4}
            y1={18}
            x2={28}
            y2={8}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <Circle cx={26} cy={6} r={2} fill={color} />
        </Svg>
      )
    case 'level':
      return (
        <Svg width={32} height={24} viewBox="0 0 32 24">
          <SvgLine
            x1={4}
            y1={14}
            x2={28}
            y2={14}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <Circle cx={16} cy={11} r={2} fill={color} />
        </Svg>
      )
    case 'downhill':
      return (
        <Svg width={32} height={24} viewBox="0 0 32 24">
          <SvgLine
            x1={4}
            y1={8}
            x2={28}
            y2={18}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <Circle cx={26} cy={20} r={2} fill={color} />
        </Svg>
      )
    case 'ball_above':
      return (
        <Svg width={32} height={24} viewBox="0 0 32 24">
          <SvgLine
            x1={4}
            y1={22}
            x2={28}
            y2={4}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <Circle cx={24} cy={4} r={2} fill={color} />
          <SvgLine
            x1={6}
            y1={22}
            x2={10}
            y2={22}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
      )
    case 'ball_below':
      return (
        <Svg width={32} height={24} viewBox="0 0 32 24">
          <SvgLine
            x1={4}
            y1={4}
            x2={28}
            y2={22}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <Circle cx={24} cy={22} r={2} fill={color} />
          <SvgLine
            x1={6}
            y1={4}
            x2={10}
            y2={4}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
      )
  }
}

function gridButtonTextStyle(active: boolean) {
  return {
    color: active ? '#0F6E56' : '#111111',
    fontSize: 11,
    fontWeight: (active ? '500' : '400') as '400' | '500',
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text
        style={{
          color: '#888880',
          fontSize: 11,
          fontWeight: '500',
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        {title}
      </Text>
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
                paddingVertical: 7,
                borderRadius: 7,
                backgroundColor: active ? '#E1F5EE' : '#F4F4F0',
                borderWidth: 0.5,
                borderColor: active ? '#1D9E75' : '#E0E0DA',
              }}
            >
              <Text
                style={{
                  color: active ? '#0F6E56' : '#111111',
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
