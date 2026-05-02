import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Tabs, Redirect } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { ErrorBoundary } from '../../components/errors/ErrorBoundary'
import { UnitsProvider } from '../../contexts/UnitsContext'

const ICON_SIZE = 18
// Transient profile fetch can hang on flaky networks. After this
// timeout we surface a retry button instead of an infinite spinner.
const PROFILE_FETCH_TIMEOUT_MS = 10_000

type ProfileState = 'loading' | 'complete' | 'incomplete' | 'error'

export default function AppLayout() {
  const { user, loading: authLoading } = useAuth()
  const [profileState, setProfileState] = useState<ProfileState>('loading')
  const [retryNonce, setRetryNonce] = useState(0)

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
      .select('skill_level, goal')
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
        if (!data || !data.skill_level || !data.goal) {
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

  if (authLoading || profileState === 'loading') return null
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
        <Text
          style={{
            color: '#F2EEE5',
            fontSize: 20,
            fontWeight: '500',
            fontStyle: 'italic',
            marginBottom: 10,
            textAlign: 'center',
          }}
        >
          Something went wrong loading your profile.
        </Text>
        <Text
          style={{
            color: 'rgba(242,238,229,0.65)',
            fontSize: 14,
            textAlign: 'center',
            marginBottom: 22,
          }}
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
            style={{
              color: '#F2EEE5',
              fontSize: 14,
              fontWeight: '600',
              letterSpacing: 0.3,
            }}
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
          paddingTop: 8,
          paddingBottom: 10,
          height: 64,
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
      <Tabs.Screen name="learn" options={{ href: null }} />
      <Tabs.Screen name="rounds" options={{ href: null }} />
      <Tabs.Screen name="round/new" options={{ href: null }} />
      <Tabs.Screen name="round/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="round/[id]/hole/[number]" options={{ href: null }} />
    </Tabs>
    </UnitsProvider>
    </ErrorBoundary>
  )
}
