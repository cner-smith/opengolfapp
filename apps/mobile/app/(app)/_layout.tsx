import { useEffect, useState } from 'react'
import { Tabs, Redirect } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { ErrorBoundary } from '../../components/errors/ErrorBoundary'
import { UnitsProvider } from '../../contexts/UnitsContext'

const ICON_SIZE = 18

type ProfileState = 'loading' | 'complete' | 'incomplete'

export default function AppLayout() {
  const { user, loading: authLoading } = useAuth()
  const [profileState, setProfileState] = useState<ProfileState>('loading')

  useEffect(() => {
    if (authLoading) return
    if (!user) return

    let active = true
    supabase
      .from('profiles')
      .select('skill_level, goal')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          // eslint-disable-next-line no-console
          console.error('[(app)/_layout]', error.message)
          // Treat as incomplete is the wrong call for a transient error;
          // leave the user on the loading state until the next render
          // can retry. Setting incomplete here would punt them to
          // onboarding and clobber their saved profile.
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
    }
  }, [user, authLoading])

  if (authLoading || profileState === 'loading') return null
  if (!user) return <Redirect href="/(auth)/login" />
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
      <Tabs.Screen name="round/new" options={{ href: null }} />
      <Tabs.Screen name="round/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="round/[id]/hole/[number]" options={{ href: null }} />
    </Tabs>
    </UnitsProvider>
    </ErrorBoundary>
  )
}
