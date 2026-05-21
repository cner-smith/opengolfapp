import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Turnstile } from '@marsidev/react-turnstile'
import { supabase } from '../../lib/supabase'

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
  const canSubmit = !loading && (!captchaEnabled || captchaToken !== null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
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
          Create your OGA account
        </h1>
        <FieldLabel>Username</FieldLabel>
        <input
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full bg-caddie-surface text-caddie-ink"
          style={inputStyle}
        />
        <FieldLabel>Email</FieldLabel>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-caddie-surface text-caddie-ink"
          style={inputStyle}
        />
        <FieldLabel>Password</FieldLabel>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-caddie-surface text-caddie-ink"
          style={{ ...inputStyle, marginBottom: 14 }}
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
          {loading ? 'Creating…' : 'Create account'}
        </button>
        <p
          className="text-caddie-ink-dim text-center"
          style={{ fontSize: 13, marginTop: 14 }}
        >
          Have an account?{' '}
          <Link to="/login" className="text-caddie-accent hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  border: '0.5px solid #E4E4E0',
  borderRadius: 7,
  padding: '8px 10px',
  fontSize: 13,
  marginBottom: 12,
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
