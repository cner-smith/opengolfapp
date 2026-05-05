import { useAuthContext } from '../contexts/AuthContext'

// Thin wrapper around the AuthProvider context. All call sites used
// `{ user, loading }` and that shape is preserved.
export function useAuth() {
  return useAuthContext()
}
