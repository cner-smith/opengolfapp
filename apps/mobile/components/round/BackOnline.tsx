import { useCallback, useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Pressable, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { Easing, cancelAnimation, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated'
import { useAuth } from '../../hooks/useAuth'
import { HardShadow, Key, KeyText, PaperSurface } from '../paper/Paper'
import { FONT_CAP, MARGIN, P, R } from '../paper/tokens'
import { TYPE } from '../../lib/typography'

// Signal is back after an offline start (#1005). Never blocks: only the keys
// take touches, so the map and the dock keep working, and ignoring it is fine.
const TAG_MS = 20_000
const BANNER_MS = 7_000
const FADE_MS = 420

// The live round says "still here?" itself; everywhere else gets the banner.
const liveRoundFocus = { current: false }

/** For the live session: catches the round up when signal returns, and says
 *  whether the tag is up (only while the session is the focused screen). */
export function useBackOnlineTag(refreshRound: () => Promise<void>) {
  const { backOnline } = useAuth()
  const [tag, setTag] = useState(false)
  const close = useCallback(() => setTag(false), [])
  useEffect(() => {
    if (backOnline === 0) return
    void refreshRound()
    if (liveRoundFocus.current) setTag(true)
  }, [backOnline, refreshRound])
  useFocusEffect(useCallback(() => {
    liveRoundFocus.current = true
    return () => {
      liveRoundFocus.current = false
    }
  }, []))
  return [tag, close] as const
}

// Up for `ms`, then a fade. Fingers on it hold it fully visible and restart the
// clock, so a tap landing late still lands: the JS timer owns the end, and a
// touch cancels a fade already running.
function useShowFor(ms: number, onDone: () => void, drop = 0) {
  const reduced = useReducedMotion()
  const t = useSharedValue(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leave = useCallback(() => {
    t.value = withTiming(0, { duration: reduced ? 1 : FADE_MS }, (done) => {
      if (done) runOnJS(onDone)()
    })
  }, [onDone, reduced, t])
  const release = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(leave, ms)
  }, [leave, ms])
  const hold = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    cancelAnimation(t)
    t.value = 1
  }, [t])
  useEffect(() => {
    t.value = reduced
      ? 1
      : withTiming(1, { duration: drop ? 560 : FADE_MS, easing: Easing.out(Easing.back(drop ? 2.2 : 1.6)) })
    release()
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [drop, reduced, release, t])
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(t.value * (drop ? 3 : 1), 1),
    transform: [{ translateY: (1 - t.value) * -(drop || 10) }],
  }))
  return { style, hold, release }
}

export function BackOnlineTag({
  holeNumber,
  anchor,
  onStillHere,
  onMovedOn,
}: {
  holeNumber: number
  anchor: { top?: number; bottom?: number }
  onStillHere: () => void
  onMovedOn: () => void
}) {
  const { style, hold, release } = useShowFor(TAG_MS, onStillHere)
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`We're back. Still on hole ${holeNumber}?`)
    // Announced once: moving holes while it's up doesn't say it again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <Animated.View
      pointerEvents="box-none"
      collapsable={false}
      style={[{ position: 'absolute', left: MARGIN, right: MARGIN, alignItems: 'center' }, anchor, style]}
    >
      <HardShadow>
        <PaperSurface
          fill={P.raised}
          onTouchStart={hold}
          onTouchEnd={release}
          onTouchCancel={release}
          style={{ borderWidth: 1, borderColor: P.ink, borderRadius: R, padding: 12 }}
        >
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { color: P.ink, fontSize: 19 }]}>
            We're back. Still on Hole {holeNumber}?
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Key accessibilityLabel="Still here" onPress={onStillHere} faceStyle={{ paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' }}>
              <KeyText bold>Still here</KeyText>
            </Key>
            <Key accessibilityLabel="I've moved on, change hole" onPress={onMovedOn} faceStyle={{ paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' }}>
              <KeyText>I've moved on</KeyText>
            </Key>
          </View>
        </PaperSurface>
      </HardShadow>
    </Animated.View>
  )
}

function Banner({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets()
  const { style } = useShowFor(BANNER_MS, onDone, 170)
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility("We're back. You have signal again.")
  }, [])
  return (
    <Animated.View
      pointerEvents="box-none"
      collapsable={false}
      style={[{ position: 'absolute', top: insets.top + 6, left: MARGIN, right: MARGIN }, style]}
    >
      <HardShadow dx={3} dy={3}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="We're back. You have signal again. Dismiss."
          onPress={onDone}
          style={{ backgroundColor: P.forest, borderWidth: 1, borderColor: P.forestEdge, borderRadius: R, paddingHorizontal: 18, paddingVertical: 14 }}
        >
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { color: P.raised, fontSize: 34 }]}>We're back.</Text>
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.chrome, fontSize: 15, marginTop: 2 }]}>You have signal again.</Text>
        </Pressable>
      </HardShadow>
    </Animated.View>
  )
}

export function BackOnlineToast() {
  const { backOnline } = useAuth()
  const [show, setShow] = useState(0)
  const close = useCallback(() => setShow(0), [])
  useEffect(() => {
    if (backOnline > 0 && !liveRoundFocus.current) setShow(backOnline)
  }, [backOnline])
  return show > 0 ? <Banner key={show} onDone={close} /> : null
}
