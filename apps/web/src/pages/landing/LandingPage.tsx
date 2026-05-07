import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { AppPreview } from '../../components/landing/AppPreview'
import '../../components/landing/landing.css'

// Marketing page served at `/`. Public, auth-aware (CTAs swap to
// "Go to app" when signed in). Real Mapbox preview via <AppPreview>.
export function LandingPage() {
  return (
    <main style={{ paddingBottom: 0 }}>
      <Hero />
      <StatsBar />
      <Features />
      <SGSection />
      <LearnSection />
      <FinalCTA />
      <Footer />
    </main>
  )
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function Hero() {
  const { user, loading } = useAuth()
  const isAuthed = !loading && !!user

  return (
    <section
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        padding: '140px 0 80px',
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          padding: '0 28px',
          width: '100%',
          display: 'grid',
          gap: 48,
          alignItems: 'center',
          gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 0.95fr)',
        }}
        className="landing-hero-grid"
      >
        <div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid #9F9580',
              borderRadius: 999,
              padding: '6px 12px',
              fontSize: 12,
              letterSpacing: '0.02em',
              color: '#1C211C',
              background: '#FBF8F1',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#1F3D2C',
                boxShadow: '0 0 0 3px rgba(31, 61, 44, 0.18)',
              }}
            />
            Free and open source
          </span>
          <div
            className="kicker"
            style={{ color: '#A66A1F', margin: '22px 0 14px' }}
          >
            Golf improvement platform
          </div>
          <h1
            className="font-serif text-caddie-ink"
            style={{
              fontSize: 'clamp(44px, 7vw, 76px)',
              fontWeight: 500,
              fontStyle: 'italic',
              lineHeight: 1.02,
              letterSpacing: '-0.02em',
              margin: '0 0 22px',
            }}
          >
            Track every shot.
            <br />
            Understand your game.
          </h1>
          <p
            className="text-caddie-ink-dim"
            style={{
              fontSize: 17,
              lineHeight: 1.6,
              maxWidth: 480,
              margin: '0 0 28px',
            }}
          >
            GPS shot tracking, strokes gained analysis, and coaching content —
            built for golfers who want to get better, not just keep score.
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              flexWrap: 'wrap',
            }}
          >
            {isAuthed ? (
              <Link to="/dashboard" style={btnAccentLg}>
                Go to app{' '}
                <span className="font-serif" style={{ fontStyle: 'italic' }}>
                  →
                </span>
              </Link>
            ) : (
              <Link to="/signup" style={btnAccentLg}>
                Start tracking free{' '}
                <span className="font-serif" style={{ fontStyle: 'italic' }}>
                  →
                </span>
              </Link>
            )}
            <span
              className="text-caddie-ink-mute"
              style={{ fontSize: 13 }}
            >
              {isAuthed ? "You're signed in." : 'No subscription required.'}
            </span>
          </div>
        </div>
        <div className="landing-hero-preview" aria-hidden>
          <AppPreview />
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Stats bar
// ---------------------------------------------------------------------------

function StatsBar() {
  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px' }}>
      <div
        className="landing-stats"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          borderTop: '1px solid #D9D2BF',
          borderBottom: '1px solid #D9D2BF',
        }}
      >
        <Stat value="15,870" label="Courses in database" mono />
        <Stat value="4" label="SG categories tracked" />
        <Stat value="100%" label="Free, forever" mono />
      </div>
    </div>
  )
}

function Stat({
  value,
  label,
  mono,
}: {
  value: string
  label: string
  mono?: boolean
}) {
  return (
    <div
      className="landing-stat"
      style={{
        padding: '36px 24px',
        textAlign: 'center',
        borderRight: '1px solid #D9D2BF',
      }}
    >
      <div
        className={mono ? 'font-mono' : 'font-serif'}
        style={{
          fontSize: mono ? 36 : 44,
          fontWeight: 500,
          letterSpacing: '-0.01em',
          lineHeight: 1,
          color: '#1C211C',
        }}
      >
        {value}
      </div>
      <div
        className="font-mono uppercase"
        style={{
          fontSize: 10,
          letterSpacing: '0.18em',
          color: '#8A8B7E',
          marginTop: 14,
        }}
      >
        {label}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------

const FEATURES = [
  {
    icon: TargetIcon,
    title: 'Live GPS round tracking',
    body: 'Track every shot on the map with GPS precision. Ball placement, aim points, and shot trails — live as you play.',
  },
  {
    icon: BarsIcon,
    title: 'Strokes gained analysis',
    body: "Understand exactly where you're losing or gaining strokes — off the tee, approach, around the green, and putting.",
  },
  {
    icon: TrendIcon,
    title: 'Shot patterns + trends',
    body: "See your miss patterns, club dispersion, and improvement trends across every round you've played.",
  },
] as const

function Features() {
  return (
    <section style={{ padding: '100px 0' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px' }}>
        <div
          className="landing-features"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 20,
          }}
        >
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} index={i} {...f} />
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureCard({
  icon: Icon,
  title,
  body,
  index,
}: {
  icon: () => JSX.Element
  title: string
  body: string
  index: number
}) {
  const { ref, visible } = useInView<HTMLElement>(0.15)
  return (
    <article
      ref={ref}
      style={{
        border: '1px solid #D9D2BF',
        borderRadius: 4,
        padding: 28,
        background: '#FBF8F1',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 600ms ease ${index * 100}ms, transform 600ms ease ${index * 100}ms, border-color 200ms ease`,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 4,
          background: '#1F3D2C',
          color: '#F2EEE5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 22,
        }}
        aria-hidden
      >
        <Icon />
      </div>
      <h3
        className="font-serif text-caddie-ink"
        style={{
          fontSize: 22,
          fontWeight: 500,
          fontStyle: 'italic',
          margin: '0 0 10px',
          lineHeight: 1.2,
        }}
      >
        {title}
      </h3>
      <p
        className="text-caddie-ink-dim"
        style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6 }}
      >
        {body}
      </p>
    </article>
  )
}

// ---------------------------------------------------------------------------
// SG section
// ---------------------------------------------------------------------------

const SG_ROWS = [
  { label: 'SG · Off tee', value: '+0.4', tone: 'pos' as const, fill: 22 },
  { label: 'SG · Approach', value: '−1.2', tone: 'neg' as const, fill: 44 },
  {
    label: 'SG · Around green',
    value: '−0.1',
    tone: 'zero' as const,
    fill: 6,
  },
  { label: 'SG · Putting', value: '+1.2', tone: 'pos' as const, fill: 48 },
]

function SGSection() {
  const { ref, visible } = useInView<HTMLDivElement>(0.3)
  return (
    <section style={{ padding: '100px 0' }}>
      <div
        className="landing-sg"
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          padding: '0 28px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 64,
          alignItems: 'center',
        }}
      >
        <div>
          <div className="kicker" style={{ color: '#A66A1F', marginBottom: 12 }}>
            Strokes gained
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
              maxWidth: 520,
            }}
          >
            Know exactly where strokes are leaking.
          </h2>
          <p
            className="text-caddie-ink-dim"
            style={{
              fontSize: 16,
              lineHeight: 1.65,
              margin: '18px 0 0',
              maxWidth: 520,
            }}
          >
            Most golfers practice their strengths. OGA shows you your
            weaknesses — the specific categories where you're losing shots
            to your handicap baseline, so you can practice what actually
            matters.
          </p>
        </div>
        <div
          ref={ref}
          style={{
            border: '1px solid #D9D2BF',
            borderRadius: 4,
            padding: 28,
            background: '#FBF8F1',
          }}
        >
          {SG_ROWS.map((r, i) => (
            <SGRow key={r.label} {...r} visible={visible} delayMs={i * 120} />
          ))}
        </div>
      </div>
    </section>
  )
}

function SGRow({
  label,
  value,
  tone,
  fill,
  visible,
  delayMs,
}: {
  label: string
  value: string
  tone: 'pos' | 'neg' | 'zero'
  fill: number
  visible: boolean
  delayMs: number
}) {
  const valueColor =
    tone === 'pos' ? '#1F3D2C' : tone === 'neg' ? '#A33A2A' : '#8A8B7E'
  const fillColor = valueColor
  return (
    <div
      style={{
        padding: '14px 0',
        borderBottom: '1px solid #D9D2BF',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 8,
        }}
      >
        <span
          className="font-mono uppercase"
          style={{
            fontSize: 10,
            letterSpacing: '0.18em',
            color: '#8A8B7E',
          }}
        >
          {label}
        </span>
        <span
          className="font-serif"
          style={{
            fontSize: 16,
            fontWeight: 500,
            fontStyle: 'italic',
            color: valueColor,
          }}
        >
          {value}
        </span>
      </div>
      <div
        style={{
          position: 'relative',
          height: 6,
          background: '#EBE5D6',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: tone === 'neg' ? undefined : '50%',
            right: tone === 'neg' ? '50%' : undefined,
            width: visible ? `${fill}%` : 0,
            background: fillColor,
            transition: `width 900ms cubic-bezier(0.2, 0.7, 0.2, 1) ${delayMs}ms`,
          }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Learn section
// ---------------------------------------------------------------------------

const LEARN_CARDS = [
  {
    section: 'On the course',
    title: 'Course management',
    slug: 'course-management',
  },
  {
    section: 'Improving your game',
    title: 'How to practice effectively',
    slug: 'how-to-practice',
  },
  {
    section: 'On the course',
    title: 'The mental game',
    slug: 'mental-game',
  },
]

function LearnSection() {
  return (
    <section style={{ padding: '100px 0' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px' }}>
        <div style={{ marginBottom: 56 }}>
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
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 18,
          }}
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
                transition:
                  'border-color 200ms ease, transform 200ms ease',
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
                style={{
                  fontSize: 22,
                  fontWeight: 500,
                  fontStyle: 'italic',
                  lineHeight: 1.25,
                }}
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

function FinalCTA() {
  const { user, loading } = useAuth()
  const isAuthed = !loading && !!user
  return (
    <section
      style={{
        background: '#1C211C',
        color: '#F2EEE5',
        textAlign: 'center',
        padding: '110px 0 100px',
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
          {isAuthed ? 'Welcome back.' : 'Start tracking free.'}
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
            : 'No subscription. No ads. Open source.'}
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
            fontFamily: 'Inter, sans-serif',
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

function Footer() {
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
          OGA
        </div>
        <div
          style={{
            display: 'flex',
            gap: 24,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <FooterLink href="https://github.com/cner-smith/opengolfapp" external>
            GitHub
          </FooterLink>
          <FooterLink href="https://ko-fi.com/nartana" external>
            Ko-fi
          </FooterLink>
          <FooterLink to="/privacy">Privacy</FooterLink>
          <FooterLink to="/login">Sign in</FooterLink>
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
function useInView<T extends Element>(threshold = 0.1) {
  const ref = useRef<T | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setVisible(true)
      return
    }
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            obs.disconnect()
            break
          }
        }
      },
      { threshold },
    )
    obs.observe(node)
    return () => obs.disconnect()
  }, [threshold])

  return { ref, visible }
}

const btnAccentLg: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  background: '#1F3D2C',
  color: '#F2EEE5',
  border: '1px solid #1F3D2C',
  borderRadius: 2,
  padding: '14px 22px',
  fontFamily: 'Inter, sans-serif',
  fontWeight: 600,
  fontSize: 15,
  letterSpacing: '0.01em',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function TargetIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

function BarsIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="6" y1="20" x2="6" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="18" y1="20" x2="18" y2="14" />
    </svg>
  )
}

function TrendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 17l4-4 4 4 4-6 6 6" />
    </svg>
  )
}
