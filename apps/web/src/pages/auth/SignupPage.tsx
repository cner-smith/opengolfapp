import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Turnstile } from '@marsidev/react-turnstile'
import { supabase } from '../../lib/supabase'
import { GoogleSignInButton } from '../../components/auth/GoogleSignInButton'
import { AuthField, AuthSpread, AuthTitle } from '../../components/auth/AuthSpread'

// Vite exposes only env vars prefixed `VITE_` to the client bundle, so
// the Turnstile site key has to follow that convention. Set
// VITE_TURNSTILE_SITE_KEY in apps/web/.env.local for dev and in the
// Vercel project's env vars for prod.
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as
  | string
  | undefined

export function SignupPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // Token issued by Cloudflare Turnstile after the player passes the
  // (usually invisible) challenge. Supabase validates this token
  // server-side via the secret key configured in the Auth dashboard;
  // signup will reject with a 400 if the token is missing or stale.
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  // Turnstile-less local dev path: when no site key is configured we
  // skip the widget entirely so devs running against a local Supabase
  // (which has CAPTCHA disabled) aren't blocked. Production deploys
  // always have the env var set, so this branch never short-circuits
  // CAPTCHA in real usage.
  const captchaEnabled = Boolean(TURNSTILE_SITE_KEY)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    // Captcha is gated at submit time, not via button-disable. Turnstile
    // managed mode auto-solves invisibly; the token usually arrives
    // before the user finishes typing, but if they slam Enter early we
    // surface a recoverable message instead of leaving the button dead.
    if (captchaEnabled && !captchaToken) {
      setError('Please wait a moment and try again.')
      return
    }
    setLoading(true)
    setError(null)
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo: `${window.location.origin}/onboarding`,
        ...(captchaToken ? { captchaToken } : {}),
      },
    })
    setLoading(false)
    if (signUpError) {
      // Deliberately not toUserMessage: GoTrue auth errors ("Invalid login
      // credentials") carry no row data or policy text, and collapsing them
      // would leave the user with nothing to act on (#667).
      setError(signUpError.message)
      // Reset the token on error — Turnstile tokens are single-use, so
      // a failed signUp leaves us with a spent token. The widget's
      // built-in reset triggers automatically when state is cleared.
      setCaptchaToken(null)
      return
    }
    navigate('/onboarding')
  }

  return (
    <AuthSpread>
      <form onSubmit={handleSubmit}>
        <AuthTitle sub="Free, open source, and it stays free.">Start your yardage book.</AuthTitle>
        <AuthField label="Username">
          <input
            required
            autoComplete="username"
            autoCapitalize="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="auth-input"
          />
        </AuthField>
        <AuthField label="Email">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input"
          />
        </AuthField>
        <AuthField label="Password">
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            aria-describedby="password-hint"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input"
            style={{ marginBottom: 6 }}
          />
        </AuthField>
        <p id="password-hint" className="text-caddie-ink-dim" style={{ fontSize: 12, marginBottom: 18 }}>
          At least 8 characters.
        </p>
        {captchaEnabled && (
          <div style={{ marginBottom: 14 }}>
            <Turnstile
              siteKey={TURNSTILE_SITE_KEY!}
              onSuccess={(token) => setCaptchaToken(token)}
              onError={() => setCaptchaToken(null)}
              onExpire={() => setCaptchaToken(null)}
              options={{ theme: 'auto' }}
            />
          </div>
        )}
        {error && (
          <p className="text-caddie-neg" role="alert" style={{ fontSize: 13, marginBottom: 12 }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full key key-primary"
          style={{ fontSize: 15, letterSpacing: '0.02em' }}
        >
          {loading ? (
            'Creating account…'
          ) : (
            <>
              Create account{' '}
              <span className="font-serif" style={{ fontStyle: 'italic' }}>
                →
              </span>
            </>
          )}
        </button>
        <div className="flex items-center" style={{ margin: '18px 0', gap: 12 }}>
          <div style={{ flex: 1, height: 1, backgroundColor: '#D9D2BF' }} />
          <span className="text-caddie-ink-dim" style={{ fontSize: 13 }}>
            or
          </span>
          <div style={{ flex: 1, height: 1, backgroundColor: '#D9D2BF' }} />
        </div>
        <GoogleSignInButton />
      </form>
      <p className="text-caddie-ink-dim" style={{ fontSize: 14, marginTop: 22 }}>
        Have an account?{' '}
        <Link to="/login" className="text-caddie-ink underline underline-offset-4 hover:opacity-80">
          Sign in
        </Link>
      </p>
    </AuthSpread>
  )
}
