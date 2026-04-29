import { Redirect } from 'expo-router'
import { View, Text } from 'react-native'
import { useAuth } from '../hooks/useAuth'

export default function Index() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-fairway-50">
        <Text className="text-fairway-700">Loading…</Text>
      </View>
    )
  }
  if (!user) return <Redirect href="/(auth)/login" />
  return <Redirect href="/(app)" />
}
