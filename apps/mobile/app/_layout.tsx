import { useEffect, useRef, useState } from 'react'
import { Animated, StyleSheet, Text } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
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

export default function RootLayout() {
  // Bundled Fraunces — `Fraunces9pt-SemiBold` upstream is the closest
  // 500-ish weight to "Medium" available as a static instance, so we
  // alias it under the family name the rest of the app references.
  // The italic file is the SemiBoldItalic counterpart.
  const [fontsLoaded] = useFonts({
    'Fraunces-Medium': require('../assets/fonts/Fraunces-Medium.ttf'),
    'Fraunces-MediumItalic': require('../assets/fonts/Fraunces-MediumItalic.ttf'),
  })
  const { loading: authLoading } = useAuth()

  // JS overlay handles the fade from splash → app once both fonts and
  // auth are ready. Kept as RN's built-in Animated (not Reanimated) so
  // it's mounted before any of our heavier UI work happens; one fewer
  // worklet runtime to spin up during the first paint.
  const overlayOpacity = useRef(new Animated.Value(1)).current
  const [overlayMounted, setOverlayMounted] = useState(true)

  // Hide the native splash as soon as fonts are loaded so the JS
  // overlay (using actual Fraunces) takes over with no flash. The
  // overlay itself stays opaque until auth resolves below.
  useEffect(() => {
    if (!fontsLoaded) return
    SplashScreen.hideAsync().catch(() => {})
  }, [fontsLoaded])

  // Fade the overlay out once auth has settled. Profile loading
  // continues inside (app)/_layout.tsx with its own ActivityIndicator
  // — keeping the overlay up for it would double-gate the cold start.
  useEffect(() => {
    if (!fontsLoaded || authLoading) return
    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setOverlayMounted(false)
    })
  }, [fontsLoaded, authLoading, overlayOpacity])

  // While fonts are still loading the native splash is up; rendering
  // null here keeps the JS tree empty so we never flash a fallback
  // serif "OGA" before the real font is ready.
  if (!fontsLoaded) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <ErrorBoundary>
        <Stack screenOptions={{ headerShown: false }} />
      </ErrorBoundary>
      {overlayMounted && (
        <Animated.View
          pointerEvents={authLoading ? 'auto' : 'none'}
          style={[
            StyleSheet.absoluteFill,
            styles.overlay,
            { opacity: overlayOpacity },
          ]}
        >
          <Text style={styles.wordmark}>OGA</Text>
          <Text style={styles.kicker}>OPEN GOLF APP</Text>
        </Animated.View>
      )}
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: '#1C211C',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  wordmark: {
    color: '#FBF8F1',
    fontFamily: 'Fraunces-MediumItalic',
    fontSize: 96,
    fontStyle: 'italic',
    letterSpacing: -2,
    lineHeight: 100,
  },
  kicker: {
    color: 'rgba(242,238,229,0.45)',
    fontSize: 11,
    letterSpacing: 4,
    marginTop: 14,
  },
})
