import { lazy, Suspense } from 'react'
import { createBrowserRouter, Outlet, type RouteObject } from 'react-router-dom'
import { AuthGuard } from './components/auth/AuthGuard'
import { ProfileGuard } from './components/auth/ProfileGuard'
import { AppShell } from './components/layout/AppShell'
import { PublicShell } from './components/landing/PublicShell'
import { LearnShell } from './components/landing/LearnShell'
import { RouteErrorBoundary } from './components/errors/ErrorBoundary'
import { LoginPage } from './pages/auth/LoginPage'
import { SignupPage } from './pages/auth/SignupPage'
import { AuthCallbackPage } from './pages/auth/AuthCallbackPage'
import { NotFoundPage } from './pages/errors/NotFoundPage'
import { OnboardingPage } from './pages/onboarding/OnboardingPage'
import { LandingPage } from './pages/landing/LandingPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { RoundsPage } from './pages/rounds/RoundsPage'
import { NewRoundPage } from './pages/rounds/NewRoundPage'
import { PracticePlanPage } from './pages/practice/PracticePlanPage'
import { DrillLibraryPage } from './pages/practice/DrillLibraryPage'
import { SettingsPage } from './pages/settings/SettingsPage'
import { BagPage } from './pages/settings/BagPage'

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
const ImportDataPage = lazy(() =>
  import('./pages/rounds/ImportDataPage').then((m) => ({ default: m.ImportDataPage })),
)
const LearnPage = lazy(() =>
  import('./pages/learn/LearnPage').then((m) => ({ default: m.LearnPage })),
)
const LearnArticlePage = lazy(() =>
  import('./pages/learn/LearnArticlePage').then((m) => ({
    default: m.LearnArticlePage,
  })),
)
const PrivacyPage = lazy(() =>
  import('./pages/landing/PrivacyPage').then((m) => ({ default: m.PrivacyPage })),
)
const SupportPage = lazy(() =>
  import('./pages/landing/SupportPage').then((m) => ({ default: m.SupportPage })),
)
const CoursePlanPage = lazy(() => import('./pages/plan/CoursePlanPage'))
const HolePlanPage = lazy(() => import('./pages/plan/HolePlanPage'))
// Dev-only Course Editor + ops dashboard — their backends (vite-plugins/
// dev-course-api.ts, vite-plugins/dev-admin-api.ts) only exist under
// `vite dev`, so the routes are gated on import.meta.env.DEV below.
//
// The lazy() calls themselves live inside that same gate (see the IIFE at
// the route-array callsite), not just the JSX that renders them. Proved
// against the built artifact
// (.superpowers/sdd/2026-09-08-admin-ops-dashboard/task-4-report.md) that
// declaring `const X = lazy(() => import('./X'))` up here, outside the
// gate, does NOT tree-shake out of a production build even though the JSX
// using X does: React.lazy() is a plain function call, not something
// Rollup can prove is free of side effects, so it keeps the call — and
// the dynamic import() inside it still forces its own chunk into
// dist/assets, fully populated with that page's copy and API paths,
// reachable by direct request on any static host serving the build. Only
// wrapping the declaration itself in the same statically-false branch as
// the JSX removes it: dead-branch elimination doesn't need purity, it
// just deletes code that provably can't run.

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
  // Public routes — no auth required. Visiting these signed-in is fine;
  // PublicNav swaps the sign-up CTA for "Go to app" so the home page
  // doubles as a re-entry point.
  {
    element: <PublicShell />,
    errorElement,
    children: [
      { path: '/', element: <LandingPage />, errorElement },
      { path: '/privacy', element: <PrivacyPage />, errorElement },
      { path: '/support', element: <SupportPage />, errorElement },
    ],
  },
  // Learn — same URLs for crawlers + signed-out readers, but signed-in
  // users see the app chrome with sidebar. LearnShell handles the swap;
  // routes stay out of PublicShell so PublicNav doesn't paint on top
  // of AppShell for authed users.
  {
    element: <LearnShell />,
    errorElement,
    children: [
      { path: '/learn', element: <LearnPage />, errorElement },
      { path: '/learn/:slug', element: <LearnArticlePage />, errorElement },
    ],
  },
  { path: '/login', element: <LoginPage />, errorElement },
  { path: '/signup', element: <SignupPage />, errorElement },
  { path: '/auth/callback', element: <AuthCallbackPage />, errorElement },
  {
    path: '/onboarding',
    element: <AuthGuard><OnboardingPage /></AuthGuard>,
    errorElement,
  },
  {
    element: <ProtectedShell />,
    errorElement,
    children: [
      { path: '/dashboard', element: <DashboardPage />, errorElement },
      { path: '/rounds', element: <RoundsPage />, errorElement },
      { path: '/rounds/new', element: <NewRoundPage />, errorElement },
      { path: '/rounds/import', element: <ImportDataPage />, errorElement },
      { path: '/rounds/:id', element: <RoundDetailPage />, errorElement },
      { path: '/stats', element: <StrokesGainedPage />, errorElement },
      { path: '/patterns', element: <ShotPatternsPage />, errorElement },
      { path: '/practice', element: <PracticePlanPage />, errorElement },
      { path: '/practice/drills', element: <DrillLibraryPage />, errorElement },
      { path: '/plan', element: <CoursePlanPage />, errorElement },
      { path: '/plan/:courseId/:holeNumber', element: <HolePlanPage />, errorElement },
      { path: '/settings', element: <SettingsPage />, errorElement },
      { path: '/settings/bag', element: <BagPage />, errorElement },
      ...(import.meta.env.DEV
        ? (() => {
            const CourseEditorIndexPage = lazy(
              () => import('./pages/dev-editor/CourseEditorIndexPage'),
            )
            const CourseEditorPage = lazy(() => import('./pages/dev-editor/CourseEditorPage'))
            const AdminDashboardPage = lazy(() => import('./pages/dev-admin/AdminDashboardPage'))
            return [
              { path: '/dev/courses', element: <CourseEditorIndexPage />, errorElement },
              { path: '/dev/courses/:id/edit', element: <CourseEditorPage />, errorElement },
              { path: '/dev/admin', element: <AdminDashboardPage />, errorElement },
            ]
          })()
        : []),
    ],
  },
  { path: '*', element: <NotFoundPage />, errorElement },
]

export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter(routes)
