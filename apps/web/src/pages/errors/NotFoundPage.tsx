import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

// Rendered inside PublicShell (router '*'), so the nav and wordmark show.
// The way back depends on who is reading: Home for a signed-in golfer, the
// landing page for anyone else.
export function NotFoundPage() {
  const { user, loading } = useAuth()
  const signedIn = !loading && !!user
  return (
    <main
      style={{
        minHeight: '82vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '120px 16px 64px',
      }}
    >
      <div style={{ maxWidth: 520, textAlign: 'center', position: 'relative' }}>
        <div
          aria-hidden
          className="font-serif"
          style={{
            fontSize: 120,
            fontStyle: 'italic',
            fontWeight: 500,
            lineHeight: 1,
            color: '#D9D2BF',
            letterSpacing: '-0.03em',
            marginBottom: -44,
            userSelect: 'none',
          }}
        >
          404
        </div>
        <h1
          className="font-serif text-caddie-ink"
          style={{ position: 'relative', fontStyle: 'italic', fontWeight: 500, fontSize: 38, letterSpacing: '-0.015em', margin: 0 }}
        >
          Page not found.
        </h1>
        <p className="font-serif text-caddie-ink" style={{ fontSize: 18, lineHeight: 1.5, margin: '14px 0 26px' }}>
          That hole isn&rsquo;t on this course.
        </p>
        <div className="flex flex-wrap items-center justify-center" style={{ gap: '14px 22px' }}>
          <Link to={signedIn ? '/dashboard' : '/'} className="key key-primary">
            {signedIn ? 'Back to Home' : 'Back to the start'}{' '}
            <span className="font-serif" style={{ fontStyle: 'italic' }}>
              →
            </span>
          </Link>
          <Link
            to="/learn"
            className="text-caddie-ink-dim hover:text-caddie-ink"
            style={{ fontSize: 14, textDecoration: 'underline', textUnderlineOffset: 3 }}
          >
            Read the guides
          </Link>
        </div>
      </div>
    </main>
  )
}
