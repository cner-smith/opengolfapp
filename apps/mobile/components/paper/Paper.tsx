import { useEffect, useState, type ReactNode } from 'react'
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type Insets,
  type StyleProp,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native'
import Animated, { Easing, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { TYPE } from '../../lib/typography'
import { LEDGE, P, R } from './tokens'

const GRAIN = require('../../assets/grain.png')

// Opaque paper (chrome / raised) with the 128 px grain tile. Never on glass:
// over imagery the grain reads as dirt (§1).
export function PaperSurface({
  fill = P.chrome,
  style,
  children,
  ...rest
}: ViewProps & { fill?: string }) {
  return (
    <View {...rest} style={[{ backgroundColor: fill }, style]}>
      <Image
        source={GRAIN}
        resizeMode="repeat"
        style={[StyleSheet.absoluteFill, { width: undefined, height: undefined }]}
      />
      {children}
    </View>
  )
}

// Hard offset shadow (no blur) for map tags, the ⋮ menu and dialogs (§0.3).
// Android `elevation` blurs, so it's a flat sibling block behind the child.
export function HardShadow({
  dx = 2,
  dy = 2,
  style,
  children,
}: {
  dx?: number
  dy?: number
  style?: StyleProp<ViewStyle>
  children: ReactNode
}) {
  return (
    <View style={style}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: dx,
          top: dy,
          right: -dx,
          bottom: -dy,
          backgroundColor: P.tagShadow,
          borderRadius: R,
        }}
      />
      {children}
    </View>
  )
}

type Tone = 'raised' | 'primary' | 'danger'

const TONES: Record<Tone, { face: string; pressed: string; edge: string; shade: string }> = {
  raised: { face: P.raised, pressed: P.well, edge: P.ink, shade: P.shade },
  primary: { face: P.forest, pressed: P.forestPressed, edge: P.forestEdge, shade: 'rgba(0,0,0,.35)' },
  danger: { face: P.neg, pressed: '#8E3223', edge: P.negEdge, shade: 'rgba(0,0,0,.35)' },
}

export interface KeyProps {
  onPress?: () => void
  accessibilityLabel: string
  tone?: Tone
  /** Border + ledge colour override (the OB callout's brick edge). */
  edge?: string
  borderWidth?: number
  /** Toggle held down: well face, 2 dp rim, sitting on its ledge. */
  latched?: boolean
  disabled?: boolean
  hitSlop?: number | Insets
  /** Fill a row-stretched outer box (a bottom row of keys of unequal text
   *  height). Opt-in: a growing face inside a ScrollView column measured
   *  to hundreds of dp tall. */
  stretch?: boolean
  style?: StyleProp<ViewStyle>
  faceStyle?: StyleProp<ViewStyle>
  children: ReactNode
}

// Letterpress key (§1 "RN recipe (ledge)"): a face standing on a hard 3 dp
// ledge; pressing sinks the face onto it. The ledge is a separate block under
// the face so the key's layout box never changes while it moves.
export function Key({
  onPress,
  accessibilityLabel,
  tone = 'raised',
  edge,
  borderWidth = 1,
  latched = false,
  disabled = false,
  hitSlop,
  stretch = false,
  style,
  faceStyle,
  children,
}: KeyProps) {
  const [pressed, setPressed] = useState(false)
  const t = TONES[tone]
  const down = pressed || latched || disabled
  const edgeColor = disabled ? P.ink35 : edge ?? t.edge
  // Motion (§15): press-in sinks 3 dp in 40 ms (out-quad), release rises in
  // 110 ms (out-cubic); the face colour swaps at once. A latch sinks in
  // 120 ms (out-cubic) and darkens over 75 ms; unlatching rises in 90 ms.
  const sink = useSharedValue(latched || disabled ? 1 : 0)
  const tint = useSharedValue(latched ? 1 : 0)
  useEffect(() => {
    if (disabled) {
      sink.value = 1
      return
    }
    sink.value = latched
      ? withTiming(1, { duration: 120, easing: Easing.out(Easing.cubic) })
      : withTiming(0, { duration: 90, easing: Easing.in(Easing.quad) })
    tint.value = withTiming(latched ? 1 : 0, { duration: 75 })
  }, [latched, disabled, sink, tint])
  const faceMotion = useAnimatedStyle(() => ({
    transform: [{ translateY: sink.value * LEDGE }],
    backgroundColor: disabled ? P.chrome : interpolateColor(tint.value, [0, 1], [t.face, t.pressed]),
  }))
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected: latched }}
      disabled={disabled || !onPress}
      onPress={onPress}
      onPressIn={() => {
        setPressed(true)
        tint.value = 1
        sink.value = withTiming(1, { duration: 40, easing: Easing.out(Easing.quad) })
      }}
      onPressOut={() => {
        setPressed(false)
        if (latched) return
        tint.value = 0
        sink.value = withTiming(0, { duration: 110, easing: Easing.out(Easing.cubic) })
      }}
      hitSlop={hitSlop}
      style={[{ paddingBottom: LEDGE }, style]}
    >
      {!disabled && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            top: LEDGE,
            backgroundColor: edgeColor,
            borderRadius: R,
          }}
        />
      )}
      <Animated.View
        style={[
          {
            flexGrow: stretch ? 1 : 0,
            borderRadius: R,
            borderWidth: latched ? 2 : borderWidth,
            borderColor: edgeColor,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          },
          faceStyle,
          faceMotion,
        ]}
      >
        {down && !disabled && (
          <View
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: t.shade }}
          />
        )}
        {children}
      </Animated.View>
    </Pressable>
  )
}

// Key label in the right ink for the key's state.
export function KeyText({
  children,
  tone = 'raised',
  bold,
  disabled,
  size = 14,
  style,
  numberOfLines,
}: {
  children: ReactNode
  tone?: Tone
  bold?: boolean
  disabled?: boolean
  size?: number
  style?: StyleProp<TextStyle>
  numberOfLines?: number
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        bold ? TYPE.bodyBold : TYPE.body,
        {
          fontSize: size,
          lineHeight: Math.round(size * 1.15),
          textAlign: 'center',
          color: disabled ? P.ink35 : tone === 'raised' ? P.ink : P.raised,
        },
        style,
      ]}
    >
      {children}
    </Text>
  )
}

export interface RockerOption<T extends string> {
  value: T
  label: string
  /** Optional glyph drawn above the label. */
  icon?: (active: boolean) => ReactNode
  accessibilityLabel?: string
  /** A half that can't be chosen yet (dimmed, no ledge). */
  disabled?: boolean
}

// One object, several halves (§5): inactive halves stand proud on an inner
// 3 dp ledge, the active half is pressed in. `clearable` lets a second tap on
// the active half clear it (every picker axis is nullable, §19.9).
export function Rocker<T extends string>({
  options,
  value,
  onChange,
  clearable = false,
  height = 44,
  fontSize = 14,
  iconBeside = false,
  style,
}: {
  options: RockerOption<T>[]
  value: T | null
  onChange: (v: T | null) => void
  clearable?: boolean
  height?: number
  fontSize?: number
  /** Glyph left of the label instead of above it. */
  iconBeside?: boolean
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          borderWidth: 1,
          borderColor: P.ink,
          borderRadius: R,
          overflow: 'hidden',
          backgroundColor: P.raised,
        },
        style,
      ]}
    >
      {options.map((o, i) => {
        const on = o.value === value
        const stacked = o.icon && !iconBeside
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityLabel={o.accessibilityLabel ?? o.label}
            accessibilityState={{ selected: on, disabled: !!o.disabled }}
            disabled={o.disabled}
            onPress={() => onChange(on ? (clearable ? null : o.value) : o.value)}
            style={{
              flex: 1,
              minHeight: height,
              paddingHorizontal: 2,
              paddingTop: stacked ? 3 : 0,
              paddingBottom: stacked ? 5 : 0,
              flexDirection: iconBeside ? 'row' : 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: iconBeside ? 5 : 1,
              backgroundColor: on ? P.well : o.disabled ? P.chrome : P.raised,
              borderLeftWidth: i === 0 ? 0 : 1,
              borderLeftColor: P.ink,
              opacity: o.disabled ? 0.45 : 1,
            }}
          >
            {on ? (
              <>
                <View
                  pointerEvents="none"
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 2, borderColor: P.ink }}
                />
                <View
                  pointerEvents="none"
                  style={{ position: 'absolute', top: 2, left: 2, right: 2, height: 3, backgroundColor: P.shade }}
                />
              </>
            ) : o.disabled ? null : (
              <View
                pointerEvents="none"
                style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: LEDGE, backgroundColor: P.ink }}
              />
            )}
            {o.icon?.(on)}
            <Text
              style={[
                on ? TYPE.bodyBold : TYPE.body,
                { fontSize, lineHeight: Math.round(fontSize * (stacked ? 1.05 : 1.2)), color: P.ink, textAlign: 'center' },
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
