import { useEffect, useState } from 'react'
import { Tabs, Redirect } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

const ICON_SIZE = 20

type ProfileState = 'loading' | 'complete' | 'incomplete'

export default function AppLayout() {
  const { user, loading: authLoading } = useAuth()
  const [profileState, setProfileState] = useState<ProfileState>('loading')

  useEffect(() => {
    if (authLoading) return
    if (!user) return

    supabase
      .from('profiles')
      .select('skill_level, goal')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data || !data.skill_level || !data.goal) {
          setProfileState('incomplete')
        } else {
          setProfileState('complete')
        }
      })
  }, [user, authLoading])

  if (authLoading || profileState === 'loading') return null
  if (!user) return <Redirect href="/(auth)/login" />
  if (profileState === 'incomplete') return <Redirect href="/(auth)/onboarding" />

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0.5,
          borderTopColor: '#E4E4E0',
          paddingTop: 8,
          paddingBottom: 10,
          height: 64,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
        tabBarActiveTintColor: '#1D9E75',
        tabBarInactiveTintColor: '#AAAAAA',
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
      <Tabs.Screen name="round/new" options={{ href: null }} />
      <Tabs.Screen name="round/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="round/[id]/hole/[number]" options={{ href: null }} />
    </Tabs>
  )
}
