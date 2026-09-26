import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { P } from '../../paper/tokens'

const ROLL_MS = 240
const DROP_MS = 90
const RIPPLE_MS = 300
const BALL = 12
/** From release to the drop landing — the review sheet rises 100 ms after. */
export const PUTT_DROP_SHEET_DELAY_MS = ROLL_MS + DROP_MS + 100

// "Made it" (#611 §15, "roll & drop"): the ball rolls home along a slight
// break curve (240 ms, 1−(1−s)^1.7 — dying at the hole), then drops into the
// cup (90 ms: scale 0.5, darkening) as a ripple spreads from the cup (r 6→20,
// 300 ms). Screen points from the map; a cosmetic trailer over committed state.
export function PuttDrop({ from, to, onDone }: { from: [number, number]; to: [number, number]; onDone: () => void }) {
  const roll = useSharedValue(0)
  const drop = useSharedValue(0)
  const ripple = useSharedValue(0)
  useEffect(() => {
    roll.value = withTiming(1, { duration: ROLL_MS, easing: Easing.out(Easing.poly(1.7)) })
    drop.value = withDelay(ROLL_MS, withTiming(1, { duration: DROP_MS }))
    ripple.value = withDelay(
      ROLL_MS,
      withTiming(1, { duration: RIPPLE_MS, easing: Easing.out(Easing.cubic) }, (done) => {
        if (done) runOnJS(onDone)()
      }),
    )
  }, [roll, drop, ripple, onDone])

  // Quadratic curve bending 12% of the putt's length to its right (the break).
  const [x0, y0] = from
  const [x1, y1] = to
  const len = Math.hypot(x1 - x0, y1 - y0) || 1
  const cx = (x0 + x1) / 2 - ((y1 - y0) / len) * len * 0.12
  const cy = (y0 + y1) / 2 + ((x1 - x0) / len) * len * 0.12

  const ball = useAnimatedStyle(() => {
    const s = roll.value
    const x = (1 - s) * (1 - s) * x0 + 2 * (1 - s) * s * cx + s * s * x1
    const y = (1 - s) * (1 - s) * y0 + 2 * (1 - s) * s * cy + s * s * y1
    return {
      transform: [{ translateX: x - BALL / 2 }, { translateY: y - BALL / 2 }, { scale: 1 - 0.5 * drop.value }],
      opacity: 1 - drop.value * 0.6,
    }
  })
  const ring = useAnimatedStyle(() => {
    const r = 6 + 14 * ripple.value
    return {
      width: r * 2,
      height: r * 2,
      borderRadius: r,
      transform: [{ translateX: x1 - r }, { translateY: y1 - r }],
      opacity: ripple.value > 0 ? 1 - ripple.value : 0,
    }
  })
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
      <Animated.View style={[{ position: 'absolute', borderWidth: 1.5, borderColor: P.raised }, ring]} />
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: BALL,
            height: BALL,
            borderRadius: BALL / 2,
            backgroundColor: P.raised,
            borderWidth: 1.5,
            borderColor: P.ink,
          },
          ball,
        ]}
      />
    </View>
  )
}
