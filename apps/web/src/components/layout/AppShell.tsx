import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  // Close the drawer whenever the user navigates.
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  return (
    <div className="flex h-screen w-full bg-caddie-bg text-caddie-ink">
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {drawerOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(28,33,28,0.55)' }}
        />
      )}
      <div
        className="fixed inset-y-0 left-0 z-50 md:hidden"
        style={{
          transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 200ms ease',
        }}
      >
        <Sidebar />
      </div>

      <main
        className="flex-1 overflow-y-auto"
        style={{ paddingInline: 'clamp(16px, 4vw, 32px)' }}
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
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="md:hidden self-start"
            style={{
              background: 'transparent',
              border: '1px solid #D9D2BF',
              borderRadius: 2,
              padding: '8px 10px',
              fontSize: 12,
              letterSpacing: '0.14em',
              fontWeight: 600,
              color: '#1C211C',
              marginBottom: 16,
            }}
          >
            ☰ MENU
          </button>
          <div style={{ flex: 1 }}>{children}</div>
          <footer
            className="font-mono uppercase text-caddie-ink-mute"
            style={{
              borderTop: '1px solid #D9D2BF',
              marginTop: 40,
              paddingTop: 18,
              fontSize: 10,
              letterSpacing: '0.14em',
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
            </a>{' '}
            · ODbL licensed
          </footer>
        </div>
      </main>
    </div>
  )
}
