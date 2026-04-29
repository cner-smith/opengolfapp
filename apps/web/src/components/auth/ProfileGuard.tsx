import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useProfile } from '../../hooks/useProfile'

export function ProfileGuard({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const { data, isLoading: profileLoading } = useProfile()

  if (authLoading || profileLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-oga-bg-page text-oga-text-muted text-sm">
        Loading…
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (!data || data.skill_level === null || data.goal === null) {
    return <Navigate to="/onboarding" replace />
  }
  return <>{children}</>
}
