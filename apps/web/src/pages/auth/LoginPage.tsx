import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { supabase } from '../../lib/supabase'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { GoogleSignInButton } from '../../components/auth/GoogleSignInButton'
import { AuthField, AuthSpread, AuthTitle, PasswordInput } from '../../components/auth/AuthSpread'

// Vite exposes only env vars prefixed `VITE_` to the client bundle, so
// the Turnstile site key has to follow that convention. Set
// VITE_TURNSTILE_SITE_KEY in apps/web/.env.local for dev and in the
// Vercel project's env vars for prod. Same constant pattern as
// SignupPage so a missing env var fails identically on both pages.
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as
  | string
  | undefined

type Mode = 'signin' | 'forgot' | 'sent'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  // 'forgot' turns the form into the password reset request; 'sent' is its
  // confirmation. The mode lives in the URL (?mode=forgot) so Back returns
  // to sign in; same page, so the email typed so far carries over. A
  // reloaded ?mode=sent has lost the address, so it asks again.
  const [params, setParams] = useSearchParams()
  const asked = params.get('mode')
  const mode: Mode = asked === 'forgot' || (asked === 'sent' && !email) ? 'forgot' : asked === 'sent' ? 'sent' : 'signin'
  // The form fades for 120 ms before Check your email rises in.
  const [leaving, setLeaving] = useState(false)
  const leaveTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(leaveTimer.current), [])
  const shownMode = useRef(mode)
  useEffect(() => {
    if (shownMode.current === mode) return
    shownMode.current = mode
    // The pressed link may fold away or unmount: hand focus to the title.
    document.getElementById('auth-title')?.focus()
  }, [mode])
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // Token issued by Cloudflare Turnstile after the user passes the
  // (usually invisible) challenge. Supabase's CAPTCHA setting applies
  // to sign-in, sign-up and the password reset request, so each call
  // rejects with "captcha protection: request disallowed (no
  // captcha_token found)" when this is missing.
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  // The widget only issues a new token on reset() or after the old one
  // expires (~300 s); clearing our state alone leaves it holding the spent
  // one (#1254).
  const turnstileRef = useRef<TurnstileInstance | undefined>(undefined)
  // Local-dev path: when no site key is configured we skip the widget
  // so devs running against a local Supabase (CAPTCHA disabled) aren't
  // blocked. Production deploys always have the env var set.
  const captchaEnabled = Boolean(TURNSTILE_SITE_KEY)
  // 'Send it again' rests for 30 s after each send.
  const [resentAt, setResentAt] = useState<number | null>(null)
  useEffect(() => {
    if (resentAt === null) return
    const t = window.setTimeout(() => setResentAt(null), 30_000)
    return () => window.clearTimeout(t)
  }, [resentAt])
  useDocumentTitle(mode === 'signin' ? 'Sign in · OGA' : 'Reset your password · OGA')

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
    const { error: authError } =
      mode === 'forgot'
        ? // PKCE (lib/supabase.ts): the emailed link comes back to
          // /auth/reset with a one-time code, exchanged there for a
          // recovery session before the new password is set.
          await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth/reset`,
            ...(captchaToken ? { captchaToken } : {}),
          })
        : await supabase.auth.signInWithPassword({
            email,
            password,
            options: {
              ...(captchaToken ? { captchaToken } : {}),
            },
          })
    setLoading(false)
    // Turnstile tokens are single-use: clear after every call and reset the
    // widget so it issues a fresh one for the next.
    setCaptchaToken(null)
    turnstileRef.current?.reset()
    if (authError) {
      // Deliberately not toUserMessage: GoTrue auth errors ("Invalid login
      // credentials") carry no row data or policy text, and collapsing them
      // would leave the user with nothing to act on (#667).
      setError(authError.message)
      return
    }
    if (mode === 'forgot') {
      // Still busy through the fade, so a second press can't send again.
      setLoading(true)
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      setLeaving(!reduce)
      leaveTimer.current = window.setTimeout(
        () => {
          setLeaving(false)
          setLoading(false)
          setParams({ mode: 'sent' }, { replace: true })
        },
        reduce ? 0 : 120,
      )
    } else navigate('/dashboard')
  }

  async function resend() {
    if (captchaEnabled && !captchaToken) {
      setError('Please wait a moment and try again.')
      return
    }
    setLoading(true)
    setError(null)
    const { error: sendError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
      ...(captchaToken ? { captchaToken } : {}),
    })
    setLoading(false)
    setCaptchaToken(null)
    turnstileRef.current?.reset()
    if (sendError) setError(sendError.message)
    else setResentAt(Date.now())
  }

  function switchTo(next: 'signin' | 'forgot') {
    setResentAt(null)
    setError(null)
    setParams(next === 'signin' ? {} : { mode: next })
  }

  if (mode === 'sent') {
    return (
      <AuthSpread>
        <div className="auth-stage lb-rise">
          <AuthTitle
            sub={
              <>
                A link is on its way to <span className="text-caddie-ink">{email}</span>, if it has an account. Open it on
                this device; it works once.
              </>
            }
          >
            Check your email.{' '}
            <span className="auth-sent-tag" aria-hidden>
              in the post
            </span>
          </AuthTitle>
          <button
            type="button"
            className="w-full key"
            disabled={loading || resentAt !== null}
            onClick={resend}
            style={{ fontSize: 15 }}
          >
            {loading ? 'Sending…' : resentAt ? 'Sent again' : 'Send it again'}
          </button>
          <p className="text-caddie-ink-dim" style={{ fontSize: 13, marginTop: 12, marginBottom: 22 }} aria-live="polite">
            {resentAt ? 'Give it a minute, and check spam.' : 'Nothing after a minute? Check spam first.'}
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
          {error && (
            <p className="text-caddie-neg" role="alert" style={{ fontSize: 13, marginBottom: 12 }}>
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-between" style={{ gap: 12 }}>
            <button type="button" className="auth-link" style={{ fontSize: 14 }} onClick={() => switchTo('signin')}>
              Back to sign in
            </button>
            <button type="button" className="auth-link" style={{ fontSize: 14 }} onClick={() => switchTo('forgot')}>
              Use a different email
            </button>
          </div>
        </div>
      </AuthSpread>
    )
  }

  const forgot = mode === 'forgot'
  // Sign in and reset are one form: the title turns over, the password and
  // the Google rows fold shut, and the email field never moves.
  return (
    <AuthSpread>
      <form onSubmit={handleSubmit} className={leaving ? 'auth-stage auth-leave' : 'auth-stage'}>
        <div key={mode} className="lb-rise">
          {forgot ? (
            <AuthTitle sub="Type the email you signed up with and we'll send a link to set a new one.">
              Reset your password.
            </AuthTitle>
          ) : (
            <AuthTitle sub="Your rounds, strokes gained and practice plan.">Welcome back.</AuthTitle>
          )}
        </div>
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
        <div className="auth-collapse" data-open={!forgot}>
          <div>
            <AuthField label="Password">
              <PasswordInput
                required={!forgot}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </AuthField>
            <div className="auth-forgot">
              <button type="button" className="auth-link" onClick={() => switchTo('forgot')}>
                Forgot your password?
              </button>
            </div>
          </div>
        </div>
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
            forgot ? 'Sending…' : 'Signing in…'
          ) : (
            <>
              {forgot ? 'Send the link' : 'Sign in'}{' '}
              <span className="font-serif" style={{ fontStyle: 'italic' }}>
                →
              </span>
            </>
          )}
        </button>
        <div className="auth-collapse" data-open={forgot}>
          <div>
            <button type="button" className="auth-link" style={{ fontSize: 14, marginTop: 18 }} onClick={() => switchTo('signin')}>
              Back to sign in
            </button>
          </div>
        </div>
        <div className="auth-collapse" data-open={!forgot}>
          <div>
            <div className="flex items-center" style={{ margin: '18px 0', gap: 12 }}>
              <div style={{ flex: 1, height: 1, backgroundColor: '#D9D2BF' }} />
              <span className="text-caddie-ink-dim" style={{ fontSize: 13 }}>
                or
              </span>
              <div style={{ flex: 1, height: 1, backgroundColor: '#D9D2BF' }} />
            </div>
            <GoogleSignInButton />
            <p className="text-caddie-ink-dim" style={{ fontSize: 14, marginTop: 22 }}>
              New to OGA?{' '}
              <Link to="/signup" className="text-caddie-ink underline underline-offset-4 hover:opacity-80">
                Create account
              </Link>
            </p>
          </div>
        </div>
      </form>
    </AuthSpread>
  )
}
