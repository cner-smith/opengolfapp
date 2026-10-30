import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { isAuthRetryableFetchError, type User } from '@supabase/supabase-js'
import { readPersistedUser, supabase } from '../lib/supabase'
import { clearScreenCache } from '../lib/screenCache'
import { logDiag } from '../lib/db'

interface AuthState {
  user: User | null
  loading: boolean
  /** The user came from the stored session because its refresh failed on the
   *  network (#1005). Until a refresh succeeds every request first waits out
   *  auth-js's failed refresh (~26 s), so the offline cache readers skip the
   *  network. Cleared by the next auth event (TOKEN_REFRESHED, SIGNED_OUT). */
  offline: boolean
  /** Counts `offline` clearing for a user still signed in: signal is back. */
  backOnline: number
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
  const [offline, setOffline] = useState(false)
  const [backOnline, setBackOnline] = useState(0)

  useEffect(() => {
    let mounted = true
    // The screen cache's keys aren't per user, so drop it whenever the
    // signed-in account changes (to/from null too) — covers a token-refresh
    // SIGNED_OUT and signing in as someone else, not just Profile's sign-out.
    // undefined = nothing seen yet (the cache is empty at launch anyway).
    let lastUserId: string | null | undefined
    let wasOffline = false
    const apply = (next: User | null, fromStorage = false) => {
      const id = next?.id ?? null
      if (lastUserId !== undefined && id !== lastUserId) clearScreenCache()
      lastUserId = id
      setUser(next)
      const nowOffline = fromStorage && next !== null
      if (wasOffline && !nowOffline && next) setBackOnline((n) => n + 1)
      wasOffline = nowOffline
      setOffline(nowOffline)
      setLoading(false)
    }

    // Counts applied auth events, so a slower offline fallback below can't
    // overwrite one (e.g. bring the user back after a SIGNED_OUT).
    let events = 0

    // Offline with an expired access token (#1005), the refresh fails with a
    // retryable network error: getSession returns null WITH that error, and
    // the session stays in storage. Keep its user so a cold start can resume
    // the round. Nothing is synced meanwhile: sync.ts and every request ask
    // auth-js for the session, which stays null until a refresh succeeds; the
    // refresh then emits TOKEN_REFRESHED, or SIGNED_OUT on a 4xx.
    const seen = events
    supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (!mounted) return
        if (data.session || !isAuthRetryableFetchError(error)) {
          apply(data.session?.user ?? null)
          return
        }
        const stored = await readPersistedUser()
        if (mounted && seen === events) apply(stored, true)
      })
      .catch((err) => {
        logDiag('auth_session_failed', { msg: String(err).slice(0, 120) })
        if (mounted) apply(null)
      })

    // Flip loading off on the first auth event too: on a warm session the
    // listener can beat getSession's resolve. The exception is a null
    // INITIAL_SESSION: auth-js emits it without the error, so it can't tell
    // signed-out from offline (#1005); getSession above decides that case.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return
      if (event === 'INITIAL_SESSION' && !nextSession) return
      events += 1
      apply(nextSession?.user ?? null)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, offline, backOnline }}>
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
