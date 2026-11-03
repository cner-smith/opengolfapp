import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { StoreBadges } from '../../components/landing/StoreBadges'

// Lower landing sections (free forever → footer), split from LandingPage.tsx.

const GITHUB_REPO = 'https://github.com/cner-smith/opengolfapp'
const KOFI = 'https://ko-fi.com/nartana'
const WRAP: React.CSSProperties = { maxWidth: 1180, margin: '0 auto', padding: '0 28px' }

export function PrimaryCta({ isAuthed, inverse }: { isAuthed: boolean; inverse?: boolean }) {
  return (
    <Link to={isAuthed ? '/dashboard' : '/signup'} className={inverse ? 'key lb-cta lb-cta-inverse' : 'key key-primary lb-cta'}>
      {isAuthed ? 'Go to app' : 'Create account'}{' '}
      <span className="font-serif" style={{ fontStyle: 'italic' }}>
        →
      </span>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Free, and open source
// ---------------------------------------------------------------------------

export function Free() {
  return (
    <section className="lb-section">
      <div style={WRAP} className="lb-free">
        <h2 className="lb-sentence font-serif">
          It&apos;s free, and it <em className="lb-accent">stays</em> free.
        </h2>
        <div>
          <p className="lb-lede" style={{ margin: 0 }}>
            No subscription, no premium tier, no ads. OGA is open source under
            the MIT License: the code, the roadmap and the bugs all live on
            GitHub. <em>If something is wrong, open an issue.</em> If you write
            code, send a pull request. If you&apos;d rather not trust anyone
            with your rounds, run your own copy.
          </p>
          <p className="lb-lede" style={{ margin: '16px 0 0' }}>
            It runs on donations. If it helps your game, the tip jar is open.
          </p>
          <div className="lb-links">
            <a className="lb-link" href={GITHUB_REPO} target="_blank" rel="noreferrer noopener">
              Read the code <Arrow />
            </a>
            <a className="lb-link" href={`${GITHUB_REPO}/issues`} target="_blank" rel="noreferrer noopener">
              Open an issue <Arrow />
            </a>
            <a className="lb-link" href={KOFI} target="_blank" rel="noreferrer noopener">
              Tip jar on Ko-fi <Arrow />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

function Arrow() {
  return (
    <span className="font-serif" style={{ fontStyle: 'italic' }}>
      →
    </span>
  )
}

// ---------------------------------------------------------------------------
// What OGA isn't
// ---------------------------------------------------------------------------

const NEGATIONS = [
  {
    what: 'Not a coaching service.',
    why: 'OGA gives you the numbers. The lessons happen with a real coach; we make their job easier, not replace them.',
  },
  {
    what: 'Not gamified.',
    why: 'No streaks, no trophies for logging a round. The reward is knowing where your strokes go.',
  },
  {
    what: 'Not a shop.',
    why: "We don't sell clubs, balls, lessons or training aids. The analysis is the product, and it's free.",
  },
  {
    what: 'Not a launch monitor.',
    why: 'No sensor measures your spin. OGA reads where the ball finished, and what it estimates, it labels an estimate.',
  },
  {
    what: 'Not a data broker.',
    why: "Your rounds are yours to export at any time. We don't sell them, and we don't share them without your say.",
  },
]

export function Negation() {
  return (
    <section className="lb-section">
      <div style={WRAP} className="landing-negation lb-negation">
        <h2 className="lb-sentence font-serif">What OGA isn&apos;t.</h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {NEGATIONS.map((item) => (
            <li key={item.what} className="lb-neg-row">
              <div className="font-serif lb-neg-what">{item.what}</div>
              <div className="lb-neg-why">{item.why}</div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Closing call to action
// ---------------------------------------------------------------------------

export function Close() {
  const { user, loading } = useAuth()
  const isAuthed = !loading && !!user
  return (
    <section className="lb-close">
      <div style={{ ...WRAP, textAlign: 'center' }}>
        <h2 className="lb-close-title font-serif">
          {isAuthed ? 'Welcome back.' : 'Stop guessing what to work on.'}
        </h2>
        <p className="lb-close-sub">
          {isAuthed
            ? 'Pick up where you left off.'
            : 'Play your rounds, mark your shots, and OGA tells you where the strokes went and builds the practice around it.'}
        </p>
        <div style={{ marginTop: 30 }}>
          <PrimaryCta isAuthed={isAuthed} inverse />
        </div>
        <StoreBadges align="center" className="landing-store-badges" />
        {!isAuthed && (
          <p className="lb-close-signin">
            Already tracking? <Link to="/login">Sign in</Link>
          </p>
        )}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

export function Footer() {
  const { user, loading } = useAuth()
  return (
    <footer className="lb-footer">
      <div style={WRAP} className="landing-footer lb-footer-grid">
        <div className="font-serif" style={{ fontSize: 20, fontWeight: 500, fontStyle: 'italic' }}>
          oga<span style={{ fontStyle: 'normal' }}>.</span>
        </div>
        <nav className="lb-footer-links" aria-label="Footer">
          <Link to="/learn">Learn</Link>
          <a href={GITHUB_REPO} target="_blank" rel="noreferrer noopener">GitHub</a>
          <a href={KOFI} target="_blank" rel="noreferrer noopener">Ko-fi</a>
          <a href="https://github.com/sponsors/cner-smith" target="_blank" rel="noreferrer noopener">Sponsors</a>
          <Link to="/privacy">Privacy</Link>
          <Link to="/support">Support</Link>
          {!loading && user ? <Link to="/dashboard">Go to app</Link> : <Link to="/login">Sign in</Link>}
        </nav>
        <div className="lb-footer-note">Free and open source, MIT License</div>
      </div>
    </footer>
  )
}
