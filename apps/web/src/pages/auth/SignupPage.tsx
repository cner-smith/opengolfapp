import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export function SignupPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    })
    setLoading(false)
    if (signUpError) {
      setError(signUpError.message)
      return
    }
    navigate('/onboarding')
  }

  return (
    <div className="flex h-screen items-center justify-center bg-oga-bg-page">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-oga-bg-card"
        style={{ border: '0.5px solid #E4E4E0', borderRadius: 10, padding: 24 }}
      >
        <h1
          className="text-oga-text-primary"
          style={{ fontSize: 22, fontWeight: 600, marginBottom: 18 }}
        >
          Create your OGA account
        </h1>
        <FieldLabel>Username</FieldLabel>
        <input
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full bg-oga-bg-input text-oga-text-primary"
          style={inputStyle}
        />
        <FieldLabel>Email</FieldLabel>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-oga-bg-input text-oga-text-primary"
          style={inputStyle}
        />
        <FieldLabel>Password</FieldLabel>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-oga-bg-input text-oga-text-primary"
          style={{ ...inputStyle, marginBottom: 14 }}
        />
        {error && (
          <div
            className="text-oga-red-dark"
            style={{ fontSize: 13, marginBottom: 10 }}
          >
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-oga-black text-white transition-colors hover:bg-oga-text-primary/90 disabled:opacity-50"
          style={{ borderRadius: 10, padding: '12px 16px', fontSize: 13, fontWeight: 500 }}
        >
          {loading ? 'Creating…' : 'Create account'}
        </button>
        <p
          className="text-oga-text-muted text-center"
          style={{ fontSize: 13, marginTop: 14 }}
        >
          Have an account?{' '}
          <Link to="/login" className="text-oga-green-dark hover:underline">
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
      className="text-oga-text-muted uppercase"
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
