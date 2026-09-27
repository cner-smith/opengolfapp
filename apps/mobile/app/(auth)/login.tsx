import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Link, useRouter } from 'expo-router'
import { WebView } from 'react-native-webview'
import { OAuthButtons } from '../../components/auth/OAuthButtons'
import { supabase } from '../../lib/supabase'
import { FONT, TYPE } from '../../lib/typography'
import { Key, KeyText, PaperSurface } from '../../components/paper/Paper'
import { PaperTile } from '../../components/paper/Section'
import { FONT_CAP, P, R } from '../../components/paper/tokens'

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
    <PaperSurface style={{ flex: 1 }}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
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
      <PaperTile innerStyle={{ padding: 20 }}>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { color: P.ink, fontSize: 26, lineHeight: 32, marginBottom: 16 }]}>
          Sign in to OGA
        </Text>
        <FieldLabel>Email</FieldLabel>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          maxFontSizeMultiplier={FONT_CAP}
          style={inputStyle}
        />
        <FieldLabel>Password</FieldLabel>
        <TextInput
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          maxFontSizeMultiplier={FONT_CAP}
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
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.neg, fontSize: 13, marginBottom: 10 }]}>
            {error}
          </Text>
        )}
        <Key
          tone="primary"
          accessibilityLabel="Sign in"
          onPress={handleSubmit}
          disabled={!canSubmit}
          faceStyle={{ minHeight: 48 }}
        >
          <KeyText tone="primary" bold size={15} disabled={!canSubmit}>
            {loading ? 'Signing in…' : 'Sign in'}
          </KeyText>
        </Key>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 18 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: P.line }} />
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12, marginHorizontal: 10 }]}>
            Or
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: P.line }} />
        </View>
        <OAuthButtons />
        <Link
          href="/(auth)/signup"
          maxFontSizeMultiplier={FONT_CAP}
          style={[TYPE.body, {
            color: P.forest,
            fontSize: 13,
            marginTop: 14,
            textAlign: 'center',
          }]}
        >
          No account? Sign up
        </Link>
      </PaperTile>
      </ScrollView>
    </KeyboardAvoidingView>
    </PaperSurface>
  )
}

const inputStyle = {
  backgroundColor: P.raised,
  borderWidth: 1,
  borderColor: P.ink,
  borderRadius: R,
  paddingHorizontal: 12,
  paddingVertical: 11,
  fontSize: 15,
  color: P.ink,
  fontFamily: FONT.body,
  marginBottom: 12,
} as const

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12, marginBottom: 6 }]}>
      {children}
    </Text>
  )
}
