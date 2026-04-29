import { useState } from 'react'
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
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
      <View className="flex-1 justify-end bg-black/40">
        <View className="rounded-t-2xl bg-white pb-6">
          <View className="flex-row items-center justify-between px-5 pt-4">
            <Text className="text-lg font-bold text-fairway-700">
              Shot #{shotNumber}
            </Text>
            <Pressable onPress={onSkip}>
              <Text className="text-sm text-gray-500">Skip all →</Text>
            </Pressable>
          </View>

          <ScrollView className="max-h-[70vh] px-5" contentContainerStyle={{ paddingTop: 12 }}>
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
              <View className="flex-row flex-wrap" style={{ gap: 4 }}>
                {SLOPE_GRID.map((key, i) => (
                  <View key={`${key}-${i}`} style={{ width: '32%' }}>
                    {key === 'spacer' ? null : (
                      <Pressable
                        onPress={() => set('lieSlope', key)}
                        className={
                          value.lieSlope === key
                            ? 'items-center rounded bg-fairway-500 py-2'
                            : 'items-center rounded border border-gray-200 py-2'
                        }
                      >
                        <Text
                          className={
                            value.lieSlope === key
                              ? 'text-xs font-semibold text-white'
                              : 'text-xs text-gray-700'
                          }
                        >
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
                    className="w-32 rounded border border-gray-200 px-2 py-2"
                  />
                </Section>

                <Section title="Putt result">
                  <View className="flex-row flex-wrap" style={{ gap: 4 }}>
                    {PUTT_GRID.map((key, i) => (
                      <View key={`${key}-${i}`} style={{ width: '32%' }}>
                        {key === 'spacer' ? null : (
                          <Pressable
                            onPress={() => set('puttResult', key)}
                            className={
                              value.puttResult === key
                                ? 'items-center rounded bg-fairway-500 py-2'
                                : 'items-center rounded border border-gray-200 py-2'
                            }
                          >
                            <Text
                              className={
                                value.puttResult === key
                                  ? 'text-xs font-semibold text-white'
                                  : 'text-xs text-gray-700'
                              }
                            >
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
                className="rounded border border-gray-200 px-2 py-2"
              />
            </Section>
          </ScrollView>

          <View className="flex-row gap-2 px-5 pt-3">
            <Pressable
              onPress={onClose}
              className="flex-1 items-center rounded border border-gray-200 py-3"
            >
              <Text className="text-sm text-gray-700">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => onSave(value)}
              className="flex-1 items-center rounded bg-fairway-500 py-3"
            >
              <Text className="text-sm font-semibold text-white">Save + next →</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-4">
      <Text className="mb-1 text-xs font-semibold uppercase text-gray-500">{title}</Text>
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
      <View className="flex-row" style={{ gap: 4 }}>
        {options.map((opt) => (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            className={
              value === opt
                ? 'rounded-full bg-fairway-500 px-3 py-1.5'
                : 'rounded-full border border-gray-200 px-3 py-1.5'
            }
          >
            <Text
              className={
                value === opt ? 'text-xs font-semibold text-white' : 'text-xs text-gray-700'
              }
            >
              {opt.replace(/_/g, ' ')}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  )
}
