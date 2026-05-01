import { createBrowserRouter, Outlet, type RouteObject } from 'react-router-dom'
import { AuthGuard } from './components/auth/AuthGuard'
import { ProfileGuard } from './components/auth/ProfileGuard'
import { AppShell } from './components/layout/AppShell'
import { RouteErrorBoundary } from './components/errors/ErrorBoundary'
import { LoginPage } from './pages/auth/LoginPage'
import { SignupPage } from './pages/auth/SignupPage'
import { OnboardingPage } from './pages/onboarding/OnboardingPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { RoundsPage } from './pages/rounds/RoundsPage'
import { RoundDetailPage } from './pages/rounds/RoundDetailPage'
import { NewRoundPage } from './pages/rounds/NewRoundPage'
import { StrokesGainedPage } from './pages/stats/StrokesGainedPage'
import { ShotPatternsPage } from './pages/patterns/ShotPatternsPage'
import { PracticePlanPage } from './pages/practice/PracticePlanPage'
import { DrillLibraryPage } from './pages/practice/DrillLibraryPage'
import { LearnPage } from './pages/learn/LearnPage'
import { SettingsPage } from './pages/settings/SettingsPage'

function ProtectedShell() {
  return (
    <AuthGuard>
      <ProfileGuard>
        <AppShell>
          <Outlet />
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
]

export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter(routes)
