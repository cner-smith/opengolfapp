import { Text, View } from 'react-native'
import { TYPE } from '../../lib/typography'
import { Key, KeyText } from '../paper/Paper'
import { Icon } from '../paper/icons'
import { GAP, P } from '../paper/tokens'

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

// Played-hole edit row (#611 paper): "‹ Shot N of M ›" plus Delete, sitting
// in the live dock's footer in place of the bottom row. Pure presentational —
// the caller owns activeShotIdx / moveShot / deleteShot wiring.
export function ShotStepper({ index, count, onPrev, onNext, onDelete, deleteDisabled }: ShotStepperProps) {
  // Display-only clamp: a delete can commit a shorter `count` one render
  // ahead of the caller's reclamp effect — never render "Shot 3 of 2".
  const displayIndex = count > 0 ? Math.min(Math.max(index, 0), count - 1) : 0
  const atStart = displayIndex <= 0
  const atEnd = displayIndex >= count - 1
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: GAP, paddingTop: 2 }}>
      <Key accessibilityLabel="Previous shot" onPress={onPrev} disabled={atStart} faceStyle={{ width: 44, height: 46 }}>
        <Icon.prev size={20} color={atStart ? P.ink35 : P.ink} />
      </Key>
      <Text style={[TYPE.serif, { flex: 1, textAlign: 'center', fontSize: 18, color: P.ink }]}>
        Shot {displayIndex + 1} of {count}
      </Text>
      <Key accessibilityLabel="Next shot" onPress={onNext} disabled={atEnd} faceStyle={{ width: 44, height: 46 }}>
        <Icon.next size={20} color={atEnd ? P.ink35 : P.ink} />
      </Key>
      <Key
        accessibilityLabel="Delete this shot"
        onPress={onDelete}
        disabled={deleteDisabled}
        faceStyle={{ height: 46, paddingHorizontal: 12 }}
      >
        <KeyText disabled={deleteDisabled} style={deleteDisabled ? undefined : { color: P.neg }}>
          Delete
        </KeyText>
      </Key>
    </View>
  )
}
