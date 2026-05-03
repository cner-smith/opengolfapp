import type { User } from '@supabase/supabase-js'
import { useAuthContext } from '../contexts/AuthContext'

// Thin re-export so existing call sites keep working unchanged. The
// real state lives in <AuthProvider> in main.tsx.
export function useAuth(): { user: User | null; loading: boolean } {
  return useAuthContext()
}
