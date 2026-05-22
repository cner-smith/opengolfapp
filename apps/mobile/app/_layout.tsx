import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { AuthProvider } from '../contexts/AuthContext'
import { useAuth } from '../hooks/useAuth'
import { ErrorBoundary } from '../components/errors/ErrorBoundary'
import '../global.css'

// Native splash stays up until our JS-side font load + auth resolve
// finish, so the brand mark never renders in a fallback serif. Without
// preventAutoHide here, Expo would dismiss the splash the instant the
// JS bundle finishes loading and the player would see a beat of system
// serif before Fraunces becomes available.
void SplashScreen.preventAutoHideAsync().catch(() => {
  // No-op: another path may have already hidden it (HMR reload, fast
  // refresh after a crash). Nothing to do.
})

const FADE_DURATION = 500
const LOGO_DELAY = 500
const TAGLINE_DELAY = 1200
const SUPPORT_DELAY = 2000
const HOLD_BEFORE_DISMISS = 3500
const FADE_OUT_DURATION = 350
const REDUCED_MOTION_HOLD = 1000

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutContent />
    </AuthProvider>
  )
}

function RootLayoutContent() {
  const [fontsLoaded] = useFonts({
    'Fraunces-Medium': require('../assets/fonts/Fraunces-Medium.ttf'),
    'Fraunces-MediumItalic': require('../assets/fonts/Fraunces-MediumItalic.ttf'),
  })
  const { loading: authLoading } = useAuth()
  const reducedMotion = useReducedMotion()

  const overlayOpacity = useSharedValue(1)
  const logoOpacity = useSharedValue(0)
  const taglineOpacity = useSharedValue(0)
  const supportOpacity = useSharedValue(0)
  const [overlayMounted, setOverlayMounted] = useState(true)
  const [readyToDismiss, setReadyToDismiss] = useState(false)
  // null = still checking storage, true = animate, false = skip
  const [shouldAnimate, setShouldAnimate] = useState<boolean | null>(null)
  // Guards the staged-fade effect against double-animation if the
  // component re-renders mid-fade (font reload, fast refresh). Without
  // this the withDelay timings would re-arm and stutter.
  const animationStarted = useRef(false)

  // Check whether a fresh login set the pending-splash flag. If not set,
  // the user is resuming an existing session — skip the animation and
  // dismiss the loading overlay as soon as fonts + auth are ready.
  useEffect(() => {
    AsyncStorage.getItem('oga.pending-splash')
      .then((v) => {
        if (v === '1') {
          AsyncStorage.removeItem('oga.pending-splash').catch(() => {})
          setShouldAnimate(true)
        } else {
          setShouldAnimate(false)
        }
      })
      .catch(() => setShouldAnimate(false))
  }, [])

  // Hide native splash whenever fonts are loaded; idempotent.
  useEffect(() => {
    if (!fontsLoaded) return
    SplashScreen.hideAsync().catch(() => {})
  }, [fontsLoaded])

  // Arm the staged fade choreography exactly once. animationStarted
  // gates double-arms on re-render; reducedMotion is snapshotted at
  // first-run time. A mid-fade toggle of reducedMotion is handled by
  // the second effect below — this one never re-runs once started.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!fontsLoaded || shouldAnimate !== true || animationStarted.current) return
    animationStarted.current = true
    if (reducedMotion) {
      // Skip the staged choreography but still hold briefly so the
      // brand registers as more than a single frame on slower devices.
      logoOpacity.value = 1
      taglineOpacity.value = 1
      supportOpacity.value = 1
      return
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
  }, [fontsLoaded])

  // If the user toggles reduced-motion mid-fade, honor it: cancel any
  // in-flight withDelay/withTiming and snap all text to visible. The
  // first effect's animationStarted ref keeps it from re-arming.
  useEffect(() => {
    if (!reducedMotion) return
    cancelAnimation(logoOpacity)
    cancelAnimation(taglineOpacity)
    cancelAnimation(supportOpacity)
    logoOpacity.value = 1
    taglineOpacity.value = 1
    supportOpacity.value = 1
  }, [reducedMotion, logoOpacity, taglineOpacity, supportOpacity])

  // Mark the overlay as ready to dismiss. Two paths:
  // - No animation (resuming session): ready immediately once flag check resolves.
  // - Animation: ready after the staged hold completes.
  useEffect(() => {
    if (!fontsLoaded || shouldAnimate === null) return
    if (!shouldAnimate) {
      setReadyToDismiss(true)
      return
    }
    const hold = reducedMotion ? REDUCED_MOTION_HOLD : HOLD_BEFORE_DISMISS
    const t = setTimeout(() => setReadyToDismiss(true), hold)
    return () => clearTimeout(t)
  }, [fontsLoaded, shouldAnimate, reducedMotion])

  useEffect(() => {
    if (!fontsLoaded || authLoading || !readyToDismiss || shouldAnimate === null) return
    overlayOpacity.value = withTiming(
      0,
      { duration: FADE_OUT_DURATION, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(setOverlayMounted)(false)
      },
    )
  }, [fontsLoaded, authLoading, readyToDismiss, overlayOpacity])

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }))
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
  }))
  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }))
  const supportStyle = useAnimatedStyle(() => ({
    opacity: supportOpacity.value,
  }))

  // Tap-to-skip: cancel any in-flight fade timings, snap all text to
  // visible, and start the dismiss path. Auth still gates the actual
  // unmount inside the effect above so we don't tear the overlay down
  // before the profile fetch resolves.
  const handleSkip = () => {
    if (!fontsLoaded) return
    cancelAnimation(logoOpacity)
    cancelAnimation(taglineOpacity)
    cancelAnimation(supportOpacity)
    logoOpacity.value = 1
    taglineOpacity.value = 1
    supportOpacity.value = 1
    setReadyToDismiss(true)
  }

  if (!fontsLoaded) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <ErrorBoundary>
        <Stack screenOptions={{ headerShown: false }} />
      </ErrorBoundary>
      {overlayMounted && (
        <Animated.View
          pointerEvents={authLoading || !readyToDismiss ? 'auto' : 'none'}
          style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle]}
        >
          {shouldAnimate && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip splash"
              onPress={handleSkip}
              style={styles.skipHit}
            >
              <Animated.Text style={[styles.wordmark, logoStyle]}>
                OGA
              </Animated.Text>
              <Animated.Text style={[styles.tagline, taglineStyle]}>
                Track every shot.
              </Animated.Text>
              <Animated.Text style={[styles.support, supportStyle]}>
                Free and open source · Ko-fi support appreciated
              </Animated.Text>
            </Pressable>
          )}
        </Animated.View>
      )}
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: '#1C211C',
    zIndex: 9999,
  },
  skipHit: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  wordmark: {
    color: '#FBF8F1',
    fontFamily: 'Fraunces-MediumItalic',
    fontSize: 96,
    fontStyle: 'italic',
    letterSpacing: -2,
    lineHeight: 100,
  },
  tagline: {
    color: 'rgba(242,238,229,0.85)',
    fontFamily: 'Fraunces-MediumItalic',
    fontSize: 18,
    fontStyle: 'italic',
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
