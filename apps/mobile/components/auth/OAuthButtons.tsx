import { useState } from 'react'
import { Text, View } from 'react-native'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { PressableTouch } from '../ui/PressableTouch'
import { supabase } from '../../lib/supabase'
import { TYPE } from '../../lib/typography'

const REDIRECT = 'oga://auth-callback'

export function OAuthButtons() {
  const [error, setError] = useState<string | null>(null)

  async function signInWithGoogle() {
    setError(null)
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
  }

  return (
    <View style={{ gap: 10 }}>
      <PressableTouch
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        onPress={signInWithGoogle}
        style={{ borderWidth: 1, borderColor: '#D9D2BF', borderRadius: 2, paddingVertical: 12, alignItems: 'center' }}
      >
        <Text style={[TYPE.body, { color: '#1C211C', fontSize: 15 }]}>Continue with Google</Text>
      </PressableTouch>
      {error && <Text style={[TYPE.body, { color: '#A33A2A', fontSize: 13 }]}>{error}</Text>}
    </View>
  )
}
