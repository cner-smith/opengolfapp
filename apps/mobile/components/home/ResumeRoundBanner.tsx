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
import { TYPE } from '../../lib/typography'
import { Key, KeyText } from '../paper/Paper'
import { PaperTile } from '../paper/Section'
import { FONT_CAP, P } from '../paper/tokens'

// Pulsing left bar on the active-round tile — slow 1.5s in / 1.5s
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
  const resume = () =>
    router.push({
      pathname: '/(app)/round/[id]',
      params: {
        id: round.id,
        hole: String(round.currentHole),
        mode: 'live',
      },
    })

  // The whole card resumes too; the Key carries the accessible label.
  return (
    <Pressable accessible={false} onPress={resume} style={{ marginBottom: 14 }}>
      <PaperTile
        innerStyle={{
          paddingVertical: 12,
          paddingLeft: 18,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
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
              backgroundColor: P.warn,
            },
            pulseStyle,
          ]}
        />
        <View style={{ flex: 1 }}>
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.warn, fontSize: 12, marginBottom: 2 }]}>
            Active round
          </Text>
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { color: P.ink, fontSize: 17, lineHeight: 22 }]}>
            {round.courseName} · Hole {round.currentHole}
          </Text>
        </View>
        <Key
          accessibilityLabel={`Resume active round at ${round.courseName}, hole ${round.currentHole}`}
          onPress={resume}
          faceStyle={{ minHeight: 40, paddingHorizontal: 14 }}
        >
          <KeyText bold>Resume →</KeyText>
        </Key>
      </PaperTile>
    </Pressable>
  )
}
