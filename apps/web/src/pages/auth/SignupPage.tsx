import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { supabase } from '../../lib/supabase'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { GoogleSignInButton } from '../../components/auth/GoogleSignInButton'
import { AuthField, AuthSpread, AuthTitle, PasswordInput } from '../../components/auth/AuthSpread'

// Vite exposes only env vars prefixed `VITE_` to the client bundle, so
// the Turnstile site key has to follow that convention. Set
// VITE_TURNSTILE_SITE_KEY in apps/web/.env.local for dev and in the
// Vercel project's env vars for prod.
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as
  | string
  | undefined

export function SignupPage() {
  useDocumentTitle('Create account · OGA')
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  // The address already has an account: say so and offer sign in with it.
  const [exists, setExists] = useState(false)
  const [loading, setLoading] = useState(false)
  // Token issued by Cloudflare Turnstile after the player passes the
  // (usually invisible) challenge. Supabase validates this token
  // server-side via the secret key configured in the Auth dashboard;
  // signup will reject with a 400 if the token is missing or stale.
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  // The widget only issues a new token on reset() or after the old one
  // expires (~300 s); clearing our state alone leaves it holding the spent
  // one (#1254).
  const turnstileRef = useRef<TurnstileInstance | undefined>(undefined)
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
    setExists(false)
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
      // With email confirmation off, GoTrue answers an existing address
      // with this error; with it on, it answers as if signed up.
      if (signUpError.code === 'user_already_exists' || signUpError.message === 'User already registered') setExists(true)
      // The signup trigger's insert failed, most often on a name someone
      // already has (profiles.username is unique).
      else if (signUpError.message === 'Database error saving new user')
        setError('We couldn’t create the account. That name may be taken: try another, or add a number.')
      else setError(signUpError.message)
      // Reset the token on error — Turnstile tokens are single-use, so
      // a failed signUp leaves us with a spent token. Clearing state doesn't
      // touch the widget; reset() makes it issue a new one.
      setCaptchaToken(null)
      turnstileRef.current?.reset()
      return
    }
    navigate('/onboarding')
  }

  return (
    <AuthSpread>
      <form onSubmit={handleSubmit}>
        <AuthTitle sub="Free, open source, and it stays free.">Start your yardage book.</AuthTitle>
        <AuthField label="What should we call you?">
          <input
            required
            autoComplete="nickname"
            autoCapitalize="off"
            // profiles.username_format (0014): anything else is swapped for
            // user_<id> by the signup trigger.
            pattern="[A-Za-z0-9_\-]{3,32}"
            title="3 to 32 letters, numbers, - or _, no spaces"
            aria-describedby="name-hint"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="auth-input"
            style={{ marginBottom: 6 }}
          />
        </AuthField>
        <p id="name-hint" className="text-caddie-ink-dim" style={{ fontSize: 12, marginBottom: 18 }}>
          Home greets you by it. 3 to 32 letters or numbers, no spaces.
        </p>
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
          <PasswordInput
            required
            minLength={8}
            autoComplete="new-password"
            aria-describedby="password-hint"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ marginBottom: 6 }}
          />
        </AuthField>
        <p id="password-hint" className="text-caddie-ink-dim" style={{ fontSize: 12, marginBottom: 18 }}>
          At least 8 characters.
        </p>
        {captchaEnabled && (
          <div style={{ marginBottom: 14 }}>
            <Turnstile
              ref={turnstileRef}
              siteKey={TURNSTILE_SITE_KEY!}
              onSuccess={(token) => setCaptchaToken(token)}
              onError={() => setCaptchaToken(null)}
              onExpire={() => setCaptchaToken(null)}
              options={{ theme: 'light' }}
            />
          </div>
        )}
        {(error || exists) && (
          <p className="text-caddie-neg" role="alert" style={{ fontSize: 13, marginBottom: 12 }}>
            {exists ? (
              <>
                That email already has an account.{' '}
                <Link to={`/login?email=${encodeURIComponent(email)}`} className="auth-link" style={{ color: 'inherit' }}>
                  Sign in instead
                </Link>
              </>
            ) : (
              error
            )}
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
        <p className="text-caddie-ink-dim" style={{ fontSize: 12, marginTop: 10 }}>
          No ads. How we handle your data is on the{' '}
          <Link to="/privacy" className="auth-link" style={{ fontSize: 12 }}>
            Privacy
          </Link>{' '}
          page.
        </p>
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
