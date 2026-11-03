import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Wordmark } from './Wordmark'

// Fixed top nav for marketing/public pages (LandingPage, PrivacyPage,
// public Learn). Transparent on top of the page; opaque paper appears as
// the user scrolls. Auth-aware: signed-in visitors see "Go to app"
// instead of the sign-up split, so the home page doubles as a cheap
// re-entry point.
export function PublicNav() {
  const { user, loading } = useAuth()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        transition: 'background-color 240ms ease, border-color 240ms ease',
        borderBottom: scrolled
          ? '1px solid #D9D2BF'
          : '1px solid transparent',
        background: scrolled ? '#F2EEE5' : 'transparent',
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          padding: '14px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Wordmark />
          <span className="font-sans" style={{ fontSize: 12, color: '#5C6356', marginTop: 3 }}>
            Open Golf App
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {!loading && user ? (
            <Link to="/dashboard" className="key key-primary" style={navKey}>
              Go to app{' '}
              <span className="font-serif" style={{ fontStyle: 'italic' }}>
                →
              </span>
            </Link>
          ) : (
            <>
              {/* A paper key: pressable like Create account, but not green. */}
              <Link to="/login" className="key" style={navKey}>
                Sign in
              </Link>
              <Link to="/signup" className="key key-primary" style={navKey}>
                Create account
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

// The landing's one primary, a size down for the bar: same forest key as the
// hero, not a second (ink) primary beside it.
const navKey = { minHeight: 40, padding: '0 14px', fontSize: 13, whiteSpace: 'nowrap' } as const
