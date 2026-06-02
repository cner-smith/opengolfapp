import type { ComponentProps } from 'react'
import { Text, View } from 'react-native'
import { PressableTouch } from '../ui/PressableTouch'
import { MaterialCommunityIcons } from '@expo/vector-icons'

// Shared pill chrome — dark translucent card on satellite, per DESIGN.md
// mobile map rules. The HUD readouts (To Hole / Exp / SG) all use it.
const PILL_BG = 'rgba(28,33,28,0.82)'
const HUD_KICKER = {
  color: 'rgba(242,238,229,0.65)',
  fontSize: 9,
  fontWeight: '600' as const,
  letterSpacing: 1.3,
  textTransform: 'uppercase' as const,
  marginBottom: 2,
}

interface TopHintProps {
  isPinMode: boolean
  isTeeMode: boolean
}

export function TopHint({ isPinMode, isTeeMode }: TopHintProps) {
  return (
    <View
      style={{
        position: 'absolute',
        // Sits well below the corner HUD pills (top:12, ~46 tall) with a
        // clear gap so the instructional line and the To Hole / Exp readouts
        // don't crowd each other.
        top: 82,
        left: 12,
        right: 12,
        backgroundColor: isPinMode
          ? 'rgba(166,106,31,0.92)'
          : 'rgba(28,33,28,0.78)',
        borderRadius: 2,
        paddingHorizontal: 10,
        paddingVertical: 6,
      }}
    >
      <Text
        style={{
          color: '#F2EEE5',
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 1.4,
          textTransform: 'uppercase',
        }}
      >
        {isPinMode
          ? 'Pin mode — tap to place flag'
          : isTeeMode
            ? 'Tee mode — tap to place tee box'
            : 'Drag the ball to refine, then tap Mark ball here'}
      </Text>
    </View>
  )
}

export function MissingLayoutBanner() {
  return (
    <View
      style={{
        position: 'absolute',
        // Below TopHint (top:82) so the two stack rather than overlap.
        top: 126,
        left: 12,
        right: 12,
        backgroundColor: 'rgba(28,33,28,0.78)',
        borderWidth: 1,
        borderColor: 'rgba(217,210,191,0.4)',
        borderRadius: 2,
        paddingHorizontal: 10,
        paddingVertical: 6,
      }}
    >
      <Text style={{ color: '#F2EEE5', fontSize: 11, lineHeight: 14 }}>
        No hole layout for this course. Place shots manually — the distance
        pill and putting auto-switch stay off until tee / pin coords land.
      </Text>
    </View>
  )
}

// To Hole — distance from the current ball to the pin (top-left HUD pill).
// Replaces the old bottom-right "X to pin" pill; matches the Shot Pattern
// top-corner HUD layout.
export function ToHolePill({ display }: { display: string }) {
  return (
    <View
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        backgroundColor: PILL_BG,
        borderRadius: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        minWidth: 86,
      }}
    >
      <Text style={HUD_KICKER}>To Hole</Text>
      <Text
        style={{
          color: '#F2EEE5',
          fontFamily: 'Fraunces-Medium',
          fontSize: 20,
          fontVariant: ['tabular-nums'],
        }}
      >
        {display}
      </Text>
    </View>
  )
}

// Expected strokes to hole out from the current ball position (top-right
// HUD pill). Distance-band baseline, calibrated to the player's handicap.
// '—' until a pin exists and the baseline resolves.
export function ExpStrokesPill({ value }: { value: number | null }) {
  return (
    <View
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: PILL_BG,
        borderRadius: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        minWidth: 86,
        alignItems: 'flex-end',
      }}
    >
      <Text style={HUD_KICKER}>Exp · to hole</Text>
      <Text
        style={{
          color: '#F2EEE5',
          fontFamily: 'Fraunces-Medium',
          fontSize: 20,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value != null ? value.toFixed(1) : '—'}
      </Text>
    </View>
  )
}

// Shown when the hole has no pin yet — distances, expected strokes, and the
// dispersion overlay all need one, so prompt for it instead of silently
// rendering nothing (Task 7, pin-first UX).
export function PinFirstCta() {
  return (
    <View
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        right: 12,
        backgroundColor: 'rgba(166,106,31,0.92)',
        borderRadius: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <Text style={{ color: '#F2EEE5', fontSize: 12, fontWeight: '600', lineHeight: 16 }}>
        Set the pin (below) to see your To Hole distance, expected strokes, and shot pattern.
      </Text>
    </View>
  )
}

export function TeeBadge() {
  return (
    <View
      style={{
        backgroundColor: '#FBF8F1',
        borderWidth: 1,
        borderColor: '#5C6356',
        borderRadius: 2,
        paddingHorizontal: 6,
        paddingVertical: 3,
      }}
    >
      <Text
        style={{
          color: '#5C6356',
          fontSize: 9,
          fontWeight: '500',
          letterSpacing: 1.4,
        }}
      >
        TEE
      </Text>
    </View>
  )
}

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name']

// Vertical icon toolbar on the left edge of the live map (Shot Pattern
// ref ux-12), adapted to OGA chrome: dark translucent pill, cream icons,
// cream-filled "active" state matching the Tee/Appr toggle. Vertically
// centered; the full-height wrapper is box-none so only the strip itself
// catches touches — map pan/long-press underneath stay live.
//
// green-map (slope heatmap) is a dimmed v1.1 stub. The dispersion button
// toggles the single-color historical-shot dots (render lands in T4).
interface LeftToolbarProps {
  dotsVisible: boolean
  onToggleDots: () => void
  onPlacePin: () => void
  onPlaceTee: () => void
  pinMode: boolean
  teeMode: boolean
}

export function LeftToolbar({
  dotsVisible,
  onToggleDots,
  onPlacePin,
  onPlaceTee,
  pinMode,
  teeMode,
}: LeftToolbarProps) {
  return (
    <View
      pointerEvents="box-none"
      // Sits low on the map (toward the bottom third) so it's in thumb reach,
      // not floating dead-center. Grows upward from here.
      style={{
        position: 'absolute',
        left: 12,
        bottom: 150,
      }}
    >
      <View
        style={{
          backgroundColor: PILL_BG,
          borderRadius: 26,
          paddingVertical: 6,
          paddingHorizontal: 4,
          gap: 3,
          alignItems: 'center',
        }}
      >
        <ToolbarButton
          icon="terrain"
          label="Green slope heatmap (coming soon)"
          disabled
        />
        <ToolbarButton
          icon="grain"
          label={dotsVisible ? 'Hide shot pattern' : 'Show shot pattern'}
          active={dotsVisible}
          onPress={onToggleDots}
        />
        <ToolbarButton
          icon="flag"
          label="Place pin"
          active={pinMode}
          onPress={onPlacePin}
        />
        <ToolbarButton
          icon="golf-tee"
          label="Place tee box"
          active={teeMode}
          onPress={onPlaceTee}
        />
      </View>
    </View>
  )
}

function ToolbarButton({
  icon,
  label,
  onPress,
  active,
  disabled,
}: {
  icon: IconName
  label: string
  onPress?: () => void
  active?: boolean
  disabled?: boolean
}) {
  return (
    <PressableTouch
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected: !!active }}
      disabled={disabled || !onPress}
      onPress={onPress}
      hitSlop={6}
      android_ripple={{ color: 'rgba(242,238,229,0.2)', borderless: true, radius: 26 }}
      // Static style object, NOT a `({ pressed }) => …` callback: under
      // NativeWind/css-interop a function `style` on a wrapped RN component is
      // never resolved, so the active cream fill silently never applied —
      // that's why the selected toolbar/rail state never highlighted. Android
      // press feedback is android_ripple; iOS dims via PressableTouch (#303).
      style={{
        width: 52,
        height: 52,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? '#FBF8F1' : 'transparent',
        opacity: disabled ? 0.32 : 1,
      }}
    >
      <MaterialCommunityIcons
        name={icon}
        size={24}
        color={active ? '#1C211C' : '#F2EEE5'}
      />
    </PressableTouch>
  )
}

// Right-edge controls (Shot Pattern refs ux-10/11/13), adapted to OGA chrome:
// a Tee/Appr toggle over a distance rail. The toggle picks the overlay SHAPE
// (Tee → arc band, Appr → circle ring); the rail SIZES it (Tee = arc width in
// yards, Appr = circle diameter in feet). Neither is a club picker. Vertically
// centered; box-none wrapper so the map underneath stays pannable.
interface RightRailProps {
  mode: 'tee' | 'appr'
  onSetMode: (mode: 'tee' | 'appr') => void
  /** Display labels for the active mode's rail values, top → bottom. */
  railLabels: string[]
  railIndex: number
  onSelectRail: (index: number) => void
}

export function RightRail({
  mode,
  onSetMode,
  railLabels,
  railIndex,
  onSelectRail,
}: RightRailProps) {
  return (
    <View
      pointerEvents="box-none"
      // Low on the map (toward the bottom third) for thumb reach. Grows upward.
      style={{
        position: 'absolute',
        right: 12,
        bottom: 150,
        alignItems: 'flex-end',
        gap: 10,
      }}
    >
      <View style={{ backgroundColor: PILL_BG, borderRadius: 18, padding: 3, gap: 2 }}>
        <RailPill label="Tee" active={mode === 'tee'} onPress={() => onSetMode('tee')} />
        <RailPill label="Appr" active={mode === 'appr'} onPress={() => onSetMode('appr')} />
      </View>
      <View style={{ backgroundColor: PILL_BG, borderRadius: 18, padding: 3, gap: 2 }}>
        {railLabels.map((label, i) => (
          <RailPill
            key={label}
            label={label}
            active={i === railIndex}
            onPress={() => onSelectRail(i)}
          />
        ))}
      </View>
    </View>
  )
}

function RailPill({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <PressableTouch
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      hitSlop={4}
      android_ripple={{ color: 'rgba(242,238,229,0.2)' }}
      // Static style (see ToolbarButton): a function `style` doesn't resolve
      // under css-interop, so the active cream fill silently never applied.
      style={{
        minWidth: 56,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 15,
        alignItems: 'center',
        backgroundColor: active ? '#FBF8F1' : 'transparent',
      }}
    >
      <Text
        style={{
          color: active ? '#1C211C' : '#F2EEE5',
          fontSize: 14,
          fontWeight: active ? '700' : '600',
          fontVariant: ['tabular-nums'],
        }}
      >
        {label}
      </Text>
    </PressableTouch>
  )
}
