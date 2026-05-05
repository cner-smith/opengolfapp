import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import * as SplashScreen from 'expo-splash-screen'
import { useAuth } from '../hooks/useAuth'
import { ErrorBoundary } from '../components/errors/ErrorBoundary'
import '../global.css'

// Keep the splash up until React has mounted and auth state is
// resolved. Module-level call is the canonical Expo pattern — Expo
// auto-hides on JS bridge ready otherwise, which would flash a blank
// screen for the ~hundreds of ms it takes to read the persisted
// session out of secure-store on cold start.
void SplashScreen.preventAutoHideAsync().catch(() => {
  // No-op: the call can fail if it's already been hidden by some
  // other path (HMR reload, unhandled error). Either way the splash
  // is gone and we're past the warm-up.
})

export default function RootLayout() {
  // Hides the splash as soon as auth resolves to a known state
  // (signed in OR signed out). Profile loading happens inside
  // (app)/_layout.tsx with its own ActivityIndicator — keeping the
  // splash up for it would double-gate the cold start, so we drop
  // out here and let the inner layout's spinner take over.
  const { loading: authLoading } = useAuth()
  useEffect(() => {
    if (authLoading) return
    SplashScreen.hideAsync().catch(() => {})
  }, [authLoading])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <ErrorBoundary>
        <Stack screenOptions={{ headerShown: false }} />
      </ErrorBoundary>
    </GestureHandlerRootView>
  )
}
