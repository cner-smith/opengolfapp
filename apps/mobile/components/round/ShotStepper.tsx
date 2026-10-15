import { Text, View } from 'react-native'
import { TYPE } from '../../lib/typography'
import { Key, KeyText } from '../paper/Paper'
import { Icon } from '../paper/icons'
import { FONT_CAP, GAP, P } from '../paper/tokens'

export interface ShotStepperProps {
  /** 0-based index of the active shot within the hole's played shots. */
  index: number
  /** Total number of played shots on this hole. */
  count: number
  onPrev: () => void
  onNext: () => void
  onDelete: () => void
  deleteDisabled?: boolean
  /** Inserts a shot after the selected one (#1114). */
  onAdd: () => void
  addDisabled?: boolean
  /** The hole isn't saved yet: a way back to its review (#938). */
  onDone?: () => void
  /** The hole isn't finished: back to live capture (#1115). */
  onResume?: () => void
}

// Played-hole edit row (#611 paper): "‹ Shot N of M ›" plus Add and Delete, sitting
// in the live dock's footer in place of the bottom row. Pure presentational —
// the caller owns activeShotIdx / moveShot / deleteShot wiring.
export function ShotStepper({
  index,
  count,
  onPrev,
  onNext,
  onDelete,
  deleteDisabled,
  onAdd,
  addDisabled,
  onDone,
  onResume,
}: ShotStepperProps) {
  // Display-only clamp: a delete can commit a shorter `count` one render
  // ahead of the caller's reclamp effect — never render "Shot 3 of 2".
  const displayIndex = count > 0 ? Math.min(Math.max(index, 0), count - 1) : 0
  const atStart = displayIndex <= 0
  const atEnd = displayIndex >= count - 1
  return (
    <View style={{ gap: GAP }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: GAP, paddingTop: 2 }}>
        <Key
          accessibilityLabel="Previous shot"
          onPress={onPrev}
          disabled={atStart}
          faceStyle={{ width: 44, height: 46 }}
        >
          <Icon.prev size={20} color={atStart ? P.ink35 : P.ink} />
        </Key>
        <Text
          maxFontSizeMultiplier={FONT_CAP}
          style={[TYPE.serif, { flex: 1, textAlign: 'center', fontSize: 18, color: P.ink }]}
        >
          Shot {displayIndex + 1} of {count}
        </Text>
        <Key
          accessibilityLabel="Next shot"
          onPress={onNext}
          disabled={atEnd}
          faceStyle={{ width: 44, height: 46 }}
        >
          <Icon.next size={20} color={atEnd ? P.ink35 : P.ink} />
        </Key>
        <Key
          accessibilityLabel="Add a shot after this one"
          onPress={onAdd}
          disabled={addDisabled}
          faceStyle={{ height: 46, paddingHorizontal: 12 }}
        >
          <KeyText disabled={addDisabled}>Add</KeyText>
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
      {onDone && (
        <Key
          accessibilityLabel="Back to the hole review"
          tone="primary"
          onPress={onDone}
          faceStyle={{ minHeight: 49 }}
        >
          <KeyText tone="primary" bold size={16}>
            Back to review
          </KeyText>
        </Key>
      )}
      {onResume && (
        <Key accessibilityLabel="Resume playing" tone="primary" onPress={onResume} faceStyle={{ minHeight: 49 }}>
          <KeyText tone="primary" bold size={16}>
            Resume playing
          </KeyText>
        </Key>
      )}
    </View>
  )
}
