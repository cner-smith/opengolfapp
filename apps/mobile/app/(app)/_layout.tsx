import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { Tabs, Redirect } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { StatusBar } from 'expo-status-bar'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { ErrorBoundary } from '../../components/errors/ErrorBoundary'
import { UnitsProvider } from '../../contexts/UnitsContext'
import { TYPE } from '../../lib/typography'

const ICON_SIZE = 18
// Transient profile fetch can hang on flaky networks. After this
// timeout we surface a retry button instead of an infinite spinner.
const PROFILE_FETCH_TIMEOUT_MS = 10_000

type ProfileState = 'loading' | 'complete' | 'incomplete' | 'error'

export default function AppLayout() {
  const { user, loading: authLoading } = useAuth()
  const [profileState, setProfileState] = useState<ProfileState>('loading')
  const [retryNonce, setRetryNonce] = useState(0)
  const insets = useSafeAreaInsets()

  useEffect(() => {
    if (authLoading) return
    if (!user) return

    let active = true
    setProfileState('loading')

    const timeoutId = setTimeout(() => {
      if (active) setProfileState('error')
    }, PROFILE_FETCH_TIMEOUT_MS)

    supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return
        clearTimeout(timeoutId)
        if (error) {
          // eslint-disable-next-line no-console
          console.error('[(app)/_layout]', error.message)
          setProfileState('error')
          return
        }
        if (!data || !data.onboarding_completed) {
          setProfileState('incomplete')
        } else {
          setProfileState('complete')
        }
      })
    return () => {
      active = false
      clearTimeout(timeoutId)
    }
  }, [user, authLoading, retryNonce])

  if (authLoading || profileState === 'loading') {
    // Match the native splash screen's dark background so the cold-start
    // transition into the React tree doesn't flash a white frame.
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#1C211C',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <StatusBar style="light" animated />
        <ActivityIndicator color="#E8E4DC" />
      </View>
    )
  }
  if (!user) return <Redirect href="/(auth)/login" />
  if (profileState === 'error') {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#1C211C',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 28,
        }}
      >
        <StatusBar style="light" animated />
        <Text
          style={[TYPE.serif, {
            color: '#F2EEE5',
            fontSize: 20,
            fontWeight: '500',
            fontStyle: 'italic',
            marginBottom: 10,
            textAlign: 'center',
          }]}
        >
          Something went wrong loading your profile.
        </Text>
        <Text
          style={[TYPE.body, {
            color: 'rgba(242,238,229,0.65)',
            fontSize: 14,
            textAlign: 'center',
            marginBottom: 22,
          }]}
        >
          Check your connection, then try again.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Try again"
          onPress={() => setRetryNonce((n) => n + 1)}
          style={{
            backgroundColor: '#1F3D2C',
            borderRadius: 2,
            paddingVertical: 14,
            paddingHorizontal: 22,
          }}
        >
          <Text
            style={[TYPE.bodyBold, {
              color: '#F2EEE5',
              fontSize: 14,
              fontWeight: '600',
              letterSpacing: 0.3,
            }]}
          >
            Try again
          </Text>
        </Pressable>
      </View>
    )
  }
  if (profileState === 'incomplete') return <Redirect href="/(auth)/onboarding" />

  return (
    <ErrorBoundary>
    <UnitsProvider>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FBF8F1',
          borderTopWidth: 1,
          borderTopColor: '#D9D2BF',
          // Explicit height + paddingBottom from safe-area insets (#300).
          // Explicit height + paddingBottom from safe-area insets (#300).
          // Platform-neutral. height and paddingBottom carry an equal +8 over
          // the base 54/10 so the content band [paddingTop, height-paddingBottom]
          // is unchanged (no cramping) but the whole bar grows 8px at the bottom
          // — lifting the icon+label ~8px off the bottom edge (device QA: label
          // sat too low on a Galaxy S23). Keep top/bottom moving together if you
          // retune; do NOT re-add Platform.OS bumps (the 49a283b regression).
          paddingTop: 8,
          height: 62 + insets.bottom,
          paddingBottom: insets.bottom + 18,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          letterSpacing: 0.4,
        },
        tabBarActiveTintColor: '#1F3D2C',
        tabBarInactiveTintColor: '#8A8B7E',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="home-outline" color={color} size={ICON_SIZE} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="chart-line" color={color} size={ICON_SIZE} />
          ),
        }}
      />
      <Tabs.Screen
        name="patterns"
        options={{
          title: 'Patterns',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons
              name="target-variant"
              color={color}
              size={ICON_SIZE}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="practice"
        options={{
          title: 'Practice',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="golf-tee" color={color} size={ICON_SIZE} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons
              name="account-circle-outline"
              color={color}
              size={ICON_SIZE}
            />
          ),
        }}
      />
      {/* Learn is a nested stack (learn/_layout.tsx owns index + [article]),
          so it collapses to a single hidden tab route. This is what makes
          "← Back" from an article pop to the list instead of the Home tab. */}
      <Tabs.Screen name="learn" options={{ href: null }} />
      <Tabs.Screen name="bag" options={{ href: null }} />
      <Tabs.Screen name="rounds" options={{ href: null }} />
      <Tabs.Screen name="round/new" options={{ href: null }} />
      {/* Live round is full-bleed — hide the tab bar entirely while it's
          focused (not just the tab button) to reclaim the bottom strip. */}
      <Tabs.Screen
        name="round/[id]/index"
        options={{ href: null, tabBarStyle: { display: 'none' } }}
      />
    </Tabs>
    </UnitsProvider>
    </ErrorBoundary>
  )
}
