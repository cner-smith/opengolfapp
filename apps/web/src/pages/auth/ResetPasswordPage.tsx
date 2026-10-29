import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { supabase } from '../../lib/supabase'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { toUserMessage } from '../../lib/errors'
import { AuthField, AuthSpread, AuthTitle, PasswordInput } from '../../components/auth/AuthSpread'

// As on LoginPage: no site key (local dev) skips the widget.
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

// Where the password reset email lands (LoginPage → resetPasswordForEmail).
// The link proves the address; this page turns it into a recovery session,
// then sets the new password on it.
//
// Two link shapes reach here. With Supabase's default email template the
// link carries `?code=`, a PKCE code that only the browser which asked for
// the reset can exchange (its code verifier is in that browser's storage).
// A template that sends `?token_hash=…&type=recovery` (Supabase's PKCE
// recipe) works from any device, via verifyOtp. Either way the code or hash
// is single-use: the ref keeps StrictMode's second effect from spending it
// twice (see AuthCallbackPage).
export function ResetPasswordPage() {
  useDocumentTitle('Set a new password · OGA')
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [linkFailed, setLinkFailed] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const handledRef = useRef(false)
  // A dead link asks for a fresh one right here, no trip back through sign
  // in. Requested from this browser, so its PKCE code works here.
  const [email, setEmail] = useState('')
  const [resent, setResent] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileInstance | undefined>(undefined)

  useEffect(() => {
    if (handledRef.current) return
    handledRef.current = true
    const params = new URLSearchParams(window.location.search)
    const tokenHash = params.get('token_hash')
    const code = params.get('code')
    const linkFailed = () => setLinkFailed(true)
    if (tokenHash && params.get('type') === 'recovery') {
      supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash }).then(({ error: e }) => (e ? linkFailed() : setReady(true)), linkFailed)
    } else if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error: e }) => (e ? linkFailed() : setReady(true)), linkFailed)
    } else if (params.get('error_description')) {
      linkFailed()
    } else {
      // Opened without a link: fine if already signed in (a recovery
      // session from a reload, or a signed-in golfer changing it).
      supabase.auth.getSession().then(({ data }) => (data.session ? setReady(true) : linkFailed()), linkFailed)
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const { error: updateError } = await supabase.auth
      .updateUser({ password })
      .catch((err: unknown) => ({ error: { message: toUserMessage(err) } }))
    setSaving(false)
    // GoTrue's messages here ("New password should be different from the
    // old password.") are the actionable part, as on LoginPage (#667).
    if (updateError) return setError(updateError.message)
    navigate('/dashboard', { replace: true })
  }

  // The view swaps under the reader (checking → dead link → sent): hand
  // focus to the new title.
  useEffect(() => {
    if (linkFailed) document.getElementById('auth-title')?.focus()
  }, [linkFailed, resent])

  async function sendFreshLink(e: FormEvent) {
    e.preventDefault()
    if (TURNSTILE_SITE_KEY && !captchaToken) return setError('Please wait a moment and try again.')
    setSaving(true)
    setError(null)
    const { error: sendError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
      ...(captchaToken ? { captchaToken } : {}),
    })
    setSaving(false)
    // Single-use tokens, as on LoginPage (#1254).
    setCaptchaToken(null)
    turnstileRef.current?.reset()
    if (sendError) return setError(sendError.message)
    setResent(true)
  }

  if (linkFailed && resent) {
    return (
      <AuthSpread>
        <AuthTitle
          sub={
            <>
              If <span className="text-caddie-ink">{email}</span> has an account, a fresh link is on its way. Open it on this
              device; it works once.
            </>
          }
        >
          Check your email.
        </AuthTitle>
        <Link to="/login" className="auth-link" style={{ fontSize: 14 }}>
          Back to sign in
        </Link>
      </AuthSpread>
    )
  }

  if (linkFailed) {
    return (
      <AuthSpread>
        <form onSubmit={sendFreshLink}>
          <AuthTitle sub="It has expired or was already used. Each link works once; we'll send you a fresh one.">
            That link didn&rsquo;t work.
          </AuthTitle>
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
          {TURNSTILE_SITE_KEY && (
            <div style={{ marginBottom: 14 }}>
              <Turnstile
                ref={turnstileRef}
                siteKey={TURNSTILE_SITE_KEY}
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
          <button type="submit" disabled={saving} className="w-full key key-primary" style={{ fontSize: 15, letterSpacing: '0.02em' }}>
            {saving ? (
              'Sending…'
            ) : (
              <>
                Send a fresh link{' '}
                <span className="font-serif" style={{ fontStyle: 'italic' }}>
                  →
                </span>
              </>
            )}
          </button>
        </form>
        <Link to="/login" className="auth-link" style={{ display: 'inline-block', fontSize: 14, marginTop: 18 }}>
          Back to sign in
        </Link>
      </AuthSpread>
    )
  }

  return (
    <AuthSpread>
      <form onSubmit={handleSubmit}>
        <AuthTitle sub={ready ? "One new password and you're back in." : 'Checking your link…'}>
          Set a new password.
        </AuthTitle>
        <AuthField label="New password">
          <PasswordInput
            required
            minLength={8}
            autoComplete="new-password"
            aria-describedby="new-password-hint"
            disabled={!ready}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ marginBottom: 6 }}
          />
        </AuthField>
        <p id="new-password-hint" className="text-caddie-ink-dim" style={{ fontSize: 12, marginBottom: 18 }}>
          At least 8 characters.
        </p>
        {error && (
          <p className="text-caddie-neg" role="alert" style={{ fontSize: 13, marginBottom: 12 }}>
            {error}
          </p>
        )}
        <button type="submit" disabled={!ready || saving} className="w-full key key-primary" style={{ fontSize: 15, letterSpacing: '0.02em' }}>
          {saving ? (
            'Saving…'
          ) : (
            <>
              Save and sign in{' '}
              <span className="font-serif" style={{ fontStyle: 'italic' }}>
                →
              </span>
            </>
          )}
        </button>
      </form>
    </AuthSpread>
  )
}
