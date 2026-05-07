import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import {
  LIE_TYPE_LABELS,
  formatClubLabel,
  formatDistance,
  type DistanceUnit,
  type LieType,
} from '@oga/core'
import type { Database } from '@oga/supabase'

type ShotRow = Database['public']['Tables']['shots']['Row']

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

interface PastHoleShotsSheetProps {
  visible: boolean
  holeNumber: number | null
  par: number | null
  shots: ShotRow[]
  unit: DistanceUnit
  onClose: () => void
}

// Read-only sheet for past round hole drill-down. Intentionally not
// reusing the live-round HoleScreen — that route runs the place-ball /
// set-aim state machine which has no business firing on a finalized
// round. This is just a list view: shot number, club, lie, distance.
// No editing, no logging, no map.
export function PastHoleShotsSheet({
  visible,
  holeNumber,
  par,
  shots,
  unit,
  onClose,
}: PastHoleShotsSheetProps) {
  const sortedShots = [...shots].sort((a, b) => a.shot_number - b.shot_number)
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            backgroundColor: '#FBF8F1',
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
            paddingHorizontal: 18,
            paddingTop: 14,
            paddingBottom: 28,
            maxHeight: '80%',
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 32,
              height: 4,
              borderRadius: 2,
              backgroundColor: '#D9D2BF',
              marginBottom: 14,
            }}
          />
          <Text style={{ ...KICKER, marginBottom: 4 }}>
            Hole {holeNumber ?? '—'}
            {par != null ? ` · Par ${par}` : ''}
          </Text>
          <Text
            style={{
              color: '#1C211C',
              fontSize: 22,
              fontStyle: 'italic',
              fontWeight: '500',
              marginBottom: 14,
            }}
          >
            {sortedShots.length} shot{sortedShots.length === 1 ? '' : 's'}
          </Text>

          {sortedShots.length === 0 ? (
            <Text style={{ color: '#5C6356', fontSize: 14, lineHeight: 20 }}>
              No shots logged for this hole.
            </Text>
          ) : (
            <ScrollView style={{ maxHeight: '85%' }}>
              {sortedShots.map((s) => (
                <ShotRowView key={s.id} shot={s} unit={unit} />
              ))}
            </ScrollView>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close hole shots"
            onPress={onClose}
            style={{
              marginTop: 14,
              paddingVertical: 12,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#D9D2BF',
              borderRadius: 2,
            }}
          >
            <Text style={{ ...KICKER, color: '#5C6356' }}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

function ShotRowView({ shot, unit }: { shot: ShotRow; unit: DistanceUnit }) {
  const clubLabel = shot.club
    ? formatClubLabel({ club_type: shot.club })
    : '—'
  const lieLabel = shot.lie_type
    ? LIE_TYPE_LABELS[shot.lie_type as LieType]
    : null
  const distanceLabel =
    shot.distance_to_target != null
      ? formatDistance(shot.distance_to_target, unit)
      : null
  return (
    <View
      style={{
        flexDirection: 'row',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderColor: '#EBE5D6',
        gap: 12,
      }}
    >
      <Text
        style={{
          width: 24,
          color: '#8A8B7E',
          fontSize: 14,
          fontVariant: ['tabular-nums'],
        }}
      >
        {shot.shot_number}
      </Text>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: '#1C211C',
            fontSize: 15,
            fontWeight: '500',
            textTransform: 'capitalize',
          }}
        >
          {clubLabel}
        </Text>
        {(lieLabel || distanceLabel) && (
          <Text
            style={{
              color: '#5C6356',
              fontSize: 12,
              marginTop: 2,
            }}
          >
            {[lieLabel, distanceLabel].filter(Boolean).join(' · ')}
          </Text>
        )}
      </View>
    </View>
  )
}
