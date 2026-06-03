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
import { Link } from 'expo-router'
import * as Linking from 'expo-linking'
import { WebView } from 'react-native-webview'
import { supabase } from '../../lib/supabase'
import { TYPE } from '../../lib/typography'

const TURNSTILE_SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY

export default function Signup() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const captchaEnabled = Boolean(TURNSTILE_SITE_KEY)
  const canSubmit = !loading && (!captchaEnabled || captchaToken !== null)

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        // Deep link the confirmation email back into the app (handled by
        // app/auth-callback.tsx). Without this, GoTrue falls back to the
        // project Site URL (a localhost/web URL) and never returns to mobile.
        emailRedirectTo: Linking.createURL('auth-callback'),
        ...(captchaToken ? { captchaToken } : {}),
      },
    })
    setLoading(false)
    if (signUpError) {
      setError(signUpError.message)
      setCaptchaToken(null)
      return
    }
    // Email confirmation is required, so signUp returns no session yet. Show a
    // "check your email" state rather than routing into the app; the link
    // deep-links back in via app/auth-callback.tsx once tapped.
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <View className="flex-1 bg-oga-bg-page items-center justify-center px-6">
        <View
          className="border-oga-border bg-oga-bg-card"
          style={{ borderRadius: 10, borderWidth: 0.5, padding: 20, width: '100%' }}
        >
          <Text
            style={[TYPE.bodyBold, { fontSize: 22, fontWeight: '600', marginBottom: 12 }]}
            className="text-oga-text-primary"
          >
            Check your email
          </Text>
          <Text
            style={[TYPE.body, { fontSize: 14, lineHeight: 20 }]}
            className="text-oga-text-muted"
          >
            We sent a confirmation link to {email}. Open it on this device to
            finish setting up your account.
          </Text>
          <Link href="/(auth)/login" asChild>
            <Text
              style={[TYPE.body, { fontSize: 13, marginTop: 18 }]}
              className="text-oga-green"
            >
              Back to sign in
            </Text>
          </Link>
        </View>
      </View>
    )
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
        className="border-oga-border bg-oga-bg-card"
        style={{ borderRadius: 10, borderWidth: 0.5, padding: 20 }}
      >
        <Text
          style={[TYPE.bodyBold, { fontSize: 22, fontWeight: '600', marginBottom: 16 }]}
          className="text-oga-text-primary"
        >
          Create your OGA account
        </Text>
        <FieldLabel>Username</FieldLabel>
        <TextInput
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
          className="bg-oga-bg-input border-oga-border text-oga-text-primary"
          style={inputStyle}
        />
        <FieldLabel>Email</FieldLabel>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          className="bg-oga-bg-input border-oga-border text-oga-text-primary"
          style={inputStyle}
        />
        <FieldLabel>Password</FieldLabel>
        <TextInput
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          className="bg-oga-bg-input border-oga-border text-oga-text-primary"
          style={{ ...inputStyle, marginBottom: 14 }}
        />
        {captchaEnabled && (
          <WebView
            source={{ uri: `https://oga.golf/captcha.html?siteKey=${encodeURIComponent(TURNSTILE_SITE_KEY ?? '')}` }}
            originWhitelist={['https://*', 'http://*', 'about:']}
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
          <Text style={[TYPE.body, { fontSize: 13, marginBottom: 10 }]} className="text-oga-red">
            {error}
          </Text>
        )}
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          className="bg-oga-black"
          style={{
            borderRadius: 10,
            paddingVertical: 13,
            alignItems: 'center',
            opacity: !canSubmit ? 0.5 : 1,
          }}
        >
          <Text style={[TYPE.body, { fontSize: 13, fontWeight: '500' }]} className="text-white">
            {loading ? 'Creating…' : 'Create account'}
          </Text>
        </Pressable>
        <Link href="/(auth)/login" asChild>
          <Text
            style={[TYPE.body, { fontSize: 13, marginTop: 14, textAlign: 'center' }]}
            className="text-oga-green"
          >
            Have an account? Sign in
          </Text>
        </Link>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// Colors come from the design tokens applied via className on each input
// (bg-oga-bg-input / border-oga-border / text-oga-text-primary); this holds
// the shared layout only.
const inputStyle = {
  borderWidth: 0.5,
  borderRadius: 7,
  paddingHorizontal: 10,
  paddingVertical: 9,
  fontSize: 13,
  marginBottom: 12,
} as const

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={[TYPE.body, {
        fontSize: 11,
        fontWeight: '500',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        marginBottom: 6,
      }]}
      className="text-oga-text-hint"
    >
      {children}
    </Text>
  )
}
