import { Gesture } from 'react-native-gesture-handler'
import {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

// Swipe-down-to-dismiss for the live-round bottom sheets (scorecard, putting,
// shot logger, past-hole shots). Returns:
//   - `pan`: attach via <GestureDetector> to the sheet's GRABBER / header
//     region ONLY — never the card or an inner ScrollView, or the drag fights
//     the scroll (and, in the putting sheet, GreenDiagram's own pan).
//   - `cardStyle`: put on an <Animated.View> wrapping the card so it follows
//     the finger down.
//
// The gesture must live inside a <GestureHandlerRootView> that is itself inside
// the RN <Modal> — on Android the Modal is a separate native window the app-
// root gesture handler can't reach (#496). Each sheet keeps its own Modal,
// backdrop, KeyboardAvoidingView, maxHeight and Close button; this only adds
// the drag layer.
//
// On dismiss we don't animate translateY off-screen: the sheet's Modal owns
// `animationType="slide"`, so it slides the card the rest of the way out from
// wherever the drag left it, then unmounts its children — which disposes this
// shared value, so the next open starts fresh at 0. No manual reset needed.
const DISMISS_DISTANCE = 120
const DISMISS_VELOCITY = 800

export function useSwipeToDismiss(onClose: () => void) {
  const translateY = useSharedValue(0)
  const reduceMotion = useReducedMotion()

  const pan = Gesture.Pan()
    // Only claim the gesture after a clear downward move, so a tap on the
    // grabber/header still reaches the buttons underneath and an upward drag
    // isn't stolen from anything above.
    .activeOffsetY(10)
    .failOffsetY(-10)
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY)
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        runOnJS(onClose)()
      } else {
        translateY.value = reduceMotion
          ? 0
          : withSpring(0, { damping: 22, stiffness: 240 })
      }
    })

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  return { pan, cardStyle }
}
