import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { KICKER, type RoundState } from './hole/types'

// Floating bottom chrome that replaces the old cream HoleStrip panel so the
// satellite map runs nearly full-bleed (Shot Pattern refs: contextual CTA over
// a thin hole-nav). All action wiring is the HoleStrip wiring verbatim — only
// the presentation moved from a solid panel to map-floating pills. Pin/tee
// placement + recenter live in the left toolbar now, so they're gone here.
//
// The nav pill is kept narrow + centered so the Mapbox logo/attribution at the
// bottom corners stays unobstructed (ToS).
const CHROME_BG = 'rgba(28,33,28,0.82)'
const CREAM = '#F2EEE5'

interface MapBottomChromeProps {
  roundState: RoundState
  pinPlacementOpen: boolean
  teePlacementOpen: boolean
  ball: { lat: number; lng: number } | null
  aim: { lat: number; lng: number } | null
  saving: boolean
  roundPin: { lat: number; lng: number } | null
  hasGps: boolean
  totalShotsThisHole: number
  holeNumber: number
  par: number
  yardsLabel: string | null
  onCancelPinPlacement: () => void
  onCancelTeePlacement: () => void
  onClearRoundPin: () => void
  onConfirmAim: () => void
  onRePlaceBall: () => void
  onSkipAim: () => void
  onMarkBallHere: () => void
  onFinishHole: () => void
  onPrev: () => void
  onNext: () => void
  onOpenScorecard: () => void
}

export function MapBottomChrome(props: MapBottomChromeProps) {
  const insets = useSafeAreaInsets()
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' }}
    >
      <View
        pointerEvents="box-none"
        style={{ alignItems: 'center', gap: 8, marginBottom: 10, paddingHorizontal: 16 }}
      >
        <ContextualActions {...props} />
      </View>
      <View style={{ alignItems: 'center', paddingBottom: insets.bottom + 10 }}>
        <HoleNavPill {...props} />
      </View>
    </View>
  )
}

function ContextualActions(p: MapBottomChromeProps) {
  if (p.pinPlacementOpen) {
    return (
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <SecondaryPill label="Cancel" onPress={p.onCancelPinPlacement} />
        {p.roundPin && <SecondaryPill label="Clear flag" danger onPress={p.onClearRoundPin} />}
      </View>
    )
  }
  if (p.teePlacementOpen) {
    return <SecondaryPill label="Cancel" onPress={p.onCancelTeePlacement} />
  }
  if (p.roundState === 'SET_AIM') {
    return (
      <>
        <PrimaryCta
          label={p.aim ? 'Confirm aim →' : 'Long-press the map to aim'}
          disabled={!p.aim}
          onPress={p.onConfirmAim}
        />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TextChip label="← Re-place ball" onPress={p.onRePlaceBall} />
          <TextChip label="Skip aim" onPress={p.onSkipAim} />
        </View>
      </>
    )
  }
  // PLACE_BALL
  const ballLabel = p.saving
    ? 'Saving…'
    : p.ball
      ? 'Mark ball here →'
      : p.hasGps
        ? 'Mark ball at my GPS →'
        : 'Waiting for GPS…'
  const ballDisabled = (!p.ball && !p.hasGps) || p.saving
  return (
    <>
      <PrimaryCta label={ballLabel} disabled={ballDisabled} onPress={p.onMarkBallHere} />
      {p.totalShotsThisHole > 0 && (
        <TextChip
          label={p.holeNumber < 18 ? 'Finish hole · next →' : 'Finish round'}
          onPress={p.onFinishHole}
          strong
        />
      )}
    </>
  )
}

function PrimaryCta({
  label,
  disabled,
  onPress,
}: {
  label: string
  disabled?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: disabled ? 'rgba(28,33,28,0.7)' : '#1F3D2C',
        borderColor: 'rgba(242,238,229,0.55)',
        borderWidth: 1,
        borderRadius: 24,
        paddingVertical: 13,
        paddingHorizontal: 28,
        opacity: pressed ? 0.85 : 1,
        // Shadow lifts the pill off the satellite imagery.
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
      })}
    >
      <Text
        style={{
          color: disabled ? 'rgba(242,238,229,0.6)' : CREAM,
          fontSize: 15,
          fontWeight: '600',
          letterSpacing: 0.3,
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function SecondaryPill({
  label,
  onPress,
  danger,
}: {
  label: string
  onPress: () => void
  danger?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: CHROME_BG,
        borderColor: danger ? 'rgba(163,58,42,0.9)' : 'rgba(242,238,229,0.4)',
        borderWidth: 1,
        borderRadius: 22,
        paddingVertical: 11,
        paddingHorizontal: 22,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ color: danger ? '#E6A99C' : CREAM, fontSize: 14, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  )
}

function TextChip({
  label,
  onPress,
  strong,
}: {
  label: string
  onPress: () => void
  strong?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        backgroundColor: 'rgba(28,33,28,0.7)',
        borderRadius: 16,
        paddingVertical: 7,
        paddingHorizontal: 14,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ ...KICKER, color: strong ? CREAM : 'rgba(242,238,229,0.85)' }}>{label}</Text>
    </Pressable>
  )
}

function HoleNavPill({
  holeNumber,
  par,
  yardsLabel,
  onPrev,
  onNext,
  onOpenScorecard,
}: MapBottomChromeProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: CHROME_BG,
        borderRadius: 22,
        paddingHorizontal: 4,
        paddingVertical: 4,
      }}
    >
      <NavChevron dir="prev" disabled={holeNumber === 1} onPress={onPrev} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open scorecard"
        onPress={onOpenScorecard}
        style={{ alignItems: 'center', paddingHorizontal: 8 }}
      >
        <Text style={{ fontFamily: 'Fraunces-Medium', fontSize: 14, color: CREAM }}>
          {`Hole ${holeNumber} · Par ${par}${yardsLabel ? ` · ${yardsLabel}` : ''}`}
        </Text>
        <Text style={{ ...KICKER, color: 'rgba(242,238,229,0.6)', marginTop: 2 }}>
          Scorecard ▾
        </Text>
      </Pressable>
      <NavChevron dir="next" disabled={holeNumber === 18} onPress={onNext} />
    </View>
  )
}

function NavChevron({
  dir,
  disabled,
  onPress,
}: {
  dir: 'prev' | 'next'
  disabled: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={dir === 'prev' ? 'Previous hole' : 'Next hole'}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => ({
        paddingVertical: 6,
        paddingHorizontal: 16,
        opacity: disabled ? 0.3 : pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ color: CREAM, fontSize: 20, fontWeight: '500' }}>
        {dir === 'prev' ? '‹' : '›'}
      </Text>
    </Pressable>
  )
}
