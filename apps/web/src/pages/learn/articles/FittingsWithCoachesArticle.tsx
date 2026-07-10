import { SrcBody, SrcLabel } from '../components/ArticlePrimitives'
import type { CSSProperties, ReactNode } from 'react'

export function FittingsWithCoachesArticle() {
  return (
    <article
      id="fittings-with-coaches"
      style={{
        borderTop: '1px solid #D9D2BF',
        paddingTop: 22,
        marginBottom: 32,
      }}
    >
      <div className="kicker" style={{ marginBottom: 14 }}>
        Working with coaches · Fittings with coaches
      </div>
      <h2
        className="font-serif text-caddie-ink"
        style={{
          fontSize: 28,
          fontWeight: 500,
          fontStyle: 'italic',
          letterSpacing: '-0.015em',
          lineHeight: 1.15,
          marginBottom: 18,
        }}
      >
        A lesson changes the swing; a fitting fits it.
      </h2>

      <P>
        The equipment guide on <em>golf fittings</em> covers what each fitting
        measures and changes — driver, irons, wedges, putter, shaft, and ball —
        and when each one is worth the money. This is the companion question from
        the coaching side: who should fit you, how a fitting fits into working
        with a coach, and how to time it so you're not fitting expensive
        equipment to a swing you're about to change. The two appointments are
        easy to confuse, and treating them as one is how golfers waste both.
      </P>

      <FitterTable />

      <Hr />

      <H3>Two different appointments</H3>
      <P>
        A lesson tries to change your swing. A fitting fits clubs to the swing
        you actually have today — not the one you're hoping to build. That's the
        line that confuses people: they want to "fix the slice first, then get
        fit," and end up playing ill-fitting clubs for a year while they chase a
        swing change.
      </P>
      <P>
        The better order is usually the opposite. Properly fit equipment fits the
        swing you bring tomorrow, and when you stop compensating for the wrong
        gear, a coach's changes often come <em>faster</em>. Unless you are a brand
        new golfer with nothing stable to measure, "fix it first" is mostly
        backward — get fit to your current swing, then let lessons move it, and
        re-check the specs when the swing has genuinely changed.
      </P>

      <Hr />

      <H3>Who's actually fitting you</H3>
      <P>
        Not all fittings come from the same chair, and the chair matters. Three
        people might fit you, and their incentives are not identical:
      </P>
      <ul style={UL_STYLE}>
        <li>
          <strong>Your coach or instructor.</strong> Already knows your typical
          miss, your goals, and the change you're in the middle of. A fitting
          run by — or coordinated with — your coach starts with all of that
          context instead of a blank sheet. The catch: not every teaching pro is
          a trained fitter, so ask what tools and data they actually use.
        </li>
        <li>
          <strong>An independent fitter.</strong> Carries multiple brands and
          gets paid for the fitting, not the badge on the head, so the
          recommendation is brand-neutral. The catch: they meet you cold and only
          see the swing you bring that hour — tell them what you're working on so
          they don't fit you to a temporary flaw.
        </li>
        <li>
          <strong>A brand (OEM) fitter.</strong> Deep on one manufacturer's
          lineup and often free, which is great if you already want that brand.
          The catch: the answer will be that brand, so treat it as fitting{' '}
          <em>within</em> a line you've chosen, not an open comparison.
        </li>
      </ul>
      <P>
        The strongest setup is a team that talks. The Titleist Performance
        Institute model makes this explicit — coach, fitness, and fitting aligned
        on the same goals — and most club fitters, left alone, have no idea what
        your instructor is trying to build. You are the one who has to connect
        them.
      </P>

      <Hr />

      <H3>Time it around your swing, not against it</H3>
      <P>
        The "fit the swing you have" rule has a wrinkle worth getting right.
        Real swing changes are usually incremental and ongoing, not a single
        overhaul on a Tuesday — so there is rarely a perfect "finished" moment to
        fit. Waiting for one mostly means playing bad gear forever.
      </P>
      <P>
        The actual danger is narrow: getting fit cold, in the middle of a major
        rebuild, to a swing you're about to abandon. Avoid it with coordination,
        not delay. Tell your coach before you book a fitting, and tell the fitter
        what you're working on — a degree of lie or a shaft profile can either
        support a change your coach is making or quietly fight it, and only the
        two of them together can tell which.
      </P>

      <Hr />

      <H3>The body comes first</H3>
      <P>
        Before the launch monitor, the right spec depends on what your body can
        actually do. The textbook lie angle, shaft, and length assume a range of
        motion you may or may not have; a mobility limit in the hips or shoulders
        can make the "standard" recommendation wrong for you. This is the
        body-swing connection the Titleist Performance Institute built its
        certification around — a physical screen that correlates how you move
        with how you should be fit and coached. A good coach-led fitting starts
        there, not at the driver.
      </P>

      <Callout>
        <strong>The one move:</strong> loop your coach in before you book the
        fitting, and tell the fitter the exact change you're working on. A
        fitting done in a vacuum optimizes launch and spin for one hour's swing;
        a fitting that knows your coach's plan optimizes for the player you're
        becoming.
      </Callout>

      <H3>Red flags</H3>
      <P>
        A coach-coordinated fitting should make your equipment quieter, not your
        wallet lighter. Walk if you see these:
      </P>
      <ul style={UL_STYLE}>
        <li>
          <strong>A "fitting" that only ever lands on one brand</strong> — or one
          that never asks what you currently play or what you're working on.
        </li>
        <li>
          <strong>Gear pushed in the middle of a lesson.</strong> A purchase is a
          separate appointment; your most expensive coaching minutes shouldn't go
          to a sales pitch.
        </li>
        <li>
          <strong>"Buy these and your slice is gone."</strong> Equipment can
          remove a fight against your gear; it can't install a swing change. If
          someone promises clubs will fix mechanics, they're selling, not
          fitting.
        </li>
      </ul>

      <P>
        Get the order and the team right — body first, fit the swing you have,
        coach and fitter on the same page — and a fitting stops being a gamble on
        gear and becomes part of the same plan as your lessons.
      </P>

      <Sources />

      <Footer />
    </article>
  )
}

const UL_STYLE: CSSProperties = {
  listStyle: 'disc',
  paddingLeft: 22,
  maxWidth: 640,
  marginBottom: 14,
  fontSize: 15,
  lineHeight: 1.6,
  color: '#1C211C',
}

function H3({ children }: { children: ReactNode }) {
  return (
    <h3
      className="font-serif text-caddie-ink"
      style={{
        fontSize: 22,
        fontWeight: 500,
        fontStyle: 'italic',
        lineHeight: 1.2,
        marginBottom: 12,
      }}
    >
      {children}
    </h3>
  )
}

function P({ children }: { children: ReactNode }) {
  return (
    <p
      className="text-caddie-ink"
      style={{ fontSize: 15, lineHeight: 1.6, maxWidth: 640, marginBottom: 14 }}
    >
      {children}
    </p>
  )
}

function Hr() {
  return <div style={{ borderTop: '1px solid #D9D2BF', margin: '0 0 18px' }} />
}

// The three people who might fit you, set against the two things that actually
// distinguish them — context and brand-neutrality — plus when each is the right
// chair. Leads the article because the choice of fitter frames everything after.
function FitterTable() {
  const rows: { who: string; knows: string; neutral: string; best: string }[] = [
    {
      who: 'Your coach',
      knows: 'Knows your swing & plan',
      neutral: 'Depends on their tools',
      best: "When you're mid-change",
    },
    {
      who: 'Independent',
      knows: 'Meets you cold',
      neutral: 'Brand-neutral',
      best: 'For an open comparison',
    },
    {
      who: 'Brand (OEM)',
      knows: 'Meets you cold',
      neutral: 'One brand only',
      best: "Once you've picked a brand",
    },
  ]
  return (
    <div
      style={{
        background: '#EBE5D6',
        border: '1px solid #D9D2BF',
        borderRadius: 2,
        padding: '14px 18px',
        maxWidth: 640,
        marginBottom: 18,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '96px 1fr',
          gap: '0 14px',
        }}
      >
        {rows.map((r, i) => (
          <Row key={r.who} first={i === 0} {...r} />
        ))}
      </div>
    </div>
  )
}

function Row({
  who,
  knows,
  neutral,
  best,
  first,
}: {
  who: string
  knows: string
  neutral: string
  best: string
  first: boolean
}) {
  const wrap: CSSProperties = {
    paddingTop: first ? 0 : 10,
    marginTop: first ? 0 : 10,
    borderTop: first ? 'none' : '1px solid #D9D2BF',
  }
  return (
    <>
      <div
        className="font-serif text-caddie-ink"
        style={{ ...wrap, fontSize: 15, fontStyle: 'italic' }}
      >
        {who}
      </div>
      <div style={wrap}>
        <div className="text-caddie-ink" style={{ fontSize: 14, lineHeight: 1.45 }}>
          {knows} · {neutral}
        </div>
        <div
          className="text-caddie-ink-dim"
          style={{ fontSize: 13, lineHeight: 1.45, marginTop: 2 }}
        >
          Best: {best}
        </div>
      </div>
    </>
  )
}

// A how-to-apply takeaway lifted out of the prose so the single move is
// scannable on its own.
function Callout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: '#EBE5D6',
        borderLeft: '3px solid #1F3D2C',
        padding: '14px 16px',
        marginBottom: 18,
        maxWidth: 680,
      }}
    >
      <div className="text-caddie-ink" style={{ fontSize: 14, lineHeight: 1.55 }}>
        {children}
      </div>
    </div>
  )
}

function Sources() {
  return (
    <section style={{ borderTop: '1px solid #D9D2BF', paddingTop: 18, marginTop: 22 }}>
      <div className="kicker" style={{ marginBottom: 12 }}>
        Sources
      </div>
      <div style={{ display: 'grid', gap: 14, maxWidth: 640 }}>
        <div>
          <SrcLabel>Fit the swing you have, don't wait to "fix" it</SrcLabel>
          <SrcBody>
            <Src href="https://golf.com/gear/fix-your-swing-club-fitting/">
              GOLF.com · why fixing your swing before a fitting is backward
            </Src>{' '}
            and{' '}
            <Src href="https://scramble.golftec.com/blog/2015/06/fit-vs-fix-should-i-get-fit-for-clubs-or-fix-my-swing/">
              GolfTEC · fit vs fix
            </Src>{' '}
            — fit to your current swing; properly fit gear tends to speed a
            change up, not wait on it.
          </SrcBody>
        </div>
        <div>
          <SrcLabel>Coach and fitter should be aligned</SrcLabel>
          <SrcBody>
            <Src href="https://www.titleist.com/learning-lab/performance/tpi-team-approach">
              Titleist Performance Institute · the team approach
            </Src>{' '}
            — most fitters, left alone, don't know your coach's plan; the player
            has to connect them.
          </SrcBody>
        </div>
        <div>
          <SrcLabel>Your body shapes the right spec</SrcLabel>
          <SrcBody>
            <Src href="https://www.titleist.com/fitting/golf-club-fitting/titleist-performance-institute">
              Titleist Performance Institute · the body-swing connection
            </Src>{' '}
            — a physical screen correlates how you move with how you should be fit
            and coached, so the fitting starts with the body, not the driver.
          </SrcBody>
        </div>
      </div>
    </section>
  )
}

function Src({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: '#1F3D2C', textDecoration: 'underline' }}
    >
      {children}
    </a>
  )
}

function Footer() {
  return (
    <div
      className="font-mono uppercase text-caddie-ink-mute"
      style={{
        fontSize: 10,
        letterSpacing: '0.14em',
        borderTop: '1px solid #D9D2BF',
        paddingTop: 18,
        marginTop: 22,
        lineHeight: 1.6,
      }}
    >
      Last reviewed July 2026
    </div>
  )
}
