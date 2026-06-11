import { SrcBody, SrcLabel } from '../components/ArticlePrimitives'
import type { CSSProperties, ReactNode } from 'react'

export function UnderstandingYourSwingArticle() {
  return (
    <article
      id="understanding-your-swing"
      style={{
        borderTop: '1px solid #D9D2BF',
        paddingTop: 22,
        marginBottom: 32,
      }}
    >
      <div className="kicker" style={{ marginBottom: 14 }}>
        Improving your game · Your swing
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
        The ball doesn't lie.
      </h2>

      <P>
        You don't need a coach behind you or a launch monitor in front of you to
        know what your swing just did. Every shot leaves evidence — the line the
        ball starts on, the way it curves, the divot in front of it, the mark on
        the face — and that evidence is a readout of what the club was doing at
        impact. Learn to read it and you can diagnose your own swing on any range
        in the world. The companion <em>self-diagnosis</em> guide helps you find{' '}
        <em>which</em> part of your game is leaking strokes; this one is about
        reading <em>what</em> your swing is actually doing once you're there.
      </P>

      <Hr />

      <H3>Start line and curve: the two-number readout</H3>
      <P>
        Modern launch-monitor data overturned what most of us were taught. Two
        things at impact write the whole shot:
      </P>
      <FlightReadout />
      <P>
        So read every ball as two separate facts. <strong>Where it starts</strong>{' '}
        is mostly your face. <strong>How it curves</strong> is the gap between
        face and path. A shot that starts left and slices back right, for
        instance, means the face was pointed left of the target but still open
        relative to an even-more-leftward path — the classic out-to-in pull-slice.
        The ball just told you both numbers; you only had to listen.
      </P>

      <BallFlightDiagram />

      <Hr />

      <H3>The divot tells you the rest</H3>
      <P>
        With an iron, the turf is a second instrument. On solid contact the divot
        begins <em>after</em> the ball, not under it — proof you struck the ball
        first and the low point of your arc was ahead of it. Beyond that, the
        divot's shape and direction fill in the path your ball flight implied:
      </P>
      <ul style={UL_STYLE}>
        <li>
          <strong>Direction.</strong> A divot pointing left of target is the
          fingerprint of an out-to-in (over-the-top) path; one pointing right
          signals in-to-out. It should roughly agree with the curve you read off
          the ball.
        </li>
        <li>
          <strong>Depth and evenness.</strong> A deep, gouged divot says your low
          point is too far forward or your attack too steep; no divot at all
          usually means you're bottoming out behind the ball. A divot deeper on
          the toe or heel side points at how the club is delivered, not just where
          it lands.
        </li>
        <li>
          <strong>Where it starts.</strong> A divot that begins well behind the
          ball is the turf-side version of fat contact — the arc bottomed out
          early.
        </li>
      </ul>

      <Hr />

      <H3>The strike fills in the blanks</H3>
      <P>
        Where on the face you make contact is the cheapest data in golf to
        collect: a dusting of foot spray, face tape, or even the wear pattern on a
        dirty clubface shows it. Toward the toe or heel explains distance you
        can't account for and a surprising amount of curve; high or low on the
        face explains a shot that flew or ballooned for no obvious reason. A
        scattered strike pattern, like a scattered ball flight, points back at the
        fundamentals — setup, posture, balance — rather than any one swing move.
      </P>

      <Hr />

      <H3>Three reads, one cause</H3>
      <P>
        The skill isn't any single read — it's that the ball, the divot, and the
        strike almost always converge on the same story. A pull that curves right,
        a divot aimed left, and a strike toward the heel are three witnesses to
        one out-to-in delivery, not three separate problems. Find where they agree
        and you've found the cause worth working on. And as the self-diagnosis
        guide stresses: chase the <em>pattern</em>, not the one ugly shot. A miss
        that repeats is a swing trait you can read and fix; a miss that's different
        every time is a fundamentals problem hiding upstream.
      </P>

      <Hr />

      <H3>When the read runs out</H3>
      <P>
        Reading your swing and <em>changing</em> it are different skills. You can
        often diagnose the cause — an open face, a steep path — long before you
        can reliably fix it, and that's exactly the moment a good coach earns
        their fee. Walk in able to say "I start it left and it slices, my divots
        point left" and you've handed them the diagnosis and bought yourself a far
        more useful hour. The companion guides on lessons and on the questions to
        ask your coach pick up from there. Until then: the ball doesn't lie. Learn
        its language and you're never completely in the dark about your own swing.
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

// The two impact factors and what each one writes on the shot.
function FlightReadout() {
  const rows: { factor: string; writes: string }[] = [
    {
      factor: 'Face angle',
      writes:
        'Where the ball starts. At impact the face sets roughly three-quarters of the start line — more at slower speeds.',
    },
    {
      factor: 'Face vs. path',
      writes:
        'How the ball curves. The gap between where the face points and where the club is travelling tilts the spin: open to the path curves away, closed to it draws back.',
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
        What writes the shot
      </div>
      {rows.map((r, i) => (
        <div
          key={r.factor}
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
            style={{ fontSize: 15, fontStyle: 'italic', flex: '0 0 110px' }}
          >
            {r.factor}
          </div>
          <div className="text-caddie-ink-dim" style={{ fontSize: 14, lineHeight: 1.5 }}>
            {r.writes}
          </div>
        </div>
      ))}
    </div>
  )
}

// Editorial line-art: the ball starts on the face line, then curves as the
// face-to-path gap tilts the spin. Accent on the curving flight.
function BallFlightDiagram() {
  return (
    <div style={{ maxWidth: 360, marginBottom: 18 }}>
      <div
        style={{
          background: '#EBE5D6',
          border: '1px solid #D9D2BF',
          borderRadius: 2,
          padding: '14px 12px 8px',
        }}
      >
        <svg width="100%" viewBox="0 0 220 120" aria-hidden="true" style={{ display: 'block' }}>
          {/* target line (dashed) */}
          <line x1="40" y1="108" x2="40" y2="14" stroke="#9F9580" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx="40" cy="108" r="3" fill="#1C211C" />
          {/* start line — straight, along the face direction */}
          <line x1="40" y1="108" x2="92" y2="20" stroke="#9F9580" strokeWidth="1.5" />
          {/* actual curving flight (accent) — starts on the face line then bends */}
          <path d="M40 108 Q 84 40 150 44" fill="none" stroke="#1F3D2C" strokeWidth="2.5" />
          <text x="58" y="100" fontSize="7" fontFamily="monospace" letterSpacing="0.5" fill="#8A8B7E">
            TARGET
          </text>
          <text x="86" y="16" fontSize="7" fontFamily="monospace" letterSpacing="0.5" fill="#8A8B7E">
            START = FACE
          </text>
          <text x="120" y="58" fontSize="7" fontFamily="monospace" letterSpacing="0.5" fill="#1F3D2C">
            CURVE = FACE vs PATH
          </text>
        </svg>
      </div>
      <div className="text-caddie-ink-mute" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 6 }}>
        The ball starts where the face points, then bends by the gap between face
        and path. Two facts, read off one shot.
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
          <SrcLabel>The modern ball-flight laws</SrcLabel>
          <SrcBody>
            <Src href="https://support.trackmangolf.com/hc/en-us/articles/5089892383515-Practice-Trackman-Data-Parameter-Definitions">
              TrackMan · data parameter definitions (face angle, club path)
            </Src>{' '}
            and{' '}
            <Src href="https://theleftrough.com/new-ball-flight-laws/">
              a plain-English explainer of the new ball-flight laws
            </Src>{' '}
            — the face sets the start line; the face-to-path gap sets the curve.
          </SrcBody>
        </div>
        <div>
          <SrcLabel>Reading path from the ball and the divot</SrcLabel>
          <SrcBody>
            <Src href="https://www.golfwrx.com/251459/use-the-new-ball-flight-laws-to-understand-your-tendencies/">
              GolfWRX · using the ball-flight laws to read your own tendencies
            </Src>{' '}
            — translating start line, curve, and divot direction back into face and
            path.
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
