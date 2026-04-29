import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useProfile } from '../../hooks/useProfile'

export function ProfileGuard({ children }: { children: ReactNode }) {
  const { data, isLoading } = useProfile()
  // TODO: remove debug log
  // eslint-disable-next-line no-console
  console.log('ProfileGuard:', {
    isLoading,
    profile: data,
    skillLevel: data?.skill_level,
  })
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-oga-bg-page text-oga-text-muted text-sm">
        Loading…
      </div>
    )
  }
  if (!data || data.skill_level === null || data.goal === null) {
    return <Navigate to="/onboarding" replace />
  }
  return <>{children}</>
}
