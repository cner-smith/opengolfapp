import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { AppShell } from '../../components/layout/AppShell'
import { PublicShell } from '../../components/landing/PublicShell'

// The router's '*'. A signed-in golfer who mistypes an app URL stays in the
// app (sidebar and all), with one key back to Home; anyone else gets the
// public nav and a way back to the landing page. Public while auth resolves,
// as in LearnShell.
export function NotFoundPage() {
  useDocumentTitle('Page not found · OGA')
  const { user, loading } = useAuth()
  const signedIn = !loading && !!user
  const body = <NotFound signedIn={signedIn} />
  return signedIn ? <AppShell>{body}</AppShell> : <PublicShell>{body}</PublicShell>
}

function NotFound({ signedIn }: { signedIn: boolean }) {
  // AppShell already has the page's <main>; PublicShell doesn't.
  const Wrap = signedIn ? 'div' : 'main'
  return (
    <Wrap
      style={{
        minHeight: '82vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: signedIn ? '64px 0' : '120px 16px 64px',
      }}
    >
      <div style={{ maxWidth: 520, textAlign: 'center', position: 'relative' }}>
        <div
          aria-hidden
          className="font-serif nf-rise nf-ghost"
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
          className="font-serif text-caddie-ink nf-rise nf-head"
          style={{ position: 'relative', fontStyle: 'italic', fontWeight: 500, fontSize: 38, letterSpacing: '-0.015em', margin: 0 }}
        >
          Page not found.
        </h1>
        <p className="font-serif text-caddie-ink nf-rise nf-head" style={{ fontSize: 18, lineHeight: 1.5, margin: '14px 0 26px' }}>
          That hole isn&rsquo;t on this course.
        </p>
        <div className="flex flex-wrap items-center justify-center nf-rise nf-keys" style={{ gap: '14px 22px' }}>
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
    </Wrap>
  )
}
