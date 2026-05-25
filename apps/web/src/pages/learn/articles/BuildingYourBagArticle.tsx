import type { ReactNode } from 'react'

export function BuildingYourBagArticle() {
  return (
    <article
      id="building-your-bag"
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
        Building your bag.
      </h2>

      <H3>Fourteen clubs is a budget, not a checklist</H3>
      <P>
        The rules let you carry fourteen clubs — no more. Most golfers fill that
        number out of habit: driver, 3-wood, irons down through the pitching
        wedge, a sand wedge, a putter, and whatever was in the box. Almost nobody
        asks the only question that matters — do these fourteen actually cover my
        distances? Usually they don't. The goal was never to own fourteen clubs.
        It's even gaps, top to bottom, with no dead zones.
      </P>

      <DeadZones />

      <P>
        Fix both and the bag fits you instead of the rack it came off. Everything
        below is how to find and close those gaps.
      </P>

      <Hr />

      <H3>Start from your distances, not the set</H3>
      <Aid svg={<GapLadderDiagram />}>
        <AidBody>
          Build the bag backwards from carry numbers, not forwards from a set
          you bought. Hit five to ten balls with each club, average the carries —
          throw out the obvious duffs — and list them top to bottom. The picture
          shows up at once: where clubs bunch together, and where they spread.
        </AidBody>
        <AidBody>
          Aim for even steps of roughly 10 to 15 yards between full clubs. Two
          clubs landing within about 8 yards of each other is a wasted slot — one
          of them is doing nothing. A gap wider than 15 leaves you stranded
          between clubs, forced into a half-swing you'll never trust on the
          course.
        </AidBody>
      </Aid>

      <Hr />

      <H3>The top of the bag: driver down to your longest club</H3>
      <P>
        This is where the most common dead zone hides. Modern lofts are strong,
        and a lot of amateurs find their 3-, 4-, and 5-iron all carry within ten
        yards of each other — three slots doing one club's job. The fix is to
        replace the long irons you can't launch with hybrids or a higher-lofted
        fairway wood: they get the ball up more easily and restore real
        separation between clubs.
      </P>
      <P>
        Keep long irons only if you have the speed to flight them and a reason to
        hit it low. And check the very top: if your 3-wood off the deck goes
        nearly as far as a driver you rarely trust, that's a slot you could spend
        on a club you'll actually pull. Carry the longest club you can keep in
        play, not the longest one you own.
      </P>

      <Hr />

      <H3>The scoring clubs: wedges, where strokes are won and lost</H3>
      <Aid svg={<WedgeLoftDiagram />}>
        <AidBody>
          The bottom of the bag is where most amateurs quietly leak strokes.
          Pitching-wedge lofts have crept stronger over the years — a
          game-improvement set may run 41–43°, where a traditional one sat at
          45–46° — and that opens a big hole right below it, in the 30-to-50-yard
          range where you score.
        </AidBody>
        <AidBody>
          Space your wedges in even loft steps of about 4 to 6°. A common setup:
          pitching wedge around 45°, gap wedge near 50°, sand wedge 54–56°, lob
          wedge 58–60°. If your pitching wedge is 45° or stronger, a gap wedge
          isn't optional — without it you've got a yawning hole exactly where
          touch matters most. For most players, pitching, gap, and sand wedges
          cover it; add a lob wedge only if you have the swing for it.
        </AidBody>
      </Aid>
      <P>
        Which bounce and grind to put on those wedges is a fitting question, not
        a gapping one — it's covered in the fittings guide. Here, the job is only
        to make sure no two of them go the same distance and nothing's missing
        below your pitching wedge.
      </P>

      <Hr />

      <H3>The putter — the club you use most</H3>
      <P>
        Roughly 40% of the strokes in a round are putts, which makes the putter
        the one slot you should never treat as an afterthought or a hand-me-down.
        It doesn't need gapping, but it does need fitting — length, lie, and head
        style matched to your stroke — and that's the cheapest set of strokes on
        this page. One slot, used more than any other; spend it deliberately.
      </P>

      <Hr />

      <H3>Where the fourteen go</H3>
      <P>
        There's no single correct bag, but a no-dead-zone build for most golfers
        lands close to this. The exact count flexes — drop a wedge to add a
        hybrid, or the reverse — as long as the gaps stay even.
      </P>

      <SampleBag />

      <P>
        Run the range test once a season and after any new club. A bag with even
        gaps and nothing you can't hit beats a bag full of the newest models —
        the fourteen slots are a budget, and the player who spends them on
        coverage instead of habit shoots lower without buying a thing.
      </P>

      <Sources />

      <Footer />
    </article>
  )
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

// The two failure modes a good bag avoids.
function DeadZones() {
  const rows: { label: string; gloss: string }[] = [
    {
      label: 'Overlap',
      gloss:
        'Two clubs that carry the same distance. One of them is a wasted slot — a club you could have spent covering a yardage you can’t reach.',
    },
    {
      label: 'Hole',
      gloss:
        'A distance you can’t cover with any full swing, so you’re stuck guessing at a three-quarter shot. Most often it sits just below the pitching wedge.',
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
        The two dead zones
      </div>
      {rows.map((r, i) => (
        <div
          key={r.label}
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
            {r.label}
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

// A section with an editorial diagram beside the prose.
function Aid({ svg, children }: { svg: ReactNode; children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        maxWidth: 660,
        marginBottom: 4,
      }}
    >
      <div style={{ flex: '0 0 160px' }}>{svg}</div>
      <div style={{ flex: '1 1 320px', minWidth: 0 }}>{children}</div>
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

// Editorial line-art diagrams — hairline strokes, one accent mark total
// (the dead-zone span), per DESIGN.md's restrained ink budget.
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

// Top row: even gaps. Bottom row: a bunched overlap and an accent-marked hole.
function GapLadderDiagram() {
  return (
    <SvgPanel>
      <svg width="100%" viewBox="0 0 160 110" aria-hidden="true" style={{ display: 'block' }}>
        {/* even-gap ladder */}
        <line x1="18" y1="34" x2="142" y2="34" stroke="#9F9580" strokeWidth="1.5" />
        {[18, 43, 68, 93, 118, 142].map((x) => (
          <g key={`top-${x}`}>
            <line x1={x} y1="28" x2={x} y2="40" stroke="#1C211C" strokeWidth="1.5" />
            <circle cx={x} cy="34" r="2" fill="#1C211C" />
          </g>
        ))}
        {/* dead-zone ladder: two bunched, then a hole */}
        <line x1="18" y1="84" x2="142" y2="84" stroke="#9F9580" strokeWidth="1.5" />
        {[18, 30, 92, 117, 142].map((x) => (
          <g key={`bot-${x}`}>
            <line x1={x} y1="78" x2={x} y2="90" stroke="#1C211C" strokeWidth="1.5" />
            <circle cx={x} cy="84" r="2" fill="#1C211C" />
          </g>
        ))}
        {/* the hole, marked in accent */}
        <line x1="34" y1="98" x2="88" y2="98" stroke="#1F3D2C" strokeWidth="1.5" />
        <line x1="34" y1="95" x2="34" y2="101" stroke="#1F3D2C" strokeWidth="1.5" />
        <line x1="88" y1="95" x2="88" y2="101" stroke="#1F3D2C" strokeWidth="1.5" />
      </svg>
    </SvgPanel>
  )
}

// Four wedges climbing in even loft steps.
function WedgeLoftDiagram() {
  const bars = [
    { x: 26, h: 30 },
    { x: 58, h: 42 },
    { x: 90, h: 54 },
    { x: 122, h: 66 },
  ]
  return (
    <SvgPanel>
      <svg width="100%" viewBox="0 0 160 96" aria-hidden="true" style={{ display: 'block' }}>
        <line x1="14" y1="82" x2="146" y2="82" stroke="#9F9580" strokeWidth="1.5" />
        {bars.map((b) => (
          <rect
            key={b.x}
            x={b.x}
            y={82 - b.h}
            width="12"
            height={b.h}
            rx="2"
            fill="none"
            stroke="#1C211C"
            strokeWidth="1.5"
          />
        ))}
      </svg>
    </SvgPanel>
  )
}

// Where a no-dead-zone build for most golfers spends its fourteen slots.
function SampleBag() {
  const rows: { role: string; clubs: string }[] = [
    {
      role: 'Off the tee',
      clubs: 'Driver — one slot, the longest club you can keep in play.',
    },
    {
      role: 'Long approach',
      clubs: 'A 3-wood, hybrids, or a high-lofted fairway — whatever you actually hit off the deck. Most amateurs gap better with hybrids than 3- and 4-irons.',
    },
    {
      role: 'Mid & short irons',
      clubs: 'Roughly 5-iron through pitching wedge, in even 10–15 yard steps.',
    },
    {
      role: 'Scoring',
      clubs: 'Pitching, gap, and sand wedge cover most players; add a lob wedge if you have the swing for it. Even 4–6° loft gaps.',
    },
    {
      role: 'On the green',
      clubs: 'Putter — the club you use most. Fit it, don’t default it.',
    },
  ]
  return (
    <div style={{ maxWidth: 640, marginBottom: 18, borderTop: '1px solid #D9D2BF' }}>
      {rows.map((r) => (
        <div
          key={r.role}
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
            style={{ fontSize: 15, fontStyle: 'italic', flex: '0 0 130px' }}
          >
            {r.role}
          </div>
          <div className="text-caddie-ink-dim" style={{ fontSize: 14, lineHeight: 1.5 }}>
            {r.clubs}
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
          <SrcLabel>The fourteen-club limit</SrcLabel>
          <SrcBody>
            <Src href="https://www.usga.org/content/usga/home-page/rules/rules-2019/rules-of-golf/rule-4.html">
              USGA · Rule 4, the player's equipment
            </Src>{' '}
            — you may carry no more than fourteen clubs, but no minimum and no
            restriction on type.
          </SrcBody>
        </div>
        <div>
          <SrcLabel>Distance gapping and finding the holes</SrcLabel>
          <SrcBody>
            <Src href="https://www.bobbywaliagolf.com/club-gapping-guide/">
              Bobby Walia Golf · club gapping guide
            </Src>{' '}
            and{' '}
            <Src href="https://www.hirekogolf.com/blog/post/guide-to-gapping-your-irons-correctly-solving-iron-distance-gaps">
              Hireko Golf · gapping your irons
            </Src>{' '}
            — aim for even 10–15 yard steps; long irons that bunch within ten
            yards are better replaced with hybrids.
          </SrcBody>
        </div>
        <div>
          <SrcLabel>Wedge lofts and the gap below the pitching wedge</SrcLabel>
          <SrcBody>
            <Src href="https://www.golfdigest.com/story/everything-you-need-to-know-about-wedge-lofts">
              Golf Digest · everything to know about wedge lofts
            </Src>{' '}
            and{' '}
            <Src href="https://mygolfspy.com/news-opinion/instruction/wedge-gapping-chart-by-handicap-distance-lofts-and-trends/">
              MyGolfSpy · wedge gapping by handicap
            </Src>{' '}
            — strong pitching-wedge lofts open a gap; space wedges about 4–6°
            apart to close it.
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
