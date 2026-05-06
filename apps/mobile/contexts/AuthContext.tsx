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

// Single source of truth for auth state on mobile. Mirrors the web
// AuthContext (PR #159) — every call site of useAuth() shares one
// onAuthStateChange subscription instead of each hook instance
// installing its own. Eliminates the per-call subscription churn and
// the loading-flag race that bit the web app before it migrated.
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

    // Always flip loading off on the first auth event, including the
    // synchronous INITIAL_SESSION the JS client emits on a warm
    // session — getSession's resolve and the listener can race, and
    // if getSession ever silently rejects we don't want the splash
    // overlay to wedge.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return
      setUser(nextSession?.user ?? null)
      setLoading(false)
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
