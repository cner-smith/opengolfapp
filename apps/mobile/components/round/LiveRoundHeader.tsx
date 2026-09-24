import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PressableTouch } from '../ui/PressableTouch'
import { TYPE } from '../../lib/typography'
import { KICKER } from './hole/types'

const CREAM = '#F2EEE5'

interface LiveRoundHeaderProps {
  holeNumber: number
  holeCount: number
  par: number
  yardsLabel: string | null
  shotNumber: number
  onLeave: () => void
  onPrev: () => void
  onNext: () => void
  onOpenScorecard: () => void
  onOpenMenu: () => void
}

// Live-round app bar. Hole nav + scorecard live here (#901) — the bottom
// hole-nav pill duplicated the header's hole/par/yards and cost the map a
// whole row of bottom chrome.
export function LiveRoundHeader(p: LiveRoundHeaderProps) {
  const insets = useSafeAreaInsets()
  return (
    <View
      style={{
        backgroundColor: '#1C211C',
        // Was a hardcoded 52 (Android ~24dp status bar + 28 gap); use the
        // real top inset so the header clears the Dynamic Island (#494).
        paddingTop: insets.top + 28,
        paddingBottom: 12,
        paddingHorizontal: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Leave round and return home"
        onPress={p.onLeave}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={{ padding: 6 }}
      >
        <Text style={[TYPE.kicker, { ...KICKER, color: 'rgba(242,238,229,0.6)' }]}>
          ← Home
        </Text>
      </Pressable>
      <View style={{ alignItems: 'center' }}>
        <Text style={[TYPE.kicker, { ...KICKER, color: 'rgba(242,238,229,0.45)', marginBottom: 4 }]}>
          Hole {p.holeNumber}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <NavChevron dir="prev" disabled={p.holeNumber === 1} onPress={p.onPrev} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open scorecard"
            onPress={p.onOpenScorecard}
            style={{ alignItems: 'center' }}
          >
            <Text style={[TYPE.serif, { color: CREAM, fontSize: 17 }]}>
              Par {p.par}
              {p.yardsLabel ? ` · ${p.yardsLabel}` : ''}
            </Text>
            <Text style={[TYPE.kicker, { ...KICKER, color: 'rgba(242,238,229,0.45)', marginTop: 3 }]}>
              Scorecard ▾
            </Text>
          </Pressable>
          <NavChevron dir="next" disabled={p.holeNumber >= p.holeCount} onPress={p.onNext} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={[TYPE.kicker, { ...KICKER, color: 'rgba(242,238,229,0.45)' }]}>
          Shot {p.shotNumber}
        </Text>
        <PressableTouch
          accessibilityRole="button"
          accessibilityLabel="Round options"
          onPress={p.onOpenMenu}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          android_ripple={{ color: 'rgba(242,238,229,0.2)', borderless: true, radius: 18 }}
          style={{ paddingHorizontal: 6, paddingVertical: 2 }}
        >
          <Text style={[TYPE.bodyBold, { color: CREAM, fontSize: 22, fontWeight: '600', lineHeight: 24 }]}>
            ⋮
          </Text>
        </PressableTouch>
      </View>
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
      android_ripple={{ color: 'rgba(242,238,229,0.2)', borderless: true, radius: 20 }}
      // Static style (see MapBottomChrome's PrimaryCta): a function `style`
      // silently dropped the padding (hit area) and the disabled dim.
      style={{ paddingHorizontal: 12, opacity: disabled ? 0.3 : 1 }}
    >
      <Text style={[TYPE.bodyBold, { color: CREAM, fontSize: 20, lineHeight: 22 }]}>
        {dir === 'prev' ? '‹' : '›'}
      </Text>
    </PressableTouch>
  )
}

// Round-options popover for the header's ⋮. Rendered by LiveRoundSession at
// its root (not inside the header) so the full-screen transparent backdrop
// covers the whole screen and catches the outside-tap to dismiss. Not a Modal:
// its actions open the confirm dialogs, one presented modal at a time (#293).
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
      <View
        style={{
          position: 'absolute',
          // Just under the header's ⋮, derived from the inset so it stays
          // put when the header grows on notched devices (#494).
          top: insets.top + 80,
          right: 12,
          zIndex: 21,
          minWidth: 184,
          backgroundColor: '#1C211C',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: 'rgba(242,238,229,0.15)',
          paddingVertical: 6,
          shadowColor: '#000',
          shadowOpacity: 0.4,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }}
      >
        <PressableTouch
          accessibilityRole="button"
          accessibilityLabel="End round early"
          onPress={onEndRound}
          android_ripple={{ color: 'rgba(242,238,229,0.15)' }}
          style={{ paddingVertical: 12, paddingHorizontal: 16 }}
        >
          <Text style={[TYPE.bodyBold, { color: CREAM, fontSize: 15, fontWeight: '600' }]}>
            End round early
          </Text>
        </PressableTouch>
        <View style={{ height: 1, backgroundColor: 'rgba(242,238,229,0.1)', marginHorizontal: 8 }} />
        <PressableTouch
          accessibilityRole="button"
          accessibilityLabel="Delete round"
          onPress={onDeleteRound}
          android_ripple={{ color: 'rgba(163,58,42,0.22)' }}
          style={{ paddingVertical: 12, paddingHorizontal: 16 }}
        >
          <Text style={[TYPE.bodyBold, { color: '#E0796B', fontSize: 15, fontWeight: '600' }]}>
            Delete round
          </Text>
        </PressableTouch>
      </View>
    </>
  )
}
