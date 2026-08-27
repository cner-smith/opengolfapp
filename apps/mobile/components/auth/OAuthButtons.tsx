import { useState } from 'react'
import { Platform, Text, View } from 'react-native'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as Crypto from 'expo-crypto'
import { PressableTouch } from '../ui/PressableTouch'
import { supabase } from '../../lib/supabase'
import { TYPE } from '../../lib/typography'

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
        style={{ borderWidth: 1, borderColor: '#D9D2BF', borderRadius: 2, paddingVertical: 12, alignItems: 'center' }}
      >
        <Text style={[TYPE.body, { color: '#1C211C', fontSize: 15 }]}>Continue with Google</Text>
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
