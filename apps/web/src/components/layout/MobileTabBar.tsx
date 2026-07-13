import { NavLink } from 'react-router-dom'

// Phase 1 of the mobile-web redesign: on phone viewports the desktop sidebar is
// replaced by this fixed bottom tab bar, mirroring the native app's five tabs
// (Home / Stats / Patterns / Practice / Profile). Secondary routes (Rounds,
// Learn, My Bag, Settings) stay reachable via the top-bar menu until Phase 2
// folds them into the Home + Profile pages. Hidden on md+ (desktop keeps the
// sidebar).

type IconProps = { active: boolean }

const svg = (children: React.ReactNode) => (
  <svg
    width={22}
    height={22}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
)

const HomeIcon = (_: IconProps) => svg(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>)
const StatsIcon = (_: IconProps) => svg(<><path d="M4 5v14h16" /><path d="m7 14 3-4 3 3 4-6" /></>)
const PatternsIcon = (_: IconProps) => svg(<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.4" /><circle cx="12" cy="12" r="0.6" fill="currentColor" /></>)
// Golf ball on a tee (matches the native app's MDI golf-tee tab icon): ball on
// top, a cupped tee cradling it, tapering to a point.
const PracticeIcon = (_: IconProps) => svg(<><circle cx="12" cy="6.5" r="3" /><path d="M9.2 10c.5 1.2 1.6 1.9 2.8 1.9s2.3-.7 2.8-1.9" /><path d="M10.8 12 12 20l1.2-8" /></>)
const ProfileIcon = (_: IconProps) => svg(<><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5c1-3.6 4-5.5 7.5-5.5s6.5 1.9 7.5 5.5" /></>)

const tabs: { to: string; label: string; Icon: (p: IconProps) => React.ReactNode; end?: boolean }[] = [
  { to: '/dashboard', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/stats', label: 'Stats', Icon: StatsIcon },
  { to: '/patterns', label: 'Patterns', Icon: PatternsIcon },
  { to: '/practice', label: 'Practice', Icon: PracticeIcon },
  // Profile maps to Settings (the native "Profile" tab is the account/settings
  // area). No `end`, so /settings/bag also keeps Profile lit.
  { to: '/settings', label: 'Profile', Icon: ProfileIcon },
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
      {tabs.map(({ to, label, Icon, end }) => (
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
              <Icon active={isActive} />
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
