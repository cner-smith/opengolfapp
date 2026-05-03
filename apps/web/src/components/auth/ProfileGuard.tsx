import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useProfile } from '../../hooks/useProfile'

export function ProfileGuard({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  // Reads the same React Query cache the rest of the app does so we don't
  // issue a second profiles query on every protected route mount. Earlier
  // version called supabase.from('profiles').select(...) directly here.
  const { data: profile, isLoading: profileLoading, isError } = useProfile()

  if (authLoading || (user && profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-caddie-bg font-sans text-meta text-caddie-ink-dim">
        Loading…
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />

  // Soft error screen so a transient network blip doesn't redirect a
  // fully-onboarded user to /onboarding (which would clobber their
  // profile on save).
  if (isError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-caddie-bg font-sans text-caddie-ink p-7 text-center">
        <div className="font-serif italic text-h2">
          Couldn't load your profile.
        </div>
        <div className="text-meta text-caddie-ink-dim">
          Check your connection and reload.
        </div>
      </div>
    )
  }

  // Single explicit gate. Earlier check (`!skill_level || !goal`) raced
  // a stale TanStack Query cache populated during the pre-onboarding
  // sign-in pass — the cache returned the pre-onboarding row
  // synchronously while the background refetch was still in flight,
  // so a user who just completed onboarding got bounced back to
  // /onboarding. The explicit boolean + setQueryData in
  // useUpdateProfile makes the cache reflect the freshly-saved state
  // on the very next read.
  if (!profile || !profile.onboarding_completed) {
    return <Navigate to="/onboarding" replace />
  }

  return <>{children}</>
}
