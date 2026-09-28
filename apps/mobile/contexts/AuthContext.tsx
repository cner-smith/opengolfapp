import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { clearScreenCache } from '../lib/screenCache'

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
    // The screen cache's keys aren't per user, so drop it whenever the
    // signed-in account changes (to/from null too) — covers a token-refresh
    // SIGNED_OUT and signing in as someone else, not just Profile's sign-out.
    // undefined = nothing seen yet (the cache is empty at launch anyway).
    let lastUserId: string | null | undefined
    const apply = (next: User | null) => {
      const id = next?.id ?? null
      if (lastUserId !== undefined && id !== lastUserId) clearScreenCache()
      lastUserId = id
      setUser(next)
      setLoading(false)
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      apply(data.session?.user ?? null)
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
      apply(nextSession?.user ?? null)
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
