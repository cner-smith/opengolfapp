import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { TYPE } from '../../lib/typography'
import { Key, KeyText } from './Paper'
import { Icon } from './icons'
import { P } from './tokens'

// Footer pieces (#611 §6) shared by the live dock and the past-round footer:
// the voice line and the bottom row's keys.

// One friendly line inside the footer paper, with an optional trailing key.
export function Voice({
  children,
  trailing,
  minHeight = 34,
}: {
  children: ReactNode
  trailing?: ReactNode
  minHeight?: number
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        minHeight: trailing ? 50 : minHeight,
        paddingTop: trailing ? 4 : 8,
        paddingRight: 2,
        paddingBottom: 2,
        paddingLeft: 4,
      }}
    >
      <Text style={[TYPE.body, { flex: 1, fontSize: 14, lineHeight: 18, color: P.ink }]}>{children}</Text>
      {trailing}
    </View>
  )
}

export function Em({ children }: { children: ReactNode }) {
  return <Text style={[TYPE.serif, { fontSize: 17 }]}>{children}</Text>
}

// §6 no-pin line; the whole line opens Pin mode.
export function NoPinVoice({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="No flag yet. Set the pin." onPress={onPress}>
      <Voice trailing={<Icon.next size={22} color={P.warn} />}>
        No flag yet —{' '}
        <Text style={{ textDecorationLine: 'underline', textDecorationColor: P.warn, textDecorationStyle: 'solid' }}>
          set the pin
        </Text>{' '}
        and I’ll show your distance, odds and pattern.
      </Voice>
    </Pressable>
  )
}

// 76×44 key trailing a voice line (Cancel, Undo, OB).
export function SmallKey({
  label,
  onPress,
  color,
  a11y,
}: {
  label: string
  onPress: () => void
  color?: string
  a11y?: string
}) {
  return (
    <Key accessibilityLabel={a11y ?? label} onPress={onPress} faceStyle={{ width: 76, height: 44 }}>
      <KeyText style={color ? { color } : undefined}>{label}</KeyText>
    </Key>
  )
}

export function Secondary({
  label,
  onPress,
  disabled,
  color,
  icon,
  a11y,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  /** Label ink, e.g. `neg` for a destructive terminal action. */
  color?: string
  icon?: ReactNode
  a11y?: string
}) {
  return (
    <Key
      accessibilityLabel={a11y ?? label}
      onPress={onPress}
      disabled={disabled}
      stretch
      style={{ flexShrink: 1, maxWidth: 120 }}
      faceStyle={{ minHeight: 49, paddingHorizontal: 10, paddingVertical: 3, flexDirection: 'row', gap: 6 }}
    >
      {icon}
      <KeyText disabled={disabled} numberOfLines={2} style={color && !disabled ? { color } : undefined}>
        {label}
      </KeyText>
    </Key>
  )
}

export function Primary({
  label,
  sub,
  onPress,
  disabled,
  plus,
  a11y,
}: {
  label: string
  sub?: string
  onPress: () => void
  disabled?: boolean
  /** Leading + glyph ("Add shot"). */
  plus?: boolean
  a11y?: string
}) {
  return (
    <Key
      accessibilityLabel={a11y ?? (sub ? `${label} ${sub}` : label)}
      tone="primary"
      onPress={onPress}
      disabled={disabled}
      stretch
      // Keeps its natural width and lets the secondaries wrap instead: as a
      // flex:1 leftover it wrapped "Mark my ball" to four lines at 1.3×.
      style={{ flexGrow: 1, flexShrink: 0, maxWidth: '60%' }}
      faceStyle={{ minHeight: 49, paddingHorizontal: 8, paddingVertical: 3 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {plus && <Icon.plus size={18} color={disabled ? P.ink35 : P.raised} />}
        <KeyText tone="primary" bold size={16} disabled={disabled} numberOfLines={2} style={{ flexShrink: 1 }}>
          {label}
        </KeyText>
      </View>
      {sub ? (
        <KeyText tone="primary" size={12} style={{ opacity: 0.9 }}>
          {sub}
        </KeyText>
      ) : null}
    </Key>
  )
}
