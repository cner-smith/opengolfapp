import type { CSSProperties, ReactNode } from 'react'

export function PracticeVsScoringRoundArticle() {
  return (
    <article
      id="practice-vs-scoring-round"
      style={{
        borderTop: '1px solid #D9D2BF',
        paddingTop: 22,
        marginBottom: 32,
      }}
    >
      <div className="kicker" style={{ marginBottom: 14 }}>
        On the course · Draft
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
        Decide which round you're playing.
      </h2>

      <P>
        A practice round and a scoring round use the same eighteen holes, but
        they are two different jobs — and trying to do both at once does neither
        well. The guide on{' '}
        <em>how to practice effectively</em> makes the distinction in a
        sentence: one is for information, the other is for performance. This is
        the on-course version — what each round is actually for, how to run a
        real practice round instead of just a casual one, and why the rounds
        that blur the line teach you the least.
      </P>

      <ModeTable />

      <Hr />

      <H3>What a practice round is actually for</H3>
      <P>
        A practice round is reconnaissance. You are not trying to shoot a number
        — you are gathering the information that lets you commit on the day it
        counts. Tour caddies walk a course for days before an event doing
        exactly this; you can get most of the value in one honest loop.
      </P>
      <ul style={UL_STYLE}>
        <li>
          <strong>Hit driver off the tees you're unsure about.</strong> You
          learn whether your driver actually reaches the fairway bunker or the
          dogleg trouble. You can always dial back to a 3-wood in competition —
          but only if you know what driver does first.
        </li>
        <li>
          <strong>Find where you can't miss.</strong> On every approach, note
          the side that leaves a dead chip or a ball in the water. Course
          management is mostly knowing the one place the ball can't go; the
          practice round is where you find it.
        </li>
        <li>
          <strong>Putt from the spots you'll actually face.</strong> Roll a few
          from each likely pin area to learn the speed and the big breaks. The
          green is where rounds are won, and it reads differently than it looks.
        </li>
        <li>
          <strong>Play a ball from the rough and a bunker.</strong> A shot or
          two from the conditions you'll meet tells you how this course's turf
          and sand behave before they surprise you under pressure.
        </li>
        <li>
          <strong>Don't keep score.</strong> A score on a practice round sets an
          expectation you'll carry to the first tee for no reason. Drop a second
          ball, try the riskier line, hole out for the read — the round is for
          learning, not for a number.
        </li>
      </ul>

      <Hr />

      <H3>What a scoring round demands</H3>
      <P>
        A scoring round is performance. One ball, every shot counts, and the
        only job is to post the lowest number you can with the game you brought.
        That means the opposite of the practice round on almost every count.
      </P>
      <ul style={UL_STYLE}>
        <li>
          <strong>Full routine on every shot.</strong> The same pre-shot
          sequence, even on the throwaway ones. A consistent pre-shot routine is
          one of the most reliably effective mental tools in the game — a
          meta-analysis across sports found routines measurably improve
          performance, and they help most precisely when the pressure is on and
          the mind wants to wander.
        </li>
        <li>
          <strong>Commit, then accept.</strong> Pick the shot, commit to it, and
          take the result without relitigating it. The experimenting was supposed
          to happen in the practice round; here, a half-committed swing is the
          worst of both worlds.
        </li>
        <li>
          <strong>One ball, no mulligans.</strong> The score only means something
          if it's the score you actually made. Play it down, count everything,
          move on.
        </li>
        <li>
          <strong>Manage, don't experiment.</strong> Aim at the fat of the green,
          favor the safe miss, and save the new shot you've been working on for
          the range. Even tour players aim at the center, not the pin, for
          anything longer than a short iron.
        </li>
      </ul>

      <Hr />

      <H3>Why mixing them costs you both</H3>
      <P>
        The common mistake isn't choosing the wrong mode — it's failing to
        choose, and drifting through the round half in each. You take the round
        seriously enough to feel the nerves, but loosely enough to drop a second
        ball when one goes sideways. The result is the worst of both: the anxiety
        of performance without a real score to show for it, and the freedom of
        practice without any of the information.
      </P>
      <P>
        It also quietly ruins your data. If you track rounds to find where your
        game leaks strokes, a dropped second ball or a "let me just try the cut
        here" poisons the signal — the round no longer reflects the decisions and
        misses you'd actually make. A round is only worth measuring if it was
        played honestly: one ball, full commitment, every stroke counted.
      </P>

      <Hr />

      <H3>The casual round is neither — and that's the trap</H3>
      <P>
        Most weekend rounds are neither a true practice round nor a true scoring
        round. That's completely fine — golf is supposed to be fun, and most of
        the time the goal is a good walk with friends. The trap is mistaking a
        steady diet of casual rounds for improvement work. A casual round gives
        you neither clean recon nor a trustworthy score; it just gives you a
        pleasant afternoon, which is its own reward but not a feedback loop.
      </P>
      <P>
        If you actually want to get better, some of your rounds have to be
        honestly one or the other: a recon loop where you experiment freely and
        keep notes, or a committed scoring round you track without fudging. The
        line between them is the whole point.
      </P>

      <Callout>
        <strong>The one habit:</strong> before you hit the first tee shot, decide
        out loud which round this is. "This is a practice round" or "I'm playing
        this one for score" — said before you start — is what keeps you from
        drifting into the half-committed middle where neither version pays off.
      </Callout>

      <P>
        The skill in golf isn't only swinging the club; it's knowing which game
        you're playing on any given day and committing to it fully. Pick one
        before you tee off, and both your scores and your practice get sharper
        for it.
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

// The two rounds set side by side across the dimensions that actually differ —
// the comparison is the article's thesis, so it leads before the prose.
function ModeTable() {
  const rows: { dim: string; practice: string; scoring: string }[] = [
    { dim: 'The job', practice: 'Gather information', scoring: 'Post a number' },
    { dim: 'Balls', practice: 'Drop extras, experiment', scoring: 'One ball, no mulligans' },
    { dim: 'Routine', practice: 'Loose', scoring: 'Full, every shot' },
    { dim: 'Risk', practice: 'Try the dangerous line', scoring: 'Favor the safe miss' },
    { dim: 'Score', practice: "Don't keep it", scoring: 'Count everything' },
    {
      dim: 'Success is',
      practice: 'Walking off knowing the course',
      scoring: 'The lowest number you can',
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
          gridTemplateColumns: '92px 1fr 1fr',
          gap: '0 14px',
          alignItems: 'baseline',
        }}
      >
        <div />
        <div className="kicker" style={{ color: '#5C6356' }}>
          Practice round
        </div>
        <div className="kicker" style={{ color: '#5C6356' }}>
          Scoring round
        </div>
        {rows.map((r, i) => (
          <Row key={r.dim} first={i === 0} {...r} />
        ))}
      </div>
    </div>
  )
}

function Row({
  dim,
  practice,
  scoring,
  first,
}: {
  dim: string
  practice: string
  scoring: string
  first: boolean
}) {
  const cell: CSSProperties = {
    paddingTop: first ? 12 : 9,
    marginTop: first ? 10 : 0,
    borderTop: first ? '1px solid #D9D2BF' : 'none',
  }
  return (
    <>
      <div
        className="font-serif text-caddie-ink"
        style={{ ...cell, fontSize: 13, fontStyle: 'italic' }}
      >
        {dim}
      </div>
      <div className="text-caddie-ink" style={{ ...cell, fontSize: 13, lineHeight: 1.45 }}>
        {practice}
      </div>
      <div className="text-caddie-ink" style={{ ...cell, fontSize: 13, lineHeight: 1.45 }}>
        {scoring}
      </div>
    </>
  )
}

// A how-to-apply takeaway lifted out of the prose so the single decision is
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
          <SrcLabel>A practice round is recon, not a score</SrcLabel>
          <SrcBody>
            <Src href="https://www.pga.com/story/prioritize-your-practice-sessions-to-prepare-for-a-big-golf-tournament">
              PGA of America · preparing for a tournament
            </Src>{' '}
            and{' '}
            <Src href="https://golfstateofmind.com/course-management-lessons-from-the-pga-tour/">
              Golf State of Mind · course-management lessons from the PGA Tour
            </Src>{' '}
            — hit driver to learn the trouble, find the no-go side, default to
            the center of the green, and keep score out of it.
          </SrcBody>
        </div>
        <div>
          <SrcLabel>Pre-shot routines help most under pressure</SrcLabel>
          <SrcBody>
            <Src href="https://www.tandfonline.com/doi/full/10.1080/1750984X.2021.1944271">
              International Review of Sport &amp; Exercise Psychology (2021) ·
              meta-analysis of pre-performance routines
            </Src>{' '}
            — a consistent routine produces a measurable performance benefit, and
            it matters most when the pressure invites distraction.
          </SrcBody>
        </div>
        <div>
          <SrcLabel>Why the practice mindset is a separate gear</SrcLabel>
          <SrcBody>
            <Src href="https://www.sportspsychologygolf.com/how-to-think-about-practice-rounds-in-golf/">
              Golf Psychology (Dr. Patrick Cohn) · how to think about practice
              rounds
            </Src>{' '}
            — treating a practice round as a performance is how golfers carry
            scoring anxiety into a day that was supposed to lower it.
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
      Last reviewed May 2026 · Draft, needs review
    </div>
  )
}
