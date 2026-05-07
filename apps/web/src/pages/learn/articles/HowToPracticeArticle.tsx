const DEV = import.meta.env.DEV

export function HowToPracticeArticle() {
  return (
    <article
      id="how-to-practice"
      style={{
        borderTop: '1px solid #D9D2BF',
        paddingTop: 22,
        marginBottom: 32,
      }}
    >
      <div className="kicker" style={{ marginBottom: 14 }}>
        Improving your game · Draft
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
        How to practice.
      </h2>

      <H3>The uncomfortable truth</H3>
      <P>
        Most golfers practice in a way that feels productive but
        isn't. They hit a bucket of balls, stripe a few drives, feel
        good, and leave. Their handicap doesn't move.
      </P>
      <P>
        This isn't laziness. It's that no one ever explained what
        practice is actually for — or that there's a difference
        between hitting balls and getting better.
      </P>
      <P>
        There's nothing wrong with going to the range to unwind, enjoy
        the weather, or just swing a club. That's a legitimate and
        enjoyable thing to do. But if your goal is to improve, that's
        a different activity and it requires a different approach.
      </P>

      <Hr />

      <H3>What practice is actually for</H3>
      <P>
        Practice exists to change your behavior on the golf course.
        Not to feel good on the range. Not to hit your best shots. To
        change what you do under pressure, on uneven lies, with
        something at stake.
      </P>
      <P>
        If your practice doesn't eventually show up on the course, it
        wasn't practice — it was entertainment. Which, again, is
        fine. Just know which one you're doing.
      </P>

      <Hr />

      <H3>The four types of practice</H3>

      <H4>Block practice</H4>
      <Kv label="What it is">
        Repeating the same shot over and over. 50 7-irons in a row to
        the same target.
      </Kv>
      <Kv label="Good for">
        Learning a brand new movement. If you're working on a swing
        change with your coach, some repetition helps establish the
        new pattern. Use it sparingly and early.
      </Kv>
      <Kv label="Not good for">
        Building skills that transfer to the course. Research
        consistently shows that improvement during block practice
        doesn't stick. You get better within the session and worse
        by the next round.
      </Kv>
      <Kv label="The trap">
        Block practice feels like learning because you do get better
        within the session. That feeling is misleading. It is one of
        the most well-replicated findings in motor learning research.
      </Kv>
      <EditorialNote variant="research">
        Research basis: Robert Bjork (UCLA) — contextual interference
        effect. See also: "Make It Stick" by Brown, Roediger,
        McDaniel.
      </EditorialNote>
      <EditorialNote variant="todo">
        TODO: Add specific study citations
      </EditorialNote>

      <H4>Random practice</H4>
      <Kv label="What it is">
        Varying every shot. 7-iron, driver, wedge, 5-iron — never
        hitting the same club twice in a row.
      </Kv>
      <Kv label="Good for">
        Building skills that actually transfer to the course. The
        research on this is consistent across many studies. Random
        practice feels harder and messier but produces dramatically
        better retention.
      </Kv>
      <Kv label="Why it works">
        Each time you pick up a different club, your brain has to
        fully reconstruct the motor pattern from scratch. That
        reconstruction process is where learning happens.
      </Kv>
      <Kv label="Not good for">
        Learning a brand new movement. Don't randomize before you
        have a basic pattern to work with.
      </Kv>
      <EditorialNote variant="research">
        Research basis: Contextual interference effect, Battig
        (1979), confirmed in many subsequent studies.
      </EditorialNote>
      <EditorialNote variant="todo">
        TODO: Verify whether the beginner exception is
        well-established or still debated
      </EditorialNote>

      <H4>Variable practice</H4>
      <Kv label="What it is">
        Same club, different conditions. 9-iron from 100 yards, then
        90, then uphill, then into wind, then from a downslope.
      </Kv>
      <Kv label="Good for">
        Building adaptability. Golf never gives you the same shot
        twice. Variable practice trains you for that reality.
      </Kv>
      <Kv label="Combine it with">
        Random practice for maximum transfer.
      </Kv>

      <H4>Pressure practice</H4>
      <Kv label="What it is">
        Creating consequences in practice. Something is at stake on
        each shot.
      </Kv>
      <Kv label="Examples">
        <ul style={UL_STYLE}>
          <li>Make 5 putts in a row from 6 feet or start over from 0</li>
          <li>Last ball in your bucket must hit a specific target</li>
          <li>
            Play a simulated 9 holes on the range — pick targets, keep
            score
          </li>
          <li>
            Clock drill: 12 balls around the hole at 3 feet (clock
            positions), make all 12 in a row or start over
          </li>
        </ul>
      </Kv>
      <Kv label="Good for">
        Training your nervous system to perform under pressure. If
        you've never practiced with consequences, your body hasn't
        learned how to handle them on the course.
      </Kv>
      <EditorialNote variant="research">
        Research basis: Dr. Sian Beilock — "Choke" (2010). Bob Rotella
        — "Golf Is Not a Game of Perfect" (1995).
      </EditorialNote>
      <EditorialNote variant="todo">
        TODO: Add more specific pressure practice examples from tour
        player documented routines
      </EditorialNote>

      <Hr />

      <H3>How to structure a session</H3>
      <P>
        A well-structured session has a flow. Adjust based on your
        time and current focus area.
      </P>
      <SessionTable />
      <EditorialNote variant="todo">
        TODO: Review these time allocations with a teaching
        professional. The short game / full swing split in
        particular (Dave Pelz suggests ~60% short game) needs more
        exploration.
      </EditorialNote>

      <Hr />

      <H3>Having a goal for the session</H3>
      <P>
        Before you hit a single ball, decide what you're trying to
        accomplish today.
      </P>
      <ul style={UL_STYLE}>
        <li>
          <strong>Bad goal:</strong> Work on my irons.
        </li>
        <li>
          <strong>Better goal:</strong> Work on my ball striking.
        </li>
        <li>
          <strong>Good goal:</strong> Hit 7 of 10 approach shots
          within 20 yards of the target from 150 yards.
        </li>
      </ul>
      <P>
        The difference is measurability. If you can't tell whether
        you achieved your goal, it wasn't a goal — it was a vague
        intention.
      </P>
      <P>
        Your OGA strokes gained data tells you exactly where to
        focus. If you're losing 1.2 strokes per round on approach
        shots, that's your focus area. Your practice goal should be
        specific to that weakness.
      </P>
      <H4>How to quantify your practice</H4>
      <ul style={UL_STYLE}>
        <li>Track your success rate on pressure games over time</li>
        <li>Note which club and distance you practiced</li>
        <li>Write down what you worked on and what changed</li>
        <li>Connect practice focus to round data over time</li>
      </ul>

      <Hr />

      <H3>What bad practice looks like</H3>

      <H4>The range bucket spiral</H4>
      <P>
        Buy a large bucket. Hit wedges, feel good. Move to 7-iron,
        stripe a few. Pull out the driver. Spend 45 minutes hitting
        drivers because that's the most fun. Leave feeling like you
        worked hard. Nothing about your game changed.
      </P>

      <H4>Same shot, same target, same lie</H4>
      <P>
        You struggle with your 6-iron so you hit 60 6-irons to the
        same target from a flat lie. On the course you face a 6-iron
        from a downslope with water left. These are completely
        different skills.
      </P>

      <H4>Practicing your strengths</H4>
      <P>
        You putt well so you skip the green. You hit your driver well
        so you spend an hour on the tee line. Improvement comes from
        addressing weaknesses, not reinforcing strengths.
      </P>

      <H4>No target, no feedback</H4>
      <P>
        Hitting shots without a specific target or any way to evaluate
        the result is exercise, not practice. Useful and enjoyable —
        but not improvement.
      </P>

      <H4>Working on technique under pressure</H4>
      <P>
        The course is for playing. The range is for working on
        technique. Working on a swing change during a round rarely
        ends well.
      </P>

      <Hr />

      <H3>Practice round vs scoring round</H3>
      <P>
        Two completely different activities. Mixing them is one of
        the most common mistakes amateurs make.
      </P>
      <Kv label="Practice round mode">
        Experiment. Try the risky shot. Play from a bad lie on
        purpose. Hit two balls. Explore. Score doesn't matter —
        you're gathering information.
      </Kv>
      <Kv label="Scoring round mode">
        Full pre-shot routine on every shot. Full commitment. No
        mulligans. Track everything. This is performance mode.
      </Kv>
      <P>
        The mistake is being half-committed to both — sort of
        practicing, sort of scoring. You get the anxiety of
        performance without the data of tracking, and the
        experimentation of practice without the freedom of no
        consequences.
      </P>
      <P>
        Before you tee off, decide which mode you're in and commit to
        it fully.
      </P>

      <Hr />

      <H3>Resources</H3>
      <EditorialNote variant="todo">
        These are starting points for further research, not
        endorsements. Verify all links are current before publishing.
      </EditorialNote>

      <H4>Books</H4>
      <ResourceList
        items={[
          {
            title: '"Make It Stick"',
            by: 'Brown, Roediger, McDaniel.',
            note: 'Best plain-language summary of learning science. Not golf-specific but directly applicable.',
          },
          {
            title: '"Golf Is Not a Game of Perfect"',
            by: 'Bob Rotella.',
            note: 'Standard text on golf psychology and performance.',
          },
          {
            title: '"Dave Pelz\'s Short Game Bible"',
            note: 'Research-based approach to practice from inside 100 yards.',
          },
          {
            title: '"Harvey Penick\'s Little Red Book"',
            note: 'The most beloved golf instruction book ever written. Simple, wise, feel-based.',
          },
          {
            title: '"Peak"',
            by: 'Anders Ericsson.',
            note: 'His own account of deliberate practice research. Better than the Gladwell version.',
          },
          {
            title: '"Choke"',
            by: 'Sian Beilock.',
            note: 'Accessible neuroscience of performance under pressure.',
          },
        ]}
      />

      <H4>Research worth knowing</H4>
      <ul style={UL_STYLE}>
        <li>
          Robert Bjork — contextual interference, desirable
          difficulties (UCLA)
        </li>
        <li>
          Anders Ericsson — deliberate practice and expert performance
        </li>
        <li>
          Gabriele Wulf — attentional focus research showing external
          focus cues outperform internal focus cues
        </li>
        <li>Sian Beilock — choking under pressure</li>
      </ul>

      <H4>Online resources</H4>
      <ul style={UL_STYLE}>
        <li>
          TPI (Titleist Performance Institute):{' '}
          <a
            href="https://mytpi.com"
            target="_blank"
            rel="noreferrer"
            style={{ color: '#1F3D2C', textDecoration: 'underline' }}
          >
            mytpi.com
          </a>
        </li>
        <li>
          Robert Bjork's lab:{' '}
          <a
            href="https://bjorklab.psych.ucla.edu"
            target="_blank"
            rel="noreferrer"
            style={{ color: '#1F3D2C', textDecoration: 'underline' }}
          >
            bjorklab.psych.ucla.edu
          </a>
          <EditorialNote variant="todo" inline>
            TODO: Verify this URL is current
          </EditorialNote>
        </li>
      </ul>

      <Footer />
    </article>
  )
}

// ===========================================================================
// Components
// ===========================================================================

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="font-serif text-caddie-ink"
      style={{
        fontSize: 22,
        fontWeight: 500,
        fontStyle: 'italic',
        letterSpacing: '-0.01em',
        lineHeight: 1.2,
        marginTop: 22,
        marginBottom: 14,
      }}
    >
      {children}
    </h3>
  )
}

function H4({ children }: { children: React.ReactNode }) {
  return (
    <h4
      className="font-serif text-caddie-ink"
      style={{
        fontSize: 17,
        fontWeight: 500,
        fontStyle: 'italic',
        marginTop: 18,
        marginBottom: 8,
      }}
    >
      {children}
    </h4>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-caddie-ink"
      style={{
        fontSize: 15,
        lineHeight: 1.6,
        maxWidth: 680,
        marginBottom: 14,
      }}
    >
      {children}
    </p>
  )
}

function Kv({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12, maxWidth: 680 }}>
      <span
        className="font-serif text-caddie-ink"
        style={{
          fontSize: 15,
          fontWeight: 500,
          fontStyle: 'italic',
        }}
      >
        {label}.
      </span>{' '}
      <span
        className="text-caddie-ink"
        style={{ fontSize: 15, lineHeight: 1.6 }}
      >
        {children}
      </span>
    </div>
  )
}

function Hr() {
  return (
    <div
      style={{
        borderTop: '1px solid #D9D2BF',
        margin: '22px 0',
      }}
    />
  )
}

const UL_STYLE: React.CSSProperties = {
  listStyle: 'disc',
  paddingLeft: 20,
  margin: '8px 0 14px',
  fontSize: 15,
  lineHeight: 1.7,
  color: '#1C211C',
  maxWidth: 680,
}

function SessionTable() {
  const rows = [
    { phase: 'Warm up', dur: '10–15 min', why: 'Easy wedges, get body ready. Not practice time.' },
    { phase: 'Skill work', dur: '20–30 min', why: 'Current focus area. Deliberate, with feedback.' },
    { phase: 'Random / variable', dur: '20–30 min', why: 'Whole bag, random clubs, real targets.' },
    { phase: 'Pressure games', dur: '10–15 min', why: 'Consequences on every shot. Keep score.' },
    { phase: 'Short game', dur: '15–20 min', why: 'Chipping and pitching. Don’t skip.' },
    { phase: 'Putting', dur: '10–15 min', why: 'Always end on the green. End by holing putts.' },
  ]
  return (
    <div style={{ borderTop: '1px solid #D9D2BF', marginTop: 14, marginBottom: 18 }}>
      {rows.map((r) => (
        <div
          key={r.phase}
          className="grid grid-cols-1 sm:grid-cols-[1.2fr_0.8fr_2.5fr]"
          style={{
            gap: 14,
            padding: '12px 0',
            borderBottom: '1px solid #D9D2BF',
            alignItems: 'baseline',
          }}
        >
          <div
            className="font-serif text-caddie-ink"
            style={{ fontSize: 15, fontWeight: 500, fontStyle: 'italic' }}
          >
            {r.phase}
          </div>
          <div
            className="font-mono tabular text-caddie-ink-dim"
            style={{ fontSize: 12, letterSpacing: '0.05em' }}
          >
            {r.dur}
          </div>
          <div className="text-caddie-ink-dim" style={{ fontSize: 14, lineHeight: 1.5 }}>
            {r.why}
          </div>
        </div>
      ))}
    </div>
  )
}

interface ResourceItem {
  title: string
  by?: string
  note: string
}

function ResourceList({ items }: { items: ResourceItem[] }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 14px', maxWidth: 680 }}>
      {items.map((r) => (
        <li
          key={r.title}
          style={{
            padding: '12px 0',
            borderTop: '1px solid #D9D2BF',
          }}
        >
          <div
            className="font-serif text-caddie-ink"
            style={{ fontSize: 15, fontWeight: 500, fontStyle: 'italic' }}
          >
            {r.title}
            {r.by && (
              <span className="text-caddie-ink-dim" style={{ fontStyle: 'normal', fontWeight: 400 }}>
                {' '}— {r.by}
              </span>
            )}
          </div>
          <div className="text-caddie-ink-dim" style={{ fontSize: 14, lineHeight: 1.55, marginTop: 4 }}>
            {r.note}
          </div>
        </li>
      ))}
    </ul>
  )
}

function EditorialNote({
  variant,
  inline,
  children,
}: {
  variant: 'research' | 'todo'
  inline?: boolean
  children: React.ReactNode
}) {
  if (!DEV) return null
  const tone = variant === 'research' ? '#1F3D2C' : '#A66A1F'
  const label = variant === 'research' ? 'Source' : 'Todo'
  if (inline) {
    return (
      <span
        className="font-mono uppercase"
        style={{
          fontSize: 10,
          letterSpacing: '0.14em',
          color: tone,
          marginLeft: 8,
        }}
      >
        [{label}: {children}]
      </span>
    )
  }
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
      Last reviewed May 2026 · Draft, needs instructor review · Edit
      docs/learn/how-to-practice.md to contribute
    </div>
  )
}
