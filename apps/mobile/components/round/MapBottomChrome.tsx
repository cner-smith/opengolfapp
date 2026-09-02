import { Pressable, Text, View } from 'react-native'
import { PressableTouch } from '../ui/PressableTouch'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tourMakePercent } from '@oga/core'
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
  /** True while the shown hole is in the played-hole on-map EDIT surface
   *  (ShotStepper, drag-to-move, delete) rather than live capture — a
   *  stricter, non-appendable sibling of `isRevisitingPlayedHole`. When set,
   *  the whole contextual-action row (mark-ball / "+Add a shot" / on-green /
   *  finish) is suppressed; LiveRoundSession renders the stepper separately
   *  and the hole-nav pill (below) stays the only way to leave. */
  editMode?: boolean
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
  /** Quiet, non-blocking on-green entry (#791 step 4): marks the ball where
   *  it lies and enters the putting flow (Made/Missed + make-%). */
  onOnGreen: () => void
  /** Opt into the live append flow on a revisited played hole. Optional — its
   *  partner `isRevisitingPlayedHole` is the only path that reaches it. */
  onAddShot?: () => void
  /** Live out-of-bounds: flag the hole's most recent shot as OB (or clear it),
   *  charge the penalty stroke, and drop the ball back on that shot's origin
   *  for the stroke-and-distance re-hit (#839). */
  onMarkLastShotOb: () => void
  /** True when that most recent shot is ALREADY flagged OB — flips the chip
   *  into its undo label. Derived from the stored rows, not remembered. */
  lastShotIsOb: boolean
  onFinishHole: () => void
  onPrev: () => void
  onNext: () => void
  onOpenScorecard: () => void
  /** On-green rework: true while `roundState === 'PUTTING'`. Swaps the whole
   *  contextual-action block for the Made/Missed overlay — the detailed aim
   *  line read moved to the end-of-hole summary (HoleReviewSheet), so there
   *  is nothing else to show here. */
  onGreenActive: boolean
  /** Ball→pin distance in feet, for the make-% pill and as the persisted
   *  putt distance. Null when there's no pin to measure against. */
  puttDistanceFt: number | null
  onPuttMade: () => void
  onPuttMissed: () => void
  onNotOnGreen: () => void
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
  // Played-hole edit mode: no mark-ball / "+Add a shot" / on-green / finish
  // row here — LiveRoundSession renders the ShotStepper instead. The
  // hole-nav pill (HoleNavPill, below) stays mounted regardless.
  if (p.editMode) return null
  // On-green (#791 step 4 rework): Made/Missed replace the whole chrome for
  // this state — no place/mark/on-green CTA while putting. Checked ahead of
  // SET_AIM/isRevisitingPlayedHole since PUTTING is its own roundState, not a
  // variant of either.
  if (p.onGreenActive) {
    return <OnGreenActions {...p} />
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
      {/* One chip row for the secondary actions — stacking them one-per-line
          read as clutter over the satellite (QA 2026-08). flexWrap: at the
          1.3x font cap on narrow devices the two chips can exceed the row
          width; wrapping beats an untappable off-screen chip. The GPS drag
          hint that used to sit here duplicated TopHint (HoleMapOverlays.tsx,
          rendered unconditionally whenever !isAimPhase in HoleMap.tsx) —
          TopHint covers every state the hint showed in, and the CTA label
          ("Mark ball at my GPS") carries the GPS-tracking cue.
          On-green gate (#791 step 4): requires a prior shot this hole — as the
          FIRST tap it would skip persisting the stroke that reached the green
          (phantom ace) and finishHole would skip the review. */}
      {p.totalShotsThisHole > 0 && (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          {(p.ball != null || p.hasGps) && !p.saving && (
            <TextChip label="⛳ On the green" onPress={p.onOnGreen} />
          )}
          {/* Live OB (#839). Deliberately in the PLACE_BALL row and nowhere
              else: every earlier branch above returns first, so the chip can
              never appear during pin placement, played-hole edit mode, the
              on-green Made/Missed overlay, aiming, or a played-hole revisit.
              Gated on a shot existing this hole by the enclosing
              totalShotsThisHole > 0 — there is no "last shot" before the
              first one. */}
          {!p.saving && (
            <TextChip
              label={p.lastShotIsOb ? '⚠ OB — tap to undo' : '⚠ Last shot went OB'}
              onPress={p.onMarkLastShotOb}
              danger
            />
          )}
          <TextChip
            label={p.holeNumber < p.holeCount ? 'Finish hole · next →' : 'Finish round'}
            onPress={p.onFinishHole}
            strong
          />
        </View>
      )}
    </>
  )
}

// On-green overlay (#791 step 4 rework): make-% pill + Made/Missed + a quiet
// escape. The detailed read (aim/break/speed) is gone from here — it now
// lives in the end-of-hole summary (HoleReviewSheet's Read ▸ / AimerOverlay).
function OnGreenActions(p: MapBottomChromeProps) {
  const ft = p.puttDistanceFt
  const tourPct = ft != null && ft > 0 ? tourMakePercent(ft) : null
  return (
    <>
      {ft != null && ft > 0 && (
        <View
          style={{
            backgroundColor: CHROME_BG,
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 8,
          }}
        >
          <Text style={[TYPE.body, { color: CREAM, fontSize: 13 }]}>
            {Math.round(ft)} ft
            {tourPct != null ? (
              <Text style={[TYPE.bodyBold, { color: CREAM, fontWeight: '700' }]}>
                {' '}· tour makes {tourPct}%
              </Text>
            ) : null}
          </Text>
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <PuttResultButton label="Missed" onPress={p.onPuttMissed} disabled={p.saving} />
        <PuttResultButton label="Made" primary onPress={p.onPuttMade} disabled={p.saving} />
      </View>
      <TextChip label="Not on the green" onPress={p.onNotOnGreen} />
    </>
  )
}

function PuttResultButton({
  label,
  primary,
  onPress,
  disabled,
}: {
  label: string
  primary?: boolean
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <PressableTouch
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: 'rgba(242,238,229,0.18)' }}
      // Static style object (see PrimaryCta) — a function `style` is dropped
      // by NativeWind/css-interop.
      style={{
        backgroundColor: primary ? '#1F3D2C' : CHROME_BG,
        borderColor: primary ? '#1F3D2C' : 'rgba(242,238,229,0.4)',
        borderWidth: 1,
        borderRadius: 26,
        paddingVertical: 15,
        paddingHorizontal: 34,
        alignItems: 'center',
        opacity: disabled ? 0.5 : 1,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
      }}
    >
      <Text
        style={[
          TYPE.bodyBold,
          { color: CREAM, fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
        ]}
      >
        {label}
      </Text>
    </PressableTouch>
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
  danger,
}: {
  label: string
  onPress: () => void
  strong?: boolean
  /** Penalty action — caddie-neg (#A33A2A) border + tint, mirroring
   *  SecondaryPill's own danger variant. */
  danger?: boolean
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
        borderColor: danger ? 'rgba(163,58,42,0.9)' : 'rgba(242,238,229,0.45)',
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
      <Text
        style={[
          TYPE.kicker,
          {
            ...KICKER,
            color: danger ? '#E6A99C' : strong ? CREAM : 'rgba(242,238,229,0.85)',
          },
        ]}
      >
        {label}
      </Text>
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
