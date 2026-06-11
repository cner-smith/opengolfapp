import { SrcBody, SrcLabel } from '../components/ArticlePrimitives'
import type { CSSProperties, ReactNode } from 'react'

export function SwingVariationsArticle() {
  return (
    <article
      id="swing-variations"
      style={{
        borderTop: '1px solid #D9D2BF',
        paddingTop: 22,
        marginBottom: 32,
      }}
    >
      <div className="kicker" style={{ marginBottom: 14 }}>
        Improving your game · Swing variations
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
        Swing your swing.
      </h2>

      <P>
        Almost all golf instruction quietly assumes one student: a flexible,
        able-bodied, average-height, right-handed player with a full, painless
        turn. If that's not you — and for most golfers it isn't — a tip built for
        that body can be useless or worse. The evidence for this is sitting in the
        Hall of Fame, where some of the best players who ever lived swung in ways
        a textbook would red-pen. There is no single correct golf swing. There is,
        however, an <em>easier</em> swing for your body — one that's more
        repeatable and less likely to hurt you — and a well-trained coach is the
        fastest way to find it.
      </P>

      <Hr />

      <H3>Before you take advice from anyone</H3>
      <P>
        Generic tips are optimized for the average golfer. Before you take one
        from a video or an article, run it through a few honest questions:
      </P>
      <Checklist
        items={[
          'Am I as flexible as this instructor assumes?',
          'Do I have an injury or limitation that affects how far I can rotate?',
          'Is this person built like me — similar height, age, mobility?',
          'Is this tip aimed at my actual miss, or is it generic?',
          'Is it written for my handedness?',
          'What is it quietly assuming about my swing that may not be true of mine?',
        ]}
      />
      <P>
        None of this means ignore instruction. It means apply it critically — a
        tip that transformed someone built nothing like you is a hypothesis for
        your swing, not a prescription.
      </P>

      <Hr />

      <H3>The proof: great swings that broke the rules</H3>
      <P>
        If there were one correct swing, the best players in the world would all
        own it. They emphatically don't. A short, non-exhaustive list of
        "incorrect" swings that won at the highest level:
      </P>
      <HallOfFame />
      <P>
        The pattern isn't that technique doesn't matter — it matters enormously.
        It's that each of these players found a motion that was repeatable for{' '}
        <em>their</em> body and then owned it, instead of grinding toward a
        position someone else's body was built for.
      </P>

      <Hr />

      <H3>Every striking sport finds the same thing</H3>
      <P>
        Golf isn't special here. Sports science has spent decades studying how
        athletes swing implements and throw objects — baseball pitches and swings,
        the tennis serve, the javelin and hammer, cricket, hockey — and two
        findings keep surfacing that map straight onto the golf swing.
      </P>
      <P>
        The first: there is no single optimal movement. The motor-control pioneer
        Nikolai Bernstein described skilled action as{' '}
        <em>"repetition without repetition"</em> — even an expert never repeats a
        motion exactly, and, counterintuitively, experts vary <em>more</em> than
        beginners, because many different movement solutions reach the same
        result. Studies of elite throwers land in the same place, calling for
        individualized technical profiling rather than one template for everyone.
      </P>
      <P>
        The second: what good technique shares isn't a position, it's a sequence.
        Across pitching, the tennis serve, the javelin and the rest, power comes
        from a kinetic chain that fires from the ground up — legs and trunk first,
        then out to the fast, distal end: the hand, the racquet head, the
        clubface. The shape of the motion varies from athlete to athlete; the
        order doesn't. It's why a shorter, well-sequenced backswing so often beats
        a long one that loses its timing — the same thing a pitching coach drills.
      </P>
      <P>
        Together they're just "swing your swing" in lab form: build a motion your
        body can sequence and repeat, rather than chasing a specific position
        borrowed from a body unlike yours. The Hall of Fame and the biomechanics
        literature agree.
      </P>

      <Hr />

      <H3>Your body shapes your swing</H3>
      <P>
        Height, build, mobility, and handedness all change what a sound setup and
        swing look like for you. These are tendencies, not rules — but they're a
        better starting point than a one-size template.
      </P>
      <BodyTypeTable />
      <P>
        Notice how much of this is about equipment as well as motion. A swing and
        the clubs that swing it are one system; fitting one to your body without
        the other leaves performance on the table.
      </P>

      <Hr />

      <H3>Schools of thought</H3>
      <P>
        "Swing plane" — roughly, how upright or flat the club travels — is where
        much of the genuine expert disagreement lives. These are perspectives with
        serious adherents, not a ranking. Most of the debate runs along a line
        from steep and upright to flat and rotary, with single-plane methods at
        one end.
      </P>
      <PlaneSpectrum />
      <ul style={UL_STYLE}>
        <li>
          <strong>The modern tour swing.</strong> Big separation between the
          shoulders and hips at the top — what Jim McLean popularized in 1992 as
          the <em>X-Factor</em> — plus heavy use of the ground for speed. It's
          what most online instruction assumes, and it produces enormous power.
          It also asks for real flexibility, and its importance is genuinely
          disputed: a number of teachers argue that chasing maximum X-Factor adds
          lower-back stress for modest gain. Powerful, but not free, and not for
          every body.
        </li>
        <li>
          <strong>The classic flatter plane (Hogan).</strong> Ben Hogan's{' '}
          <em>Five Lessons</em> and its famous "pane of glass" image describe a
          flatter, on-plane move that's still hugely influential. Tellingly, even
          Hogan's plane isn't universal: as instructors have long noted, shorter
          players tend to work above that pane and taller players below it — proof
          that the most famous swing model in print still has to bend to the body
          using it.
        </li>
        <li>
          <strong>The single-plane swing (Moe Norman / Graves).</strong> Club,
          arms, and body set on essentially one plane at address and impact,
          stripping out moving parts. Moe Norman — whom Sam Snead and others
          called the greatest ball-striker who ever lived — built it intuitively;
          Todd Graves, taught directly by Norman, now teaches it through the
          Graves Golf Academy. Fewer moving parts and low spinal stress make it
          worth a look for players who fight conventional complexity or have back
          limitations.
        </li>
        <li>
          <strong>Stack and Tilt.</strong> Created by instructors Mike Bennett and
          Andy Plummer, it keeps the weight forward over the lead side throughout
          the swing to kill lateral sway. Controversial, but with real tour
          adherents over the years (Aaron Baddeley and Mike Weir among them), and
          potentially friendlier to limited hip mobility.
        </li>
        <li>
          <strong>Rotary, body-driven methods.</strong> A family of approaches
          that lead with body rotation over hand and arm manipulation, on the
          argument that fewer timing-dependent parts make the swing more
          repeatable and easier on the body.
        </li>
      </ul>

      <P>
        Other respected methods aren't really about plane at all — they're about
        making the motion simpler, more repeatable, or kinder to the body, which
        is the same goal reached through a different door.
      </P>
      <ul style={UL_STYLE}>
        <li>
          <strong>Peak Performance (Don Trahan).</strong> A short, vertical,
          limited-turn backswing — "a little turn, a lot of lift" — that Trahan
          built with orthopedic input to be easy on the back and friendly to
          players who've lost flexibility, while arguing it gives up little or no
          clubhead speed.
        </li>
        <li>
          <strong>The A Swing (David Leadbetter).</strong> An "alternative" that
          rebuilds the backswing to be simpler and more repeatable, so the
          downswing becomes mostly a reaction — aimed squarely at golfers who
          can't groove the conventional move.
        </li>
        <li>
          <strong>Swing the clubhead (Manuel de la Torre).</strong> A feel-first
          school in the Ernest Jones tradition: focus on swinging the club itself
          rather than choreographing body positions, trusting the body to follow a
          correct clubhead motion. De la Torre was the PGA's first National
          Teacher of the Year, in 1986.
        </li>
      </ul>

      <P>
        The honest takeaway is not "pick the right one." It's that a method which
        transforms one golfer can fight another's body outright — so the question
        is never "which swing is correct," but "which of these fits the body I
        actually have."
      </P>

      <Hr />

      <H3>Physical conditions and adaptations</H3>
      <Callout>
        <strong>This is general information, not medical advice.</strong> If you
        have any of the conditions below, get cleared by a medical professional
        and work with a TPI-certified instructor <em>before</em> changing your
        swing or starting intensive practice. The notes here are starting points
        for that conversation, not prescriptions.
      </Callout>
      <ul style={UL_STYLE}>
        <li>
          <strong>Scoliosis.</strong> Spinal curvature can make a high-torque
          rotational swing a poor fit; a flatter, more arms-based or single-plane
          motion may put less stress on the spine. This is exactly the case for a
          physical screening before any intensive change.
        </li>
        <li>
          <strong>Hip replacement or hip limitations.</strong> Weight shift and
          hip clearance are affected. Methods that reduce lateral movement (such
          as single-plane or weight-forward styles) and a wider, more stable
          stance can lower the demand on the hip.
        </li>
        <li>
          <strong>Shoulder injury or limited shoulder mobility.</strong> Backswing
          length and follow-through are the first things to give. A shorter, more
          controlled backswing that prioritizes solid contact usually beats
          forcing a full turn you don't have.
        </li>
        <li>
          <strong>Back injury or fused vertebrae.</strong> When rotation is
          restricted or gone, arms-dominant, minimal-rotation swings are the
          adaptation, and Moe Norman's low-stress single-plane motion is worth
          studying. Medical clearance first, always.
        </li>
        <li>
          <strong>One-arm and adaptive golfers.</strong> Competitive one-arm and
          adaptive players exist and thrive. The mechanics are genuinely different,
          not a tweak of the standard swing, and specialized adaptive instruction
          exists to teach them.
        </li>
      </ul>

      <Hr />

      <H3>How a good coach finds your swing</H3>
      <P>
        This is where a well-trained teacher earns their fee. The Titleist
        Performance Institute (TPI) has done the most rigorous work on what it
        calls the <em>body-swing connection</em> — mapping specific physical
        limitations to the swing characteristics they tend to produce. A TPI
        screening identifies what your body can and can't do <em>before</em> you
        try to change anything, which is often more valuable than any single swing
        tip.
      </P>
      <P>
        That's the practical core of "swing your swing." A good coach assesses
        your body first and prescribes to it; a good fitter measures your impact
        and ball flight rather than textbook numbers; and the right equipment is
        built to fit the swing your body actually makes. As the companion guides on
        lessons and on the questions to ask your coach put it — the teacher worth
        hiring is the one who looks at you before they look at a model.
      </P>

      <Hr />

      <H3>The bottom line</H3>
      <P>
        "Swing your swing" isn't lazy advice. It's the most sophisticated advice
        in golf. There is no one correct swing — the Hall of Fame settles that —
        but there is a swing that's easier, more repeatable, and safer for your
        particular body. Find your constraints honestly, build a motion that works
        within them, fit your equipment to that motion, and work with a coach who
        starts from your body and not a textbook. That, not copying a position
        built for someone else, is the actual path to better golf.
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

// A how-to-apply takeaway / disclaimer lifted out of the prose.
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

// The self-awareness questions to run before taking a generic tip.
function Checklist({ items }: { items: string[] }) {
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
        Run this before you copy a tip
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((item) => (
          <li
            key={item}
            className="text-caddie-ink"
            style={{
              fontSize: 14,
              lineHeight: 1.5,
              marginBottom: 9,
              paddingLeft: 18,
              position: 'relative',
            }}
          >
            <span
              aria-hidden="true"
              style={{ position: 'absolute', left: 0, color: '#1F3D2C' }}
            >
              ?
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

// Sidebar-style cards: unconventional swings that won at the top.
function HallOfFame() {
  const players: { name: string; quirk: string; result: string }[] = [
    {
      name: 'Jim Furyk',
      quirk: 'A double-loop swing no coach would teach from scratch.',
      result: 'Won the 2003 U.S. Open; shot 58, the lowest round in PGA Tour history.',
    },
    {
      name: 'Lee Trevino',
      quirk: 'Open stance, a deliberate fade, self-taught — told for years to change it.',
      result: 'Six major championships. Hall of Fame.',
    },
    {
      name: 'Nancy Lopez',
      quirk: 'A pronounced "flying" right elbow every textbook warns against.',
      result: '48 LPGA Tour wins and a Hall of Fame career.',
    },
    {
      name: 'Moe Norman',
      quirk: 'A single-plane swing dismissed for decades as eccentric.',
      result: 'Sam Snead and others called him the greatest ball-striker who ever lived.',
    },
    {
      name: 'John Daly',
      quirk: '"Grip it and rip it" — a backswing well past parallel.',
      result: 'Two major championships: the 1991 PGA and the 1995 Open.',
    },
    {
      name: 'Gary Player',
      quirk: 'Smaller stature; a swing he kept reshaping as he aged.',
      result: 'Nine majors, and competitive into his 70s.',
    },
  ]
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 12,
        maxWidth: 680,
        marginBottom: 16,
      }}
    >
      {players.map((p) => (
        <div
          key={p.name}
          style={{
            border: '1px solid #D9D2BF',
            background: '#EBE5D6',
            borderRadius: 2,
            padding: '12px 14px',
          }}
        >
          <div
            className="font-serif text-caddie-ink"
            style={{ fontSize: 16, fontStyle: 'italic', marginBottom: 6 }}
          >
            {p.name}
          </div>
          <div className="text-caddie-ink-dim" style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 6 }}>
            {p.quirk}
          </div>
          <div
            className="text-caddie-ink"
            style={{ fontSize: 13, lineHeight: 1.5, fontWeight: 500, color: '#1F3D2C' }}
          >
            {p.result}
          </div>
        </div>
      ))}
    </div>
  )
}

// Body type → swing/equipment tendency. Tendencies, not rules.
function BodyTypeTable() {
  const rows: { type: string; note: string }[] = [
    {
      type: 'Taller (6′2″+)',
      note: 'Tend to stand more upright, with a flatter natural plane. Usually need longer clubs and flatter lie angles — off-the-rack clubs are built to a standard, not to you.',
    },
    {
      type: 'Shorter',
      note: 'Stand closer to the ball with a more upright shaft angle; an upright plane is natural and correct here. Shorter clubs and more upright lie angles often fit better.',
    },
    {
      type: 'Limited flexibility / older',
      note: 'A restricted turn changes everything. A shorter backswing with good sequencing beats a long one that collapses; force the “modern” power move and you risk injury. Gary Player’s swing evolved with his body for a reason.',
    },
    {
      type: 'Heavier build',
      note: 'A restricted hip turn is common, and compensating with more arm swing is adaptive, not wrong. Grip size and shaft flex fitting matter more, not less; standing a touch further from the ball can help.',
    },
    {
      type: 'Left-handed',
      note: 'Most instruction is written for righties — mirror the cues. Left-handed equipment is more limited, so custom fitting matters even more.',
    },
  ]
  return (
    <div style={{ maxWidth: 660, marginBottom: 16, borderTop: '1px solid #D9D2BF' }}>
      {rows.map((r) => (
        <div
          key={r.type}
          style={{
            display: 'flex',
            gap: 16,
            padding: '12px 0',
            borderBottom: '1px solid #D9D2BF',
            alignItems: 'baseline',
            flexWrap: 'wrap',
          }}
        >
          <div
            className="font-serif text-caddie-ink"
            style={{ fontSize: 15, fontStyle: 'italic', flex: '0 0 168px' }}
          >
            {r.type}
          </div>
          <div
            className="text-caddie-ink-dim"
            style={{ fontSize: 14, lineHeight: 1.5, flex: '1 1 280px', minWidth: 0 }}
          >
            {r.note}
          </div>
        </div>
      ))}
    </div>
  )
}

// Editorial line-art: the shaft plane from upright to flat, with single-plane
// shown as arms-and-shaft aligned. Hairline strokes; the single plane in accent.
function PlaneSpectrum() {
  return (
    <div style={{ maxWidth: 420, marginBottom: 18 }}>
      <div
        style={{
          background: '#EBE5D6',
          border: '1px solid #D9D2BF',
          borderRadius: 2,
          padding: '14px 12px 8px',
        }}
      >
        <svg width="100%" viewBox="0 0 240 120" aria-hidden="true" style={{ display: 'block' }}>
          {/* ground + ball, shared origin at lower right */}
          <line x1="20" y1="100" x2="220" y2="100" stroke="#9F9580" strokeWidth="1.5" />
          <circle cx="190" cy="100" r="3" fill="#1C211C" />
          {/* All three are believable swing-plane angles fanning up from the
              ball — upright steepest (~63°), flat shallower (~45°), single
              plane the flattest (~33°). The old single-plane line sat ~13°,
              almost flat on the ground, which read as broken. */}
          {/* upright (steep) plane ~63° */}
          <line x1="190" y1="100" x2="147" y2="16" stroke="#9F9580" strokeWidth="2" />
          {/* flat (Hogan) plane ~45° */}
          <line x1="190" y1="100" x2="108" y2="18" stroke="#9F9580" strokeWidth="2" />
          {/* single plane (accent), flattest ~33° */}
          <line x1="190" y1="100" x2="72" y2="24" stroke="#1F3D2C" strokeWidth="2.5" />
          <text x="150" y="13" fontSize="7" fontFamily="monospace" letterSpacing="0.5" fill="#8A8B7E">
            UPRIGHT
          </text>
          <text x="86" y="13" fontSize="7" fontFamily="monospace" letterSpacing="0.5" fill="#8A8B7E">
            FLAT
          </text>
          <text x="14" y="22" fontSize="7" fontFamily="monospace" letterSpacing="0.5" fill="#1F3D2C">
            SINGLE PLANE
          </text>
        </svg>
      </div>
      <div className="text-caddie-ink-mute" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 6 }}>
        Roughly how the club travels — steep and upright through flat and rotary to
        a single plane. None is "correct"; each fits a different body.
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
          <SrcLabel>The body-swing connection</SrcLabel>
          <SrcBody>
            <Src href="https://www.mytpi.com/certification/about">
              Titleist Performance Institute · About Certification
            </Src>{' '}
            and{' '}
            <Src href="https://mytpi.com/articles/fitness/x-factor_essentials_what_it_is_and_how_to_train_it">
              TPI · X-Factor essentials
            </Src>{' '}
            — screening the body first, and mapping physical limits to swing
            characteristics.
          </SrcBody>
        </div>
        <div>
          <SrcLabel>What other striking and throwing sports show</SrcLabel>
          <SrcBody>
            <Src href="https://pmc.ncbi.nlm.nih.gov/articles/PMC7438768/">
              Bernstein's "repetition without repetition" (motor-control review)
            </Src>{' '}
            — skilled movement is variable, with many solutions to one task;{' '}
            <Src href="https://pmc.ncbi.nlm.nih.gov/articles/PMC3445080/">
              the kinetic chain in overhand pitching
            </Src>{' '}
            and{' '}
            <Src href="https://www.sciencedirect.com/science/article/pii/S002192902300235X">
              fifty years of performance-related sports biomechanics
            </Src>{' '}
            — power runs proximal-to-distal across throwing and striking sports,
            and elite technique calls for individual profiling, not one template.
          </SrcBody>
        </div>
        <div>
          <SrcLabel>The modern swing and the X-Factor — and the dispute</SrcLabel>
          <SrcBody>
            <Src href="https://www.golfdigest.com/story/jim-mcleans-new-x-factor">
              Golf Digest · Jim McLean on the X-Factor
            </Src>{' '}
            (popularized 1992) and a critical view in{' '}
            <Src href="https://www.perfectgolfswingreview.net/xfactor.htm">
              a review of the X-Factor evidence
            </Src>{' '}
            — power gains are real but contested, and high separation can add
            lower-back stress.
          </SrcBody>
        </div>
        <div>
          <SrcLabel>The modern swing and lower-back load</SrcLabel>
          <SrcBody>
            <Src href="https://thejns.org/spine/view/journals/j-neurosurg-spine/31/6/article-p914.xml">
              Journal of Neurosurgery: Spine (2019) · lumbar degeneration in
              modern-era golfers
            </Src>{' '}
            links the repetitive modern swing to early disc wear, while a{' '}
            <Src href="https://www.tandfonline.com/doi/full/10.1080/02640414.2024.2319443">
              2024 systematic review (Journal of Sports Sciences)
            </Src>{' '}
            cautions that the biomechanics-to-back-pain evidence is still limited
            and conflicting — a real concern, not settled science.
          </SrcBody>
        </div>
        <div>
          <SrcLabel>The classic flatter plane (Hogan)</SrcLabel>
          <SrcBody>
            <Src href="https://www.usgtf.com/hogans-five-lessons-in-our-modern-game/">
              USGTF · Hogan's Five Lessons in the modern game
            </Src>{' '}
            and{' '}
            <Src href="https://mygolfspy.com/news-opinion/ben-hogans-swing/">
              MyGolfSpy · Ben Hogan's swing
            </Src>{' '}
            — the "pane of glass" plane, and why it doesn't fit every height.
          </SrcBody>
        </div>
        <div>
          <SrcLabel>The single-plane swing (Moe Norman / Graves)</SrcLabel>
          <SrcBody>
            <Src href="https://gravesgolf.com/about-moe-norman/">
              Graves Golf · About Moe Norman
            </Src>{' '}
            and{' '}
            <Src href="https://moenorman.org/">Todd Graves · Moe Norman</Src> — the
            single-plane method, and the ball-striking reputation behind it.
          </SrcBody>
        </div>
        <div>
          <SrcLabel>Stack and Tilt</SrcLabel>
          <SrcBody>
            <Src href="https://en.wikipedia.org/wiki/Mike_Bennett_and_Andy_Plummer">
              Bennett &amp; Plummer (Stack and Tilt)
            </Src>{' '}
            — weight-forward method and its tour adherents.
          </SrcBody>
        </div>
        <div>
          <SrcLabel>Simpler and body-friendly methods</SrcLabel>
          <SrcBody>
            <Src href="https://www.swingsurgeon.com/learn-the-swing">
              Don Trahan · Peak Performance Golf Swing
            </Src>{' '}
            (vertical, limited-turn, body-friendly),{' '}
            <Src href="https://www.golfdigest.com/story/david-leadbetter-a-swing-starter-kit">
              David Leadbetter · the A Swing
            </Src>{' '}
            (a simpler, repeatable backswing), and{' '}
            <Src href="https://www.wisconsin.golf/19th_hole/gary_d_amato/manuel-de-la-torres-former-students-committed-to-keeping-alive-his-simple-concepts-of-the/article_58cb7714-9baa-11ea-b99c-c79f89a574d7.html">
              Manuel de la Torre
            </Src>{' '}
            (Ernest Jones's "swing the clubhead," 1986 PGA Teacher of the Year).
          </SrcBody>
        </div>
        <div>
          <SrcLabel>Fitting clubs to your body</SrcLabel>
          <SrcBody>
            <Src href="https://pluggedingolf.com/much-lie-angle-matter-golf-myths-unplugged/">
              Plugged In Golf · lie-angle testing
            </Src>{' '}
            (a correct lie tightens left-right dispersion) and{' '}
            <Src href="https://www.pga.info/discover/latest/news/pings-ultimate-guide-better-custom-fitting/">
              PING's custom-fitting guide
            </Src>{' '}
            — most golfers don't fit the standard off-the-rack build.
          </SrcBody>
        </div>
        <div>
          <SrcLabel>Great "incorrect" swings</SrcLabel>
          <SrcBody>
            <Src href="https://en.wikipedia.org/wiki/Jim_Furyk">Jim Furyk</Src>{' '}
            (2003 U.S. Open;{' '}
            <Src href="https://en.wikipedia.org/wiki/Jim_Furyk's_round_of_58">
              the 58
            </Src>
            ),{' '}
            <Src href="https://en.wikipedia.org/wiki/Lee_Trevino">Lee Trevino</Src>{' '}
            (six majors, self-taught fade),{' '}
            <Src href="https://en.wikipedia.org/wiki/Nancy_Lopez">Nancy Lopez</Src>{' '}
            (48 LPGA wins),{' '}
            <Src href="https://en.wikipedia.org/wiki/John_Daly_(golfer)">
              John Daly
            </Src>{' '}
            (two majors), and{' '}
            <Src href="https://en.wikipedia.org/wiki/Gary_Player">Gary Player</Src>{' '}
            (nine majors, competitive into his 70s).
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
      Last reviewed May 2026
    </div>
  )
}
