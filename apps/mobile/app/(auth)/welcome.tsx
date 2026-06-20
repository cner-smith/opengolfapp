import { useEffect, useRef } from 'react'
import { BackHandler, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { FONT } from '../../lib/typography'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'

// Post-login brand splash. login/signup `router.replace` here (not straight
// to /(app)) so the staged-fade brand moment plays after EVERY login — the
// root layout doesn't remount on in-session navigation, so a root-level
// overlay could never fire post-login (#500). Forwards into the app when the
// hold completes, or immediately on tap.
const FADE_DURATION = 500
const LOGO_DELAY = 500
const TAGLINE_DELAY = 1200
const SUPPORT_DELAY = 2000
const HOLD_BEFORE_DISMISS = 3500
const REDUCED_MOTION_HOLD = 1000

export default function Welcome() {
  const router = useRouter()
  const reducedMotion = useReducedMotion()

  const logoOpacity = useSharedValue(0)
  const taglineOpacity = useSharedValue(0)
  const supportOpacity = useSharedValue(0)
  // Guards against a double-arm if the screen re-renders mid-fade.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const enter = () => router.replace('/(app)')

    if (reducedMotion) {
      logoOpacity.value = 1
      taglineOpacity.value = 1
      supportOpacity.value = 1
      const t = setTimeout(enter, REDUCED_MOTION_HOLD)
      return () => clearTimeout(t)
    }
    logoOpacity.value = withDelay(
      LOGO_DELAY,
      withTiming(1, { duration: FADE_DURATION, easing: Easing.out(Easing.cubic) }),
    )
    taglineOpacity.value = withDelay(
      TAGLINE_DELAY,
      withTiming(1, { duration: FADE_DURATION, easing: Easing.out(Easing.cubic) }),
    )
    supportOpacity.value = withDelay(
      SUPPORT_DELAY,
      withTiming(1, { duration: FADE_DURATION, easing: Easing.out(Easing.cubic) }),
    )
    const t = setTimeout(enter, HOLD_BEFORE_DISMISS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Android hardware back during the splash forwards into the app rather than
  // popping to the (already-passed, now-authenticated) login screen.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/(app)')
      return true
    })
    return () => sub.remove()
  }, [router])

  // Tap to skip — snap the text visible, then forward.
  const handleSkip = () => {
    cancelAnimation(logoOpacity)
    cancelAnimation(taglineOpacity)
    cancelAnimation(supportOpacity)
    router.replace('/(app)')
  }

  const logoStyle = useAnimatedStyle(() => ({ opacity: logoOpacity.value }))
  const taglineStyle = useAnimatedStyle(() => ({ opacity: taglineOpacity.value }))
  const supportStyle = useAnimatedStyle(() => ({ opacity: supportOpacity.value }))

  return (
    <>
      <StatusBar style="light" animated />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Skip splash"
        onPress={handleSkip}
        style={styles.screen}
      >
        <Animated.Text style={[styles.wordmark, logoStyle]}>oga.</Animated.Text>
        <Animated.Text style={[styles.tagline, taglineStyle]}>Track every shot.</Animated.Text>
        <Animated.Text style={[styles.support, supportStyle]}>
          Free and open source · Ko-fi support appreciated
        </Animated.Text>
      </Pressable>
    </>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#1C211C',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  wordmark: {
    color: '#FBF8F1',
    // No fontStyle: 'italic' — FONT.serifItalic is an already-italic named face
    // (Fraunces-MediumItalic). On Android, layering an italic style on a face
    // whose name encodes the italic axis breaks resolution → system-font fallback.
    fontFamily: FONT.serifItalic,
    fontSize: 96,
    letterSpacing: -2,
    lineHeight: 100,
  },
  tagline: {
    color: 'rgba(242,238,229,0.85)',
    fontFamily: FONT.serifItalic,
    fontSize: 18,
    marginTop: 18,
  },
  support: {
    color: 'rgba(242,238,229,0.45)',
    fontSize: 11,
    letterSpacing: 1,
    marginTop: 28,
    textAlign: 'center',
  },
})
