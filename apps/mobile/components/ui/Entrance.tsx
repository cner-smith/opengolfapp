import { useEffect } from 'react'
import type { ReactNode } from 'react'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'

// Shared gentle entrance for screen content blocks. Wrap a screen's major
// sections and pass an incrementing `index` to stagger them as they mount /
// as their data arrives. Restrained per DESIGN.md — one direction, short,
// no bounce. (#600)
//
// Drives the fade+rise with a MANUAL mount animation (shared values +
// withTiming via useAnimatedStyle), NOT Reanimated's declarative `entering`
// layout-animation prop. The `entering`/FadeInDown subsystem is broken on
// Android (old arch): late/conditionally-mounted children inside a ScrollView
// race the native initial-value snapshot, so blocks paint at their final
// position (overlap) or get dropped entirely (blank screen) — iOS was fine but
// Android collapsed. See reanimated #8445 / #5492 / #3992 / #5715. The core
// shared-value engine (what HoleMap uses) has none of those issues, so the
// animation now works identically on both platforms.
const STAGGER_MS = 80
const DURATION_MS = 380
const RISE_PX = 16

export function Entrance({
  index = 0,
  children,
}: {
  index?: number
  children: ReactNode
}) {
  const reduceMotion = useReducedMotion()
  // Start hidden + offset. Because JS owns these values, the view never paints
  // at its final position before animating (the Android entering bug), and a
  // late mount (async-fetched block) still animates when it actually mounts.
  const opacity = useSharedValue(reduceMotion ? 1 : 0)
  const translateY = useSharedValue(reduceMotion ? 0 : RISE_PX)

  useEffect(() => {
    if (reduceMotion) return
    const delay = index * STAGGER_MS
    opacity.value = withDelay(delay, withTiming(1, { duration: DURATION_MS }))
    translateY.value = withDelay(
      delay,
      withTiming(0, { duration: DURATION_MS, easing: Easing.out(Easing.cubic) }),
    )
  }, [index, reduceMotion, opacity, translateY])

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  // collapsable={false}: stop Android view-flattening from dropping the node
  // Reanimated drives. Harmless on iOS.
  return (
    <Animated.View collapsable={false} style={style}>
      {children}
    </Animated.View>
  )
}
