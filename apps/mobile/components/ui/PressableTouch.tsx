import { useState } from 'react'
import {
  Platform,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

// UIKit dims non-destructive controls to ~0.75 alpha on press; match that.
const IOS_PRESSED_OPACITY = 0.75

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>
  pressedOpacity?: number
}

/**
 * Pressable with an iOS press-down opacity dim. Android keeps its native
 * `android_ripple`; iOS has no ripple, so we toggle opacity on
 * onPressIn/onPressOut via a STATIC style array.
 *
 * Why not `style={({ pressed }) => …}`: NativeWind 4 css-interop silently
 * drops a function `style` on wrapped RN components, so it never lands (#303).
 * The `style` prop here is therefore typed as a non-function StyleProp.
 *
 * `ref` is not forwarded — no caller needs one yet. Add `forwardRef` when a
 * tap target genuinely needs `measure()`/focus.
 *
 * Default tap target for the app; reach for this instead of a bare Pressable.
 */
export function PressableTouch({
  style,
  onPress,
  onPressIn,
  onPressOut,
  disabled,
  pressedOpacity = IOS_PRESSED_OPACITY,
  ...rest
}: Props) {
  const [pressed, setPressed] = useState(false)
  // Only dim genuinely-interactive presses: skip disabled and no-op rows (the
  // scorecard renders non-played holes as a Pressable with no onPress).
  const dim = Platform.OS === 'ios' && pressed && !disabled && onPress != null
  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPress={onPress}
      onPressIn={(e: GestureResponderEvent) => {
        setPressed(true)
        onPressIn?.(e)
      }}
      onPressOut={(e: GestureResponderEvent) => {
        setPressed(false)
        onPressOut?.(e)
      }}
      style={[style, dim ? { opacity: pressedOpacity } : null]}
    />
  )
}
