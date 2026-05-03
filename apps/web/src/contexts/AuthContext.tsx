import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
  user: User | null
  loading: boolean
}

const AuthContext = createContext<AuthState | null>(null)

// Single source of truth for the auth state. Earlier `useAuth` was a
// hook that ran its own useState + useEffect per call, so every caller
// (AuthGuard, ProfileGuard, useProfile, every page hook…) had an
// independent loading flag and its own getSession + onAuthStateChange
// subscription. ProfileGuard and the useProfile hook nested under it
// raced — when ProfileGuard's instance settled before useProfile's,
// useProfile stayed `enabled: false` (its own loading was still true),
// the query never fired, profile was undefined, and ProfileGuard
// bounced the user to /onboarding. Collapsing to one shared state
// eliminates the race AND the N-way duplicate auth subscription.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setUser(session?.user ?? null)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext(): AuthState {
  const ctx = useContext(AuthContext)
  if (ctx === null) {
    throw new Error('useAuth must be called inside <AuthProvider>')
  }
  return ctx
}
