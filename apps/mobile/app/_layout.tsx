import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
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
const LOGO_DELAY = 300
const TAGLINE_DELAY = 900
const SUPPORT_DELAY = 1500
const HOLD_BEFORE_DISMISS = 3500
const FADE_OUT_DURATION = 350

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

  const overlayOpacity = useSharedValue(1)
  const logoOpacity = useSharedValue(0)
  const taglineOpacity = useSharedValue(0)
  const supportOpacity = useSharedValue(0)
  const [overlayMounted, setOverlayMounted] = useState(true)
  const [readyToDismiss, setReadyToDismiss] = useState(false)

  useEffect(() => {
    if (!fontsLoaded) return
    SplashScreen.hideAsync().catch(() => {})
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
  }, [fontsLoaded, logoOpacity, taglineOpacity, supportOpacity])

  // Mark the overlay as ready to dismiss after the staged fade-ins
  // settle. The actual dismiss waits on auth too — we never tear the
  // overlay down while a profile fetch is still in flight.
  useEffect(() => {
    if (!fontsLoaded) return
    const t = setTimeout(() => setReadyToDismiss(true), HOLD_BEFORE_DISMISS)
    return () => clearTimeout(t)
  }, [fontsLoaded])

  useEffect(() => {
    if (!fontsLoaded || authLoading || !readyToDismiss) return
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

  // Tap-to-skip: collapse remaining timeouts and start the fade-out
  // immediately, but only after fonts are ready (otherwise we'd unmount
  // the overlay while the bundle is still booting and flash the system
  // serif). Auth still gates the actual unmount inside the effect above.
  const handleSkip = () => {
    if (!fontsLoaded) return
    logoOpacity.value = withTiming(1, { duration: 0 })
    taglineOpacity.value = withTiming(1, { duration: 0 })
    supportOpacity.value = withTiming(1, { duration: 0 })
    setReadyToDismiss(true)
  }

  if (!fontsLoaded) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <ErrorBoundary>
        <Stack screenOptions={{ headerShown: false }} />
      </ErrorBoundary>
      {overlayMounted && (
        <Animated.View
          pointerEvents={authLoading || !readyToDismiss ? 'auto' : 'none'}
          style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle]}
        >
          <Pressable onPress={handleSkip} style={styles.skipHit}>
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
