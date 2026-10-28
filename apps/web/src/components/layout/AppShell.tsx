import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { MobileTabBar } from './MobileTabBar'
import './shell.css'

// The phone top bar names the screen in cream Fraunces on ink, as the app's
// header does (SHL-13). Longest prefix wins; unknown routes show the mark.
const TITLES: [string, string][] = [
  ['/settings/bag', 'My bag'],
  ['/settings', 'Profile'],
  ['/dashboard', 'Home'],
  ['/rounds/new', 'New round'],
  ['/rounds/import', 'Import'],
  ['/rounds', 'Rounds'],
  ['/stats', 'Stats'],
  ['/patterns', 'Patterns'],
  ['/practice/drills', 'Drills'],
  ['/practice', 'Practice'],
  ['/learn', 'Learn'],
  ['/plan', 'Course plan'],
]

function titleFor(pathname: string): string | null {
  return TITLES.find(([p]) => pathname === p || pathname.startsWith(`${p}/`))?.[1] ?? null
}

export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLButtonElement>(null)
  const title = titleFor(location.pathname)

  // On navigation: close the drawer and reset the scroll position. `main`
  // is the scroll container (not the window), and the app had no scroll
  // restoration — so long pages (Learn articles especially) kept the
  // previous route's scroll offset instead of starting at the top. Keyed
  // on pathname only, so query-param changes (e.g. round tab switches)
  // don't yank the scroll.
  useEffect(() => {
    setDrawerOpen(false)
    mainRef.current?.scrollTo({ top: 0 })
  }, [location.pathname])

  // Drawer is a modal: Escape closes it, focus moves in on open and back to
  // the Menu key on close, and the page behind stops scrolling (SHL-03).
  const wasOpen = useRef(false)
  useEffect(() => {
    if (!drawerOpen) {
      if (wasOpen.current) menuRef.current?.focus()
      wasOpen.current = false
      return
    }
    wasOpen.current = true
    drawerRef.current?.querySelector<HTMLElement>('nav a')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  return (
    <div className="flex h-screen w-full bg-caddie-bg text-caddie-ink">
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      <div
        aria-hidden="true"
        data-open={drawerOpen}
        onClick={() => setDrawerOpen(false)}
        className="shell-scrim fixed inset-0 z-40 lg:hidden"
      />
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        data-open={drawerOpen}
        className="shell-drawer fixed inset-y-0 left-0 z-50 flex lg:hidden"
      >
        <Sidebar onClose={() => setDrawerOpen(false)} />
      </div>

      {/* Phone top bar: ink band, the screen's name in cream Fraunces, a
          44px menu key. Fixed so it stays on scroll; hidden on lg+. */}
      <header
        className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-caddie-ink text-caddie-bg"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex items-center justify-between" style={{ height: 52, paddingInline: '16px 6px' }}>
          {title ? (
            <div className="font-serif" style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em' }}>
              {title}
            </div>
          ) : (
            <div className="font-serif" style={{ fontSize: 20, fontWeight: 500, fontStyle: 'italic' }}>
              oga<span style={{ fontStyle: 'normal' }}>.</span>
            </div>
          )}
          <div className="flex items-center">
            {location.pathname === '/settings/bag' && (
              <Link
                to="/settings"
                className="flex items-center text-caddie-bg/80 hover:text-caddie-bg"
                style={{ minHeight: 44, paddingInline: 10, fontSize: 14 }}
              >
                ← Back
              </Link>
            )}
            <button
              ref={menuRef}
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              aria-expanded={drawerOpen}
              className="shell-menu-glyph flex flex-col items-center justify-center transition-colors hover:bg-white/10"
              style={{ width: 44, height: 44, borderRadius: 3 }}
            >
              <span />
              <span />
              <span style={{ width: 14, alignSelf: 'center', marginLeft: 6 }} />
            </button>
          </div>
        </div>
      </header>

      <main
        ref={mainRef}
        className="flex-1 overflow-y-auto pt-[calc(52px+env(safe-area-inset-top))] lg:pt-0"
        style={{ paddingInline: 'clamp(16px, 4vw, 40px)', overflowY: drawerOpen ? 'hidden' : undefined }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100%',
            paddingBlock: 'clamp(18px, 3vw, 28px)',
          }}
        >
          <div style={{ flex: 1 }}>{children}</div>
          <footer
            className="text-caddie-ink-dim"
            style={{
              borderTop: '1px solid #D9D2BF',
              marginTop: 40,
              paddingTop: 18,
              fontSize: 12,
            }}
          >
            Course data from{' '}
            <a
              href="https://opengolfapi.org"
              target="_blank"
              rel="noreferrer noopener"
              style={{ textDecoration: 'underline' }}
            >
              OpenGolfAPI
            </a>
            ,{' '}
            <a
              href="https://golfcourseapi.com"
              target="_blank"
              rel="noreferrer noopener"
              style={{ textDecoration: 'underline' }}
            >
              GolfCourseAPI
            </a>
            , and ©{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer noopener"
              style={{ textDecoration: 'underline' }}
            >
              OpenStreetMap
            </a>{' '}
            contributors (ODbL)
          </footer>
          {/* Clears the fixed bottom tab bar (mobile only). */}
          <div
            className="lg:hidden"
            style={{ height: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}
          />
        </div>
      </main>
      <MobileTabBar />
    </div>
  )
}
