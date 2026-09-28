import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { PhoneShot } from '../../components/landing/PhoneShot'
import { StoreBadges } from '../../components/landing/StoreBadges'
import '../../components/landing/landing.css'
import {
  Community,
  FinalCTA,
  Footer,
  LearnSection,
  Negation,
  Pricing,
  btnAccentLg,
} from './LandingSections'

// Marketing page served at `/`. Public, auth-aware (CTAs swap to
// "Go to app" when signed in). Real app screenshots via <PhoneShot>.
export function LandingPage() {
  return (
    <main style={{ paddingBottom: 0 }}>
      <Hero />
      <StatsBar />
      <Manifesto />
      <SGSpread />
      <PatternsSpread />
      <ReplaySpread />
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
          <StoreBadges align="left" className="landing-store-badges" />
        </div>
        <div className="landing-hero-preview">
          <PhoneShot
            priority
            src="/landing/hero.webp"
            alt="Live round on the 8th at Whistling Straits: driver aimed at the fairway, with the player's real driver pattern drawn around the aim"
            tag={{ text: <>your driver:<br />97 real shots</>, left: 194, top: 262, width: 104 }}
            arrow={[196, 300, 130, 309]}
          />
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

function SGSpread() {
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
        <PhoneShot
          src="/landing/stats.webp"
          alt="Strokes gained over the last 10 rounds: off the tee +0.27, approach −1.13, around the green +0.02, putting −0.18"
          tag={{ text: <>approach<br />is the leak</>, left: 170, top: 346, width: 112 }}
          arrow={[276, 350, 274, 246]}
        />
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
        <PhoneShot
          src="/landing/patterns.webp"
          alt="Driver shot pattern from 97 real shots: 68% and 95% rings around the aim, a solid core with pushes to the right"
          tag={{ text: <>97 drives,<br />one picture</>, left: 166, top: 92, width: 118 }}
          arrow={[190, 138, 150, 214]}
        />
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

// ---------------------------------------------------------------------------
// Round replay spread
// ---------------------------------------------------------------------------

function ReplaySpread() {
  return (
    <SpreadShell
      kicker="Round replay"
      title={
        <>
          Every shot, <em>where</em> it landed.
        </>
      }
      figure={
        <PhoneShot
          src="/landing/map.webp"
          alt="The 13th at Harbour Town replayed shot by shot: drive, wedge, and a 17-foot putt holed"
          tag={{ text: <>drive, wedge,<br />17-footer in</>, left: 18, top: 368, width: 128 }}
          arrow={[122, 372, 168, 300]}
        />
      }
    >
      <SpreadParagraph>
        Every round you track keeps its shots. Open any hole and replay it —
        the drive, the approach, the putt — with the club and the distance for
        each.
      </SpreadParagraph>
      <SpreadParagraph>
        Your scorecard fills itself in as you go: birdies circled, bogeys boxed,
        like the one in your back pocket.
      </SpreadParagraph>
    </SpreadShell>
  )
}
