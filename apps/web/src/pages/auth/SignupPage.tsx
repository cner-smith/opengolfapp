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
    <div className="flex h-screen items-center justify-center bg-fairway-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg bg-white p-8 shadow-sm"
      >
        <h1 className="mb-6 text-2xl font-bold text-fairway-700">Create your OGA account</h1>
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-gray-600">Username</span>
          <input
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded border border-gray-200 px-3 py-2"
          />
        </label>
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-gray-600">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-gray-200 px-3 py-2"
          />
        </label>
        <label className="mb-4 block text-sm">
          <span className="mb-1 block text-gray-600">Password</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-gray-200 px-3 py-2"
          />
        </label>
        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-fairway-500 py-2 text-white hover:bg-fairway-700 disabled:opacity-50"
        >
          {loading ? 'Creating…' : 'Create account'}
        </button>
        <p className="mt-4 text-center text-sm text-gray-600">
          Have an account?{' '}
          <Link to="/login" className="text-fairway-700 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  )
}
