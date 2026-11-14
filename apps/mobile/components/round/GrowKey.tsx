// The Aim width key and its drawer as ONE surface (#1468).
// The key's face and border spring upward to hold the drawer, then fold back
// down into the key on pick. One face, one border, one ledge at the bottom.
// Its own file for LiveRoundDock's 1,000-line cap.
import { useEffect, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { GestureDetector, type GestureType } from 'react-native-gesture-handler'
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { haptic } from '../../lib/haptics'
import { GAP, LEDGE, MAP_KEY, P, R } from '../paper/tokens'

// The shipped drawer's spring (Grow in LiveRoundDock).
const SPRING = { stiffness: 140, damping: 22, mass: 1 }

export function GrowKey({
  open,
  ghost,
  width,
  keyH,
  accessibilityLabel,
  onPress,
  gesture,
  drawer,
  onDrawerHeight,
  children,
}: {
  /** Tapped open: the drawer takes touches. */
  open: boolean
  /** Held for a scrub: grown, drawn faint, touch-through. */
  ghost: boolean
  width: number
  keyH: number
  accessibilityLabel: string
  onPress: () => void
  /** Hold-and-drag on the key part (scrub). */
  gesture: GestureType
  drawer: ReactNode
  onDrawerHeight: (h: number) => void
  /** The key's own label + value, always at the bottom. */
  children: ReactNode
}) {
  const reduce = useReducedMotion()
  const grown = open || ghost
  const t = useSharedValue(grown ? 1 : 0)
  const [drawerH, setDrawerH] = useState(0)
  useEffect(() => {
    t.value = reduce ? (grown ? 1 : 0) : withSpring(grown ? 1 : 0, SPRING)
  }, [grown, reduce, t])

  const edge = grown ? P.ink : MAP_KEY.edge
  const fade = ghost && !open ? 0.82 : 1
  const extra = drawerH + GAP
  const surface = useAnimatedStyle(() => ({
    height: keyH + t.value * extra,
    // The drawer reads on the plates' 68% glass; the key at rest on the map keys' glass.
    backgroundColor: interpolateColor(t.value, [0, 1], [MAP_KEY.face, P.glass]),
  }))
  const content = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(1, t.value * 1.6 - 0.25)) * fade,
    transform: [{ translateY: (1 - t.value) * 18 }],
  }))
  const rule = useAnimatedStyle(() => ({ opacity: t.value }))

  return (
    <View style={{ width, height: keyH + LEDGE }}>
      {/* The one ledge: a strip under the face, as on the glass map keys. */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: LEDGE - MAP_KEY.ledge,
          height: MAP_KEY.ledge,
          backgroundColor: edge,
          borderBottomLeftRadius: R,
          borderBottomRightRadius: R,
        }}
      />
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: LEDGE,
            borderRadius: R,
            borderWidth: grown ? 1 : StyleSheet.hairlineWidth,
            borderColor: edge,
            overflow: 'hidden',
          },
          surface,
        ]}
      >
        {/* Anchored just above the key part, so the growing face uncovers it from the bottom up. */}
        <Animated.View
          pointerEvents={open && !ghost ? 'auto' : 'none'}
          onLayout={(e) => {
            setDrawerH(e.nativeEvent.layout.height)
            onDrawerHeight(e.nativeEvent.layout.height)
          }}
          style={[{ position: 'absolute', left: 0, right: 0, bottom: keyH, padding: 6, paddingBottom: GAP / 2, gap: GAP }, content]}
        >
          {drawer}
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', left: 8, right: 8, bottom: keyH - 1, height: StyleSheet.hairlineWidth, backgroundColor: P.ink45 }, rule]}
        />
        <GestureDetector gesture={gesture}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ expanded: open }}
            onPressIn={() => haptic('press')}
            onPress={onPress}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: keyH - 2, alignItems: 'center', justifyContent: 'center' }}
          >
            {children}
          </Pressable>
        </GestureDetector>
      </Animated.View>
    </View>
  )
}
