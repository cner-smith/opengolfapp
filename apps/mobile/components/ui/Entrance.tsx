import type { ReactNode } from 'react'
import Animated, { FadeInDown } from 'react-native-reanimated'

// Shared gentle entrance for screen content blocks. Wrap a screen's major
// sections and pass an incrementing `index` to stagger them as they mount /
// as their data arrives. Restrained per DESIGN.md — one direction, short,
// no bounce. (#600)
const STAGGER_MS = 80
const DURATION_MS = 380

export function Entrance({
  index = 0,
  children,
}: {
  index?: number
  children: ReactNode
}) {
  return (
    <Animated.View entering={FadeInDown.duration(DURATION_MS).delay(index * STAGGER_MS)}>
      {children}
    </Animated.View>
  )
}
