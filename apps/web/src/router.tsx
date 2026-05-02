import { lazy, Suspense } from 'react'
import { createBrowserRouter, Outlet, type RouteObject } from 'react-router-dom'
import { AuthGuard } from './components/auth/AuthGuard'
import { ProfileGuard } from './components/auth/ProfileGuard'
import { AppShell } from './components/layout/AppShell'
import { RouteErrorBoundary } from './components/errors/ErrorBoundary'
import { LoginPage } from './pages/auth/LoginPage'
import { SignupPage } from './pages/auth/SignupPage'
import { NotFoundPage } from './pages/errors/NotFoundPage'
import { OnboardingPage } from './pages/onboarding/OnboardingPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { RoundsPage } from './pages/rounds/RoundsPage'
import { NewRoundPage } from './pages/rounds/NewRoundPage'
import { PracticePlanPage } from './pages/practice/PracticePlanPage'
import { DrillLibraryPage } from './pages/practice/DrillLibraryPage'
import { SettingsPage } from './pages/settings/SettingsPage'

// Heavy / non-entry routes are loaded on demand. Entry routes (auth,
// dashboard, rounds list, settings) stay eager so the initial paint
// after sign-in doesn't waterfall on a chunk fetch.
//
// Pages use named exports, so the .then adapter wraps each module to
// the { default } shape React.lazy expects.
const StrokesGainedPage = lazy(() =>
  import('./pages/stats/StrokesGainedPage').then((m) => ({ default: m.StrokesGainedPage })),
)
const ShotPatternsPage = lazy(() =>
  import('./pages/patterns/ShotPatternsPage').then((m) => ({ default: m.ShotPatternsPage })),
)
const RoundDetailPage = lazy(() =>
  import('./pages/rounds/RoundDetailPage').then((m) => ({ default: m.RoundDetailPage })),
)
const LearnPage = lazy(() =>
  import('./pages/learn/LearnPage').then((m) => ({ default: m.LearnPage })),
)

function RouteFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center font-sans text-meta text-caddie-ink-dim">
      Loading…
    </div>
  )
}

function ProtectedShell() {
  return (
    <AuthGuard>
      <ProfileGuard>
        <AppShell>
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </AppShell>
      </ProfileGuard>
    </AuthGuard>
  )
}

const errorElement = <RouteErrorBoundary />

const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage />, errorElement },
  { path: '/signup', element: <SignupPage />, errorElement },
  {
    path: '/onboarding',
    element: <AuthGuard><OnboardingPage /></AuthGuard>,
    errorElement,
  },
  {
    element: <ProtectedShell />,
    errorElement,
    children: [
      { path: '/', element: <DashboardPage />, errorElement },
      { path: '/rounds', element: <RoundsPage />, errorElement },
      { path: '/rounds/new', element: <NewRoundPage />, errorElement },
      { path: '/rounds/:id', element: <RoundDetailPage />, errorElement },
      { path: '/stats', element: <StrokesGainedPage />, errorElement },
      { path: '/patterns', element: <ShotPatternsPage />, errorElement },
      { path: '/practice', element: <PracticePlanPage />, errorElement },
      { path: '/practice/drills', element: <DrillLibraryPage />, errorElement },
      { path: '/learn', element: <LearnPage />, errorElement },
      { path: '/settings', element: <SettingsPage />, errorElement },
    ],
  },
  { path: '*', element: <NotFoundPage />, errorElement },
]

export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter(routes)
