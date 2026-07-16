import { NavLink } from 'react-router-dom'
import {
  mdiHomeOutline,
  mdiChartLine,
  mdiTargetVariant,
  mdiGolfTee,
  mdiAccountCircleOutline,
} from '@mdi/js'

// Phase 1 of the mobile-web redesign: on phone viewports the desktop sidebar is
// replaced by this fixed bottom tab bar, mirroring the native app's five tabs.
// Icons are the SAME Material Community Icons the native app renders via
// @expo/vector-icons (home-outline / chart-line / target-variant / golf-tee /
// account-circle-outline) — pulled here as SVG path data from @mdi/js so the
// two platforms draw identical glyphs with no drift. Secondary routes (Rounds,
// Learn, My Bag, Settings) stay reachable via the top-bar menu until Phase 2
// folds them into the Home + Profile pages. Hidden on md+ (desktop keeps the
// sidebar).

function MdiIcon({ path }: { path: string }) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

const tabs: { to: string; label: string; icon: string; end?: boolean }[] = [
  { to: '/dashboard', label: 'Home', icon: mdiHomeOutline, end: true },
  { to: '/stats', label: 'Stats', icon: mdiChartLine },
  { to: '/patterns', label: 'Patterns', icon: mdiTargetVariant },
  { to: '/practice', label: 'Practice', icon: mdiGolfTee },
  // Profile maps to Settings (the native "Profile" tab is the account/settings
  // area). No `end`, so /settings/bag also keeps Profile lit.
  { to: '/settings', label: 'Profile', icon: mdiAccountCircleOutline },
]

export function MobileTabBar() {
  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-caddie-surface"
      style={{
        borderTop: '1px solid #D9D2BF',
        display: 'flex',
        // Respect the iOS/Android home-indicator inset in mobile browsers.
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {tabs.map(({ to, label, icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          aria-label={label}
          className={({ isActive }) =>
            [
              'flex flex-1 flex-col items-center justify-center transition-colors',
              isActive ? 'text-caddie-accent' : 'text-caddie-ink-mute',
            ].join(' ')
          }
          style={{ gap: 3, paddingTop: 8, paddingBottom: 8, minHeight: 56 }}
        >
          {({ isActive }) => (
            <>
              <MdiIcon path={icon} />
              <span
                className="font-mono uppercase"
                style={{ fontSize: 9, letterSpacing: '0.1em', fontWeight: isActive ? 600 : 500 }}
              >
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
