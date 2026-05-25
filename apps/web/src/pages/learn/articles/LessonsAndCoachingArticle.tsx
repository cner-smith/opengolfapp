import type { CSSProperties, ReactNode } from 'react'

export function LessonsAndCoachingArticle() {
  return (
    <article
      id="lessons-and-coaching"
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
        Lessons and coaching.
      </h2>

      <H3>Most golfers waste the lesson hour</H3>
      <P>
        A golf lesson is one of the highest-leverage hours you can spend on your
        game — and most golfers either never book one or get almost nothing out
        of the ones they do. They show up cold, collect a tip, never practice
        it, slide back to their old swing within a week, and conclude that
        "lessons don't work for me." The lesson worked fine. The hour around it
        didn't. This guide is about both halves: choosing a teacher worth your
        money, and setting yourself up to actually keep what they give you.
      </P>

      <Hr />

      <H3>What the letters after a name mean — and don't</H3>
      <P>
        Certifications tell you someone cleared a bar. They don't tell you
        whether that person is the right teacher for <em>you</em>.
      </P>
      <ul style={UL_STYLE}>
        <li>
          <strong>PGA / LPGA.</strong> A PGA of America or LPGA teaching
          professional has completed a long training and testing program and
          knows the game deeply. It's a real credential — and a broad one. It
          certifies competence and seriousness, not that this particular coach
          communicates in a way that clicks for you.
        </li>
        <li>
          <strong>TPI (Titleist Performance Institute).</strong> A TPI-certified
          instructor is trained in the "body-swing connection" — they screen
          your physical mobility and limitations first, so they're less likely
          to prescribe a position your body literally cannot reach. Useful if
          you've got an injury history or wonder why a textbook move feels
          impossible.
        </li>
      </ul>
      <P>
        Treat any certification as a floor, not a ceiling. The best teacher you
        ever have might have a wall of letters or just a long line of students
        who got better. The credential gets them on your shortlist; the next few
        questions decide whether they make the cut.
      </P>

      <Hr />

      <H3>Questions worth asking before you book</H3>
      <P>
        You're hiring someone. It's fair — and smart — to interview them first.
        A quick email or phone call answers most of this:
      </P>
      <ul style={UL_STYLE}>
        <li>
          <strong>What's your teaching philosophy?</strong> A good teacher can
          answer in a sentence or two. Vagueness here is a warning.
        </li>
        <li>
          <strong>Do you use video and a launch monitor?</strong> You want
          someone who measures, not just eyeballs and guesses.
        </li>
        <li>
          <strong>How do you structure things — one-offs or a series?</strong>{' '}
          The honest answer is almost always a series, and you want a coach who
          says so.
        </li>
        <li>
          <strong>Who do you mostly teach?</strong> A coach who lives with
          competitive players may not be the right fit for a nervous beginner,
          and vice versa.
        </li>
      </ul>

      <Hr />

      <H3>Green flags and red flags</H3>
      <P>
        Once you're in front of someone — or watching a few minutes of how they
        teach online — the difference between a teacher who'll help you and one
        who won't is usually obvious within a lesson:
      </P>

      <FlagColumns />

      <Hr />

      <H3>Online or in person?</H3>
      <P>
        In-person lessons give a coach hands-on feedback in real time — they can
        feel your grip, move you into a position, and react to a shot the second
        it happens. That's hard to beat for first-time fundamentals and anything
        kinesthetic. Online coaching — you send swing videos, they send back a
        breakdown — is cheaper, fits any schedule, and lets you work with a
        specialist who isn't within driving distance. It leans on you to film
        well and to self-apply between notes.
      </P>
      <P>
        For a lot of golfers the best answer is both: in person to set the
        direction and learn the feel, online to maintain it and stay
        accountable between range trips.
      </P>

      <Hr />

      <H3>Show up ready</H3>
      <P>
        How much you get out of an hour is mostly decided before it starts.
      </P>
      <ul style={UL_STYLE}>
        <li>
          <strong>Bring your own clubs.</strong> They're what you actually play,
          fitted (or mis-fitted) to you. A coach learns a lot from them.
        </li>
        <li>
          <strong>Bring your phone.</strong> You'll want video to review later,
          and your own footage of the feels they give you.
        </li>
        <li>
          <strong>Tell them the truth up front:</strong> your goals, your
          typical miss, what's been bothering you, and what you actually shoot.
          The more specific, the faster they can help.
        </li>
        <li>
          <strong>Take notes</strong> — during the lesson or the moment it ends.
          The clarity you feel walking off the range fades startlingly fast by
          the next day.
        </li>
      </ul>

      <Hr />

      <H3>Feel isn't real</H3>
      <P>
        This is the single most useful thing to understand about taking
        instruction: what a change <em>feels</em> like and what the camera
        actually shows are almost never the same. When a coach asks you to feel
        something that seems wildly exaggerated, they're usually using that gap
        on purpose — the feeling that produces the correct position often feels
        like a gross overcorrection. Don't argue with the feel and don't trust
        it either. Trust the checkpoint — the video, the launch-monitor number,
        the ball flight — and let the feel be whatever gets you there.
      </P>

      <Hr />

      <H3>Why you might get worse before you get better</H3>
      <P>
        A genuine swing change means overwriting a motor pattern your brain has
        grooved over years. For a while the old pattern is fading and the new
        one hasn't taken hold, so you're caught in between — contact gets clumsy,
        the odd shot flies sideways, and your scores can dip. This is a normal,
        predictable stage of learning a new movement, not a sign the lesson
        failed or the teacher was wrong.
      </P>
      <Callout>
        <strong>So plan for the dip.</strong> Commit to a set number of practice
        sessions on the change before you judge it, expect a rough patch in the
        middle, and don't carry a half-built swing into a round that matters.
        The most common way golfers waste a good lesson is bailing on the change
        the first time it costs them a few shots.
      </Callout>

      <Hr />

      <H3>One lesson rarely fixes anything</H3>
      <P>
        Skill change comes from reps and feedback loops, not a single
        revelation on a Tuesday. Going in expecting to be "fixed" in an hour is
        the surest way to be disappointed. Commit to a block instead — say three
        to five lessons over a couple of months — and judge the teacher on the
        block, not the first session.
      </P>
      <P>
        Between lessons, practice exactly what they gave you, not the new tip
        you stumbled onto on YouTube that week — mixing coaches mid-change is how
        you end up with no swing at all. At the end of the block, take stock: is
        my miss smaller, are my numbers or scores trending the right way, do I
        understand what I'm doing and why? If the answer is yes, keep going. If
        there's no plan, no progress after honest effort, or you simply never
        understand the language they teach in, it's fair to move on.
      </P>

      <Hr />

      <H3>Coaching yourself between lessons</H3>
      <P>
        You can do a surprising amount of your own checking with a phone and a
        little honesty. Film two angles: <strong>down the line</strong> (camera
        directly behind you, on the target line) and <strong>face on</strong>{' '}
        (straight in front). They show different things — the down-the-line view
        reveals swing plane and path, the face-on view shows sway, weight, and
        ball position. Compare yourself to the checkpoints your coach gave you,
        not to a tour pro built nothing like you.
      </P>
      <P>
        Data does the same job for the parts you can't see. A launch monitor —
        Trackman, a Garmin unit, whatever you can borrow — or your own
        round-tracking turns "I think I'm better" into evidence you can act on.
        And the most useful thing you can carry into a lesson is a clear read on
        where you're actually losing shots.
      </P>
      <Callout>
        <strong>Walk in with a diagnosis, not a complaint.</strong> "I'm hitting
        it bad" burns the first ten minutes of the hour. "My strokes gained data
        says I lose about 1.2 shots a round on approach, and my miss is right"
        points the lesson straight at the leak. If you track your rounds in OGA,
        you arrive with that read already done — and the coach spends the hour
        fixing instead of interviewing.
      </Callout>

      <Hr />

      <H3>The bottom line</H3>
      <P>
        Pick a teacher who measures, explains the why, and sends you away with a
        plan. Show up with your clubs, your numbers, and the truth about your
        miss. Expect to get a little worse before you get better, and don't quit
        the change in the dip. Do that and a lesson stops being a tip you forget
        by Saturday and becomes the fastest way there is to actually get better.
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
      style={{
        fontSize: 15,
        lineHeight: 1.6,
        maxWidth: 640,
        marginBottom: 14,
      }}
    >
      {children}
    </p>
  )
}

function Hr() {
  return <div style={{ borderTop: '1px solid #D9D2BF', margin: '0 0 18px' }} />
}

// A how-to-apply takeaway: a short, actionable instruction lifted out of the
// prose so the reader can scan the practical moves without rereading.
function Callout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: '#EBE5D6',
        borderLeft: '3px solid #1F3D2C',
        padding: '14px 16px',
        marginBottom: 14,
        maxWidth: 680,
      }}
    >
      <div className="text-caddie-ink" style={{ fontSize: 14, lineHeight: 1.55 }}>
        {children}
      </div>
    </div>
  )
}

// Side-by-side "look for / walk away from" cards. Palette stays in the house
// earth tones — the accent green marks the column you want, a muted ink marks
// the one you don't. No red; the labels carry the meaning.
function FlagColumns() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
        marginBottom: 14,
        maxWidth: 680,
      }}
    >
      <FlagCard
        label="Look for"
        accent
        items={[
          'Ties every change to ball flight — what it does, not just how it looks',
          'Gives you a feel AND a checkpoint you can verify on your own',
          'Sends you off with a clear practice plan',
          'Explains the why, so you could re-teach it to a friend',
          'Asks about your goals and your typical miss before touching your swing',
        ]}
      />
      <FlagCard
        label="Walk away from"
        items={[
          'Only tells you what’s wrong, never how to fix it',
          'One identical swing prescribed to every student',
          'No video, no launch monitor — all eyeball and opinion',
          'Jargon with no translation into something you can do',
          'Promises a quick, one-lesson fix',
        ]}
      />
    </div>
  )
}

function FlagCard({
  label,
  items,
  accent,
}: {
  label: string
  items: string[]
  accent?: boolean
}) {
  return (
    <div
      style={{
        flex: '1 1 280px',
        border: `1px solid ${accent ? '#1F3D2C' : '#D9D2BF'}`,
        background: '#EBE5D6',
        borderRadius: 2,
        padding: '14px 16px',
      }}
    >
      <div
        className="font-mono uppercase"
        style={{
          fontSize: 10,
          letterSpacing: '0.14em',
          color: accent ? '#1F3D2C' : '#5C6356',
          marginBottom: 10,
          paddingBottom: 8,
          borderBottom: `1px solid ${accent ? '#1F3D2C' : '#D9D2BF'}`,
        }}
      >
        {label}
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((item) => (
          <li
            key={item}
            className="text-caddie-ink"
            style={{
              fontSize: 13.5,
              lineHeight: 1.45,
              marginBottom: 8,
              paddingLeft: 16,
              position: 'relative',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 0,
                color: accent ? '#1F3D2C' : '#8A8B7E',
              }}
            >
              {accent ? '✓' : '·'}
            </span>
            {item}
          </li>
        ))}
      </ul>
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
          <SrcLabel>What the certifications mean</SrcLabel>
          <SrcBody>
            <Src href="https://www.mytpi.com/certification/about">
              Titleist Performance Institute · About Certification
            </Src>{' '}
            on the body-swing-connection approach and physical screening;{' '}
            <Src href="https://www.pga.com/things-to-do/coaches">
              PGA of America · Coaches
            </Src>{' '}
            for what a PGA teaching professional is and how to find one.
          </SrcBody>
        </div>
        <div>
          <SrcLabel>Why a swing change feels worse before it feels better</SrcLabel>
          <SrcBody>
            <Src href="https://hackmotion.com/worse-after-golf-lessons/">
              HackMotion · Worse After Golf Lessons?
            </Src>{' '}
            — the temporary performance dip is a normal stage of overwriting a
            grooved motor pattern: the old swing fades before the new one takes
            hold, so contact gets clumsy in the middle. Expected, not a failure.
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
      style={{
        fontSize: 10,
        letterSpacing: '0.14em',
        color: '#5C6356',
        marginBottom: 4,
      }}
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
