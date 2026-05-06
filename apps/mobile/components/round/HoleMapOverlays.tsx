import { Text, View } from 'react-native'

interface TopHintProps {
  isPinMode: boolean
  isAimPhase: boolean
}

export function TopHint({ isPinMode, isAimPhase }: TopHintProps) {
  return (
    <View
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        right: 12,
        backgroundColor: isPinMode
          ? 'rgba(166,106,31,0.92)'
          : 'rgba(28,33,28,0.78)',
        borderRadius: 2,
        paddingHorizontal: 10,
        paddingVertical: 6,
      }}
    >
      <Text
        style={{
          color: '#F2EEE5',
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 1.4,
          textTransform: 'uppercase',
        }}
      >
        {isPinMode
          ? 'Pin mode — tap to place flag'
          : isAimPhase
            ? 'Long-press to set aim line — where you started the ball, not where it finishes'
            : 'Drag the ball to refine, then tap Mark ball here'}
      </Text>
    </View>
  )
}

export function MissingLayoutBanner() {
  return (
    <View
      style={{
        position: 'absolute',
        top: 48,
        left: 12,
        right: 12,
        backgroundColor: 'rgba(28,33,28,0.78)',
        borderWidth: 1,
        borderColor: 'rgba(217,210,191,0.4)',
        borderRadius: 2,
        paddingHorizontal: 10,
        paddingVertical: 6,
      }}
    >
      <Text style={{ color: '#F2EEE5', fontSize: 11, lineHeight: 14 }}>
        No hole layout for this course. Place shots manually — the distance
        pill and putting auto-switch stay off until tee / pin coords land.
      </Text>
    </View>
  )
}

export function PinDistancePill({ display }: { display: string }) {
  return (
    <View
      style={{
        position: 'absolute',
        right: 12,
        bottom: 12,
        backgroundColor: 'rgba(28,33,28,0.78)',
        borderRadius: 2,
        paddingHorizontal: 12,
        paddingVertical: 6,
      }}
    >
      <Text
        style={{
          color: '#F2EEE5',
          fontSize: 12,
          fontWeight: '500',
          fontVariant: ['tabular-nums'],
        }}
      >
        {display} to pin
      </Text>
    </View>
  )
}

export function TeeBadge() {
  return (
    <View
      style={{
        backgroundColor: '#FBF8F1',
        borderWidth: 1,
        borderColor: '#5C6356',
        borderRadius: 2,
        paddingHorizontal: 6,
        paddingVertical: 3,
      }}
    >
      <Text
        style={{
          color: '#5C6356',
          fontSize: 9,
          fontWeight: '500',
          letterSpacing: 1.4,
        }}
      >
        TEE
      </Text>
    </View>
  )
}
