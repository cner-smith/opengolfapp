import type { CSSProperties, ReactNode } from 'react'

const DEV = import.meta.env.DEV

export function SelfDiagnosisArticle() {
  return (
    <article
      id="self-diagnosis"
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
        Self-diagnosis.
      </h2>

      <H3>You know something is off</H3>
      <P>
        Most golfers can feel that a part of their game is leaking shots.
        Far fewer can say what is actually happening — and that gap is the
        difference between fixing a problem and flailing at it. "I'm playing
        bad" is not a diagnosis. "I lose most of my strokes on approach, my
        miss is a push to the right with the mid-irons, and it gets worse
        when I bear down" is a diagnosis. A diagnosis points at a fix.
      </P>
      <P>
        This guide hands you the vocabulary and the framework to read your
        own game. You don't need a coach behind you and you don't need a
        launch monitor. You need to watch where your ball actually goes,
        round after round, and be honest and specific about the pattern.
        The work here is noticing — not judging.
      </P>

      <Hr />

      <H3>Start where the strokes leak</H3>
      <P>
        Golf hands you four bills to pay every round: the tee shot, the
        approach, the short game, and the putter. Before you diagnose a
        swing, find out which bill is bleeding you. Spending an afternoon
        fixing your driver when you three-putt six times a round is solving
        a problem you don't have.
      </P>
      <P>
        If you track strokes gained, this is already answered for you —
        whichever category is most negative is where to look first. If you
        don't track anything, you can still eyeball it over three or four
        rounds:
      </P>
      <ul style={UL_STYLE}>
        <li>
          <strong>Off the tee</strong> — how often does a tee shot cost you
          a penalty stroke or a chip-out sideways?
        </li>
        <li>
          <strong>Approach</strong> — how often do you miss the green, and
          when you miss, is it by a little or by a lot?
        </li>
        <li>
          <strong>Short game</strong> — when you miss a green, how often do
          you get up and down in two?
        </li>
        <li>
          <strong>Putting</strong> — how many putts a round, and how many of
          those are three-putts?
        </li>
      </ul>
      <P>
        Whichever answer makes you wince is your starting point. Diagnose
        that area first and ignore the rest for now. You can only rebuild one
        wall at a time.
      </P>

      <Hr />

      <H3>Four questions for any miss</H3>
      <P>
        Once you know the area, the same four questions crack open almost any
        ball-flight problem. Ask them in order. Each answer narrows the field.
      </P>

      <Subhead>1. What is your typical miss?</Subhead>
      <P>
        Name it precisely. Direction misses — <em>push, pull, slice, hook</em>{' '}
        — are mostly a story about your clubface and your swing path at
        impact. Contact misses — <em>fat, thin, toe, heel</em> — are mostly a
        story about where the bottom of your swing arc lives. A "bad shot" is
        useless information. "A pull that starts left and stays left" tells you
        the face was closed to your target. Specificity is the whole game here.
      </P>

      <Subhead>2. Is it consistent or random?</Subhead>
      <P>
        This is the most important question and the most encouraging one. A{' '}
        <strong>consistent</strong> miss — the same shape almost every time —
        is a pattern, and a pattern can be aimed around or adjusted out. That
        is good news. A <strong>random</strong> miss — left, then right, then
        fat, with no rhyme — usually points further back, at contact and
        fundamentals: grip, posture, alignment, or balance changing from swing
        to swing. Consistency is a sign you are closer to fixed than you feel.
      </P>

      <Subhead>3. Does it get worse under pressure?</Subhead>
      <P>
        If a miss only shows up on the first tee, over water, or when you are
        trying to protect a good score, the cause is often tension and tempo,
        not technique. Pressure speeds people up and tightens the hands. A
        swing that works on the range and falls apart on the card is rarely a
        mechanical problem — it is a rhythm-and-grip-pressure problem wearing a
        mechanical costume.
      </P>

      <Subhead>4. All clubs, or specific ones?</Subhead>
      <P>
        A miss that shows up with <strong>every club</strong> is systemic —
        something in your setup or motion that travels with you: grip, posture,
        alignment, ball position. A miss isolated to <strong>one club</strong>{' '}
        is usually about that club specifically — the driver's length and low
        loft exaggerate whatever your hands do, a particular wedge you don't
        trust, a long iron most amateurs simply shouldn't be carrying.
      </P>

      <Hr />

      <H3>Off the tee</H3>
      <P>
        The expensive tee misses are the ones that find penalty areas: the big
        slice and the snap hook. Run the four questions. A consistent curve in
        one direction is a face-to-path relationship you can work on or simply
        aim for in the meantime. A two-way miss — slice one hole, hook the next
        — is harder to live with and usually traces to alignment and tempo
        rather than one fixable flaw.
      </P>
      <Example
        flight="Consistent slice with the driver, but straight with the irons"
        read="The face is open to a path that's swinging across the ball, left of target — and the driver's length and low loft magnify the side-spin the irons hide. Because the irons are fine, this is rarely a whole-swing rebuild."
        focus="Check alignment first (slicers often aim further left to compensate, which steepens the across-the-ball path and feeds the slice), then check grip strength. A grip rotated too far toward the target leaves the face open at speed."
      />

      <Hr />

      <H3>Approach</H3>
      <P>
        Approach misses come in two flavors: <em>direction</em> (push/pull,
        or a curve) and <em>contact</em> (fat/thin). Direction misses behave
        like the tee — read the curve and the start line. Contact misses are
        about your low point: fat means the arc bottoms out behind the ball,
        thin means you caught it on the way up or pulled out of the shot.
      </P>
      <Example
        flight="Fat shots with the irons, especially under pressure"
        read="Catching it heavy means the low point of your swing fell behind the ball. Under pressure this is commonly weight hanging on the back foot or the hips thrusting toward the ball through impact (early extension) — both move the bottom of the arc backward."
        focus="An impact-bag drill teaches the hands and body where solid contact lives; a slow, balance-focused drill — hold your finish for three seconds on every range ball — retrains weight moving forward. Confirm with a coach if it persists, because fat contact has more than one cause."
      />

      <Hr />

      <H3>Short game</H3>
      <P>
        Around the green, the two killers are the chunk and the skull — and
        they are often the same fault from opposite directions: a low point
        that wanders because the hands try to lift the ball into the air
        instead of letting the loft do it. The fix lives in setup and a
        quieter, descending strike, not in a different club.
      </P>
      <P>
        Distance control is the other half. If your chips finish reliably
        short or reliably long, that is a consistent, fixable pattern — adjust
        your default and re-calibrate. If they scatter with no pattern, the
        contact is the problem, not the green-reading or the touch.
      </P>

      <Hr />

      <H3>Putting</H3>
      <P>
        Putting misses are easy to mislabel. Most golfers blame their read
        when the real culprit is speed. Read errors and pace errors look
        different on the green: a read error leaves you a tester on the same
        side most of the time; a pace error leaves you long and short, and it
        is what turns a routine two-putt into a three.
      </P>
      <Example
        flight="Three-putts from inside 20 feet"
        read="From that range you almost never misread the line badly enough to three-putt — the cause is pace. The first putt finishes too far past or too far short, leaving a knee-knocker you then miss."
        focus="Train speed, not line. Hit putts with your eyes closed and guess where each finished before you look; you'll sharpen the feel for distance fast. Lag drills to a tee or a coin — not a hole — keep your focus on the speed instead of the make."
      />

      <Hr />

      <H3>Consistent is fixable; random is fundamentals</H3>
      <P>
        If you take one thing from this guide, take the second question. A
        consistent miss is a friend — it is repeatable, which means it is
        understandable, which means it is fixable, and in the meantime it is
        aimable. A random miss is telling you to go back to the boring
        basics: grip, posture, alignment, ball position, balance. Nobody wants
        the answer to be "check your setup," but it usually is.
      </P>

      <Hr />

      <H3>When to bring this to a coach</H3>
      <P>
        Self-diagnosis tells you <em>what</em> is happening and points you at
        the likely <em>why</em>. It does not replace a trained eye and a camera
        for the things you cannot see in your own swing. Bring a coach a
        diagnosis, not a vague complaint — "consistent push with the mid-irons,
        worse under pressure, fine with the wedges" gets you a productive
        lesson far faster than "I'm hitting it bad." You will have done half
        their work for them, and you will know whether the fix they give you
        actually addresses the pattern you walked in with.
      </P>

      <EditorialNote variant="todo">
        SVG flowchart diagrams (DESIGN.md editorial style) still to add: (1) a
        top-level "where are the strokes leaking → which section" decision tree,
        and (2) per-area miss → likely-cause → focus flow for tee / approach /
        short game / putting. Holding for direction on flowchart approach
        (hand-drawn SVG vs styled decision blocks).
      </EditorialNote>

      <EditorialNote variant="research">
        Swing-cause claims here are stated as "usually / commonly" on purpose —
        verify the slice path/alignment and fat-shot early-extension framing
        against a teaching source before promoting from Draft to Published.
      </EditorialNote>

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

// Worked example: a real-world miss, what it tells you, and where to focus.
function Example({
  flight,
  read,
  focus,
}: {
  flight: string
  read: string
  focus: string
}) {
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
      <div
        className="font-serif text-caddie-ink"
        style={{ fontSize: 16, fontStyle: 'italic', marginBottom: 8 }}
      >
        “{flight}”
      </div>
      <div
        className="text-caddie-ink-dim"
        style={{ fontSize: 14, lineHeight: 1.55, marginBottom: 8 }}
      >
        <strong>What it reads as:</strong> {read}
      </div>
      <div
        className="text-caddie-ink-dim"
        style={{ fontSize: 14, lineHeight: 1.55 }}
      >
        <strong>Where to focus:</strong> {focus}
      </div>
    </div>
  )
}

function EditorialNote({
  variant,
  children,
}: {
  variant: 'research' | 'todo'
  children: ReactNode
}) {
  if (!DEV) return null
  const tone = variant === 'research' ? '#1F3D2C' : '#A66A1F'
  const label = variant === 'research' ? 'Source' : 'Todo'
  return (
    <div
      style={{
        background: '#EBE5D6',
        borderLeft: `3px solid ${tone}`,
        padding: '10px 14px',
        marginBottom: 14,
        maxWidth: 680,
      }}
    >
      <div
        className="font-mono uppercase"
        style={{
          fontSize: 10,
          letterSpacing: '0.14em',
          color: tone,
          marginBottom: 4,
        }}
      >
        {label} · dev only
      </div>
      <div
        className="text-caddie-ink-dim"
        style={{ fontSize: 13, lineHeight: 1.5, fontStyle: 'italic' }}
      >
        {children}
      </div>
    </div>
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
      Last reviewed May 2026 · Draft, needs instructor review
    </div>
  )
}
