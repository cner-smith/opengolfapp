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
import { WebView } from 'react-native-webview'
import { OAuthButtons } from '../../components/auth/OAuthButtons'
import { supabase } from '../../lib/supabase'
import { TYPE } from '../../lib/typography'

const TURNSTILE_SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  // Turnstile tokens are single-use; a failed sign-in consumes the token, so
  // the widget must be remounted (key bump) to mint a fresh one — otherwise
  // the submit button stays disabled until the screen remounts. Same pattern
  // as signup's check-email screen introduced in #738.
  const [captchaNonce, setCaptchaNonce] = useState(0)

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
      setCaptchaNonce((n) => n + 1)
      return
    }
    // Route through the brand splash (plays on every login), which then
    // forwards into the app. See app/(auth)/welcome.tsx (#500).
    router.replace('/(auth)/welcome')
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F2EEE5' }}
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
          style={[TYPE.bodyBold, {
            color: '#111111',
            fontSize: 22,
            fontWeight: '600',
            marginBottom: 16,
          }]}
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
            key={captchaNonce}
            source={{ uri: `https://oga.golf/captcha.html?siteKey=${encodeURIComponent(TURNSTILE_SITE_KEY ?? '')}` }}
            // about:blank + about:srcdoc required for the Turnstile challenge
            // iframe to load inside iOS WKWebView — without them iOS filters the
            // sub-frame and the widget hangs on "Verifying…" (#405). Per
            // Cloudflare's Turnstile mobile-implementation docs.
            originWhitelist={['https://*', 'http://*', 'about:blank', 'about:srcdoc']}
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
          <Text style={[TYPE.body, { color: '#A32D2D', fontSize: 13, marginBottom: 10 }]}>
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
          <Text style={[TYPE.bodyBold, { color: '#FFFFFF', fontSize: 13 }]}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Text>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 18 }}>
          <View style={{ flex: 1, height: 0.5, backgroundColor: '#D9D2BF' }} />
          <Text
            style={[TYPE.kicker, {
              color: '#8A8B7E',
              fontSize: 10,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              marginHorizontal: 10,
            }]}
          >
            Or
          </Text>
          <View style={{ flex: 1, height: 0.5, backgroundColor: '#D9D2BF' }} />
        </View>
        <OAuthButtons />
        <Link
          href="/(auth)/signup"
          style={[TYPE.body, {
            color: '#0F6E56',
            fontSize: 13,
            marginTop: 14,
            textAlign: 'center',
          }]}
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
      style={[TYPE.body, {
        color: '#888880',
        fontSize: 11,
        fontWeight: '500',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        marginBottom: 6,
      }]}
    >
      {children}
    </Text>
  )
}
