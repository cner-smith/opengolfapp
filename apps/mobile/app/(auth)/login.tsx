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
    <View className="flex-1 justify-center bg-oga-bg-page px-6">
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 10,
          borderWidth: 0.5,
          borderColor: '#E4E4E0',
          padding: 20,
        }}
      >
        <Text
          style={{
            color: '#111111',
            fontSize: 22,
            fontWeight: '600',
            marginBottom: 16,
          }}
        >
          Sign in to OGA
        </Text>
        <FieldLabel>Email</FieldLabel>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={inputStyle}
        />
        <FieldLabel>Password</FieldLabel>
        <TextInput
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={{ ...inputStyle, marginBottom: 14 }}
        />
        {error && (
          <Text style={{ color: '#A32D2D', fontSize: 13, marginBottom: 10 }}>
            {error}
          </Text>
        )}
        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          style={{
            backgroundColor: '#111111',
            borderRadius: 10,
            paddingVertical: 13,
            alignItems: 'center',
            opacity: loading ? 0.5 : 1,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '500' }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Text>
        </Pressable>
        <Link
          href="/(auth)/signup"
          style={{
            color: '#0F6E56',
            fontSize: 13,
            marginTop: 14,
            textAlign: 'center',
          }}
        >
          No account? Sign up
        </Link>
      </View>
    </View>
  )
}

const inputStyle = {
  backgroundColor: '#F9F9F6',
  borderWidth: 0.5,
  borderColor: '#E4E4E0',
  borderRadius: 7,
  paddingHorizontal: 10,
  paddingVertical: 9,
  fontSize: 13,
  color: '#111111',
  marginBottom: 12,
} as const

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        color: '#888880',
        fontSize: 11,
        fontWeight: '500',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        marginBottom: 6,
      }}
    >
      {children}
    </Text>
  )
}
