import { useEffect } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import type { ActiveRound } from '../../hooks/useActiveRound'

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  fontFamily: 'JetBrainsMono-Medium',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

// Pulsing left border on the active-round banner — slow 1.5s in / 1.5s
// out breath so the player notices the live state without it nagging.
// Cancel on unmount so we don't leak a running worklet on Android.
export function ResumeRoundBanner({ round }: { round: ActiveRound }) {
  const router = useRouter()
  const pulse = useSharedValue(1)

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 1500 }),
        withTiming(1, { duration: 1500 }),
      ),
      -1,
      false,
    )
    return () => {
      cancelAnimation(pulse)
    }
  }, [pulse])

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }))

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Resume active round at ${round.courseName}, hole ${round.currentHole}`}
      onPress={() =>
        router.push({
          pathname: '/(app)/round/[id]',
          params: {
            id: round.id,
            hole: String(round.currentHole),
            mode: 'live',
          },
        })
      }
      style={{
        borderRadius: 2,
        paddingVertical: 14,
        paddingHorizontal: 16,
        paddingLeft: 18,
        marginBottom: 14,
        backgroundColor: '#FBF8F1',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            backgroundColor: '#A66A1F',
          },
          pulseStyle,
        ]}
      />
      <View>
        <Text
          style={{
            ...KICKER,
            color: '#A66A1F',
            marginBottom: 4,
          }}
        >
          Active round
        </Text>
        <Text
          style={{
            color: '#1C211C',
            fontSize: 15,
            fontWeight: '500',
            fontFamily: 'Fraunces-Medium',
            fontStyle: 'italic',
          }}
        >
          {round.courseName} · Hole {round.currentHole}
        </Text>
      </View>
      <Text
        style={{
          color: '#A66A1F',
          fontSize: 14,
          fontWeight: '600',
          letterSpacing: 0.3,
        }}
      >
        Resume →
      </Text>
    </Pressable>
  )
}
