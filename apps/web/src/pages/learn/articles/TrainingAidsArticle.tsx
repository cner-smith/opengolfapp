import type { ReactNode } from 'react'

export function TrainingAidsArticle() {
  return (
    <article
      id="training-aids"
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
        Training aids.
      </h2>

      <H3>Feeling productive isn't the same as getting better</H3>
      <P>
        The training-aid aisle sells a feeling: that buying the device is the
        same as building the skill. Most of it isn't. A few aids genuinely teach
        — they show you something you can't see on your own and let you fix it.
        The rest just make practice feel like work without changing what your
        ball does on Saturday.
      </P>
      <P>
        This isn't a list of brands to buy. It's the categories — what problem
        each kind of aid solves, how it works, who actually needs it, and when
        in your development it earns a place in the bag. Before any of that, one
        test sorts the coaches from the crutches.
      </P>

      <TheTest />

      <Hr />

      <H3>The seven kinds, and what each one trains</H3>
      <P>
        Six aids you can rehearse with, then the one that measures — the launch
        monitor — which gets its own section because the numbers need
        explaining.
      </P>

      <Aid
        name="Alignment aids"
        trains="Where you're actually aimed"
        svg={<AlignmentDiagram />}
      >
        <AidBody>
          Standing beside the ball, your eyes lie. Most golfers aim well off the
          target without feeling it, then build a compensation into the swing to
          pull the ball back — baking in a fault to fix a setup error. Sticks on
          the ground make the invisible error visible: one along your toes, one
          on the ball-to-target line, body parallel-left like railroad tracks
          while the clubface points at the target.
        </AidBody>
        <AidBody>
          Everyone, from the first lesson on. Alignment is the cheapest
          fundamental in the game and the one most quietly broken — even four
          degrees off misses a 150-yard target by more than ten yards with a
          perfect swing.
        </AidBody>
        <LookFor>
          Two sticks, or two clubs from your bag. A laser adds precision you
          don't need yet.
        </LookFor>
      </Aid>

      <Aid
        name="Putting aids"
        trains="A square face and a repeating stroke"
        svg={<PuttingGateDiagram />}
      >
        <AidBody>
          At putting distance the face angle decides almost everything about
          where the ball starts — a couple of degrees open and you've missed —
          and you can't watch your own eyes or face at address. A mirror shows
          eye position and shoulder line; gates (two tees just wider than the
          ball) force a square strike on an on-line start, or the ball clips a
          tee; an arc trainer guides the stroke shape.
        </AidBody>
        <AidBody>
          Anyone who three-putts or misses the short ones, which is nearly
          everyone — putting is roughly 40% of the strokes in a round, and the
          cheapest skill to train at home.
        </AidBody>
        <LookFor>
          A mirror plus two tees covers it. Save the arc trainer for when you're
          chasing a specific stroke shape.
        </LookFor>
      </Aid>

      <Aid
        name="Impact aids"
        trains="What actually happens at the ball"
        svg={<ImpactFaceDiagram />}
      >
        <AidBody>
          Impact lasts under half a thousandth of a second — you cannot feel
          where on the face you caught it, yet strike location quietly drives
          both distance and curve. Dry-erase or foot spray on the face leaves a
          mark showing exactly where contact was: toe, heel, high, low. An impact
          bag trains a hands-forward, flat-lead-wrist delivery with no ball to
          chase.
        </AidBody>
        <AidBody>
          The player who strikes it &ldquo;fine sometimes&rdquo; and loses
          distance for no obvious reason. Off-center contact is usually the
          answer, and you can't fix a pattern you can't see.
        </AidBody>
        <LookFor>
          A can of spray costs a couple of dollars and is the highest-feedback
          aid on this page.
        </LookFor>
      </Aid>

      <Aid
        name="Swing plane aids"
        trains="The path the club travels"
        svg={<SwingPlaneDiagram />}
      >
        <AidBody>
          Swing plane is the tilted circle the club swings around your body. Get
          steep or over the top of it and you fight strike and start direction
          all day. It's hard to feel and easy to misjudge alone. A plane board or
          an angled rod gives the club something to stay under or trace, so an
          over-the-top move turns from a mystery into something obvious.
        </AidBody>
        <AidBody>
          A player with one stubborn miss — a pull or a slice — once contact is
          already repeatable. Not for a brand-new swing still hunting for the
          center of the face; there's nothing stable yet to shape.
        </AidBody>
        <LookFor>
          Simplicity. An alignment stick angled into the ground does most of
          what an expensive plane board does.
        </LookFor>
      </Aid>

      <Aid
        name="Tempo aids"
        trains="The rhythm that holds the swing together"
        svg={<TempoDiagram />}
      >
        <AidBody>
          Tempo is the first thing to leave under pressure — a rushed transition
          wrecks an otherwise sound swing. Tour players hold a remarkably steady
          ratio, the backswing taking roughly three times as long as the
          downswing, while amateurs often drift to four-to-one or worse and
          snatch the club from the top. A metronome or a tones app trains that
          three-to-one feel; a weighted club exaggerates the load so you stop
          rushing.
        </AidBody>
        <AidBody>
          The player whose range swing deserts them on the first tee. Tempo is a
          finishing skill, not a beginner one — there has to be a swing before
          there's a rhythm to smooth.
        </AidBody>
        <LookFor>
          A free metronome app does the job. Don't swing a weighted club
          full-speed cold.
        </LookFor>
      </Aid>

      <Aid
        name="Chipping & pitching aids"
        trains="Landing spot and clean contact near the green"
      >
        <AidBody>
          Short game is feel, and feel needs reps with feedback — but most
          backyard chipping is aimless and trains nothing. A landing target — a
          towel, a hoop, a small net — gives the one thing that actually matters
          in a chip, where it lands, a clear bullseye, so you're rehearsing a
          number instead of just making contact. Impact tape catches the thin and
          fat patterns that wreck short shots.
        </AidBody>
        <AidBody>
          Anyone leaking strokes inside 40 yards, which strokes-gained data says
          is most amateurs.
        </AidBody>
        <LookFor>
          A towel on the ground is a landing target. You don't need a branded
          net.
        </LookFor>
      </Aid>

      <Hr />

      <H3>Launch monitors — the numbers, and which ones are yours</H3>
      <P>
        A launch monitor is the one aid that measures rather than guides. Point
        it at your swing and it reports ball speed, club speed, launch angle,
        spin, carry, total distance, and smash factor — and on better units, club
        path and face angle. The trap is drowning in numbers that aren't yours to
        worry about yet. Here is which is which.
      </P>

      <NumbersTable />

      <Subhead>Free vs paid</Subhead>
      <P>
        Phone apps and sub-$500 units give reliable ball speed, club speed, and
        carry with no subscription — and ball speed is the most stable reading
        even on cheap hardware. Spin and launch get less precise as the price
        drops; the $15,000-and-up commercial units (TrackMan, Foresight) earn
        their cost in spin accuracy and indoor club data, which is why fitters
        and tour players use them. For an amateur, a budget unit that nails carry
        and smash factor measures everything you'd actually act on.
      </P>

      <Subhead>What to do with the data</Subhead>
      <P>
        Build a real yardage chart — most golfers overstate every club by a full
        club, and the monitor settles it honestly. Watch your dispersion, not
        your one longest carry. Use smash factor to tell a club problem from a
        strike problem before you spend money on either. And leave alone the
        numbers you can't change yet: chasing spin optimization before your
        contact repeats is measuring mishits with a very expensive ruler.
      </P>

      <Hr />

      <H3>What most golfers actually need</H3>
      <P>
        Set against the thesis, the honest shortlist is short and cheap. The aids
        worth owning give you feedback you can't get on your own; the rest mostly
        sell the feeling of practice.
      </P>

      <Shortlist />

      <P>
        The pattern holds across all of it: a real training aid shows you
        something you can't see, then gets out of the way. If the skill vanishes
        the moment you set the gadget down, it was a feeling — not a habit you
        built.
      </P>

      <Sources />

      <Footer />
    </article>
  )
}

const UL_STYLE: import('react').CSSProperties = {
  listStyle: 'disc',
  paddingLeft: 22,
  maxWidth: 620,
  marginBottom: 14,
  fontSize: 14,
  lineHeight: 1.6,
  color: '#5C6356',
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

// The opinionated frame: three questions any aid has to pass.
function TheTest() {
  const rows: { q: string; gloss: string }[] = [
    {
      q: '“Does it show me something I can’t see myself?”',
      gloss: 'If you can already feel it, you don’t need a device to tell you.',
    },
    {
      q: '“Can I trust the feedback on every rep?”',
      gloss: 'A gate that lies or a number that bounces around trains nothing.',
    },
    {
      q: '“Does the skill survive when I put it down?”',
      gloss: 'An aid you can’t wean off is a crutch, not a coach.',
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
        The test for any aid
      </div>
      {rows.map((r, i) => (
        <div
          key={r.q}
          style={{
            paddingTop: i === 0 ? 0 : 10,
            marginTop: i === 0 ? 0 : 10,
            borderTop: i === 0 ? 'none' : '1px solid #D9D2BF',
          }}
        >
          <div
            className="font-serif text-caddie-ink"
            style={{ fontSize: 15, fontStyle: 'italic', marginBottom: 3 }}
          >
            {r.q}
          </div>
          <div
            className="text-caddie-ink-dim"
            style={{ fontSize: 14, lineHeight: 1.5 }}
          >
            {r.gloss}
          </div>
        </div>
      ))}
    </div>
  )
}

// One aid category: an optional editorial diagram beside the prose.
function Aid({
  name,
  trains,
  svg,
  children,
}: {
  name: string
  trains: string
  svg?: ReactNode
  children: ReactNode
}) {
  return (
    <div
      style={{
        borderTop: '1px solid #D9D2BF',
        paddingTop: 14,
        marginBottom: 14,
        maxWidth: 660,
      }}
    >
      <div
        style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}
      >
        {svg && <div style={{ flex: '0 0 160px' }}>{svg}</div>}
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div
            className="font-serif text-caddie-ink"
            style={{ fontSize: 18, fontStyle: 'italic', marginBottom: 4 }}
          >
            {name}
          </div>
          <div
            className="text-caddie-ink-dim"
            style={{ fontSize: 14, lineHeight: 1.55, marginBottom: 8 }}
          >
            <Tag>Trains</Tag>
            {trains}
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

function AidBody({ children }: { children: ReactNode }) {
  return (
    <p
      className="text-caddie-ink-dim"
      style={{ fontSize: 14, lineHeight: 1.55, marginBottom: 8 }}
    >
      {children}
    </p>
  )
}

function LookFor({ children }: { children: ReactNode }) {
  return (
    <div className="text-caddie-ink-dim" style={{ fontSize: 14, lineHeight: 1.55 }}>
      <Tag>Look for</Tag>
      {children}
    </div>
  )
}

// Editorial line-art diagrams — hairline strokes, one accent mark total
// (the impact-strike dot), matching DESIGN.md's restrained ink budget.
function SvgPanel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: '#EBE5D6',
        border: '1px solid #D9D2BF',
        borderRadius: 2,
        padding: '12px 12px 8px',
      }}
    >
      {children}
    </div>
  )
}

// Railroad tracks: body parallel-left, clubface on the target line.
function AlignmentDiagram() {
  return (
    <SvgPanel>
      <svg width="100%" viewBox="0 0 160 96" aria-hidden="true" style={{ display: 'block' }}>
        <line x1="36" y1="68" x2="140" y2="30" stroke="#9F9580" strokeWidth="1.5" />
        <line x1="26" y1="84" x2="130" y2="46" stroke="#9F9580" strokeWidth="1.5" />
        <circle cx="36" cy="68" r="4" fill="#1C211C" />
        <circle cx="140" cy="30" r="5" fill="none" stroke="#1C211C" strokeWidth="1.5" />
        <circle cx="140" cy="30" r="1.5" fill="#1C211C" />
      </svg>
    </SvgPanel>
  )
}

// Two tees form a gate the putt must roll through, on line to the hole.
function PuttingGateDiagram() {
  return (
    <SvgPanel>
      <svg width="100%" viewBox="0 0 160 96" aria-hidden="true" style={{ display: 'block' }}>
        <line x1="28" y1="50" x2="134" y2="50" stroke="#9F9580" strokeWidth="1.5" />
        <line x1="74" y1="36" x2="74" y2="44" stroke="#1C211C" strokeWidth="1.5" />
        <line x1="74" y1="56" x2="74" y2="64" stroke="#1C211C" strokeWidth="1.5" />
        <circle cx="28" cy="50" r="4" fill="#1C211C" />
        <circle cx="144" cy="50" r="6" fill="none" stroke="#1C211C" strokeWidth="1.5" />
      </svg>
    </SvgPanel>
  )
}

// Clubface grid; the accent dot is where you actually struck it.
function ImpactFaceDiagram() {
  return (
    <SvgPanel>
      <svg width="100%" viewBox="0 0 160 96" aria-hidden="true" style={{ display: 'block' }}>
        <rect x="56" y="16" width="48" height="64" rx="3" fill="#F2EEE5" stroke="#1C211C" strokeWidth="1.5" />
        <line x1="72" y1="16" x2="72" y2="80" stroke="#D9D2BF" strokeWidth="1" />
        <line x1="88" y1="16" x2="88" y2="80" stroke="#D9D2BF" strokeWidth="1" />
        <line x1="56" y1="37" x2="104" y2="37" stroke="#D9D2BF" strokeWidth="1" />
        <line x1="56" y1="59" x2="104" y2="59" stroke="#D9D2BF" strokeWidth="1" />
        <circle cx="80" cy="48" r="4" fill="none" stroke="#9F9580" strokeWidth="1" />
        <circle cx="92" cy="34" r="3.5" fill="#1F3D2C" />
      </svg>
    </SvgPanel>
  )
}

// The inclined plane; the dashed line is an over-the-top, off-plane move.
function SwingPlaneDiagram() {
  return (
    <SvgPanel>
      <svg width="100%" viewBox="0 0 160 96" aria-hidden="true" style={{ display: 'block' }}>
        <line x1="18" y1="80" x2="144" y2="80" stroke="#D9D2BF" strokeWidth="1.5" />
        <line x1="42" y1="80" x2="138" y2="24" stroke="#9F9580" strokeWidth="1.5" />
        <line x1="42" y1="80" x2="96" y2="18" stroke="#9F9580" strokeWidth="1.5" strokeDasharray="3 3" />
        <line x1="42" y1="80" x2="80" y2="58" stroke="#1C211C" strokeWidth="2.5" />
        <circle cx="42" cy="80" r="4" fill="#1C211C" />
      </svg>
    </SvgPanel>
  )
}

// The backswing runs roughly three times as long as the downswing.
function TempoDiagram() {
  return (
    <SvgPanel>
      <svg width="100%" viewBox="0 0 160 96" aria-hidden="true" style={{ display: 'block' }}>
        <rect x="20" y="32" width="120" height="14" rx="2" fill="#9F9580" />
        <rect x="20" y="56" width="40" height="14" rx="2" fill="#1C211C" />
      </svg>
    </SvgPanel>
  )
}

// Which launch-monitor numbers are an amateur's, and which can wait.
function NumbersTable() {
  const rows: { num: string; who: string }[] = [
    {
      num: 'Carry distance',
      who: 'Everyone. Your real number, not the one good swing — build your gapping from it.',
    },
    {
      num: 'Smash factor',
      who: 'Everyone. Ball speed over club speed: how flush you caught it. Separates a club problem from a strike problem.',
    },
    {
      num: 'Dispersion',
      who: 'Everyone. How tight your pattern is. Reward this over the occasional long bomb.',
    },
    {
      num: 'Ball speed',
      who: 'Everyone. The most reliable number on a budget unit, and the engine behind distance.',
    },
    {
      num: 'Spin rate',
      who: 'Better players and fittings. Dials in flight once contact repeats — and the least accurate reading on cheap units.',
    },
    {
      num: 'Path & face angle',
      who: 'Coaches and better players. Face angle alone sets about 85% of your start line — worth knowing, hard to change without help.',
    },
  ]
  return (
    <div style={{ maxWidth: 640, marginBottom: 18, borderTop: '1px solid #D9D2BF' }}>
      {rows.map((r) => (
        <div
          key={r.num}
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
            style={{ fontSize: 15, fontStyle: 'italic', flex: '0 0 120px' }}
          >
            {r.num}
          </div>
          <div className="text-caddie-ink-dim" style={{ fontSize: 14, lineHeight: 1.5 }}>
            {r.who}
          </div>
        </div>
      ))}
    </div>
  )
}

// The honest buy/skip list, set against the thesis.
function Shortlist() {
  return (
    <div style={{ maxWidth: 640, marginBottom: 14 }}>
      <Subhead>Worth owning</Subhead>
      <ul style={UL_STYLE}>
        <li>
          <strong>Two alignment sticks</strong> — or two clubs. Aim, ball
          position, and a rough swing plane, all from one cheap pair.
        </li>
        <li>
          <strong>A mirror</strong> — putting setup and a square face, the
          cheapest strokes to find at home.
        </li>
        <li>
          <strong>Impact spray or tape</strong> — the unvarnished truth about
          where you strike it.
        </li>
        <li>
          <strong>A landing towel</strong> — turns aimless chipping into reps at
          a real target.
        </li>
        <li>
          <strong>A free metronome app</strong> — tempo, for nothing.
        </li>
      </ul>

      <Subhead>Skip, or wait</Subhead>
      <ul style={UL_STYLE}>
        <li>
          Anything promising speed or distance from swinging it through the air
          alone.
        </li>
        <li>Single-purpose gadgets that just duplicate a three-dollar stick.</li>
        <li>
          A premium launch monitor before your carry and contact repeat — you'll
          only be measuring mishits.
        </li>
        <li>
          Aids that work in the yard but never make it to the course, where the
          skill has to show up.
        </li>
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
          <SrcLabel>Why alignment is foundational</SrcLabel>
          <SrcBody>
            <Src href="https://www.pga.com/story/4-alignment-mistakes-killing-your-golf-game-and-how-to-fix-them">
              PGA of America · 4 alignment mistakes
            </Src>{' '}
            and{' '}
            <Src href="https://golf.com/instruction/why-aim-alignment-poor-how-fix/">
              Golf.com · why your aim is poor
            </Src>{' '}
            — most golfers aim off the target without feeling it, and small
            errors miss by yards over distance.
          </SrcBody>
        </div>
        <div>
          <SrcLabel>Face angle sets the start line</SrcLabel>
          <SrcBody>
            <Src href="https://www.trackman.com/blog/golf/what-is-face-angle">
              TrackMan · what is face angle
            </Src>{' '}
            and{' '}
            <Src href="https://www.trackman.com/blog/golf/6-trackman-numbers-all-amateur-golfers-should-know">
              6 numbers every amateur should know
            </Src>{' '}
            — the clubface controls roughly 85% of where the ball starts, which
            is why putting and impact aids train a square strike.
          </SrcBody>
        </div>
        <div>
          <SrcLabel>Tempo — the three-to-one ratio</SrcLabel>
          <SrcBody>
            <Src href="https://tourtempo.com/pages/tour-tempo-app">Tour Tempo</Src>{' '}
            on the 3:1 backswing-to-downswing finding, and{' '}
            <Src href="https://www.pga.com/story/find-a-rhythm-and-tempo-that-fits-your-game">
              PGA of America · rhythm and tempo
            </Src>{' '}
            — tour players hold a steady ratio; amateurs often rush the
            transition.
          </SrcBody>
        </div>
        <div>
          <SrcLabel>Launch monitors — which numbers, and what they cost</SrcLabel>
          <SrcBody>
            <Src href="https://www.trackman.com/blog/golf/the-ultimate-guide-to-understanding-trackman">
              TrackMan · the ultimate guide to the data
            </Src>{' '}
            and{' '}
            <Src href="https://mygolfspy.com/buyers-guide/we-tested-12-launch-monitors-ranging-from-500-to-5000-whats-the-real-difference/">
              MyGolfSpy · $500 to $5,000 tested
            </Src>{' '}
            — ball speed and carry are reliable on budget units; spin and launch
            precision are what the expensive ones buy.
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
