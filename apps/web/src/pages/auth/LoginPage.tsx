import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Turnstile } from '@marsidev/react-turnstile'
import { supabase } from '../../lib/supabase'

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
  const canSubmit = !loading && (!captchaEnabled || captchaToken !== null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
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
      setError(signInError.message)
      // Turnstile tokens are single-use — clear after a failed sign-in
      // so the widget reissues a fresh one for the retry.
      setCaptchaToken(null)
      return
    }
    navigate('/dashboard')
  }

  return (
    <div className="flex h-screen items-center justify-center bg-caddie-bg">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-caddie-surface"
        style={{ border: '0.5px solid #E4E4E0', borderRadius: 10, padding: 24 }}
      >
        <h1
          className="text-caddie-ink"
          style={{ fontSize: 22, fontWeight: 600, marginBottom: 18 }}
        >
          Sign in to OGA
        </h1>
        <FieldLabel>Email</FieldLabel>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-caddie-surface text-caddie-ink"
          style={{
            border: '0.5px solid #E4E4E0',
            borderRadius: 7,
            padding: '8px 10px',
            fontSize: 13,
            marginBottom: 12,
          }}
        />
        <FieldLabel>Password</FieldLabel>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-caddie-surface text-caddie-ink"
          style={{
            border: '0.5px solid #E4E4E0',
            borderRadius: 7,
            padding: '8px 10px',
            fontSize: 13,
            marginBottom: 14,
          }}
        />
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
          <div
            className="text-caddie-neg"
            style={{ fontSize: 13, marginBottom: 10 }}
          >
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full bg-caddie-accent text-caddie-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ borderRadius: 10, padding: '12px 16px', fontSize: 13, fontWeight: 500 }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <p
          className="text-caddie-ink-dim text-center"
          style={{ fontSize: 13, marginTop: 14 }}
        >
          No account?{' '}
          <Link to="/signup" className="text-caddie-accent hover:underline">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-caddie-ink-dim uppercase"
      style={{
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: 0.4,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  )
}
