import type { ReactNode } from 'react'

export function GuideToFittingsArticle() {
  return (
    <article
      id="guide-to-fittings"
      style={{
        borderTop: '1px solid #D9D2BF',
        paddingTop: 22,
        marginBottom: 32,
      }}
    >
      <div className="kicker" style={{ marginBottom: 14 }}>
        Your equipment · Draft
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
        Golf fittings.
      </h2>

      <H3>There is no such thing as "getting fit"</H3>
      <P>
        Most golfers picture a fitting as one appointment that sorts out their
        clubs. It isn't. Driver, irons, wedges, putter, shaft, and ball are six
        different fittings measuring six different things, and being dialed in
        with one tells you nothing about the others.
      </P>
      <P>
        Knowing what each one actually changes is how you spend fitting money
        where it returns strokes instead of where it sells clubs. So before you
        book anything, here is what is on the table.
      </P>

      <Hr />

      <H3>The six fittings, and what each one changes</H3>

      <Fit
        name="Driver"
        measures="launch angle, spin rate, club path, face angle, ball speed"
        adjusts="loft, shaft, and — on most modern heads — movable weights and an adjustable hosel. The goal is a launch-and-spin pairing that carries: too much spin balloons it, too little drops it out of the sky early."
      />
      <Fit
        name="Irons"
        measures="lie angle, length, shaft weight and flex, grip size"
        adjusts="mostly lie and length. Lie angle is the one that quietly costs accuracy — and most players are off. Across more than 100,000 fittings, Ping finds the majority of golfers don't match the standard lie, and a single degree off can push a wedge five to six yards offline."
      />
      <Fit
        name="Wedges"
        measures="bounce, grind, and the loft gaps between your wedges"
        adjusts="which bounce and grind suit your turf and swing. Bounce is the angle that keeps the sole from digging: high bounce (over 10°) suits soft turf, fluffy lies, and steep digger swings; low bounce (4–6°) suits firm turf and shallow, sweeping contact; mid bounce (7–10°) is the versatile middle. Grind is the shape of the sole around that bounce."
      />
      <Fit
        name="Putter"
        measures="length, lie, loft, and your stroke shape — how much it arcs"
        adjusts="length, lie, head style, and grip. A strong-arc stroke and a straight-back-straight-through stroke want different head designs. It is the club you use most and the one amateurs fit least."
      />
      <Fit
        name="Shaft"
        measures="how the shaft loads and delivers the head for your speed and tempo"
        adjusts="flex, weight, and bend profile. Flex is how much the shaft bends through the swing; too soft for your speed and the head lags behind your hands and the face arrives pointing offline. Flex is not standardized — one brand's stiff can play like another's regular."
      />
      <Fit
        name="Ball"
        measures="how compression and cover suit your speed and short game"
        adjusts="which ball you play. Compression is matched to swing speed; the cover — soft urethane versus a firmer ionomer — trades greenside spin and feel against durability and distance. The ball is a fitting too, and the cheapest one to test."
      />

      <Hr />

      <H3>When to get fitted — start where it pays</H3>
      <P>
        You don't need every fitting at once, and a brand-new golfer doesn't
        need any yet — the swing has to repeat before there is anything stable
        to measure. After that, fit in the order that returns the most strokes
        for the money.
      </P>

      <FitByHandicap />

      <P>
        The through-line: fit the club you use most and the swing you actually
        have, not the one you are hoping to build.
      </P>

      <Hr />

      <H3>Get the most out of the day</H3>
      <P>
        A fitting is only as good as the swing you bring to it. A few habits
        separate data you can trust from a wasted hour:
      </P>
      <ul style={UL_STYLE}>
        <li>
          <strong>Bring the clubs you actually play.</strong> The fitter needs a
          baseline — every recommendation should be measured against your
          current gamer, not against nothing.
        </li>
        <li>
          <strong>Warm up like a round, not a long-drive contest.</strong> Fit
          the swing you play with, not the one that shows up for three perfect
          balls.
        </li>
        <li>
          <strong>Come with a goal and your typical miss.</strong> "I lose it
          right off the tee" or "my wedges are gapping badly" focuses the hour.
        </li>
        <li>
          <strong>Hit enough balls per option.</strong> One good shot is luck; a
          fitter should be reading a cluster, not a highlight.
        </li>
        <li>
          <strong>Be honest about how often you play.</strong> The best club for
          a range hero who plays twice a year is not the best club for you.
        </li>
      </ul>

      <Hr />

      <H3>A real fitting vs a sales pitch</H3>
      <P>
        A fitting and a sale can look identical from the outside. The difference
        is whether the session is about your numbers or about the rack.
      </P>

      <Subhead>Signs it's a real fitting</Subhead>
      <ul style={UL_STYLE}>
        <li>A launch monitor is running and you are shown your numbers</li>
        <li>Several heads and shafts are tested back-to-back, not just one</li>
        <li>The fitter explains what each change did to the ball flight</li>
        <li>You are sometimes told a change isn't worth the money</li>
      </ul>

      <Subhead>Signs it's a sales pitch</Subhead>
      <ul style={UL_STYLE}>
        <li>One option is pushed hard from the start</li>
        <li>No data is shown, or the numbers are kept on the fitter's side</li>
        <li>"This is what everyone's playing" stands in for your results</li>
        <li>Every session somehow ends in exactly one thing to buy</li>
      </ul>

      <P>
        Indoor fitting gives controlled launch-monitor data; outdoor lets you
        see real flight and roll. Both are valid — but either way the numbers
        should be explained to you, not just sold.
      </P>

      <Hr />

      <H3>Questions worth asking</H3>
      <P>
        The fitter works for you for that hour, even when the bay is inside a
        shop. These turn a transaction back into a fitting — each one, and what
        you're listening for in the answer:
      </P>
      <QA lead="&ldquo;What are we optimizing for?&rdquo;">
        You want a clear target before the first ball — carry distance, tighter
        dispersion, better gapping. "Let's just hit some and see" is not a plan.
      </QA>
      <QA lead="&ldquo;Can I see the numbers for every option?&rdquo;">
        A real fitting shows you the data for each club, not just announces a
        winner. If the screen only faces the fitter, ask them to turn it around.
      </QA>
      <QA lead="&ldquo;How does this compare to what I'm playing now?&rdquo;">
        Every change should beat your current gamer by enough to matter — and
        "better" should be a number, not a feeling.
      </QA>
      <QA lead="&ldquo;Is this difference real, or is it inside my scatter?&rdquo;">
        If an option averages five yards longer but your shots vary by twenty,
        that five yards is noise. A good fitter talks in averages and spread,
        not single shots.
      </QA>
      <QA lead="&ldquo;What would you change first — and what isn't worth it?&rdquo;">
        A fitter willing to tell you something doesn't matter is one you can
        trust on the things that do.
      </QA>
      <QA lead="&ldquo;What are my yardage gaps?&rdquo;">
        You want even gaps between clubs — no two going the same distance, and no
        big holes where you're stranded between clubs.
      </QA>

      <Hr />

      <H3>Decoding what the fitter says</H3>
      <P>
        Fitters talk in launch-monitor shorthand. Here is what the common
        phrases actually mean — and when one is a real signal versus a way to
        wave a weak number past you.
      </P>
      <QA lead="&ldquo;You need more launch / less spin.&rdquo;">
        Your carry isn't matching your speed. With the driver, too much spin
        balloons the ball and costs distance; too little and it drops out of the
        sky early. The fix is launch and spin working together, usually through
        loft and shaft.
      </QA>
      <QA lead="&ldquo;Your smash factor is 1.4-something.&rdquo;">
        How much ball speed you got for your clubhead speed — basically, how
        flush you struck it. Around 1.50 with a driver is efficient; a low number
        usually means off-center contact, which can be the club or your strike,
        so make sure it's the club before you pay for it.
      </QA>
      <QA lead="&ldquo;Your dispersion tightened up.&rdquo;">
        Your shots are landing in a smaller area. This matters more than one
        extra-long drive — the tighter pattern is the one that keeps you in play.
        Reward dispersion over the occasional bomb.
      </QA>
      <QA lead="&ldquo;Your spin axis is tilted.&rdquo;">
        That's your curve: the ball fades or draws because the face and the path
        don't match. Same mechanism as a slice in any ball-flight explainer — the
        fitter is just reading it off the monitor.
      </QA>
      <QA lead="&ldquo;This shaft loads better for you.&rdquo;">
        A feel-and-timing claim. It can be real, but it should still show up in
        the data — better contact, tighter dispersion, more speed. If it only
        feels better and the numbers are flat, that's preference, not performance.
      </QA>
      <QA lead="&ldquo;Your attack angle is up / down.&rdquo;">
        Whether you're hitting up or down on the ball at impact. The driver likes
        a slightly upward strike for carry; irons want a downward strike that
        bottoms out just after the ball.
      </QA>
      <QA lead="&ldquo;The numbers don't tell the whole story.&rdquo;">
        Sometimes true for feel — but it's also the line used to sell you past
        data that doesn't support the upgrade. Make them tell you exactly what
        the numbers are missing.
      </QA>

      <Hr />

      <H3>When you're ready, and how often</H3>
      <P>
        You are ready when your contact is consistent enough that the fitter is
        measuring your swing and not your mishits — roughly, when most shots
        find the middle of the face. Get re-fit after a swing change, a real
        change in speed, or every few years as your body and the equipment move
        on. You don't need the newest model. You need clubs that match you.
      </P>

      <Hr />

      <H3>What it costs</H3>
      <P>
        Big retailers often fit for free when you buy. Independent fittings run
        roughly $75–150 for a single club up to $300 and more for a full bag,
        sometimes credited back toward a purchase, with building the clubs
        billed separately. The fitting itself is cheap next to a set of irons —
        and a putter fitting is the cheapest stroke-saver on this page.
      </P>

      <Sources />

      <Footer />
    </article>
  )
}

const UL_STYLE: import('react').CSSProperties = {
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

function Subhead({ children }: { children: ReactNode }) {
  return (
    <div
      className="kicker"
      style={{ marginTop: 14, marginBottom: 10, color: '#5C6356' }}
    >
      {children}
    </div>
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

// One fitting type: what it measures vs what it actually adjusts.
function Fit({
  name,
  measures,
  adjusts,
}: {
  name: string
  measures: string
  adjusts: string
}) {
  return (
    <div
      style={{
        borderTop: '1px solid #D9D2BF',
        paddingTop: 12,
        marginBottom: 12,
        maxWidth: 660,
      }}
    >
      <div
        className="font-serif text-caddie-ink"
        style={{ fontSize: 18, fontStyle: 'italic', marginBottom: 6 }}
      >
        {name}
      </div>
      <div className="text-caddie-ink-dim" style={{ fontSize: 14, lineHeight: 1.55 }}>
        <Tag>Measures</Tag> {measures}
      </div>
      <div
        className="text-caddie-ink-dim"
        style={{ fontSize: 14, lineHeight: 1.55, marginTop: 4 }}
      >
        <Tag>Adjusts</Tag> {adjusts}
      </div>
    </div>
  )
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span
      className="font-mono uppercase"
      style={{
        fontSize: 10,
        letterSpacing: '0.14em',
        color: '#8A8B7E',
        marginRight: 6,
      }}
    >
      {children}
    </span>
  )
}

// A question to ask (or a phrase the fitter uses) and what it actually means.
function QA({ lead, children }: { lead: string; children: ReactNode }) {
  return (
    <div
      style={{
        borderTop: '1px solid #D9D2BF',
        paddingTop: 10,
        marginBottom: 10,
        maxWidth: 660,
      }}
    >
      <div
        className="font-serif text-caddie-ink"
        style={{ fontSize: 15, fontStyle: 'italic', marginBottom: 4 }}
      >
        {lead}
      </div>
      <div className="text-caddie-ink-dim" style={{ fontSize: 14, lineHeight: 1.55 }}>
        {children}
      </div>
    </div>
  )
}

// Fitting priority by handicap — fit the highest-return club for where you are.
function FitByHandicap() {
  const rows: { stage: string; advice: string }[] = [
    {
      stage: 'New golfer',
      advice: 'Not yet. Get contact repeatable first — there is nothing stable to fit.',
    },
    {
      stage: '20+ handicap',
      advice: 'Putter first. The club you use most, and the cheapest to fit.',
    },
    {
      stage: '10–20',
      advice: 'Irons and wedges — lie angle, length, and the loft gaps between wedges.',
    },
    {
      stage: 'Under 10',
      advice: 'Everything, ball included — small gains are worth chasing now.',
    },
  ]
  return (
    <div style={{ maxWidth: 640, marginBottom: 18, borderTop: '1px solid #D9D2BF' }}>
      {rows.map((r) => (
        <div
          key={r.stage}
          style={{
            display: 'flex',
            gap: 16,
            padding: '12px 0',
            borderBottom: '1px solid #D9D2BF',
            alignItems: 'baseline',
          }}
        >
          <div
            className="font-serif text-caddie-ink"
            style={{ fontSize: 15, fontStyle: 'italic', flex: '0 0 110px' }}
          >
            {r.stage}
          </div>
          <div className="text-caddie-ink-dim" style={{ fontSize: 14, lineHeight: 1.5 }}>
            {r.advice}
          </div>
        </div>
      ))}
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
          <SrcLabel>Lie angle and iron fitting</SrcLabel>
          <SrcBody>
            <Src href="https://www.globalgolf.com/articles/pro-tip-110/">
              Understanding the PING fitting charts
            </Src>{' '}
            and{' '}
            <Src href="https://mygolfspy.com/news-opinion/historys-mysteries-the-birth-of-pings-color-code-system/">
              MyGolfSpy on PING's color-code system
            </Src>{' '}
            — over 100,000 fittings show most golfers don't match the standard
            lie; a degree off moves a wedge several yards offline.
          </SrcBody>
        </div>
        <div>
          <SrcLabel>Wedge bounce and grind</SrcLabel>
          <SrcBody>
            <Src href="https://www.vokey.com/explained/wedge-bounce">
              Titleist Vokey · Wedge Bounce
            </Src>{' '}
            and{' '}
            <Src href="https://www.golfdigest.com/story/wedge-bounce-versus-wedge-grind-explained">
              Golf Digest · bounce vs grind
            </Src>{' '}
            — high, mid, and low bounce, and which turf and swing each suits.
          </SrcBody>
        </div>
        <div>
          <SrcLabel>Shaft flex and ball, matched to swing speed</SrcLabel>
          <SrcBody>
            <Src href="https://mygolfspy.com/news-opinion/instruction/golf-driver-shaft-flex-chart-find-the-right-flex-for-your-swing-speed/">
              MyGolfSpy · shaft flex by swing speed
            </Src>{' '}
            and{' '}
            <Src href="https://www.pgatoursuperstore.com/learning-center/ultimate-golf-club-shaft-flex-guide.html">
              PGA Tour Superstore · shaft flex guide
            </Src>{' '}
            — flex changes where the face points at impact, and isn't standard
            across brands; compression pairs to the same swing-speed logic.
          </SrcBody>
        </div>
        <div>
          <SrcLabel>What the fitter's numbers mean</SrcLabel>
          <SrcBody>
            <Src href="https://www.trackman.com/blog/golf/6-trackman-numbers-all-amateur-golfers-should-know">
              TrackMan · 6 numbers every amateur should know
            </Src>{' '}
            and{' '}
            <Src href="https://www.trackman.com/blog/golf/the-ultimate-guide-to-understanding-trackman">
              the ultimate guide to TrackMan data
            </Src>{' '}
            — launch, spin, smash factor, attack angle, and dispersion, in plain
            terms.
          </SrcBody>
        </div>
      </div>
    </section>
  )
}

function SrcLabel({ children }: { children: ReactNode }) {
  return (
    <div
      className="font-mono uppercase"
      style={{ fontSize: 10, letterSpacing: '0.14em', color: '#5C6356', marginBottom: 4 }}
    >
      {children}
    </div>
  )
}

function SrcBody({ children }: { children: ReactNode }) {
  return (
    <div className="text-caddie-ink-dim" style={{ fontSize: 13, lineHeight: 1.55 }}>
      {children}
    </div>
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
      Last reviewed May 2026 · Draft, needs fitter review
    </div>
  )
}
