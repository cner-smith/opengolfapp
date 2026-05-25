import type { CSSProperties, ReactNode } from 'react'

export function QuestionsForCoachArticle() {
  return (
    <article
      id="questions-for-coach"
      style={{
        borderTop: '1px solid #D9D2BF',
        paddingTop: 22,
        marginBottom: 32,
      }}
    >
      <div className="kicker" style={{ marginBottom: 14 }}>
        Working with coaches · Draft
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
        A lesson is a conversation.
      </h2>

      <P>
        Most golfers treat a lesson as a download: stand there, collect the tip,
        nod, drive home. The ones who actually improve treat it as a conversation
        — and the questions they ask are what turn a good feeling on the range
        into a change they can still find next week. The companion guide on{' '}
        <em>lessons and coaching</em> covers choosing a teacher and the questions
        to ask <em>before</em> you book. This is the conversation once you're in
        the bay, and the handful of questions at the end that decide whether any
        of it survives the drive home.
      </P>

      <WhenToAsk />

      <Hr />

      <H3>While they're teaching</H3>
      <P>
        A tip you can't reproduce on your own is worthless by Tuesday. These
        three turn a position into something portable.
      </P>
      <ul style={UL_STYLE}>
        <li>
          <strong>"What is this doing to my ball flight?"</strong> You want the
          change tied to an outcome you can see, not just a body position.
          Research on where golfers aim their attention is unusually consistent:
          focusing on the <em>effect</em> of a movement — what the ball does —
          produces better and more durable results than focusing on the body part
          making it. If the answer is only "get your hands here," ask what "here"
          is supposed to <em>produce</em>.
        </li>
        <li>
          <strong>"What's the feel, and what's the checkpoint?"</strong> Feel and
          reality rarely match, so you want both — a feel to chase in the moment,
          and an external checkpoint you can verify alone: a video angle, a
          ball-flight window, a launch number. The feel gets you moving; the
          checkpoint keeps you honest when the coach isn't standing there.
        </li>
        <li>
          <strong>"How will I know when I'm doing it wrong?"</strong> Every new
          move has a characteristic miss. Knowing the failure mode in advance lets
          you catch yourself drifting, instead of grooving the error for three
          weeks until the next lesson.
        </li>
      </ul>

      <Hr />

      <H3>Before you leave</H3>
      <P>
        The clarity you feel walking off the range fades startlingly fast. Pin it
        down before you go.
      </P>
      <ul style={UL_STYLE}>
        <li>
          <strong>"What exactly do I practice, and how much?"</strong> A change
          without a dose is a wish. Get the specific drill and a number — reps,
          minutes, or sessions — so "practice this" becomes something you can
          schedule. Then spread it across days rather than cramming it into one
          marathon; practice spaced over time sticks far better than the same
          reps in a single grind.
        </li>
        <li>
          <strong>"What do I ignore until next time?"</strong> Permission to work
          on one thing is the most underrated gift a coach can give. Ask what to
          leave alone — including the new tip you'll inevitably trip over online
          this week. Mixing sources mid-change is how you end up with no swing at
          all.
        </li>
        <li>
          <strong>"What should get worse first?"</strong> A real swing change
          usually dips before it climbs. Ask how rough the middle gets and how
          long it lasts, so you don't abandon a good change the first time it
          costs you a few shots.
        </li>
        <li>
          <strong>"When should we check this?"</strong> Set the next checkpoint
          before you leave — a date, or a milestone like "once I can hit it 7 of
          10." That's what turns a one-off tip into a plan.
        </li>
      </ul>

      <Callout>
        <strong>If you ask one question, ask this:</strong> "If I could only
        practice one thing this week, what would it be?" It forces your coach to
        prioritize out loud and hands you the single highest-leverage rep to take
        home — the antidote to leaving with a list of six things and doing none of
        them well.
      </Callout>

      <Hr />

      <H3>Questions that waste the hour</H3>
      <P>A few questions feel productive and aren't. Skip them.</P>
      <ul style={UL_STYLE}>
        <li>
          <strong>"What does [tour player] do here?"</strong> Their body, speed,
          and tens of thousands of reps aren't yours. The right model is the
          checkpoint your coach set for <em>you</em>, not a swing built for
          someone else.
        </li>
        <li>
          <strong>"Should I buy this club or gadget?"</strong> A purchase or a
          fitting is a different appointment. Don't spend your most expensive
          coaching minutes on gear questions.
        </li>
        <li>
          <strong>"Is my swing fixed now?"</strong> One lesson rarely fixes
          anything — skill comes from reps and feedback loops, not a single
          revelation on a Tuesday. Judge the coach over a block of lessons, not
          the first hour.
        </li>
      </ul>

      <Hr />

      <H3>The thread under all of it</H3>
      <P>
        A lesson isn't something done to you — it's something you steer. Ask what
        the change is <em>for</em>, how to verify it alone, what to ignore, and
        when to check back, and you walk out with a plan instead of a feeling.
        That's the whole difference between a tip you've forgotten by Saturday and
        a change that's still with you next season.
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

// The three moments of the lesson, and the one-line job of each batch of
// questions. The first moment points at the companion booking guide.
function WhenToAsk() {
  const rows: { when: string; ask: string }[] = [
    {
      when: 'Before booking',
      ask: 'Who to hire — philosophy, video, series. Covered in the lessons-and-coaching guide.',
    },
    {
      when: 'While teaching',
      ask: 'What the change is for, the feel and its checkpoint, and how the miss shows up.',
    },
    {
      when: 'Before you leave',
      ask: 'The exact drill and dose, what to ignore, the dip to expect, and when to check back.',
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
      <div className="kicker" style={{ marginBottom: 12, color: '#5C6356' }}>
        When to ask what
      </div>
      {rows.map((r, i) => (
        <div
          key={r.when}
          style={{
            display: 'flex',
            gap: 14,
            alignItems: 'baseline',
            paddingTop: i === 0 ? 0 : 10,
            marginTop: i === 0 ? 0 : 10,
            borderTop: i === 0 ? 'none' : '1px solid #D9D2BF',
          }}
        >
          <div
            className="font-serif text-caddie-ink"
            style={{ fontSize: 15, fontStyle: 'italic', flex: '0 0 116px' }}
          >
            {r.when}
          </div>
          <div className="text-caddie-ink-dim" style={{ fontSize: 14, lineHeight: 1.5 }}>
            {r.ask}
          </div>
        </div>
      ))}
    </div>
  )
}

// A how-to-apply takeaway lifted out of the prose so the single best question
// is scannable on its own.
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
          <SrcLabel>Focus on the ball, not the body part</SrcLabel>
          <SrcBody>
            <Src href="https://gwulf.faculty.unlv.edu/wp-content/uploads/2018/11/Wulf_AF_review_2013.pdf">
              Wulf, International Review of Sport &amp; Exercise Psychology (2013) ·
              attentional focus, a 15-year review
            </Src>{' '}
            and a golf-specific test in{' '}
            <Src href="https://journals.humankinetics.com/view/journals/jmld/1/1/article-p2.xml">
              Journal of Motor Learning &amp; Development (2013) · external focus,
              X-factor and carry distance
            </Src>{' '}
            — focusing on the movement's effect (the ball) beats focusing on the
            body part making it.
          </SrcBody>
        </div>
        <div>
          <SrcLabel>And it holds up over days</SrcLabel>
          <SrcBody>
            <Src href="https://pmc.ncbi.nlm.nih.gov/articles/PMC11246618/">
              Internal vs external focus on golf putting accuracy over multiple
              days (2024)
            </Src>{' '}
            — the external-focus advantage persists on delayed retention, not just
            in the moment.
          </SrcBody>
        </div>
        <div>
          <SrcLabel>Space the practice you're given</SrcLabel>
          <SrcBody>
            <Src href="https://www.sciencedirect.com/science/article/abs/pii/S016794570000021X">
              Shea et al., Human Movement Science (2000) · spacing practice across
              days
            </Src>{' '}
            — the same reps spread over several days produce far better retention
            than the same total packed into one session.
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
      Last reviewed May 2026 · Draft, needs coaching review
    </div>
  )
}
