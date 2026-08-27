import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { toUserMessage } from '../../lib/errors'

// OAuth (Google/Apple) redirect target. The web client is PKCE
// (lib/supabase.ts), so the provider redirect carries a `?code=` query
// param rather than a URL fragment — parse it by hand and exchange it
// manually rather than flipping `detectSessionInUrl` (see
// packages/supabase/src/client.ts for why that stays false).
export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const code = new URLSearchParams(window.location.search).get('code')
    if (!code) {
      setError('Missing sign-in code. Please try signing in again.')
      return
    }
    supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
      if (!active) return
      if (exchangeError) {
        setError(toUserMessage(exchangeError))
        return
      }
      // Session is set; ProfileGuard routes onboarding vs app from here.
      navigate('/', { replace: true })
    })
    return () => {
      active = false
    }
  }, [navigate])

  return (
    <div className="flex h-screen items-center justify-center bg-caddie-bg">
      <div
        className="w-full max-w-sm bg-caddie-surface text-center"
        style={{ border: '0.5px solid #E4E4E0', borderRadius: 10, padding: 24 }}
      >
        {error ? (
          <>
            <h1
              className="text-caddie-ink"
              style={{ fontSize: 22, fontWeight: 600, marginBottom: 12 }}
            >
              Sign-in failed
            </h1>
            <p className="text-caddie-neg" style={{ fontSize: 13, marginBottom: 14 }}>
              {error}
            </p>
            <Link to="/login" className="text-caddie-accent hover:underline" style={{ fontSize: 13 }}>
              Back to sign in
            </Link>
          </>
        ) : (
          <p className="text-caddie-ink-dim" style={{ fontSize: 13 }}>
            Signing you in…
          </p>
        )}
      </div>
    </div>
  )
}
