import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Link, useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { WebView } from 'react-native-webview'
import { supabase } from '../../lib/supabase'

const TURNSTILE_SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)

  const captchaEnabled = Boolean(TURNSTILE_SITE_KEY)
  const canSubmit = !loading && (!captchaEnabled || captchaToken !== null)

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: {
        ...(captchaToken ? { captchaToken } : {}),
      },
    })
    setLoading(false)
    if (signInError) {
      setError(signInError.message)
      setCaptchaToken(null)
      return
    }
    await AsyncStorage.setItem('oga.pending-splash', '1').catch(() => {})
    router.replace('/(app)')
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-oga-bg-page"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingVertical: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
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
        {captchaEnabled && (
          <WebView
            source={{ uri: `https://oga.golf/captcha.html?siteKey=${TURNSTILE_SITE_KEY}` }}
            originWhitelist={['https://*', 'http://*']}
            onMessage={(event) => {
              try {
                const msg = JSON.parse(event.nativeEvent.data)
                if (msg.type === 'success') setCaptchaToken(msg.token)
                else setCaptchaToken(null)
              } catch {
                // ignore non-JSON WebView messages
              }
            }}
            style={{ height: 65, marginBottom: 14 }}
            scrollEnabled={false}
          />
        )}
        {error && (
          <Text style={{ color: '#A32D2D', fontSize: 13, marginBottom: 10 }}>
            {error}
          </Text>
        )}
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          style={{
            backgroundColor: '#111111',
            borderRadius: 10,
            paddingVertical: 13,
            alignItems: 'center',
            opacity: !canSubmit ? 0.5 : 1,
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
      </ScrollView>
    </KeyboardAvoidingView>
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
