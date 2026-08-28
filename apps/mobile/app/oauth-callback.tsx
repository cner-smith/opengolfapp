import { Text, View } from 'react-native'
import { TYPE } from '../lib/typography'

// Deep-link destination for Google/Apple OAuth (`OAuthButtons.tsx` sets
// `redirectTo: 'oga://oauth-callback'`). This screen is DELIBERATELY
// PASSIVE — it exists only so Android has a real route to land on instead
// of Router's Unmatched screen while the sign-in flow finishes elsewhere.
//
// Why it must never call `exchangeCodeForSession` (or touch `supabase.auth`
// at all): on Android, expo-web-browser has no native auth-session support,
// so `WebBrowser.openAuthSessionAsync`'s redirect arrives via the ordinary
// RN `Linking` emitter — the same emitter Expo Router uses for navigation.
// That means this screen mounts with the exact same OAuth URL that
// `OAuthButtons.tsx`'s `signInWithGoogle`/`signInWithApple` handler is
// already parsing the `code` from and exchanging in-handler. A PKCE code is
// single-use: exchanging it here too would race the handler's own exchange
// and fail one of them, surfacing a spurious "sign-in failed" on a sign-in
// that actually succeeded (the original bug, reusing `auth-callback.tsx`'s
// path). The handler owns the whole flow and `router.replace`s over this
// screen once it completes — do not "fix" that by adding an exchange here.
export default function OAuthCallback() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2EEE5', paddingHorizontal: 24 }}>
      <Text style={[TYPE.body, { color: '#5C6356', fontSize: 14, textAlign: 'center' }]}>
        Signing you in…
      </Text>
    </View>
  )
}
