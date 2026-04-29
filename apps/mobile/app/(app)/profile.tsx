import { View, Text, Pressable } from 'react-native'
import { supabase } from '../../lib/supabase'

export default function Profile() {
  return (
    <View className="flex-1 items-center justify-center bg-fairway-50 p-6">
      <Text className="mb-6 text-xl font-bold text-fairway-700">Profile</Text>
      <Pressable
        onPress={() => supabase.auth.signOut()}
        className="rounded bg-fairway-500 px-6 py-3"
      >
        <Text className="font-semibold text-white">Sign out</Text>
      </Pressable>
    </View>
  )
}
