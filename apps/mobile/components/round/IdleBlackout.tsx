import { useCallback, useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, AppState, Keyboard, Pressable, StyleSheet, type GestureResponderEvent } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { getKeepScreenOn } from '../../lib/keepScreenOn'

// Live round keeps the screen on and blacks it out when idle (#1121).
const TAG = 'oga.live-round'
const IDLE_MS = 20_000
// Mark, then Confirm aim, plus the waking tap is the 3-tap limit. A slow read of
// the aim shouldn't cost a fourth, nor should a tip cut out mid-sentence, so
// these wait longer, but not for ever (tips open on their own, in a pocket too).
const READING_IDLE_MS = 60_000
const FADE_IN_MS = 400
// The lifting overlay goes on eating touches, so a quick second tap (a pocket's
// double tap) can't reach Mark my ball.
const LIFT_MS = 250

const noop = () => {}

/**
 * `paused`: a native Modal is up; the overlay can't cover one, so the player
 * reads it undisturbed. `draggingRef`: the ball is held on the map (a gesture
 * handler cancels the JS touch when it activates, so touches can't tell).
 */
export function useIdleBlackout({ paused, reading, draggingRef }: {
  paused: boolean
  reading: boolean
  draggingRef: { current: boolean }
}) {
  const [armed, setArmed] = useState(false)
  const [black, setBlack] = useState(false)
  const [screenReader, setScreenReader] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The overlay fades in for FADE_IN_MS. One state drives both the overlay's
  // pass-through and the capture below that cancels the blackout, so the two
  // can't disagree (#1451).
  const [fadedIn, setFadedIn] = useState(false)
  useEffect(() => {
    setFadedIn(false)
    if (!black) return
    const t = setTimeout(() => setFadedIn(true), FADE_IN_MS)
    return () => clearTimeout(t)
  }, [black])
  const fading = black && !fadedIn
  const start = useRef(noop)
  const stop = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  // On focus, not useKeepAwake's mount: this session stays mounted behind Home
  // after Leave (#1032), and a lock held there would keep the whole app awake.
  useFocusEffect(
    useCallback(() => {
      let live = true
      void getKeepScreenOn().then((on) => {
        if (!live || !on) return
        setArmed(true)
        activateKeepAwakeAsync(TAG).catch(noop)
      })
      return () => {
        live = false
        setArmed(false)
        setBlack(false)
        deactivateKeepAwake(TAG).catch(noop)
      }
    }, []),
  )

  // A screen reader walks the controls under the overlay, and the screen means
  // nothing to its user, so the screen stays on and never blacks out.
  useEffect(() => {
    let live = true
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      if (live) setScreenReader(on)
    })
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader)
    return () => {
      live = false
      sub.remove()
    }
  }, [])

  useEffect(() => {
    if (!armed || paused || screenReader) {
      setBlack(false)
      return
    }
    start.current = () => {
      stop()
      timer.current = setTimeout(() => {
        if (draggingRef.current || Keyboard.isVisible()) start.current()
        else setBlack(true)
      }, reading ? READING_IDLE_MS : IDLE_MS)
    }
    start.current()
    const sub = AppState.addEventListener('change', (s) => {
      stop()
      if (s !== 'active') return
      // Coming back to a black screen would look like a dead phone.
      setBlack(false)
      start.current()
      // Android sets the flag on the Activity's window only when no tag is
      // held, so a recreated Activity lost it while our tag still reads active
      // (ExpoKeepAwakeManager.activate). Dropping the tag first re-adds it.
      deactivateKeepAwake(TAG).catch(noop).then(() => activateKeepAwakeAsync(TAG)).catch(noop)
    })
    return () => {
      start.current = noop
      stop()
      sub.remove()
    }
  }, [armed, paused, reading, screenReader])

  return {
    black,
    catching: black && fadedIn,
    wake: useCallback(() => {
      setBlack(false)
      start.current()
    }, []),
    // A finger down holds the timer; the last finger up restarts it. A touch
    // while the overlay is still fading in (it lets touches through then)
    // cancels the blackout.
    touchProps: {
      onTouchStartCapture: () => {
        stop()
        if (fading) setBlack(false)
      },
      onTouchEnd: (e: GestureResponderEvent) => {
        if (e.nativeEvent.touches.length === 0) start.current()
      },
      onTouchCancel: () => start.current(),
    },
  }
}

type TouchProps = {
  onTouchStartCapture: () => void
  onTouchEnd: (e: GestureResponderEvent) => void
  onTouchCancel: () => void
}

// The map keys fade after a few idle seconds (#1468). Same plumbing as the
// blackout's touchProps: a finger down wakes them and holds the timer; the
// last finger up restarts it.
const KEYS_IDLE_MS = 4_000
export function useMapKeysIdle(): { awake: boolean; touchProps: TouchProps } {
  const [awake, setAwake] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stop = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  const arm = useCallback(() => {
    stop()
    timer.current = setTimeout(() => setAwake(false), KEYS_IDLE_MS)
  }, [])
  useEffect(() => {
    arm()
    return stop
  }, [arm])
  return {
    awake,
    touchProps: {
      onTouchStartCapture: () => {
        stop()
        setAwake(true)
      },
      onTouchEnd: (e) => {
        if (e.nativeEvent.touches.length === 0) arm()
      },
      onTouchCancel: arm,
    },
  }
}

export function bothTouchProps(a: TouchProps, b: TouchProps): TouchProps {
  return {
    onTouchStartCapture: () => {
      a.onTouchStartCapture()
      b.onTouchStartCapture()
    },
    onTouchEnd: (e) => {
      a.onTouchEnd(e)
      b.onTouchEnd(e)
    },
    onTouchCancel: () => {
      a.onTouchCancel()
      b.onTouchCancel()
    },
  }
}

// Plain black: on OLED those pixels are off, which is the point. Mounted last in
// the session root, over the review sheet, tips and menu. The first tap only
// lifts it.
// While it fades in the screen still looks live, so `catching` is false and
// touches pass through to the control under them (the session's touch capture
// cancels the blackout) instead of only lifting an overlay nobody saw (#1451).
export function IdleBlackout({ onWake, catching }: { onWake: () => void; catching: boolean }) {
  const opacity = useSharedValue(0)
  const lifting = useRef(false)
  useEffect(() => {
    opacity.value = withTiming(1, { duration: FADE_IN_MS })
  }, [])
  const faded = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return (
    <Animated.View
      pointerEvents={catching ? 'auto' : 'none'}
      style={[StyleSheet.absoluteFill, { backgroundColor: '#000', zIndex: 200 }, faded]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Wake the screen"
        style={StyleSheet.absoluteFill}
        onPress={() => {
          if (lifting.current) return
          lifting.current = true
          opacity.value = withTiming(0, { duration: LIFT_MS })
          setTimeout(onWake, LIFT_MS)
        }}
      />
    </Animated.View>
  )
}
