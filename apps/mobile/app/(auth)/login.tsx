import { useState } from 'react'
import { View, Text, TextInput, Pressable } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (signInError) {
      setError(signInError.message)
      return
    }
    router.replace('/(app)')
  }

  return (
    <View className="flex-1 justify-center bg-fairway-50 px-6">
      <View className="rounded-lg bg-white p-6 shadow-sm">
        <Text className="mb-6 text-2xl font-bold text-fairway-700">Sign in to OGA</Text>
        <Text className="mb-1 text-sm text-gray-600">Email</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          className="mb-3 rounded border border-gray-200 px-3 py-2"
        />
        <Text className="mb-1 text-sm text-gray-600">Password</Text>
        <TextInput
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          className="mb-4 rounded border border-gray-200 px-3 py-2"
        />
        {error && <Text className="mb-3 text-sm text-red-600">{error}</Text>}
        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          className="rounded bg-fairway-500 py-3"
        >
          <Text className="text-center font-semibold text-white">
            {loading ? 'Signing in…' : 'Sign in'}
          </Text>
        </Pressable>
        <Link href="/(auth)/signup" className="mt-4 text-center text-sm text-fairway-700">
          No account? Sign up
        </Link>
      </View>
    </View>
  )
}
