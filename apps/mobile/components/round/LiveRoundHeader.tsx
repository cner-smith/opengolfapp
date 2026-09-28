import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TYPE } from '../../lib/typography'
import { HardShadow, Key, KeyText, PaperSurface } from '../paper/Paper'
import { HeroRow } from '../paper/HeroRow'
import { Icon } from '../paper/icons'
import { FONT_CAP, P, R } from '../paper/tokens'
import { PressableTouch } from '../ui/PressableTouch'
import { CoachTarget } from '../help/CoachMarks'

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth']

interface LiveRoundHeaderProps {
  holeNumber: number
  holeCount: number
  par: number
  yardsLabel: string | null
  shotNumber: number
  distance: { value: string; unit: string } | null
  /** A pin is set but there's no ball to measure from yet. */
  noBall?: boolean
  expected: number | null
  onLeave: () => void
  onPrev: () => void
  onNext: () => void
  onOpenScorecard: () => void
  onOpenMenu: () => void
  /** "?" — walk through what's on this screen (#900). */
  onHelp: () => void
}

// Live-round header (#611 §3): paper, hole nav row over the hero row
// (distance to the pin, expected strokes, Card key).
export function LiveRoundHeader(p: LiveRoundHeaderProps) {
  const insets = useSafeAreaInsets()
  const ordinal = ORDINAL[p.shotNumber - 1] ?? `${p.shotNumber}th`
  return (
    <PaperSurface style={{ paddingTop: insets.top, borderBottomWidth: 1, borderBottomColor: P.ink, zIndex: 2 }}>
      <CoachTarget id="live.holes" style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: 2 }}>
        <NavButton label="Leave round and return home" onPress={p.onLeave}>
          <Icon.back size={22} />
        </NavButton>
        <NavButton label="Previous hole" onPress={p.onPrev} disabled={p.holeNumber === 1}>
          <Icon.prev size={20} color={P.inkDim} />
        </NavButton>
        <View style={{ flex: 1, alignItems: 'center', paddingVertical: 3 }}>
          {/* Full row width: sized to its content, Android under-measures the
              italic Fraunces title and wraps the number onto a clipped line. */}
          <Text maxFontSizeMultiplier={FONT_CAP}
            numberOfLines={1}
            style={[TYPE.serif, { alignSelf: 'stretch', textAlign: 'center', fontSize: 24, lineHeight: 28, color: P.ink }]}
          >
            {`Hole ${p.holeNumber}`}
          </Text>
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 13, lineHeight: 17, color: P.ink, textAlign: 'center' }]}>
            Par {p.par}
            {p.yardsLabel ? ` · ${p.yardsLabel}` : ''} · {ordinal} shot
          </Text>
        </View>
        <NavButton label="Next hole" onPress={p.onNext} disabled={p.holeNumber >= p.holeCount}>
          <Icon.next size={20} color={P.inkDim} />
        </NavButton>
        <NavButton label="What's on this screen" onPress={p.onHelp}>
          {/* Thin space after: Android clips the italic ?'s hook at its layout edge. */}
          <Text maxFontSizeMultiplier={1} style={[TYPE.serif, { fontSize: 20, lineHeight: 24, color: P.inkDim }]}>{'?\u2009'}</Text>
        </NavButton>
        <NavButton label="Round options" onPress={p.onOpenMenu}>
          <Icon.more size={20} />
        </NavButton>
      </CoachTarget>
      <CoachTarget id="live.hero">
      <HeroRow
        distance={p.distance}
        emptyLabel={p.noBall ? 'mark your\nball' : undefined}
        expected={p.expected}
        trailing={
          <CoachTarget id="live.card">
            <Key
              accessibilityLabel="Open scorecard"
              onPress={p.onOpenScorecard}
              faceStyle={{ minHeight: 44, flexDirection: 'row', gap: 6, paddingLeft: 9, paddingRight: 10 }}
            >
              <Icon.card size={18} />
              <KeyText>Card</KeyText>
            </Key>
          </CoachTarget>
        }
      />
      </CoachTarget>
    </PaperSurface>
  )
}

export function NavButton({
  label,
  onPress,
  disabled,
  children,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <PressableTouch
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: P.well }}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : 1 }}
    >
      {children}
    </PressableTouch>
  )
}

// ⋮ menu (§11): raised paper panel under header row 1, no scrim. Not a Modal —
// its rows open the confirm dialogs, one presented modal at a time (#293).
export function RoundOptionsMenu({
  onClose,
  onEndRound,
  onDeleteRound,
}: {
  onClose: () => void
  onEndRound: () => void
  onDeleteRound: () => void
}) {
  const insets = useSafeAreaInsets()
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close menu"
        onPress={onClose}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 }}
      />
      <HardShadow dx={3} dy={3} style={{ position: 'absolute', top: insets.top + 52, right: 12, width: 228, zIndex: 21 }}>
        <View style={{ backgroundColor: P.raised, borderWidth: 1, borderColor: P.ink, borderRadius: R, paddingVertical: 4 }}>
          <MenuRow label="End round early" onPress={onEndRound} divider />
          <MenuRow label="Delete round" onPress={onDeleteRound} color={P.neg} />
        </View>
      </HardShadow>
    </>
  )
}

function MenuRow({
  label,
  onPress,
  color = P.ink,
  divider,
}: {
  label: string
  onPress: () => void
  color?: string
  divider?: boolean
}) {
  return (
    <PressableTouch
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={{ color: P.well }}
      style={{
        minHeight: 48,
        justifyContent: 'center',
        paddingHorizontal: 16,
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: P.line,
      }}
    >
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 15, color }]}>{label}</Text>
    </PressableTouch>
  )
}
