import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-fairway-700">Loading…</div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}
