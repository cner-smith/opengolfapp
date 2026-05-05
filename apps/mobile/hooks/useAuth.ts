import { useAuthContext } from '../contexts/AuthContext'

// Thin wrapper around the AuthProvider context. All previous call
// sites used `{ user, loading }` and that shape is preserved here.
// The session is also exposed so any future caller that needs the raw
// access token (signed URL hand-off, RPC headers) doesn't have to
// re-query supabase.auth.getSession().
export function useAuth() {
  return useAuthContext()
}
