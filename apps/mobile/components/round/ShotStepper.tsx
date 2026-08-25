import { Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { PressableTouch } from '../ui/PressableTouch'
import { TYPE } from '../../lib/typography'

// Dark translucent HUD bar — matches the map chrome in HoleMapOverlays.tsx
// (PILL_BG) and MapBottomChrome's CHROME_BG. Local copy: this file follows
// the same convention those two use (each keeps its own constant rather
// than sharing one across files).
const CHROME_BG = 'rgba(28,33,28,0.82)'
const CREAM = '#F2EEE5'
const BRICK = '#A33A2A'

export interface ShotStepperProps {
  /** 0-based index of the active shot within the hole's played shots. */
  index: number
  /** Total number of played shots on this hole. */
  count: number
  onPrev: () => void
  onNext: () => void
  onDelete: () => void
  deleteDisabled?: boolean
}

// On-map editing HUD for a played hole (live round + past round). Renders
// "‹ Shot N of M ›" plus a delete affordance. Pure presentational — no data
// access; the caller owns activeShotIdx / moveShot / deleteShot wiring and
// the draggable marker this steps through.
export function ShotStepper({
  index,
  count,
  onPrev,
  onNext,
  onDelete,
  deleteDisabled,
}: ShotStepperProps) {
  // Defensive display-only clamp: the caller's `activeShotIdx` is reclamped
  // to the fresh `previousShots.length` in an effect (LiveRoundSession), but
  // a delete can commit a shorter `count` one render ahead of that effect
  // running — clamp here too so that frame can't render "Shot 3 of 2" (or
  // chevron-disabled state computed against an out-of-range index).
  const displayIndex = count > 0 ? Math.min(Math.max(index, 0), count - 1) : 0
  const atStart = displayIndex <= 0
  const atEnd = displayIndex >= count - 1
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: CHROME_BG,
        borderRadius: 22,
        paddingVertical: 4,
        paddingHorizontal: 4,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
      }}
    >
      <StepperChevron dir="prev" disabled={atStart} onPress={onPrev} />
      <Text
        style={[
          TYPE.serifUpright,
          {
            color: CREAM,
            fontSize: 14,
            paddingHorizontal: 10,
            fontVariant: ['tabular-nums'],
          },
        ]}
      >
        {`Shot ${displayIndex + 1} of ${count}`}
      </Text>
      <StepperChevron dir="next" disabled={atEnd} onPress={onNext} />
      <View
        style={{
          width: 1,
          height: 22,
          backgroundColor: 'rgba(242,238,229,0.2)',
          marginHorizontal: 4,
        }}
      />
      <PressableTouch
        accessibilityRole="button"
        accessibilityLabel="Delete this shot"
        accessibilityState={{ disabled: !!deleteDisabled }}
        disabled={deleteDisabled}
        onPress={onDelete}
        hitSlop={10}
        android_ripple={{ color: 'rgba(163,58,42,0.22)', borderless: true, radius: 20 }}
        style={{
          paddingVertical: 8,
          paddingHorizontal: 12,
          opacity: deleteDisabled ? 0.4 : 1,
        }}
      >
        <MaterialCommunityIcons name="trash-can-outline" size={18} color={BRICK} />
      </PressableTouch>
    </View>
  )
}

function StepperChevron({
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
      accessibilityLabel={dir === 'prev' ? 'Previous shot' : 'Next shot'}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={10}
      android_ripple={{ color: 'rgba(242,238,229,0.2)', borderless: true, radius: 22 }}
      style={{
        paddingVertical: 6,
        paddingHorizontal: 14,
        opacity: disabled ? 0.3 : 1,
      }}
    >
      <Text style={[TYPE.bodyBold, { color: CREAM, fontSize: 18 }]}>
        {dir === 'prev' ? '‹' : '›'}
      </Text>
    </PressableTouch>
  )
}
