import { useEffect, useState } from 'react'
import { Modal, Text, View } from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { LIE_TYPES, capFirst as cap, type LieSlopeForward, type LieSlopeSide, type LieType } from '@oga/core'
import { TYPE } from '../../lib/typography'
import { Key, KeyText } from '../paper/Paper'
import { SlopeGrid } from '../paper/Pickers'
import { FONT_CAP, P } from '../paper/tokens'
import { PressableTouch } from '../ui/PressableTouch'

// Shot patterns' lie and slope filters as a bottom sheet. The page dims while
// the sheet rises (manual shared values: the Modal's own slide moved the scrim
// with the sheet), and a drag down on the handle closes it.

const OPEN = { duration: 280, easing: Easing.out(Easing.cubic) }
const CLOSE = { duration: 196, easing: Easing.in(Easing.cubic) }
const DISMISS_DP = 80
const DISMISS_VELOCITY = 800

export function FilterSheet({
  open,
  onClose,
  lieType,
  onLieType,
  forward,
  side,
  onForward,
  onSide,
  onClear,
  doneLabel,
  bottomInset,
}: {
  open: boolean
  onClose: () => void
  lieType: LieType | null
  onLieType: (v: LieType | null) => void
  forward: LieSlopeForward | null
  side: LieSlopeSide | null
  onForward: (v: LieSlopeForward | null) => void
  onSide: (v: LieSlopeSide | null) => void
  onClear: () => void
  /** "Show 13 shots", or "Only 3 from the rough". */
  doneLabel: string
  bottomInset: number
}) {
  const reduce = useReducedMotion()
  const [mounted, setMounted] = useState(open)
  const [height, setHeight] = useState(0)
  const scrim = useSharedValue(0)
  const drop = useSharedValue(1000)

  useEffect(() => {
    if (open) setMounted(true)
  }, [open])
  useEffect(() => {
    if (!mounted || height === 0) return
    if (open) {
      scrim.value = reduce ? 1 : withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) })
      drop.value = reduce ? 0 : withTiming(0, OPEN)
    } else {
      const done = (finished?: boolean) => {
        'worklet'
        if (finished) runOnJS(setMounted)(false)
      }
      scrim.value = reduce ? 0 : withTiming(0, { duration: 140 })
      if (reduce) {
        drop.value = height
        setMounted(false)
      } else drop.value = withTiming(height, CLOSE, done)
    }
  }, [open, mounted, height, reduce, scrim, drop])

  const pan = Gesture.Pan()
    .activeOffsetY(10)
    .failOffsetY(-10)
    .onUpdate((e) => {
      drop.value = Math.max(0, e.translationY)
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DP || e.velocityY > DISMISS_VELOCITY) runOnJS(onClose)()
      else drop.value = reduce ? 0 : withTiming(0, OPEN)
    })

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }))
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: drop.value }] }))
  const filtered = lieType != null || forward != null || side != null

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* RN Modal is its own native window on Android: the pan needs its own root (#496). */}
      <GestureHandlerRootView style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: P.scrim }, scrimStyle]}>
          <PressableTouch accessibilityRole="button" accessibilityLabel="Close filters" onPress={onClose} style={{ flex: 1 }} />
        </Animated.View>
        <Animated.View
          onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
          style={[
            {
              backgroundColor: P.raised,
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
              borderTopWidth: 1,
              borderColor: P.ink,
              paddingHorizontal: 18,
              paddingBottom: bottomInset + 18,
            },
            sheetStyle,
          ]}
        >
          <GestureDetector gesture={pan}>
            <View style={{ paddingTop: 12, paddingBottom: 6 }}>
              <View style={{ width: 32, height: 4, backgroundColor: P.line, alignSelf: 'center', marginBottom: 12 }} />
              <Text accessibilityRole="header" maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { fontSize: 22, color: P.ink }]}>
                Filters
              </Text>
            </View>
          </GestureDetector>
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 13, color: P.inkDim, marginTop: 8, marginBottom: 8 }]}>Lie</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {([null, ...LIE_TYPES] as const).map((v) => (
              <Key
                key={v ?? 'any'}
                accessibilityLabel={v ? cap(v) : 'Any lie'}
                latched={lieType === v}
                onPress={() => onLieType(v)}
                faceStyle={{ minHeight: 44, paddingHorizontal: 12 }}
              >
                <KeyText size={13} bold={lieType === v}>{v ? cap(v) : 'Any'}</KeyText>
              </Key>
            ))}
          </View>
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 13, color: P.inkDim, marginTop: 18, marginBottom: 8 }]}>
            Slope
          </Text>
          <SlopeGrid forward={forward} side={side} onForward={onForward} onSide={onSide} />
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 12, color: P.inkDim, marginTop: 6 }]}>
            Tap a chosen slope again to clear it.
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 22 }}>
            {filtered && (
              <Key accessibilityLabel="Clear filters" onPress={onClear} faceStyle={{ minHeight: 48, paddingHorizontal: 16 }}>
                <KeyText size={14}>Clear filters</KeyText>
              </Key>
            )}
            <Key accessibilityLabel={doneLabel} tone="primary" onPress={onClose} stretch style={{ flex: 1 }} faceStyle={{ minHeight: 48 }}>
              <KeyText tone="primary" bold>{doneLabel}</KeyText>
            </Key>
          </View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  )
}
