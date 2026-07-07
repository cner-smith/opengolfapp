import { useLayoutEffect } from 'react'
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
// wherever the drag left it.
//
// The exit leaves translateY at the drag offset. Sheets that FULLY unmount on
// close (rendered inside a parent <Modal>, e.g. PuttingSheet/ScorecardModal)
// dispose this shared value and reopen fresh — they can omit `isOpen`. But
// sheets that stay mounted and only toggle their OWN inner Modal's `visible`
// (ShotLogger, PastHoleShotsSheet) keep the offset, so they reopen off-screen
// (#644 residual). Pass `isOpen` and we reset to 0 on each (re)open — done
// while hidden, so the exit animation is untouched.
const DISMISS_DISTANCE = 120
const DISMISS_VELOCITY = 800

export function useSwipeToDismiss(onClose: () => void, isOpen = true) {
  const translateY = useSharedValue(0)
  const reduceMotion = useReducedMotion()

  // useLayoutEffect (not useEffect): apply the reset before the reopened
  // subtree paints, so the card never shows one frame at the stale drag offset
  // mid-open animation.
  useLayoutEffect(() => {
    if (isOpen) translateY.value = 0
  }, [isOpen])

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
