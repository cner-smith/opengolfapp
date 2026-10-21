import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Turnstile } from '@marsidev/react-turnstile'
import { supabase } from '../../lib/supabase'
import { GoogleSignInButton } from '../../components/auth/GoogleSignInButton'

// Vite exposes only env vars prefixed `VITE_` to the client bundle, so
// the Turnstile site key has to follow that convention. Set
// VITE_TURNSTILE_SITE_KEY in apps/web/.env.local for dev and in the
// Vercel project's env vars for prod. Same constant pattern as
// SignupPage so a missing env var fails identically on both pages.
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as
  | string
  | undefined

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // Token issued by Cloudflare Turnstile after the user passes the
  // (usually invisible) challenge. Supabase's CAPTCHA setting applies
  // to BOTH sign-in and sign-up by default, so signInWithPassword
  // rejects with "captcha protection: request disallowed (no
  // captcha_token found)" when this is missing.
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  // Local-dev path: when no site key is configured we skip the widget
  // so devs running against a local Supabase (CAPTCHA disabled) aren't
  // blocked. Production deploys always have the env var set.
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
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: {
        ...(captchaToken ? { captchaToken } : {}),
      },
    })
    setLoading(false)
    if (signInError) {
      // Deliberately not toUserMessage: GoTrue auth errors ("Invalid login
      // credentials") carry no row data or policy text, and collapsing them
      // would leave the user with nothing to act on (#667).
      setError(signInError.message)
      // Turnstile tokens are single-use — clear after a failed sign-in
      // so the widget reissues a fresh one for the retry.
      setCaptchaToken(null)
      return
    }
    navigate('/dashboard')
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-caddie-bg" style={{ padding: '48px 16px' }}>
      <Link
        to="/"
        aria-label="OGA home"
        className="font-serif text-caddie-ink"
        style={{ fontSize: 26, fontStyle: 'italic', fontWeight: 500, marginBottom: 28 }}
      >
        oga.
      </Link>
      <form
        onSubmit={handleSubmit}
        className="w-full bg-caddie-surface"
        style={{ maxWidth: 400, border: '1px solid #D9D2BF', borderRadius: 4, padding: '28px 24px' }}
      >
        <h1
          className="font-serif text-caddie-ink"
          style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.15 }}
        >
          Sign in
        </h1>
        <p className="text-caddie-ink-dim" style={{ fontSize: 15, marginTop: 6, marginBottom: 22 }}>
          Your rounds, strokes gained and practice plan.
        </p>
        <Field label="Email">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
        </Field>
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
          className="w-full bg-caddie-accent text-caddie-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ border: 'none', borderRadius: 2, padding: '12px 16px', fontSize: 14, fontWeight: 600, letterSpacing: '0.02em' }}
        >
          {loading ? (
            'Signing in…'
          ) : (
            <>
              Sign in{' '}
              <span className="font-serif" style={{ fontStyle: 'italic' }}>
                →
              </span>
            </>
          )}
        </button>
        <div className="flex items-center" style={{ margin: '18px 0', gap: 12 }}>
          <div style={{ flex: 1, height: 1, backgroundColor: '#D9D2BF' }} />
          <span className="text-caddie-ink-mute" style={{ fontSize: 13 }}>
            or
          </span>
          <div style={{ flex: 1, height: 1, backgroundColor: '#D9D2BF' }} />
        </div>
        <GoogleSignInButton />
      </form>
      <p className="text-caddie-ink-dim" style={{ fontSize: 14, marginTop: 18 }}>
        New to OGA?{' '}
        <Link to="/signup" className="text-caddie-ink underline underline-offset-4 hover:opacity-80">
          Create account
        </Link>
      </p>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  background: '#F2EEE5',
  border: '1px solid #D9D2BF',
  borderRadius: 2,
  padding: '10px 12px',
  fontSize: 15,
  color: '#1C211C',
  marginBottom: 16,
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-caddie-ink-dim" style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
        {label}
      </span>
      {children}
    </label>
  )
}
