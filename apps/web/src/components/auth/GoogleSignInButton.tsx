import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { toUserMessage } from '../../lib/errors'

// "Continue with Google" — starts the OAuth redirect. The web client is
// PKCE (lib/supabase.ts), so Supabase sends the browser to Google and,
// on success, back to /auth/callback with a `?code=` param that page
// exchanges for a session. There is no local success path here: either
// signInWithOAuth errors before the redirect fires, or the browser has
// already navigated away.
export function GoogleSignInButton() {
  const [error, setError] = useState<string | null>(null)

  async function onClick() {
    setError(null)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (oauthError) setError(toUserMessage(oauthError))
    // On success the browser has already redirected to Google.
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-label="Continue with Google"
        className="w-full flex items-center justify-center transition-opacity hover:opacity-90"
        style={{
          gap: 10,
          backgroundColor: '#FFFFFF',
          color: '#1F1F1F',
          border: '1px solid #747775',
          borderRadius: 4,
          padding: '10px 16px',
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        {/* Official Google "G" logomark — required by Google's sign-in
            branding guidelines (recognizable multi-color mark, not a
            generic icon or wordmark substitute). */}
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.8582-3.0477.8582-2.3436 0-4.3282-1.5831-5.0359-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"
          />
          <path
            fill="#FBBC05"
            d="M3.9641 10.71c-.18-.54-.2827-1.1168-.2827-1.71s.1027-1.17.2827-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.9641 10.71z"
          />
          <path
            fill="#EA4335"
            d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5814-2.5814C13.4632.891 11.4259 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.9641 7.29C4.6718 5.1627 6.6564 3.5795 9 3.5795z"
          />
        </svg>
        Continue with Google
      </button>
      {error && (
        <div className="text-caddie-neg" style={{ fontSize: 13, marginTop: 10 }} role="alert">
          {error}
        </div>
      )}
    </>
  )
}
