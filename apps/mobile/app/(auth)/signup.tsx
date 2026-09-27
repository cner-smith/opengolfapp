import { useEffect, useRef, useState } from 'react'
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Link, useRouter } from 'expo-router'
import * as Linking from 'expo-linking'
import { WebView } from 'react-native-webview'
import { OAuthButtons } from '../../components/auth/OAuthButtons'
import { supabase } from '../../lib/supabase'
import { FONT, TYPE } from '../../lib/typography'
import { Key, KeyText, PaperSurface } from '../../components/paper/Paper'
import { PaperTile } from '../../components/paper/Section'
import { FONT_CAP, P, R } from '../../components/paper/tokens'

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
      // Token was consumed by the failed attempt — remount the widget so a
      // fresh one can mint; otherwise Create account stays disabled (same
      // single-use mechanism as the check-email screen + login).
      setCaptchaNonce((n) => n + 1)
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
      <PaperSurface style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <PaperTile style={{ width: '100%' }} innerStyle={{ padding: 20 }}>
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { fontSize: 26, lineHeight: 32, marginBottom: 12, color: P.ink }]}>
            Check your email
          </Text>
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 14, lineHeight: 20, color: P.inkDim }]}>
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
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 13, marginTop: 12, color: P.inkDim }]}>
              {confirmHint}
            </Text>
          )}
          <Key
            tone="primary"
            accessibilityLabel="I've confirmed it"
            onPress={() => void tryConfirmSignIn(true)}
            disabled={checking || (captchaEnabled && !captchaToken)}
            style={{ marginTop: 16 }}
            faceStyle={{ minHeight: 48 }}
          >
            <KeyText tone="primary" bold size={15} disabled={checking || (captchaEnabled && !captchaToken)}>
              {checking ? 'Checking…' : "I've confirmed it"}
            </KeyText>
          </Key>
          <Link href="/(auth)/login" asChild>
            <Text
              maxFontSizeMultiplier={FONT_CAP}
              style={[TYPE.body, { fontSize: 13, marginTop: 14, textAlign: 'center', color: P.forest }]}
            >
              Back to sign in
            </Text>
          </Link>
        </PaperTile>
      </PaperSurface>
    )
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
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { fontSize: 26, lineHeight: 32, marginBottom: 16, color: P.ink }]}>
          Create your OGA account
        </Text>
        <FieldLabel>Username</FieldLabel>
        <TextInput
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
          maxFontSizeMultiplier={FONT_CAP}
          style={inputStyle}
        />
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
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 13, marginBottom: 10, color: P.neg }]}>
            {error}
          </Text>
        )}
        <Key
          tone="primary"
          accessibilityLabel="Create account"
          onPress={handleSubmit}
          disabled={!canSubmit}
          faceStyle={{ minHeight: 48 }}
        >
          <KeyText tone="primary" bold size={15} disabled={!canSubmit}>
            {loading ? 'Creating…' : 'Create account'}
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
        <Link href="/(auth)/login" asChild>
          <Text
            maxFontSizeMultiplier={FONT_CAP}
            style={[TYPE.body, { fontSize: 13, marginTop: 14, textAlign: 'center', color: P.forest }]}
          >
            Have an account? Sign in
          </Text>
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
