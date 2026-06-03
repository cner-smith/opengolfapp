import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

// Fixed top nav for marketing/public pages (LandingPage, PrivacyPage,
// public Learn). Transparent on top of the page; backdrop appears as
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
        background: scrolled ? 'rgba(242, 238, 229, 0.92)' : 'transparent',
        backdropFilter: scrolled ? 'saturate(140%) blur(8px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'saturate(140%) blur(8px)' : 'none',
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
        <Link
          to="/"
          style={{
            textDecoration: 'none',
            color: '#1C211C',
            display: 'flex',
            flexDirection: 'column',
            lineHeight: 1.05,
          }}
        >
          <span
            className="font-serif"
            style={{ fontSize: 24, fontWeight: 500, fontStyle: 'italic' }}
          >
            OGA
          </span>
          <span
            className="font-mono uppercase"
            style={{
              fontSize: 10,
              letterSpacing: '0.16em',
              color: '#8A8B7E',
              marginTop: 4,
            }}
          >
            Open Golf App
          </span>
        </Link>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {!loading && user ? (
            <Link
              to="/dashboard"
              style={{
                ...btnBase,
                background: '#1C211C',
                color: '#F2EEE5',
                border: '1px solid #1C211C',
              }}
            >
              Go to app{' '}
              <span className="font-serif" style={{ fontStyle: 'italic' }}>
                →
              </span>
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                style={{
                  ...btnBase,
                  color: '#1C211C',
                  border: '1px solid #9F9580',
                  background: 'transparent',
                }}
                className="public-nav-ghost"
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                style={{
                  ...btnBase,
                  background: '#1C211C',
                  color: '#F2EEE5',
                  border: '1px solid #1C211C',
                }}
              >
                Sign up free
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

const btnBase = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontFamily: 'Epilogue, sans-serif',
  fontWeight: 600,
  fontSize: 13,
  letterSpacing: '0.01em',
  borderRadius: 2,
  padding: '8px 14px',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  transition: 'background-color 160ms ease, color 160ms ease, border-color 160ms ease',
} as const
