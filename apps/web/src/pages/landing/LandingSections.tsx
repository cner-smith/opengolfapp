import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { StoreBadges } from '../../components/landing/StoreBadges'

// Lower landing sections (community → footer), split from LandingPage.tsx
// to keep both under the 1000-line cap.

// ---------------------------------------------------------------------------
// Community / open source
// ---------------------------------------------------------------------------

const GITHUB_REPO = 'https://github.com/cner-smith/opengolfapp'

export function Community() {
  return (
    <section
      style={{ background: '#1C211C', color: '#F2EEE5', padding: '110px 0', marginTop: 60 }}
    >
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px' }}>
        <div className="kicker" style={{ color: 'rgba(242,238,229,0.55)' }}>
          The “open” in Open Golf App
        </div>
        <h2
          className="font-serif"
          style={{
            fontSize: 'clamp(36px, 5vw, 56px)',
            fontWeight: 500,
            fontStyle: 'italic',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            margin: '16px 0 0',
            color: '#F2EEE5',
            maxWidth: 760,
          }}
        >
          Read the code. <em>Suggest a feature. Fix what's broken.</em>
        </h2>
        <p
          className="font-serif"
          style={{
            fontSize: 18,
            lineHeight: 1.6,
            color: 'rgba(242,238,229,0.85)',
            margin: '22px 0 36px',
            maxWidth: 680,
          }}
        >
          OGA is built in public. The source is on GitHub, the roadmap is on
          GitHub, the bugs are on GitHub.{' '}
          <em style={{ color: '#F2EEE5', fontWeight: 500 }}>
            If something doesn't work the way you expect
          </em>{' '}
          — open an issue. If you want a feature — open an issue. If you can
          write code, open a pull request.
        </p>
        <div
          className="landing-ways"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginTop: 28 }}
        >
          <Way
            n="01 · For golfers"
            title="Tell us what you want."
            href={`${GITHUB_REPO}/issues`}
            cta="Open an issue"
          >
            Open an issue describing what's missing or broken.{' '}
            <em style={{ color: '#F2EEE5', fontWeight: 500 }}>
              Every feature in the app started as an issue.
            </em>
          </Way>
          <Way
            n="02 · For developers"
            title="Read the source."
            href={GITHUB_REPO}
            cta="Explore the repo"
          >
            TypeScript on web, React Native on mobile, Supabase out back.{' '}
            <em style={{ color: '#F2EEE5', fontWeight: 500 }}>
              Clone it, run it locally, send a pull request.
            </em>{' '}
            Good-first-issues are tagged.
          </Way>
          <Way
            n="03 · For everyone"
            title="Self-host if you'd rather."
            href={`${GITHUB_REPO}/blob/main/docs/self-hosting.md`}
            cta="Read the docs"
          >
            MIT license means the code is yours to use.{' '}
            <em style={{ color: '#F2EEE5', fontWeight: 500 }}>
              Run your own copy if you'd rather not trust a hosted app with
              your data.
            </em>
          </Way>
        </div>
      </div>
    </section>
  )
}

function Way({
  n,
  title,
  href,
  cta,
  children,
}: {
  n: string
  title: string
  href: string
  cta: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        padding: 24,
        border: '1px solid rgba(242,238,229,0.18)',
        borderRadius: 4,
        background: 'rgba(242,238,229,0.04)',
      }}
    >
      <div
        className="font-mono uppercase"
        style={{
          fontSize: 10,
          letterSpacing: '0.16em',
          color: 'rgba(242,238,229,0.55)',
          marginBottom: 10,
        }}
      >
        {n}
      </div>
      <h4
        className="font-serif"
        style={{
          fontSize: 20,
          fontWeight: 500,
          fontStyle: 'italic',
          margin: '0 0 8px',
          color: '#F2EEE5',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h4>
      <p
        className="font-serif"
        style={{ fontSize: 15, lineHeight: 1.55, color: 'rgba(242,238,229,0.7)', margin: 0 }}
      >
        {children}
      </p>
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="font-sans"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          marginTop: 14,
          fontSize: 12,
          fontWeight: 600,
          color: '#F2EEE5',
          textDecoration: 'none',
          borderBottom: '1px solid rgba(242,238,229,0.45)',
          paddingBottom: 2,
        }}
      >
        {cta} →
      </a>
    </div>
  )
}

// ---------------------------------------------------------------------------
// What OGA isn't
// ---------------------------------------------------------------------------

const NEGATIONS = [
  {
    what: 'Not a coaching service.',
    why: (
      <>
        OGA gives you the data.{' '}
        <em style={{ color: '#1C211C', fontWeight: 500 }}>
          The lessons happen with a real coach
        </em>{' '}
        — we make their job easier, not replace them.
      </>
    ),
  },
  {
    what: 'Not gamified.',
    why: (
      <>
        No streaks, no leaderboards by default, no trophies for logging a
        round. You're an adult;{' '}
        <em style={{ color: '#1C211C', fontWeight: 500 }}>the data is the reward.</em>
      </>
    ),
  },
  {
    what: 'Not a shop.',
    why: (
      <>
        <em style={{ color: '#1C211C', fontWeight: 500 }}>
          We don't sell clubs, balls, lessons, or training aids.
        </em>{' '}
        The product is the analysis, and the analysis is free.
      </>
    ),
  },
  {
    what: 'Not a launch monitor.',
    why: (
      <>
        We don't measure spin or apex with a sensor.{' '}
        <em style={{ color: '#1C211C', fontWeight: 500 }}>
          What we estimate, we label estimate.
        </em>{' '}
        Honesty about precision is part of the brand.
      </>
    ),
  },
  {
    what: 'Not a data broker.',
    why: (
      <>
        Your rounds, your shots, your patterns.{' '}
        <em style={{ color: '#1C211C', fontWeight: 500 }}>Yours. Exportable.</em>{' '}
        We don't sell them and don't share without your opt-in.
      </>
    ),
  },
]

export function Negation() {
  return (
    <section style={{ padding: '100px 0' }}>
      <div
        className="landing-negation"
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          padding: '0 28px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 60,
          alignItems: 'flex-start',
        }}
      >
        <div>
          <div className="kicker" style={{ color: '#8A8B7E' }}>
            Defined by absence
          </div>
          <h2
            className="font-serif text-caddie-ink"
            style={{
              fontSize: 'clamp(32px, 4vw, 42px)',
              fontWeight: 500,
              fontStyle: 'italic',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              margin: '18px 0 0',
            }}
          >
            What OGA <em>isn't</em>.
          </h2>
          <p
            className="font-serif text-caddie-ink-dim"
            style={{ fontSize: 17, lineHeight: 1.6, margin: '18px 0 0', maxWidth: 480 }}
          >
            A short list, because half of what makes something good is what it
            refuses to be.
          </p>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {NEGATIONS.map((item, i) => (
            <li
              key={item.what}
              style={{
                padding: '18px 0',
                borderBottom:
                  i === NEGATIONS.length - 1 ? 'none' : '1px solid #D9D2BF',
                display: 'flex',
                gap: 18,
                alignItems: 'flex-start',
              }}
            >
              <span
                className="font-mono"
                style={{
                  fontSize: 10,
                  letterSpacing: '0.16em',
                  color: '#A33A2A',
                  flexShrink: 0,
                  paddingTop: 4,
                  width: 24,
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <div
                  className="font-serif text-caddie-ink"
                  style={{
                    fontSize: 18,
                    fontWeight: 500,
                    fontStyle: 'italic',
                    lineHeight: 1.3,
                    marginBottom: 4,
                  }}
                >
                  {item.what}
                </div>
                <div
                  className="font-serif text-caddie-ink-dim"
                  style={{ fontSize: 14.5, lineHeight: 1.55 }}
                >
                  {item.why}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

export function Pricing() {
  const { user, loading } = useAuth()
  const isAuthed = !loading && !!user
  return (
    <section style={{ padding: '120px 0', textAlign: 'center' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px' }}>
        <div className="kicker" style={{ color: '#8A8B7E', marginBottom: 18 }}>
          The price
        </div>
        <h2
          className="font-serif text-caddie-ink"
          style={{
            fontSize: 'clamp(56px, 8vw, 92px)',
            fontWeight: 500,
            fontStyle: 'italic',
            lineHeight: 0.95,
            letterSpacing: '-0.03em',
            margin: 0,
          }}
        >
          <span style={{ color: '#1F3D2C' }}>$0.</span> Forever.
        </h2>
        <p
          className="font-serif text-caddie-ink"
          style={{ fontSize: 19, lineHeight: 1.55, margin: '28px auto 0', maxWidth: 600 }}
        >
          <em style={{ fontWeight: 500 }}>
            No subscription. No “premium” tier you'll discover at the wrong
            moment.
          </em>{' '}
          If OGA helps your game and you want to keep the lights on, the tip jar
          is open.
        </p>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 40,
            margin: '48px auto 0',
            flexWrap: 'wrap',
            paddingTop: 36,
            borderTop: '1px solid #D9D2BF',
            maxWidth: 740,
          }}
        >
          <Term value="MIT licensed" label="Source on GitHub" />
          <Term value="No ads" label="Ever" />
          <Term value="Your data" label="Exportable anytime" />
          <Term value="Self-hostable" label="Run your own" />
        </div>
        <div
          style={{
            marginTop: 48,
            display: 'flex',
            justifyContent: 'center',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <Link to={isAuthed ? '/dashboard' : '/signup'} style={btnAccentLg}>
            {isAuthed ? 'Go to app' : 'Start tracking'}{' '}
            <span className="font-serif" style={{ fontStyle: 'italic' }}>
              →
            </span>
          </Link>
          <a
            href="https://ko-fi.com/nartana"
            target="_blank"
            rel="noreferrer noopener"
            style={btnGhostLg}
          >
            Tip jar · Ko-fi
          </a>
        </div>
      </div>
    </section>
  )
}

function Term({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span
        className="font-serif text-caddie-ink"
        style={{ fontSize: 20, fontWeight: 500, fontStyle: 'italic' }}
      >
        {value}
      </span>
      <span
        className="font-mono uppercase"
        style={{ fontSize: 9, letterSpacing: '0.16em', color: '#8A8B7E' }}
      >
        {label}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Learn section
// ---------------------------------------------------------------------------

const LEARN_CARDS = [
  { section: 'On the course', title: 'Course management', slug: 'course-management' },
  {
    section: 'Improving your game',
    title: 'How to practice effectively',
    slug: 'how-to-practice',
  },
  { section: 'On the course', title: 'The mental game', slug: 'mental-game' },
]

export function LearnSection() {
  return (
    <section style={{ padding: '60px 0 100px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px' }}>
        <div style={{ marginBottom: 40 }}>
          <div className="kicker" style={{ color: '#A66A1F', marginBottom: 12 }}>
            Learn
          </div>
          <h2
            className="font-serif text-caddie-ink"
            style={{
              fontSize: 'clamp(32px, 4.4vw, 48px)',
              fontWeight: 500,
              fontStyle: 'italic',
              lineHeight: 1.1,
              letterSpacing: '-0.015em',
              margin: 0,
            }}
          >
            A coach's column, built in.
          </h2>
        </div>
        <div
          className="landing-learn"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}
        >
          {LEARN_CARDS.map((c) => (
            <Link
              key={c.slug}
              to={`/learn/${c.slug}`}
              style={{
                border: '1px solid #D9D2BF',
                borderRadius: 4,
                padding: 26,
                background: '#FBF8F1',
                textDecoration: 'none',
                color: 'inherit',
                display: 'block',
                transition: 'border-color 200ms ease, transform 200ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#9F9580'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#D9D2BF'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <div
                className="font-mono uppercase"
                style={{
                  fontSize: 10,
                  letterSpacing: '0.18em',
                  color: '#8A8B7E',
                  marginBottom: 12,
                }}
              >
                {c.section}
              </div>
              <div
                className="font-serif text-caddie-ink"
                style={{ fontSize: 22, fontWeight: 500, fontStyle: 'italic', lineHeight: 1.25 }}
              >
                {c.title}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Final CTA (inverted dark band)
// ---------------------------------------------------------------------------

export function FinalCTA() {
  const { user, loading } = useAuth()
  const isAuthed = !loading && !!user
  return (
    <section
      style={{
        background: '#1C211C',
        color: '#F2EEE5',
        textAlign: 'center',
        padding: '110px 0 100px',
        borderTop: '1px solid rgba(242, 238, 229, 0.12)',
      }}
    >
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px' }}>
        <div
          className="kicker"
          style={{ color: 'rgba(242, 238, 229, 0.55)', marginBottom: 18 }}
        >
          Open Golf App
        </div>
        <h2
          className="font-serif"
          style={{
            fontSize: 'clamp(40px, 5vw, 60px)',
            fontWeight: 500,
            fontStyle: 'italic',
            lineHeight: 1.05,
            letterSpacing: '-0.015em',
            margin: '0 0 18px',
            color: '#F2EEE5',
          }}
        >
          {isAuthed ? 'Welcome back.' : 'Start tracking.'}
        </h2>
        <p
          style={{
            color: 'rgba(242, 238, 229, 0.65)',
            fontSize: 16,
            margin: '0 0 36px',
          }}
        >
          {isAuthed
            ? 'Pick up where you left off.'
            : 'Free forever · open source · iPhone, Android & web'}
        </p>
        <Link
          to={isAuthed ? '/dashboard' : '/signup'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: '#F2EEE5',
            color: '#1C211C',
            border: '1px solid #F2EEE5',
            borderRadius: 2,
            padding: '14px 22px',
            fontFamily: 'Epilogue, sans-serif',
            fontWeight: 600,
            fontSize: 15,
            letterSpacing: '0.01em',
            textDecoration: 'none',
          }}
        >
          {isAuthed ? 'Go to app' : 'Create your account'}{' '}
          <span className="font-serif" style={{ fontStyle: 'italic' }}>
            →
          </span>
        </Link>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

export function Footer() {
  return (
    <footer
      style={{
        background: '#1C211C',
        color: '#F2EEE5',
        borderTop: '1px solid rgba(242, 238, 229, 0.12)',
        padding: '32px 0',
      }}
    >
      <div
        className="landing-footer"
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          padding: '0 28px',
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          gap: 24,
          alignItems: 'center',
        }}
      >
        <div
          className="font-serif"
          style={{ fontSize: 20, fontWeight: 500, fontStyle: 'italic' }}
        >
          oga<span style={{ fontStyle: 'normal' }}>.</span>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            alignItems: 'center',
          }}
        >
          <StoreBadges align="center" />
          <div
            style={{
              display: 'flex',
              gap: 24,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
          <FooterLink href={GITHUB_REPO} external>
            GitHub
          </FooterLink>
          <FooterLink href="https://ko-fi.com/nartana" external>
            Ko-fi
          </FooterLink>
          <FooterLink href="https://github.com/sponsors/cner-smith" external>
            Sponsors
          </FooterLink>
          <FooterLink to="/privacy">Privacy</FooterLink>
          <FooterLink to="/support">Support</FooterLink>
          <FooterLink to="/login">Sign in</FooterLink>
          </div>
        </div>
        <div
          style={{
            textAlign: 'right',
            fontSize: 12,
            color: 'rgba(242, 238, 229, 0.55)',
            letterSpacing: '0.02em',
          }}
        >
          Free and open source · MIT License
        </div>
      </div>
    </footer>
  )
}

function FooterLink({
  href,
  to,
  external,
  children,
}: {
  href?: string
  to?: string
  external?: boolean
  children: React.ReactNode
}) {
  const style: React.CSSProperties = {
    fontSize: 13,
    color: 'rgba(242, 238, 229, 0.6)',
    textDecoration: 'none',
    transition: 'color 160ms ease',
  }
  const onEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.currentTarget.style.color = '#F2EEE5'
  }
  const onLeave = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.currentTarget.style.color = 'rgba(242, 238, 229, 0.6)'
  }
  if (to) {
    return (
      <Link to={to} style={style} onMouseEnter={onEnter} onMouseLeave={onLeave}>
        {children}
      </Link>
    )
  }
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer noopener' : undefined}
      style={style}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {children}
    </a>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// IntersectionObserver hook. Sets `visible` true once the ref hits the
// threshold. Always-true if reduce-motion is on so animations don't
// hide behind the gate.

export const btnAccentLg: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  background: '#1F3D2C',
  color: '#F2EEE5',
  border: '1px solid #1F3D2C',
  borderRadius: 2,
  padding: '14px 22px',
  fontFamily: 'Epilogue, sans-serif',
  fontWeight: 600,
  fontSize: 15,
  letterSpacing: '0.01em',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
}

const btnGhostLg: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: 'transparent',
  color: '#1C211C',
  border: '1px solid #9F9580',
  borderRadius: 2,
  padding: '14px 18px',
  fontFamily: 'Epilogue, sans-serif',
  fontWeight: 600,
  fontSize: 14,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
}
