import { NavLink } from 'react-router-dom'
import { marksPath, pencilUnderline } from '@oga/core'
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

// Mobile's PencilTabButton underline, from the shared pencil geometry, so the
// active tab carries the same graphite hand (SHL-14).
const UNDERLINE = marksPath([{ m: pencilUnderline(), at: 0 }], 1e9)

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
