import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import {
  FEET_TO_CM,
  combinedBreakDirection,
  horizontalBreakFromAim,
  tourMakePercent,
  type BreakDirectionHorizontal,
  type BreakDirectionVertical,
  type GreenSpeed,
  type LieType,
  type PuttDirectionResult,
  type PuttDistanceResult,
} from '@oga/core'
import { GreenDiagram } from './GreenDiagram'
import { useUnits } from '../../hooks/useUnits'
import { TYPE } from '../../lib/typography'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import { useSwipeToDismiss } from '../ui/useSwipeToDismiss'

// Animated so the swipe-to-dismiss translateY drives the whole card. A
// transform is post-layout, so it does NOT affect the ScrollView's absolute
// maxHeight — the #643 scroll fix stays intact.
const AnimatedKeyboardAvoidingView =
  Animated.createAnimatedComponent(KeyboardAvoidingView)

export interface PuttingValue {
  puttDistanceFt?: number
  puttMade?: boolean
  puttDistanceResult?: PuttDistanceResult
  puttDirectionResult?: PuttDirectionResult
  breakDirectionVertical?: BreakDirectionVertical
  breakDirectionHorizontal?: BreakDirectionHorizontal
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
  /**
   * Optional escape from putting mode without closing the sheet. When
   * provided, renders a "Not a putt?" link that hands the lie back to
   * the parent so it can swap to the regular shot logger UI. Used by
   * ShotLogger when its internal `lieType === 'green'` branch wants to
   * let the player undo an incorrect on-the-green prompt response.
   */
  onChangeLie?: (lie: LieType) => void
}

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

const DISTANCE_OPTIONS: { value: PuttDistanceResult; label: string }[] = [
  { value: 'short', label: 'Short' },
  { value: 'long', label: 'Long' },
]
const DIRECTION_OPTIONS: { value: PuttDirectionResult; label: string }[] = [
  { value: 'left', label: 'Missed left' },
  { value: 'right', label: 'Missed right' },
]

const BREAK_SLOPE_OPTIONS: { value: BreakDirectionVertical; label: string }[] = [
  { value: 'uphill', label: 'Uphill' },
  { value: 'flat', label: 'Flat' },
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
  onChangeLie,
}: PuttingSheetProps) {
  const { unit } = useUnits()
  const isMetric = unit === 'meters'
  const inputUnit = isMetric ? 'cm' : 'ft'
  // Storage stays in feet so SG baselines line up; the input field
  // echoes the unit on the player's profile and converts on the way in
  // and out. The previous label said "m" while the input still parsed
  // feet — a metric player typing "5" stored 5 ft (1.5 m), not 5 m.
  const feetToInput = (feet: number): number =>
    isMetric ? Math.round(feet * FEET_TO_CM) : Math.round(feet)
  const inputToFeet = (n: number): number =>
    isMetric ? n / FEET_TO_CM : n
  const [value, setValue] = useState<PuttingValue>({
    puttDistanceFt: initial?.puttDistanceFt ?? initialDistanceFt ?? 0,
    puttMade: initial?.puttMade,
    puttDistanceResult: initial?.puttDistanceResult,
    puttDirectionResult: initial?.puttDirectionResult,
    breakDirectionVertical: initial?.breakDirectionVertical,
    breakDirectionHorizontal: initial?.breakDirectionHorizontal,
    puttSlopePct: initial?.puttSlopePct ?? 0,
    greenSpeed: initial?.greenSpeed,
    aimOffsetInches: initial?.aimOffsetInches ?? 0,
    notes: initial?.notes,
  })
  const [distanceText, setDistanceText] = useState(
    String(feetToInput(initial?.puttDistanceFt ?? initialDistanceFt ?? 0)),
  )
  // Opt-in read (#791 step 4). The green leads with distance + make-% + the
  // Made/Missed action; the read (aim/break/speed) and miss detail stay
  // collapsed behind "Set my read" until the player asks — pace of play first.
  // Anything skipped is still fillable in the end-of-hole review.
  const [readOpen, setReadOpen] = useState(false)

  function commitDistance(text: string) {
    setDistanceText(text)
    const n = parseFloat(text)
    setValue((v) => ({
      ...v,
      puttDistanceFt: Number.isFinite(n) ? inputToFeet(n) : undefined,
    }))
  }

  function set<K extends keyof PuttingValue>(k: K, v: PuttingValue[K]) {
    setValue((prev) => ({ ...prev, [k]: v }))
  }

  // Toggle the made flag exclusively — selecting 'made' clears the
  // distance / direction misses, and tapping any miss clears made.
  function setMade(made: boolean) {
    setValue((prev) => ({
      ...prev,
      puttMade: made,
      puttDistanceResult: made ? undefined : prev.puttDistanceResult,
      puttDirectionResult: made ? undefined : prev.puttDirectionResult,
    }))
  }

  function setDistanceResult(v: PuttDistanceResult) {
    setValue((prev) => ({
      ...prev,
      puttMade: false,
      puttDistanceResult: prev.puttDistanceResult === v ? undefined : v,
    }))
  }

  function setDirectionResult(v: PuttDirectionResult) {
    setValue((prev) => ({
      ...prev,
      puttMade: false,
      puttDirectionResult: prev.puttDirectionResult === v ? undefined : v,
    }))
  }

  function setBreakSlope(v: BreakDirectionVertical) {
    setValue((prev) => ({
      ...prev,
      breakDirectionVertical: prev.breakDirectionVertical === v ? undefined : v,
    }))
  }

  function commit(makeOverride?: boolean) {
    const made =
      makeOverride === true ? true : makeOverride === false ? false : value.puttMade
    onSave({
      ...value,
      puttMade: made,
      puttDistanceResult: made ? undefined : value.puttDistanceResult,
      puttDirectionResult: made ? undefined : value.puttDirectionResult,
    })
  }

  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const { pan, cardStyle } = useSwipeToDismiss(onClose)
  const distance = value.puttDistanceFt ?? 0
  // Make-% readout (#791 step 4). Tour make rate from this distance, shown the
  // moment the ball is marked. Only meaningful with a real distance (a pin was
  // known) — hidden at 0 ft. The player's own "You" rate blends in later.
  const tourPct = distance > 0 ? tourMakePercent(distance) : null

  return (
    <AnimatedKeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[
        {
          backgroundColor: '#FBF8F1',
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          paddingHorizontal: 18,
          paddingTop: 10,
          paddingBottom: insets.bottom + 24,
          maxHeight: '90%',
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
          <Text style={[TYPE.kicker, { ...KICKER, marginBottom: 4 }]}>Putt {shotNumber}</Text>
          <Text
            style={[
              TYPE.serif,
              {
                color: '#1C211C',
                fontSize: 22,
              },
            ]}
          >
            On the green.
          </Text>
          {onChangeLie && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Not a putt — switch to chip or bunker shot"
              onPress={() => onChangeLie('rough')}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={{ marginTop: 4, paddingVertical: 12 }}
            >
              <Text
                style={[
                  TYPE.body,
                  {
                    color: '#A66A1F',
                    fontSize: 12,
                    fontWeight: '500',
                    letterSpacing: 0.2,
                  },
                ]}
              >
                Not a putt? Chip / bunker →
              </Text>
            </Pressable>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close putting sheet"
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ padding: 12 }}
        >
          <Text style={[TYPE.kicker, { ...KICKER, color: '#8A8B7E' }]}>Close</Text>
        </Pressable>
      </View>

      {/* An ABSOLUTE maxHeight (not flexShrink deriving height from the
          '90%' sheet) gives the ScrollView a scroll range that resolves in
          the first layout pass — independent of the modal's slide transform
          and the parent's percentage height. Previously the derived height
          settled to content-height on first paint (nothing to scroll) and
          only unlocked when a state change (toggling "Holed it") forced a
          re-measure; app foreground re-measures made it recur (#643).
          0.72·screen sits well under the 90% sheet so the two never fight. */}
      <ScrollView
        style={{ maxHeight: windowHeight * 0.72, flexShrink: 1 }}
        contentContainerStyle={{ paddingTop: 14, paddingBottom: 8 }}
      >
        {tourPct != null && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 10,
              marginBottom: 4,
              borderRadius: 8,
              backgroundColor: '#EBE5D6',
            }}
          >
            <Text style={[TYPE.serifUpright, { color: '#1C211C', fontSize: 22, fontVariant: ['tabular-nums'] }]}>
              {Math.round(distance)} ft
            </Text>
            <Text style={[TYPE.body, { color: '#5C6356', fontSize: 13 }]}>
              · tour makes{' '}
              <Text style={[TYPE.bodyBold, { color: '#1F3D2C', fontWeight: '600' }]}>
                {tourPct}%
              </Text>
            </Text>
          </View>
        )}

        {!readOpen && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Set my read — aim, break, speed, and miss detail"
            onPress={() => setReadOpen(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginTop: 6, paddingVertical: 12, alignItems: 'center' }}
          >
            <Text
              style={[
                TYPE.bodyBold,
                { color: '#1F3D2C', fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },
              ]}
            >
              Set my read →
            </Text>
          </Pressable>
        )}

        {readOpen && (
          <>
        <GreenDiagram
          distanceFt={distance}
          aimOffsetInches={value.aimOffsetInches ?? 0}
          breakDirection={
            combinedBreakDirection({
              vertical: value.breakDirectionVertical,
              horizontal: value.breakDirectionHorizontal,
            }) ?? 'straight'
          }
          onAimChange={(n) =>
            setValue((prev) => ({
              ...prev,
              aimOffsetInches: n,
              breakDirectionHorizontal: horizontalBreakFromAim(n),
            }))
          }
        />

        <View style={{ marginTop: 14 }}>
          <Text style={[TYPE.kicker, { ...KICKER, marginBottom: 6 }]}>
            Distance override ({inputUnit})
          </Text>
          <TextInput
            keyboardType="numeric"
            value={distanceText}
            onChangeText={commitDistance}
            style={inputStyle}
          />
        </View>

        <Section title="Made?">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <ResultCell
              label="Holed it"
              made
              active={value.puttMade === true}
              onPress={() => setMade(value.puttMade !== true)}
            />
            <View style={{ flex: 2 }} />
          </View>
        </Section>

        <Section title="Distance">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {DISTANCE_OPTIONS.map((d) => (
              <ResultCell
                key={d.value}
                label={d.label}
                made={false}
                active={
                  !value.puttMade && value.puttDistanceResult === d.value
                }
                disabled={value.puttMade === true}
                onPress={() => setDistanceResult(d.value)}
              />
            ))}
            <View style={{ flex: 1 }} />
          </View>
          <Text style={[TYPE.kicker, { ...KICKER, marginTop: 8, color: '#8A8B7E' }]}>
            Tap again to clear · leave blank if pace was right
          </Text>
        </Section>

        <Section title="Direction">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {DIRECTION_OPTIONS.map((d) => (
              <ResultCell
                key={d.value}
                label={d.label}
                made={false}
                active={
                  !value.puttMade && value.puttDirectionResult === d.value
                }
                disabled={value.puttMade === true}
                onPress={() => setDirectionResult(d.value)}
              />
            ))}
          </View>
          <Text style={[TYPE.kicker, { ...KICKER, marginTop: 8, color: '#8A8B7E' }]}>
            Tap again to clear · leave blank if line was good
          </Text>
        </Section>

        <Section title="Break (slope)">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {BREAK_SLOPE_OPTIONS.map((b) => (
              <Chip
                key={b.value}
                label={b.label}
                active={value.breakDirectionVertical === b.value}
                onPress={() => setBreakSlope(b.value)}
              />
            ))}
          </View>
          <Text style={[TYPE.kicker, { ...KICKER, marginTop: 8, color: '#8A8B7E' }]}>
            Tap again to clear · leave blank if green was level
          </Text>
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
          </>
        )}

        <View style={{ marginTop: 22 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save putt as missed"
            onPress={() => commit(false)}
            style={{
              borderWidth: 1,
              borderColor: '#1F3D2C',
              borderRadius: 2,
              paddingVertical: 14,
              alignItems: 'center',
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
              Missed →
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save putt as holed"
            onPress={() => commit(true)}
            style={{
              backgroundColor: '#1F3D2C',
              borderRadius: 2,
              paddingVertical: 18,
              alignItems: 'center',
              marginTop: 10,
            }}
          >
            <Text
              style={[
                TYPE.bodyBold,
                {
                  color: '#F2EEE5',
                  fontSize: 16,
                  fontWeight: '700',
                  letterSpacing: 0.4,
                },
              ]}
            >
              Holed it →
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </AnimatedKeyboardAvoidingView>
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
      <Text style={[TYPE.kicker, { ...KICKER, marginBottom: 10 }]}>{title}</Text>
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
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        backgroundColor: active ? '#1F3D2C' : '#EBE5D6',
        borderRadius: 2,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <Text
        style={[
          TYPE.body,
          {
            color: active ? '#F2EEE5' : '#1C211C',
            fontSize: 12,
            fontWeight: active ? '600' : '400',
          },
        ]}
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
  disabled,
  onPress,
}: {
  label: string
  made: boolean
  active: boolean
  disabled?: boolean
  onPress: () => void
}) {
  // "Made" cell uses accent fill when active. Misses are surface with
  // caddie-line border; active state inverts to accent fill.
  const fill = (made && active) || (!made && active) ? '#1F3D2C' : '#FBF8F1'
  const fg = active ? '#F2EEE5' : '#1C211C'
  const border = active ? '#1F3D2C' : '#D9D2BF'
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      onPress={onPress}
      disabled={disabled}
      style={{
        flex: 1,
        backgroundColor: fill,
        borderWidth: 1,
        borderColor: border,
        borderRadius: 2,
        paddingVertical: 16,
        alignItems: 'center',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text
        style={[
          TYPE.body,
          {
            color: fg,
            fontSize: 14,
            fontWeight: active ? '600' : '500',
            letterSpacing: 0.3,
          },
        ]}
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
