import { createBrowserRouter, Outlet, type RouteObject } from 'react-router-dom'
import { AuthGuard } from './components/auth/AuthGuard'
import { AppShell } from './components/layout/AppShell'
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

function ProtectedShell() {
  return (
    <AuthGuard>
      <AppShell>
        <Outlet />
      </AppShell>
    </AuthGuard>
  )
}

const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  { path: '/onboarding', element: <AuthGuard><OnboardingPage /></AuthGuard> },
  {
    element: <ProtectedShell />,
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/rounds', element: <RoundsPage /> },
      { path: '/rounds/new', element: <NewRoundPage /> },
      { path: '/rounds/:id', element: <RoundDetailPage /> },
      { path: '/stats', element: <StrokesGainedPage /> },
      { path: '/patterns', element: <ShotPatternsPage /> },
      { path: '/practice', element: <PracticePlanPage /> },
      { path: '/practice/drills', element: <DrillLibraryPage /> },
    ],
  },
]

export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter(routes)
