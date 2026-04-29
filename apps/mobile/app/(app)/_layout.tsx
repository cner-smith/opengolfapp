import { Tabs, Redirect } from 'expo-router'
import { useAuth } from '../../hooks/useAuth'

export default function AppLayout() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Redirect href="/(auth)/login" />
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="stats" options={{ title: 'Stats' }} />
      <Tabs.Screen name="patterns" options={{ title: 'Patterns' }} />
      <Tabs.Screen name="practice" options={{ title: 'Practice' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  )
}
