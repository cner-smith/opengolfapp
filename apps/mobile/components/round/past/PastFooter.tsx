import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TYPE } from '../../../lib/typography'
import { Icon } from '../../paper/icons'
import { Key, PaperSurface, Rocker } from '../../paper/Paper'
import { GAP, MARGIN, P } from '../../paper/tokens'

export type PastMode = 'PLACE_BALL' | 'SET_AIM' | 'PIN'

// Paper footer shared by logging (§19.4) and review (§19.5): voice line or
// stepper row over the buttons, on chrome + grain above the nav bar.
export function PastFooter({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    <PaperSurface
      style={{
        borderTopWidth: 1,
        borderTopColor: P.ink,
        paddingHorizontal: MARGIN,
        paddingBottom: insets.bottom + 7,
      }}
    >
      {children}
    </PaperSurface>
  )
}

export function ButtonRow({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: GAP, alignItems: 'stretch' }}>{children}</View>
}

// §19.5 stepper row: [‹] "Shot 2 of 5" / summary [›].
export function ShotStepperRow({
  pos,
  count,
  summary,
  onPrev,
  onNext,
}: {
  pos: number
  count: number
  summary: string
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: 8, paddingTop: 8, paddingBottom: 6 }}>
      <Key accessibilityLabel="Previous shot" onPress={onPrev} disabled={pos <= 0} faceStyle={{ width: 44, height: 44 }}>
        <Icon.prev size={20} color={pos <= 0 ? P.ink35 : P.ink} />
      </Key>
      <View style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
        <Text numberOfLines={1} style={[TYPE.serif, { fontSize: 18, lineHeight: 22, color: P.ink }]}>
          Shot {pos + 1} of {count}
        </Text>
        <Text numberOfLines={1} style={[TYPE.body, { fontSize: 13, lineHeight: 17, color: P.ink, textAlign: 'center' }]}>
          {summary}
        </Text>
      </View>
      <Key
        accessibilityLabel="Next shot"
        onPress={onNext}
        disabled={pos >= count - 1}
        faceStyle={{ width: 44, height: 44 }}
      >
        <Icon.next size={20} color={pos >= count - 1 ? P.ink35 : P.ink} />
      </Key>
    </View>
  )
}

const MODES = [
  { value: 'PLACE_BALL' as const, label: 'Ball', icon: () => <Icon.ball size={18} /> },
  { value: 'SET_AIM' as const, label: 'Aim', icon: () => <Icon.aim size={18} /> },
  { value: 'PIN' as const, label: 'Pin', icon: () => <Icon.pin size={18} /> },
]

// Logging's [Ball | Aim | Pin] rocker (§19.4): glyph beside the label (PR6e),
// Aim disabled until the ball is placed. Sets what a map tap does.
export function ModeRocker({
  value,
  onChange,
  aimDisabled,
}: {
  value: PastMode
  onChange: (m: PastMode) => void
  aimDisabled: boolean
}) {
  return (
    <Rocker
      options={MODES.map((m) => ({ ...m, disabled: m.value === 'SET_AIM' && aimDisabled }))}
      value={value}
      onChange={(m) => m && onChange(m)}
      iconBeside
      style={{ width: 186 }}
    />
  )
}
