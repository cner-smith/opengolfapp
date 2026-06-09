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
      <Manifesto />
      <SGSpread />
      <PatternsSpread />
      <Community />
      <Negation />
      <Pricing />
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
            Free and open source · MIT
          </span>
          <div
            className="kicker"
            style={{ color: '#A66A1F', margin: '22px 0 14px' }}
          >
            Strokes gained for everyone
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
              margin: '0 0 24px',
            }}
          >
            GPS shot tracking, strokes gained, and shot patterns — no sensors
            on your bag, no subscription, free forever.
          </p>
          <div className="landing-platforms">
            <PlatformTag>iPhone</PlatformTag>
            <PlatformTag>Android</PlatformTag>
            <PlatformTag>Web</PlatformTag>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              flexWrap: 'wrap',
              marginTop: 26,
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
            <span className="text-caddie-ink-mute" style={{ fontSize: 13 }}>
              {isAuthed ? "You're signed in." : 'No subscription · no ads.'}
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

function PlatformTag({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="font-mono uppercase"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        letterSpacing: '0.12em',
        color: '#5C6356',
      }}
    >
      <span
        aria-hidden
        style={{ width: 6, height: 6, borderRadius: '50%', background: '#1F3D2C' }}
      />
      {children}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Stats bar (4 cells)
// ---------------------------------------------------------------------------

function StatsBar() {
  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px' }}>
      <div
        className="landing-stats landing-numbers"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          borderTop: '1px solid #1C211C',
          borderBottom: '1px solid #1C211C',
        }}
      >
        <Stat value="15,000+" label="Courses in database" />
        <Stat value="WHS" label="Handicap tracking" mono />
        <Stat value="$0" label="Free, forever" />
        <Stat value="MIT" label="Open source" mono />
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
          fontSize: mono ? 34 : 44,
          fontWeight: 500,
          fontStyle: mono ? 'normal' : 'italic',
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
// Manifesto
// ---------------------------------------------------------------------------

function Manifesto() {
  return (
    <section
      style={{
        padding: '110px 0',
        borderTop: '1px solid #D9D2BF',
        borderBottom: '1px solid #D9D2BF',
        marginTop: 100,
      }}
    >
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '0 28px' }}>
        <div className="kicker" style={{ color: '#8A8B7E' }}>
          The point of this thing
        </div>
        <h2
          className="font-serif text-caddie-ink"
          style={{
            fontSize: 'clamp(32px, 4.8vw, 48px)',
            fontWeight: 500,
            fontStyle: 'italic',
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            margin: '20px 0 0',
          }}
        >
          Strokes gained is the best metric in golf. It shouldn't be{' '}
          <span style={{ color: '#1F3D2C' }}>locked behind a subscription.</span>
        </h2>
        <p
          className="font-serif text-caddie-ink"
          style={{ fontSize: 18, lineHeight: 1.65, margin: '24px 0 0', maxWidth: 740 }}
        >
          The math behind professional shot tracking — strokes gained against
          handicap baselines, per-club dispersion, where you're winning and
          losing strokes — is decades old and well understood. Plenty of
          products charge real money to put it in your pocket.
        </p>
        <p
          className="font-serif text-caddie-ink"
          style={{ fontSize: 18, lineHeight: 1.65, margin: '24px 0 0', maxWidth: 740 }}
        >
          OGA is that math,{' '}
          <em style={{ fontWeight: 500 }}>
            written in plain English, given away for free
          </em>
          , and open source so anyone can read the code, fix what's broken, or
          build something better on top of it.
        </p>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Spreads
// ---------------------------------------------------------------------------

function SpreadShell({
  kicker,
  title,
  children,
  figure,
  reverse,
  to,
  linkLabel,
}: {
  kicker: string
  title: React.ReactNode
  children: React.ReactNode
  figure: React.ReactNode
  reverse?: boolean
  to?: string
  linkLabel?: string
}) {
  return (
    <section style={{ padding: '60px 0' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px' }}>
        <div className={reverse ? 'landing-spread reverse' : 'landing-spread'}>
          <div className="spread-copy">
            <div className="kicker" style={{ color: '#A66A1F', marginBottom: 16 }}>
              {kicker}
            </div>
            <h3
              className="font-serif text-caddie-ink"
              style={{
                fontSize: 'clamp(30px, 3.6vw, 40px)',
                fontWeight: 500,
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                margin: '0 0 18px',
              }}
            >
              {title}
            </h3>
            {children}
            {to && linkLabel && (
              <Link
                to={to}
                className="font-sans"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#1F3D2C',
                  textDecoration: 'none',
                  borderBottom: '1px solid #1F3D2C',
                  paddingBottom: 2,
                  marginTop: 10,
                }}
              >
                {linkLabel} <span>→</span>
              </Link>
            )}
          </div>
          <div className="spread-figure">{figure}</div>
        </div>
      </div>
    </section>
  )
}

function SpreadParagraph({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="font-serif text-caddie-ink"
      style={{ fontSize: 17, lineHeight: 1.6, margin: '0 0 14px', maxWidth: 520 }}
    >
      {children}
    </p>
  )
}

// ---------------------------------------------------------------------------
// SG spread (live demo bars)
// ---------------------------------------------------------------------------

const SG_ROWS = [
  { label: 'SG · Off tee', value: '+0.4', tone: 'pos' as const, fill: 22 },
  { label: 'SG · Approach', value: '−1.2', tone: 'neg' as const, fill: 44 },
  { label: 'SG · Around green', value: '−0.1', tone: 'zero' as const, fill: 6 },
  { label: 'SG · Putting', value: '+1.2', tone: 'pos' as const, fill: 48 },
]

function SGSpread() {
  const { ref, visible } = useInView<HTMLDivElement>(0.3)
  return (
    <SpreadShell
      kicker="Strokes gained"
      title={
        <>
          Find <em>exactly</em> where the strokes go.
        </>
      }
      to="/learn/strokes-gained"
      linkLabel="How strokes gained works"
      figure={
        <div
          ref={ref}
          style={{
            border: '1px solid #D9D2BF',
            borderRadius: 4,
            padding: 28,
            background: '#FBF8F1',
          }}
        >
          <div className="kicker" style={{ color: '#8A8B7E', marginBottom: 18 }}>
            Sample · last 10 rounds
          </div>
          {SG_ROWS.map((r, i) => (
            <SGRow key={r.label} {...r} visible={visible} delayMs={i * 120} />
          ))}
          <p
            className="font-serif text-caddie-ink-dim"
            style={{
              fontSize: 13,
              fontStyle: 'italic',
              lineHeight: 1.55,
              margin: '16px 0 0',
              paddingTop: 12,
              borderTop: '1px dotted #D9D2BF',
            }}
          >
            <span style={{ color: '#1F3D2C', fontWeight: 500 }}>
              Approach is your leak.
            </span>{' '}
            Fixing 150–200 yd alone could add 1.2 strokes a round.
          </p>
        </div>
      }
    >
      <SpreadParagraph>
        Every shot you log gets graded against a baseline — what a player of
        your handicap usually does from that distance, that lie. The difference
        is your leak, by category.
      </SpreadParagraph>
      <SpreadParagraph>
        Most golfers spend range time hitting the club they already love. OGA
        tells you the club you should be on instead.
      </SpreadParagraph>
    </SpreadShell>
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
  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid #D9D2BF' }}>
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
          style={{ fontSize: 10, letterSpacing: '0.18em', color: '#8A8B7E' }}
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
            background: valueColor,
            transition: `width 900ms cubic-bezier(0.2, 0.7, 0.2, 1) ${delayMs}ms`,
          }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shot patterns spread (live demo dispersion)
// ---------------------------------------------------------------------------

function PatternsSpread() {
  return (
    <SpreadShell
      kicker="Shot patterns"
      reverse
      title={
        <>
          See <em>where</em> your ball actually goes.
        </>
      }
      to="/learn"
      linkLabel="How dispersion works"
      figure={
        <div
          style={{
            border: '1px solid #D9D2BF',
            borderRadius: 4,
            padding: 22,
            background: '#FBF8F1',
          }}
        >
          <DemoDispersion />
          <p
            className="font-serif text-caddie-ink-dim"
            style={{
              fontSize: 14,
              fontStyle: 'italic',
              textAlign: 'center',
              margin: '14px 0 0',
              paddingTop: 14,
              borderTop: '1px dotted #D9D2BF',
            }}
          >
            <span style={{ color: '#1F3D2C', fontWeight: 500 }}>
              Aim 4 yards left of target
            </span>{' '}
            to center the pattern.
          </p>
        </div>
      }
    >
      <SpreadParagraph>
        Per-club dispersion centered on your aim point. The chart shows your
        typical miss — left, right, short, long — and the small aim adjustment
        that <em style={{ fontWeight: 500 }}>centers the whole pattern</em>.
      </SpreadParagraph>
      <SpreadParagraph>
        The web app surfaces the analytics; the mobile app captures the data.
        Same account, same numbers.
      </SpreadParagraph>
    </SpreadShell>
  )
}

// Demo dispersion — a hardcoded but realistic 7-iron pattern (slight push,
// tends short), drawn the way the live Shot Patterns chart does: 68/95%
// cones around the mean, target centerline, aim-relative frame. Static so it
// renders on the public page without auth or live data.
const DEMO_DOTS = [
  [212, 118], [224, 110], [206, 132], [232, 124], [218, 100],
  [228, 138], [240, 116], [214, 146], [236, 102], [222, 128],
  [248, 130], [208, 112], [230, 150], [220, 122],
]
function DemoDispersion() {
  return (
    <div
      style={{
        aspectRatio: '1.2 / 1',
        background: '#F2EEE5',
        border: '1px solid #D9D2BF',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <svg
        viewBox="0 0 400 320"
        width="100%"
        height="100%"
        role="img"
        aria-label="7-iron dispersion: the shot pattern sits a few yards right of target, so aiming slightly left centers it."
      >
        <defs>
          <pattern id="lp-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#D9D2BF" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="400" height="320" fill="url(#lp-grid)" />
        <line
          x1="200"
          y1="34"
          x2="200"
          y2="286"
          stroke="#9F9580"
          strokeWidth="0.6"
          strokeDasharray="4 5"
        />
        <text
          x="200"
          y="26"
          fontFamily="Inconsolata, monospace"
          fontSize="9"
          letterSpacing="1.4"
          fill="#8A8B7E"
          textAnchor="middle"
        >
          TARGET
        </text>
        <ellipse
          cx="228"
          cy="124"
          rx="50"
          ry="42"
          fill="none"
          stroke="#1F3D2C"
          strokeWidth="1"
          strokeDasharray="4 4"
          opacity="0.55"
        />
        <ellipse
          cx="228"
          cy="124"
          rx="29"
          ry="24"
          fill="rgba(31,61,44,0.08)"
          stroke="#1F3D2C"
          strokeWidth="1"
        />
        {DEMO_DOTS.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.6" fill="#A66A1F" opacity="0.85" />
        ))}
        <circle cx="228" cy="124" r="5.5" fill="#FBF8F1" stroke="#1F3D2C" strokeWidth="2.5" />
        <text
          x="284"
          y="124"
          fontFamily="Inconsolata, monospace"
          fontSize="9"
          letterSpacing="1.2"
          fill="#5C6356"
          textAnchor="start"
          dominantBaseline="middle"
        >
          MEAN
        </text>
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Community / open source
// ---------------------------------------------------------------------------

const GITHUB_REPO = 'https://github.com/cner-smith/opengolfapp'

function Community() {
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

function Negation() {
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

function Pricing() {
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

function LearnSection() {
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
          oga<span style={{ fontStyle: 'normal' }}>.</span>
        </div>
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
