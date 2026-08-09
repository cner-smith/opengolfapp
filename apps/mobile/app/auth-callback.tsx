import { useEffect, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import * as Linking from 'expo-linking'
import { supabase } from '../lib/supabase'
import { TYPE } from '../lib/typography'

// Deep-link target for email confirmation (signup sends
// `emailRedirectTo: oga://auth-callback`). GoTrue verifies the token
// server-side, then redirects here. Two payload shapes:
//
//  • PKCE (current, flowType 'pkce' in lib/supabase.ts): `?code=` in the
//    QUERY string → exchangeCodeForSession. Query params survive the
//    mail-app → browser → oga:// handoff that strips URL fragments on
//    some iOS chains (#509 field reports).
//  • Implicit (legacy links from signups before the PKCE switch): the
//    session rides the `#` fragment → parse by hand (the native client is
//    `detectSessionInUrl: false`, and expo-router never surfaces
//    fragments) and setSession.
//
// Either way GoTrue confirmed the email BEFORE redirecting, so if neither
// payload arrives (the observed stuck case) the account almost certainly
// works — the fallback UI sends the user to sign in normally rather than
// hanging on "Confirming…" forever.
export default function AuthCallback() {
  const url = Linking.useURL()
  const handled = useRef(false)
  const [error, setError] = useState<string | null>(null)
  // Payload never arrived (or the URL itself never arrived) — offer the
  // manual sign-in path instead of spinning forever.
  const [fallback, setFallback] = useState(false)

  // Watchdog for the url-never-arrives case; any handled outcome wins the
  // render over it via the message precedence below.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!handled.current) setFallback(true)
    }, 8000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!url || handled.current) return
    const [base, fragment] = url.split('#')
    const queryStart = base!.indexOf('?')
    const query = new URLSearchParams(queryStart >= 0 ? base!.slice(queryStart + 1) : '')
    const frag = new URLSearchParams(fragment ?? '')

    const code = query.get('code')
    const accessToken = frag.get('access_token')
    const refreshToken = frag.get('refresh_token')
    const errDescription =
      query.get('error_description') ?? frag.get('error_description')

    if (code) {
      handled.current = true
      supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
        if (exchangeError) {
          // Most common cause: the code_verifier isn't on this install
          // (link tapped after a reinstall, or minted pre-PKCE). The email
          // is verified regardless — steer to a normal sign-in.
          setError(exchangeError.message)
          return
        }
        router.replace('/(auth)/welcome')
      })
      return
    }

    if (accessToken && refreshToken) {
      handled.current = true
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error: sessionError }) => {
          if (sessionError) {
            setError(sessionError.message)
            return
          }
          router.replace('/(auth)/welcome')
        })
      return
    }

    if (errDescription) {
      handled.current = true
      setError(errDescription)
      return
    }

    // URL arrived carrying neither a code, tokens, nor an error — the
    // stuck-at-"Confirming…" case from the field. Go straight to the
    // manual path.
    setFallback(true)
  }, [url])

  const message = error
    ? error
    : fallback
      ? 'This is taking longer than expected. Your email is most likely already confirmed — go back and sign in with your email and password.'
      : 'Confirming your account…'

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2EEE5', paddingHorizontal: 24 }}>
      <Text
        style={[TYPE.body, { color: '#5C6356', fontSize: 14, textAlign: 'center' }]}
      >
        {message}
      </Text>
      {(error || fallback) && (
        <Pressable onPress={() => router.replace('/(auth)/login')}>
          <Text
            style={[TYPE.body, { fontSize: 13, marginTop: 16, color: '#1F3D2C' }]}
          >
            Back to sign in
          </Text>
        </Pressable>
      )}
    </View>
  )
}
