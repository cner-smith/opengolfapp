import { Redirect } from 'expo-router'
import { View, Text } from 'react-native'
import { useAuth } from '../hooks/useAuth'
import { TYPE } from '../lib/typography'

export default function Index() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2EEE5' }}>
        <Text style={[TYPE.body, { color: '#5C6356', fontSize: 14 }]}>Loading…</Text>
      </View>
    )
  }
  if (!user) return <Redirect href="/(auth)/login" />
  return <Redirect href="/(app)" />
}
