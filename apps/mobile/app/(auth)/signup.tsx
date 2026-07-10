import { useEffect, useRef, useState } from 'react'
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Link, useRouter } from 'expo-router'
import * as Linking from 'expo-linking'
import { WebView } from 'react-native-webview'
import { supabase } from '../../lib/supabase'
import { TYPE } from '../../lib/typography'

const TURNSTILE_SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY

export default function Signup() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  // Self-clearing "check your email" state (#509 field report): the deep
  // link back into the app is the happy path, but it dies in in-app mail
  // browsers and can't fire at all when the user confirms on another
  // device — GoTrue confirms server-side either way, so the account works
  // while this screen sits forever. Fallback: silently try
  // signInWithPassword (we still hold both credentials) whenever the app
  // returns to foreground — the natural "just confirmed in Mail" moment —
  // plus a manual "I've confirmed it" button. Fails "Email not confirmed"
  // until the link is tapped, succeeds right after.
  const [checking, setChecking] = useState(false)
  const [confirmHint, setConfirmHint] = useState<string | null>(null)
  // Turnstile tokens are single-use; remounting the widget (key bump)
  // mints the next one for the next attempt.
  const [captchaNonce, setCaptchaNonce] = useState(0)
  // Refs so the AppState listener and attempt logic never read stale
  // closure state.
  const captchaTokenRef = useRef<string | null>(null)
  const attemptInFlightRef = useRef(false)
  const wantAttemptRef = useRef(false)
  // Auto attempts (foreground returns) keep a minimum spacing so a user
  // fidgeting between apps can't burn GoTrue's auth rate budget on
  // speculative pre-confirmation attempts — getting rate-limited on the
  // REAL attempt would reproduce the stuck screen this exists to fix.
  // The manual button is exempt (explicit user intent).
  const lastAutoAttemptAtRef = useRef(0)

  const captchaEnabled = Boolean(TURNSTILE_SITE_KEY)
  const canSubmit = !loading && (!captchaEnabled || captchaToken !== null)

  async function tryConfirmSignIn(manual: boolean) {
    if (attemptInFlightRef.current) return
    if (!manual && Date.now() - lastAutoAttemptAtRef.current < 20_000) return
    const token = captchaTokenRef.current
    if (captchaEnabled && !token) {
      // No token yet (widget still minting after the last attempt consumed
      // one) — remember the intent; the token-arrival effect fires us.
      // Deliberately NOT stamped as an attempt — the queued retry must not
      // be suppressed by the auto-attempt interval.
      wantAttemptRef.current = true
      return
    }
    if (!manual) lastAutoAttemptAtRef.current = Date.now()
    attemptInFlightRef.current = true
    wantAttemptRef.current = false
    if (manual) setChecking(true)
    // Consume the token up front — single-use either way — and remount the
    // widget so the next attempt has a fresh one.
    captchaTokenRef.current = null
    setCaptchaToken(null)
    setCaptchaNonce((n) => n + 1)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: {
        ...(token ? { captchaToken: token } : {}),
      },
    })
    attemptInFlightRef.current = false
    setChecking(false)
    if (!signInError) {
      // Confirmed — same hand-off as login (#500 splash route).
      router.replace('/(auth)/welcome')
      return
    }
    // "Email not confirmed" is the expected pre-confirmation result; stay
    // quiet on auto attempts, give feedback on the button. Other failures
    // (network, captcha, rate limit) show their real message — masking
    // them as "not confirmed" would misdirect the user.
    if (manual) {
      setConfirmHint(
        signInError.message.toLowerCase().includes('not confirmed')
          ? 'Not confirmed yet — tap the link in your email, then try again.'
          : signInError.message,
      )
    }
  }

  // Foreground return is the natural "I just confirmed in my mail app"
  // moment — attempt (or queue) a silent sign-in.
  useEffect(() => {
    if (!submitted) return
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void tryConfirmSignIn(false)
    })
    return () => sub.remove()
    // tryConfirmSignIn is redefined every render; listing it would
    // re-subscribe the listener per render. Its mutable inputs are refs;
    // the state it reads (email/password) can't change once submitted —
    // the form is unmounted — so the captured closure stays correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted])

  // A queued attempt (foreground arrived before the widget minted a token)
  // fires as soon as the fresh token lands.
  useEffect(() => {
    if (submitted && captchaToken && wantAttemptRef.current) {
      void tryConfirmSignIn(false)
    }
    // tryConfirmSignIn omitted for the same reason as the AppState effect
    // above — per-render identity, and its closure inputs are stable
    // after submit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, captchaToken])

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
      captchaTokenRef.current = null
      setCaptchaToken(null)
      return
    }
    // Email confirmation is required, so signUp returns no session yet. Show a
    // "check your email" state rather than routing into the app; the link
    // deep-links back in via app/auth-callback.tsx once tapped, and the
    // foreground/button sign-in fallback above covers a dead deep link.
    // The signup token was consumed by signUp — drop it so the check-email
    // widget mints a fresh one for the first sign-in attempt.
    captchaTokenRef.current = null
    setCaptchaToken(null)
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
            finish setting up your account — or confirm anywhere and come back
            here.
          </Text>
          {captchaEnabled && (
            <WebView
              key={captchaNonce}
              source={{ uri: `https://oga.golf/captcha.html?siteKey=${encodeURIComponent(TURNSTILE_SITE_KEY ?? '')}` }}
              originWhitelist={['https://*', 'http://*', 'about:blank', 'about:srcdoc']}
              onMessage={(event) => {
                try {
                  const msg = JSON.parse(event.nativeEvent.data)
                  if (msg.type === 'success') {
                    captchaTokenRef.current = msg.token
                    setCaptchaToken(msg.token)
                  } else {
                    captchaTokenRef.current = null
                    setCaptchaToken(null)
                  }
                } catch {
                  // ignore non-JSON WebView messages
                }
              }}
              style={{ height: 65, marginTop: 16 }}
              scrollEnabled={false}
            />
          )}
          {confirmHint && (
            <Text
              style={[TYPE.body, { fontSize: 13, marginTop: 12 }]}
              className="text-oga-text-muted"
            >
              {confirmHint}
            </Text>
          )}
          <Pressable
            onPress={() => void tryConfirmSignIn(true)}
            disabled={checking || (captchaEnabled && !captchaToken)}
            className="bg-oga-black"
            style={{
              borderRadius: 10,
              paddingVertical: 13,
              alignItems: 'center',
              marginTop: 16,
              opacity: checking || (captchaEnabled && !captchaToken) ? 0.5 : 1,
            }}
          >
            <Text style={[TYPE.bodyBold, { fontSize: 13 }]} className="text-white">
              {checking ? 'Checking…' : "I've confirmed it"}
            </Text>
          </Pressable>
          <Link href="/(auth)/login" asChild>
            <Text
              style={[TYPE.body, { fontSize: 13, marginTop: 14, textAlign: 'center' }]}
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
            // about:blank + about:srcdoc required for the Turnstile challenge
            // iframe to load inside iOS WKWebView — without them iOS filters the
            // sub-frame and the widget hangs on "Verifying…" (#405). Per
            // Cloudflare's Turnstile mobile-implementation docs.
            originWhitelist={['https://*', 'http://*', 'about:blank', 'about:srcdoc']}
            onMessage={(event) => {
              try {
                const msg = JSON.parse(event.nativeEvent.data)
                if (msg.type === 'success') {
                  captchaTokenRef.current = msg.token
                  setCaptchaToken(msg.token)
                } else {
                  captchaTokenRef.current = null
                  setCaptchaToken(null)
                }
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
          <Text style={[TYPE.bodyBold, { fontSize: 13 }]} className="text-white">
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
