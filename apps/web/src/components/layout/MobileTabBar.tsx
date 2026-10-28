import { NavLink } from 'react-router-dom'
import './shell.css'
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
// folds them into the Home + Profile pages. Hidden on lg+ (desktop keeps the
// sidebar).

function MdiIcon({ path }: { path: string }) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

// Mobile's PencilTabButton underline (marksPath(pencilUnderline()) from
// apps/mobile/components/paper/pencil.ts), precomputed and trimmed of its
// end-cap loops, so the active tab carries the same graphite hand (SHL-14).
const UNDERLINE =
  'M-14.02 0.70 Q-12.58 -0.07 -11.53 -0.13 Q-10.48 -0.19 -9.43 -0.24 Q-8.39 -0.29 -7.34 -0.35 Q-6.29 -0.41 -5.24 -0.49 Q-4.19 -0.57 -3.14 -0.60 Q-2.08 -0.64 -1.03 -0.70 Q0.02 -0.76 1.07 -0.82 Q2.11 -0.88 3.16 -0.98 Q4.21 -1.08 5.22 -1.18 Q6.24 -1.29 7.29 -1.34 Q8.34 -1.40 9.39 -1.50 Q10.43 -1.61 12.21 -1.58 Q13.98 -1.55 14.01 -1.55 Q14.30 -1.40 14.02 -1.25 Q12.31 -0.78 12.31 -0.78 Q10.60 -0.32 9.56 -0.17 Q8.52 -0.01 7.49 0.20 Q6.45 0.40 5.38 0.44 Q4.30 0.48 3.25 0.51 Q2.20 0.55 1.15 0.61 Q0.10 0.67 -0.94 0.74 Q-1.99 0.81 -3.03 0.90 Q-4.07 0.99 -5.12 1.08 Q-6.16 1.16 -7.21 1.27 Q-8.25 1.38 -9.30 1.50 Q-10.34 1.61 -11.38 1.72 Q-12.43 1.83 -13.20 1.57 Q-13.98 1.30 -14.01 1.30 Q-14.30 1.00 -14.02 0.70Z'

export function PencilUnderline({ width = 34, height = 8 }: { width?: number | string; height?: number | string }) {
  return (
    <svg
      className="shell-pencil"
      width={width}
      height={height}
      viewBox="-17 -4 34 8"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={UNDERLINE} fill="#353430" opacity={0.9} />
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
      // `flex` belongs in the class list, NOT in the style object below: an
      // inline `display` beats any stylesheet rule short of !important, so
      // `style={{ display: 'flex' }}` silently overrode `lg:hidden` and the
      // bar rendered at EVERY width — including desktop, alongside the
      // sidebar. Both display values must live in the same cascade layer for
      // the breakpoint to win.
      className="flex lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-caddie-surface"
      style={{
        borderTop: '1px solid #D9D2BF',
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
              isActive ? 'text-caddie-ink' : 'text-caddie-ink-mute hover:text-caddie-ink-dim',
            ].join(' ')
          }
          style={{ gap: 3, paddingTop: 8, paddingBottom: 10, minHeight: 58, position: 'relative' }}
        >
          {({ isActive }) => (
            <>
              <MdiIcon path={icon} />
              <span style={{ fontSize: 11, fontWeight: isActive ? 600 : 500 }}>
                {label}
              </span>
              {isActive && (
                <span style={{ position: 'absolute', bottom: 3, lineHeight: 0 }}>
                  <PencilUnderline />
                </span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
