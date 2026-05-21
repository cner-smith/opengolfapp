import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { AppShell } from '../layout/AppShell'
import { PublicNav } from './PublicNav'

// Auth-aware layout for /learn and /learn/:slug. Same URLs serve both
// audiences (SEO + shareability), but signed-in users get the app
// chrome with sidebar while signed-out users get the public marketing
// nav. Defaults to the public branch while auth resolves so signed-out
// visitors never see a flash of app chrome on cold load.
//
// Gates on `user` only — not `profile.onboarding_completed`. Mid-
// onboarding users see the app chrome; clicking a sidebar link still
// trips ProfileGuard on the target route.
export function LearnShell() {
  const { user, loading } = useAuth()

  if (!loading && user) {
    return (
      <AppShell>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </div>
      </AppShell>
    )
  }

  return (
    <div className="bg-caddie-bg text-caddie-ink" style={{ minHeight: '100vh' }}>
      <PublicNav />
      <main style={{ paddingTop: 120, paddingBottom: 80 }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 28px' }}>
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  )
}

function RouteFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center font-sans text-meta text-caddie-ink-dim">
      Loading…
    </div>
  )
}
