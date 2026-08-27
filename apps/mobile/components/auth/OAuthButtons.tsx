import { useState } from 'react'
import { Platform, Text, View } from 'react-native'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as Crypto from 'expo-crypto'
import Svg, { Path } from 'react-native-svg'
import { PressableTouch } from '../ui/PressableTouch'
import { supabase } from '../../lib/supabase'
import { TYPE } from '../../lib/typography'

// Official Google "G" logomark — required by Google's sign-in branding
// guidelines (recognizable multi-color mark, not a generic icon or
// wordmark substitute). Same path data/colors as the web button
// (apps/web/src/components/auth/GoogleSignInButton.tsx) so both
// platforms render the identical official mark.
function GoogleGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path
        fill="#4285F4"
        d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"
      />
      <Path
        fill="#34A853"
        d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.8582-3.0477.8582-2.3436 0-4.3282-1.5831-5.0359-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"
      />
      <Path
        fill="#FBBC05"
        d="M3.9641 10.71c-.18-.54-.2827-1.1168-.2827-1.71s.1027-1.17.2827-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.9641 10.71z"
      />
      <Path
        fill="#EA4335"
        d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5814-2.5814C13.4632.891 11.4259 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.9641 7.29C4.6718 5.1627 6.6564 3.5795 9 3.5795z"
      />
    </Svg>
  )
}

const REDIRECT = 'oga://auth-callback'

export function OAuthButtons() {
  const [error, setError] = useState<string | null>(null)
  // Shared in-flight guard: covers Google here and the Apple handler Task 5
  // adds to this same component, so only one provider sheet can be open
  // (and one button dimmed) at a time.
  const [busy, setBusy] = useState(false)

  async function signInWithGoogle() {
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: REDIRECT, skipBrowserRedirect: true },
      })
      if (oauthError || !data?.url) {
        setError('Could not start Google sign-in.')
        return
      }
      const res = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT)
      if (res.type !== 'success') return // user dismissed the sheet — no-op
      const code = Linking.parse(res.url).queryParams?.code
      if (typeof code !== 'string') {
        setError('Google sign-in did not complete.')
        return
      }
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      if (exchangeError) {
        setError('Could not complete Google sign-in.')
        return
      }
      router.replace('/(auth)/welcome')
    } catch {
      // openAuthSessionAsync rejects if a session sheet is already presented,
      // and any other step in the chain can throw — surface one neutral
      // message rather than an unhandled rejection.
      setError('Could not complete Google sign-in.')
    } finally {
      setBusy(false)
    }
  }

  async function signInWithApple() {
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      const rawNonce = Crypto.randomUUID() // CSPRNG
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce)
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      })
      if (!credential.identityToken) {
        setError('Could not sign in with Apple.')
        return
      }
      const { error: idError } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      })
      if (idError) {
        setError('Could not sign in with Apple.')
        return
      }
      router.replace('/(auth)/welcome')
    } catch (e) {
      if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return // user cancel — no-op
      setError('Could not sign in with Apple.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={{ gap: 10 }}>
      <PressableTouch
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        onPress={signInWithGoogle}
        disabled={busy}
        style={{
          flexDirection: 'row',
          borderWidth: 1,
          borderColor: '#D9D2BF',
          borderRadius: 2,
          paddingVertical: 12,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: busy ? 0.5 : 1,
        }}
      >
        <GoogleGlyph />
        <Text style={[TYPE.body, { color: '#1C211C', fontSize: 15, marginLeft: 10 }]}>Continue with Google</Text>
      </PressableTouch>
      {Platform.OS === 'ios' && (
        <View pointerEvents={busy ? 'none' : 'auto'} style={{ opacity: busy ? 0.5 : 1 }}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={2}
            style={{ width: '100%', height: 44 }}
            onPress={signInWithApple}
          />
        </View>
      )}
      {error && <Text style={[TYPE.body, { color: '#A33A2A', fontSize: 13 }]}>{error}</Text>}
    </View>
  )
}
