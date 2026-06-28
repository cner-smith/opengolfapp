import { Pressable, Text, View } from 'react-native'
import { PressableTouch } from '../ui/PressableTouch'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TYPE } from '../../lib/typography'
import { KICKER, type RoundState } from './hole/types'

// Floating bottom chrome that replaces the old cream HoleStrip panel so the
// satellite map runs nearly full-bleed (Shot Pattern refs: contextual CTA over
// a thin hole-nav). All action wiring is the HoleStrip wiring verbatim — only
// the presentation moved from a solid panel to map-floating pills. Pin
// placement lives in the left toolbar now, so it's gone here.
//
// The nav pill is kept narrow + centered so the Mapbox logo/attribution at the
// bottom corners stays unobstructed (ToS).
const CHROME_BG = 'rgba(28,33,28,0.82)'
const CREAM = '#F2EEE5'

interface MapBottomChromeProps {
  roundState: RoundState
  pinPlacementOpen: boolean
  ball: { lat: number; lng: number } | null
  aim: { lat: number; lng: number } | null
  saving: boolean
  roundPin: { lat: number; lng: number } | null
  hasGps: boolean
  /** Live mode only: the ball marker is currently tracking the player's GPS
   *  (not manually dragged). Drives the GPS-explicit place-ball CTA + hint. */
  ballFromGps?: boolean
  /** True when the player has navigated back to a hole that already has logged
   *  shots and hasn't opted into adding another. The live mark-ball CTA is
   *  replaced by an explicit "Add a shot" affordance (#484). */
  isRevisitingPlayedHole?: boolean
  totalShotsThisHole: number
  holeNumber: number
  holeCount: number
  par: number
  yardsLabel: string | null
  onCancelPinPlacement: () => void
  onClearRoundPin: () => void
  onConfirmAim: () => void
  onRePlaceBall: () => void
  onSkipAim: () => void
  onMarkBallHere: () => void
  /** Opt into the live append flow on a revisited played hole. Optional — its
   *  partner `isRevisitingPlayedHole` is the only path that reaches it. */
  onAddShot?: () => void
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
  // Revisiting a played hole: the live mark-ball flow is suppressed (no
  // GPS ball, no auto-aim, no line-to-green). Show the existing-shot breadcrumb
  // only, with an explicit "Add a shot" opt-in plus the finish affordance. #484.
  if (p.isRevisitingPlayedHole) {
    return (
      <>
        <PrimaryCta label="+ Add a shot" disabled={p.saving} onPress={() => p.onAddShot?.()} />
        {p.totalShotsThisHole > 0 && (
          <TextChip
            label={p.holeNumber < p.holeCount ? 'Finish hole · next →' : 'Finish round'}
            onPress={p.onFinishHole}
            strong
          />
        )}
      </>
    )
  }
  // PLACE_BALL. When the ball is GPS-tracked (live, not yet dragged), the CTA
  // says so explicitly — otherwise it's the generic "here" for a dragged marker.
  const ballLabel = p.saving
    ? 'Saving…'
    : p.ballFromGps
      ? 'Mark ball at my GPS →'
      : p.ball
        ? 'Mark ball here →'
        : p.hasGps
          ? 'Mark ball at my GPS →'
          : 'Waiting for GPS…'
  const ballDisabled = (!p.ball && !p.hasGps) || p.saving
  return (
    <>
      <PrimaryCta label={ballLabel} disabled={ballDisabled} onPress={p.onMarkBallHere} />
      {p.ballFromGps && !p.saving && (
        <View
          style={{
            backgroundColor: CHROME_BG,
            borderRadius: 14,
            paddingHorizontal: 12,
            paddingVertical: 5,
          }}
        >
          <Text style={[TYPE.body, { color: CREAM, fontSize: 11, opacity: 0.85 }]}>
            The ball follows your GPS — drag to adjust.
          </Text>
        </View>
      )}
      {p.totalShotsThisHole > 0 && (
        <TextChip
          label={p.holeNumber < p.holeCount ? 'Finish hole · next →' : 'Finish round'}
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
    <PressableTouch
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: 'rgba(31,61,44,0.18)' }}
      // Static style object, NOT a `({ pressed }) => …` callback: under
      // NativeWind/css-interop a function `style` on a wrapped RN component is
      // never resolved, so the backgroundColor it returns silently never lands
      // — that was the "CTA has no background on the satellite" bug. Android
      // press feedback is android_ripple; iOS dims via PressableTouch (#303).
      style={{
        // Cream fill + forest text reads on ANY satellite (the forest-on-trees
        // version blended into dark imagery). Disabled stays a dark pill.
        backgroundColor: disabled ? 'rgba(28,33,28,0.85)' : '#FBF8F1',
        borderColor: disabled ? 'rgba(242,238,229,0.4)' : '#1F3D2C',
        borderWidth: 1,
        borderRadius: 26,
        paddingVertical: 15,
        paddingHorizontal: 30,
        // Shadow lifts the pill off the satellite imagery.
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 7,
        shadowOffset: { width: 0, height: 2 },
        elevation: 5,
      }}
    >
      <Text
        style={[
          TYPE.bodyBold,
          {
            color: disabled ? 'rgba(242,238,229,0.7)' : '#1F3D2C',
            fontSize: 16,
            fontWeight: '700',
            letterSpacing: 0.3,
          },
        ]}
      >
        {label}
      </Text>
    </PressableTouch>
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
    <PressableTouch
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={{ color: 'rgba(242,238,229,0.18)' }}
      // Static style (see PrimaryCta): function `style` doesn't resolve under
      // css-interop, so the pill background would silently drop.
      style={{
        backgroundColor: CHROME_BG,
        borderColor: danger ? 'rgba(163,58,42,0.9)' : 'rgba(242,238,229,0.4)',
        borderWidth: 1,
        borderRadius: 22,
        paddingVertical: 11,
        paddingHorizontal: 22,
      }}
    >
      <Text style={[TYPE.bodyBold, { color: danger ? '#E6A99C' : CREAM, fontSize: 14, fontWeight: '600' }]}>
        {label}
      </Text>
    </PressableTouch>
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
    <PressableTouch
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      android_ripple={{ color: 'rgba(242,238,229,0.18)' }}
      // Static style (see PrimaryCta): function `style` doesn't resolve under
      // css-interop, so the chip background + border would silently drop.
      style={{
        backgroundColor: 'rgba(28,33,28,0.92)',
        borderColor: 'rgba(242,238,229,0.45)',
        borderWidth: 1,
        borderRadius: 16,
        paddingVertical: 10,
        paddingHorizontal: 16,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 1 },
        elevation: 3,
      }}
    >
      <Text style={[TYPE.kicker, { ...KICKER, color: strong ? CREAM : 'rgba(242,238,229,0.85)' }]}>{label}</Text>
    </PressableTouch>
  )
}

function HoleNavPill({
  holeNumber,
  holeCount,
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
        <Text style={[TYPE.serifUpright, { fontSize: 14, color: CREAM }]}>
          {`Hole ${holeNumber} · Par ${par}${yardsLabel ? ` · ${yardsLabel}` : ''}`}
        </Text>
        <Text style={[TYPE.kicker, { ...KICKER, color: 'rgba(242,238,229,0.6)', marginTop: 2 }]}>
          Scorecard ▾
        </Text>
      </Pressable>
      <NavChevron dir="next" disabled={holeNumber >= holeCount} onPress={onNext} />
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
    <PressableTouch
      accessibilityRole="button"
      accessibilityLabel={dir === 'prev' ? 'Previous hole' : 'Next hole'}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={10}
      android_ripple={{ color: 'rgba(242,238,229,0.2)', borderless: true, radius: 22 }}
      // Static style (see PrimaryCta): a function `style` here silently dropped
      // the padding (hit area) and the disabled dim under css-interop.
      style={{
        paddingVertical: 6,
        paddingHorizontal: 16,
        opacity: disabled ? 0.3 : 1,
      }}
    >
      <Text style={[TYPE.bodyBold, { color: CREAM, fontSize: 20 }]}>
        {dir === 'prev' ? '‹' : '›'}
      </Text>
    </PressableTouch>
  )
}
