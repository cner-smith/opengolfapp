import { useEffect, useState } from 'react'
import { StyleSheet } from 'react-native'
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
  withTiming,
} from 'react-native-reanimated'
import { AuthProvider } from '../contexts/AuthContext'
import { useAuth } from '../hooks/useAuth'
import { ErrorBoundary } from '../components/errors/ErrorBoundary'
import '../global.css'

// Native splash stays up until our JS-side font load finishes so the brand
// mark never renders in a fallback serif. The animated brand splash now lives
// in app/(auth)/welcome.tsx (shown after every login); this layout keeps only
// a brief loading gate over the cold-start auth-resolve window.
void SplashScreen.preventAutoHideAsync().catch(() => {
  // No-op: another path may have already hidden it (HMR reload, fast refresh).
})

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
    'Inconsolata-Medium': require('../assets/fonts/Inconsolata-Medium.ttf'),
    'Inconsolata-Regular': require('../assets/fonts/Inconsolata-Regular.ttf'),
  })
  const { loading: authLoading } = useAuth()

  const gateOpacity = useSharedValue(1)
  const [gateMounted, setGateMounted] = useState(true)

  // Hide the native splash once fonts are ready (idempotent).
  useEffect(() => {
    if (!fontsLoaded) return
    SplashScreen.hideAsync().catch(() => {})
  }, [fontsLoaded])

  // Fade the loading gate out once fonts + auth both resolve — it bridges the
  // gap between native-splash dismissal and the first real frame so the app
  // never flashes a half-resolved screen on cold start.
  useEffect(() => {
    if (!fontsLoaded || authLoading) return
    gateOpacity.value = withTiming(
      0,
      { duration: FADE_OUT_DURATION, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(setGateMounted)(false)
      },
    )
  }, [fontsLoaded, authLoading, gateOpacity])

  const gateStyle = useAnimatedStyle(() => ({ opacity: gateOpacity.value }))

  if (!fontsLoaded) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* The loading gate is near-black (#1C211C); force light icons while it
          covers the screen, then auto-resolve takes over. */}
      <StatusBar style={gateMounted ? 'light' : 'auto'} animated />
      <ErrorBoundary>
        <Stack screenOptions={{ headerShown: false }} />
      </ErrorBoundary>
      {gateMounted && (
        <Animated.View
          pointerEvents={authLoading ? 'auto' : 'none'}
          style={[StyleSheet.absoluteFill, styles.gate, gateStyle]}
        />
      )}
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  gate: {
    backgroundColor: '#1C211C',
    zIndex: 9999,
  },
})
