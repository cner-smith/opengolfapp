import { useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import Svg, { Circle, Line as SvgLine } from 'react-native-svg'
import {
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  DEFAULT_BAG,
  LIE_TYPES,
  SHOT_RESULTS,
  formatClubLabel,
  type BreakDirectionHorizontal,
  type BreakDirectionVertical,
  type Club,
  type GreenSpeed,
  type LieSlopeForward,
  type LieSlopeSide,
  type LieType,
  type ShotResult,
} from '@oga/core'
import { useUserBag } from '../../hooks/useUserBag'
import { TYPE } from '../../lib/typography'
import { PuttingSheet } from './PuttingSheet'
import { useSwipeToDismiss } from '../ui/useSwipeToDismiss'

export interface ShotLoggerValue {
  club?: Club
  lieType?: LieType
  lieSlopeForward?: LieSlopeForward
  lieSlopeSide?: LieSlopeSide
  shotResult?: ShotResult
  puttMade?: boolean
  puttDistanceResult?: 'short' | 'long'
  puttDirectionResult?: 'left' | 'right'
  puttDistanceFt?: number
  puttSlopePct?: number
  greenSpeed?: GreenSpeed
  breakDirectionVertical?: BreakDirectionVertical
  breakDirectionHorizontal?: BreakDirectionHorizontal
  aimOffsetInches?: number
  notes?: string
}

interface ShotLoggerProps {
  visible: boolean
  shotNumber: number
  isPutt: boolean
  /** Seed putt distance from GPS (ball→pin) when starting in putting mode. */
  puttDistanceFt?: number
  initial?: ShotLoggerValue
  /** True while a save is in flight. Disables the Save button so a fast
   *  double-tap can't enqueue two pending_shots rows for the same shot
   *  number. The ref-based gate in useShotActions is the durable
   *  backstop; this just gives the button a visible disabled state. */
  saving?: boolean
  onSave: (value: ShotLoggerValue) => void
  onSkip: () => void
  onClose: () => void
}

const LIE_TYPE_OPTIONS = LIE_TYPES.map((l) => ({ value: l, label: l }))
const SHOT_RESULT_OPTIONS = SHOT_RESULTS.map((r) => ({
  value: r,
  label: r.replace(/_/g, ' '),
}))

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
  puttDistanceFt,
  initial,
  saving = false,
  onSave,
  onSkip,
  onClose,
}: ShotLoggerProps) {
  const seededLieType: LieType | undefined = isPutt ? 'green' : initial?.lieType
  const [value, setValue] = useState<ShotLoggerValue>({
    ...initial,
    lieType: seededLieType ?? initial?.lieType,
    club: isPutt ? 'putter' : initial?.club,
  })
  const set = <K extends keyof ShotLoggerValue>(key: K, v: ShotLoggerValue[K]) =>
    setValue((prev) => ({ ...prev, [key]: prev[key] === v ? undefined : v }))

  // Source the club picker from the user's bag. Fall back to DEFAULT_BAG
  // while the bag is loading or if the user trimmed it to nothing — never
  // show an empty picker. seedIfEmpty=true ensures a brand-new user
  // (e.g. one who skipped the optional onboarding bag step, issue #152)
  // ends up with real user_clubs rows so inferShot's userBag path runs.
  const { bag } = useUserBag({ seedIfEmpty: true })
  const clubOptions = useMemo<{ value: string; label: string }[]>(() => {
    const source = bag.length > 0 ? bag : DEFAULT_BAG
    const typeCounts = new Map<string, number>()
    for (const c of source) {
      typeCounts.set(c.club_type, (typeCounts.get(c.club_type) ?? 0) + 1)
    }
    return source.map((c) => ({
      value: c.club_type,
      label: formatClubLabel(c, {
        hasDuplicateType: (typeCounts.get(c.club_type) ?? 0) > 1,
      }),
    }))
  }, [bag])

  const insets = useSafeAreaInsets()
  const isOnGreen = value.lieType === 'green'
  // Swipe-dismiss for the non-putt card; the on-green branch delegates to
  // PuttingSheet, which owns its own swipe-dismiss.
  const { pan, cardStyle } = useSwipeToDismiss(onClose, visible)

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      {/* RN <Modal> opens a separate native window the app-root
          GestureHandlerRootView doesn't reach — wrap the contents in
          their own root so the on-green GreenDiagram aim-handle pan
          gesture works (mirrors HoleModals; #496). */}
      <GestureHandlerRootView style={{ flex: 1 }}>
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(28,33,28,0.55)',
        }}
      >
        {isOnGreen ? (
          <PuttingSheet
            shotNumber={shotNumber}
            initialDistanceFt={puttDistanceFt}
            initial={{
              puttMade: value.puttMade,
              puttDistanceResult: value.puttDistanceResult,
              puttDirectionResult: value.puttDirectionResult,
              puttDistanceFt: value.puttDistanceFt,
              puttSlopePct: value.puttSlopePct,
              greenSpeed: value.greenSpeed,
              breakDirectionVertical: value.breakDirectionVertical,
              breakDirectionHorizontal: value.breakDirectionHorizontal,
              aimOffsetInches: value.aimOffsetInches,
              notes: value.notes,
            }}
            onSave={(p) =>
              onSave({
                club: 'putter',
                lieType: 'green',
                puttMade: p.puttMade,
                puttDistanceResult: p.puttDistanceResult,
                puttDirectionResult: p.puttDirectionResult,
                puttDistanceFt: p.puttDistanceFt,
                puttSlopePct: p.puttSlopePct,
                greenSpeed: p.greenSpeed,
                breakDirectionVertical: p.breakDirectionVertical,
                breakDirectionHorizontal: p.breakDirectionHorizontal,
                aimOffsetInches: p.aimOffsetInches,
                notes: p.notes,
              })
            }
            onClose={onClose}
            onChangeLie={(lie) =>
              setValue((prev) => ({
                ...prev,
                lieType: lie,
                // Drop putter when switching off the green — the player
                // is logging a chip / bunker shot now and the club
                // chip row will let them pick the right club.
                club: prev.club === 'putter' ? undefined : prev.club,
              }))
            }
          />
        ) : (
        <Animated.View
          style={[
            {
              backgroundColor: '#FBF8F1',
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
              paddingHorizontal: 18,
              paddingTop: 10,
              paddingBottom: insets.bottom + 28,
            },
            cardStyle,
          ]}
        >
          <GestureDetector gesture={pan}>
            <View style={{ alignItems: 'center', paddingBottom: 14 }}>
              <View
                style={{
                  width: 32,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: '#D9D2BF',
                }}
              />
            </View>
          </GestureDetector>
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
              <Text style={[TYPE.kicker, { ...KICKER, marginBottom: 4 }]}>
                Shot {shotNumber}
              </Text>
              <Text
                style={[
                  TYPE.serif,
                  {
                    color: '#1C211C',
                    fontSize: 22,
                  },
                ]}
              >
                Log it.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip all logging for this shot"
              onPress={onSkip}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ padding: 6 }}
            >
              <Text
                style={[
                  TYPE.kicker,
                  {
                    ...KICKER,
                    color: '#A66A1F',
                    fontSize: 10,
                  },
                ]}
              >
                Skip all →
              </Text>
            </Pressable>
          </View>

          <ScrollView
            style={{ maxHeight: '75%' }}
            contentContainerStyle={{ paddingTop: 14 }}
          >
            <Section title="Club">
              <ChipRow
                value={value.club}
                options={clubOptions}
                onChange={(v) => set('club', v as Club | undefined)}
              />
            </Section>

            <Section title="Lie type">
              <ChipRow
                value={value.lieType}
                options={LIE_TYPE_OPTIONS}
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
                        <Text style={[TYPE.body, gridButtonTextStyle(active)]}>
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
                        <Text style={[TYPE.body, gridButtonTextStyle(active)]}>
                          {SIDE_LABEL[key]}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            </Section>

            {/* Putt UI lives in PuttingSheet (rendered when lie_type=green).
                The standard sheet only handles non-putt shots. */}
            <Section title="Shot result">
              <ChipRow
                value={value.shotResult}
                options={SHOT_RESULT_OPTIONS}
                onChange={(v) => set('shotResult', v)}
              />
            </Section>

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
              accessibilityRole="button"
              accessibilityLabel="Cancel logging shot"
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
                style={[
                  TYPE.bodyBold,
                  {
                    color: '#1F3D2C',
                    fontSize: 14,
                    fontWeight: '600',
                    letterSpacing: 0.3,
                  },
                ]}
              >
                Cancel
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save shot and continue"
              accessibilityState={{ disabled: saving }}
              disabled={saving}
              onPress={() => onSave(value)}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 14,
                borderRadius: 2,
                backgroundColor: '#1F3D2C',
                opacity: saving ? 0.6 : 1,
              }}
            >
              <Text
                style={[
                  TYPE.bodyBold,
                  {
                    color: '#F2EEE5',
                    fontSize: 14,
                    fontWeight: '600',
                    letterSpacing: 0.3,
                  },
                ]}
              >
                {saving ? 'Saving…' : 'Save + next →'}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
        )}
      </View>
      </GestureHandlerRootView>
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
      <Text style={[TYPE.kicker, { ...KICKER, marginBottom: 12 }]}>{title}</Text>
      {children}
    </View>
  )
}

interface ChipRowProps<T extends string> {
  value: T | undefined
  options: readonly { value: T; label: string }[]
  onChange: (v: T) => void
}

function ChipRow<T extends string>({ value, options, onChange }: ChipRowProps<T>) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {options.map(({ value: optValue, label }) => {
          const active = value === optValue
          return (
            <Pressable
              key={optValue}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
              onPress={() => onChange(optValue)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 2,
                backgroundColor: active ? '#1F3D2C' : '#EBE5D6',
              }}
            >
              <Text
                style={[
                  TYPE.body,
                  {
                    color: active ? '#F2EEE5' : '#1C211C',
                    fontSize: 12,
                    fontWeight: active ? '500' : '400',
                  },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </ScrollView>
  )
}
