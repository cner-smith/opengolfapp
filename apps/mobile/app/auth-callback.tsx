import { useEffect, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import * as Linking from 'expo-linking'
import { supabase } from '../lib/supabase'
import { TYPE } from '../lib/typography'

// Deep-link target for email confirmation (signup sends
// `emailRedirectTo: oga://auth-callback`). GoTrue verifies the token
// server-side, then redirects here with the session in the URL *fragment*
// (implicit flow — the native client is `detectSessionInUrl: false`, and
// expo-router only surfaces query params, never the `#` fragment). So we
// parse the fragment by hand, set the session, then hand off to the same
// post-login splash every other sign-in uses.
export default function AuthCallback() {
  const url = Linking.useURL()
  const handled = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!url || handled.current) return
    const fragment = url.split('#')[1]
    if (!fragment) return
    handled.current = true

    const params = new URLSearchParams(fragment)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    if (!accessToken || !refreshToken) {
      setError(
        params.get('error_description') ??
          'This confirmation link is invalid or has expired.',
      )
      return
    }

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error: sessionError }) => {
        if (sessionError) {
          handled.current = false
          setError(sessionError.message)
          return
        }
        router.replace('/(auth)/welcome')
      })
  }, [url])

  return (
    <View className="flex-1 items-center justify-center bg-oga-bg-page px-6">
      <Text
        style={TYPE.body}
        className="text-oga-text-muted text-sm text-center"
      >
        {error ?? 'Confirming your account…'}
      </Text>
      {error && (
        <Pressable onPress={() => router.replace('/(auth)/login')}>
          <Text style={[TYPE.body, { color: '#0F6E56', fontSize: 13, marginTop: 16 }]}>
            Back to sign in
          </Text>
        </Pressable>
      )}
    </View>
  )
}
