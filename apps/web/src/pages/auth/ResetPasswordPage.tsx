import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { toUserMessage } from '../../lib/errors'
import { AuthField, AuthSpread, AuthTitle } from '../../components/auth/AuthSpread'

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
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const handledRef = useRef(false)

  useEffect(() => {
    if (handledRef.current) return
    handledRef.current = true
    const params = new URLSearchParams(window.location.search)
    const tokenHash = params.get('token_hash')
    const code = params.get('code')
    const linkFailed = () => setLinkError('This link has expired or was already used. Ask for a new one.')
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

  if (linkError) {
    return (
      <AuthSpread>
        <AuthTitle sub={linkError}>That link didn&rsquo;t work.</AuthTitle>
        <Link to="/login" className="key key-primary">
          Back to sign in{' '}
          <span className="font-serif" style={{ fontStyle: 'italic' }}>
            →
          </span>
        </Link>
      </AuthSpread>
    )
  }

  return (
    <AuthSpread>
      <form onSubmit={handleSubmit}>
        <AuthTitle sub={ready ? 'Pick a new one, then you are signed in.' : 'Checking your link…'}>
          Set a new password.
        </AuthTitle>
        <AuthField label="New password">
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            aria-describedby="new-password-hint"
            disabled={!ready}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input"
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
