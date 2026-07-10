import { SrcBody, SrcLabel } from '../components/ArticlePrimitives'
import type { ReactNode } from 'react'

export function PracticeModesArticle() {
  return (
    <article
      id="practice-modes"
      style={{
        borderTop: '1px solid #D9D2BF',
        paddingTop: 22,
        marginBottom: 32,
      }}
    >
      <div className="kicker" style={{ marginBottom: 14 }}>
        Improving your game · Practice modes
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
        Block, random, and pressure.
      </h2>

      <H3>The practice that feels best teaches least</H3>
      <P>
        The most satisfying practice — same club, same target, ball after ball
        until it grooves — is also the least durable. Half a century of
        motor-learning research keeps landing on the same uncomfortable result:
        how well you hit it on the range is a poor predictor of how well you'll
        learn. The practice that improves your score often feels worse while
        you're doing it.
      </P>
      <P>
        There are three modes worth understanding — blocked, random, and
        pressure. Each does a different job, and the mistake nearly every golfer
        makes is living entirely in the first one. This is what each mode is for,
        and how to put them together.
      </P>

      <ModesGlance />

      <Hr />

      <H3>Blocked — building the movement</H3>
      <P>
        Blocked practice is one shot repeated: the same club to the same target,
        over and over. It's the right tool for installing a brand-new movement or
        working through a swing change — repetition lets you feel the new pattern
        without anything else competing for attention, and you improve fast
        inside the session. That fast improvement is exactly the trap. The gains
        are fragile, and they tend not to follow you to the course. Use blocks to
        install a feel, not to finish it: a short blocked warm-up, then move on.
      </P>

      <Hr />

      <H3>Random — the mode that actually transfers</H3>
      <Aid svg={<ScheduleDiagram />}>
        <AidBody>
          Random practice mixes it up every ball — different club, different
          target, never the same shot twice in a row. It produces a strange,
          well-documented pattern called the contextual interference effect:
          random practice makes you <em>worse</em> during the session but{' '}
          <em>better</em> days later, on the tests that measure real learning —
          retention and transfer to new situations.
        </AidBody>
        <AidBody>
          The reason is that each ball forces you to build the shot from scratch,
          the way the course always will — you never hit the same putt twice in a
          round. Studies of golf putting and chipping show it directly: random
          groups putt worse in practice, then more accurately on a delayed
          retention test, and build a mental model of the stroke closer to a
          skilled player's.
        </AidBody>
      </Aid>
      <P>
        This is what the psychologist Robert Bjork named a{' '}
        <em>desirable difficulty</em> — a condition that slows you down now and
        pays off later. It feels like you're practicing badly, which is precisely
        why most people avoid it. Once a movement is roughly in place, the bulk of
        your practice should live here.
      </P>

      <RetentionDiagram />

      <Hr />

      <H3>Pressure — closing the gap to the first tee</H3>
      <P>
        The range swing that abandons you on the first tee is a transfer failure:
        you rehearsed the skill in a calm state you never actually compete in.
        Pressure practice fixes the mismatch by adding consequence — a putt you
        have to hole, a number to beat, one ball and one attempt — so the skill
        is trained alongside the nerves it will meet. Sport-psychology research on
        acclimatization shows that practicing under mild, manufactured pressure
        helps performance hold up when the real thing arrives, and is one of the
        better-supported defenses against choking.
      </P>
      <P>
        The companion article on skill games and pressure games is the how — the
        specific games that manufacture that consequence. The point here is only
        the why: a skill you've never tested under pressure is a skill you don't
        yet own on the course.
      </P>

      <Hr />

      <H3>How to combine them</H3>
      <P>
        The modes aren't a menu to pick from; they're a progression. Match the
        mix to what you're trying to do, and shift it as a movement stabilizes.
      </P>

      <CombineTable />

      <P>
        Within a single session, the same shape works: a few minutes of blocks to
        find the feel, the bulk of the time in random practice with the club and
        target changing every ball, and a pressure game to finish. Across months,
        a new change starts blocked-heavy and tilts toward random and pressure as
        it holds up.
      </P>

      <Hr />

      <H3>Why it has to feel worse</H3>
      <P>
        The through-line under all three modes is the same: performance during
        practice is a poor guide to learning, and the conditions that build
        durable, transferable skill are the ones that feel harder while you're in
        them. If your range sessions feel smooth and your scores aren't moving,
        that gap is the signal — not to practice more, but to practice in a way
        that makes the work harder in the right places.
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

// The three modes and the one-line job of each.
function ModesGlance() {
  const rows: { mode: string; job: string }[] = [
    { mode: 'Blocked', job: 'Same shot, repeated. Installs a new movement — fast gains, fragile.' },
    { mode: 'Random', job: 'A different shot every ball. Builds durable, transferable skill.' },
    { mode: 'Pressure', job: 'Consequence on the shot. Carries the skill to the first tee.' },
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
        The three modes at a glance
      </div>
      {rows.map((r, i) => (
        <div
          key={r.mode}
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
            style={{ fontSize: 15, fontStyle: 'italic', flex: '0 0 78px' }}
          >
            {r.mode}
          </div>
          <div className="text-caddie-ink-dim" style={{ fontSize: 14, lineHeight: 1.5 }}>
            {r.job}
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

// Editorial line-art diagrams — hairline strokes, the random line in accent.
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

// Three shot types as shapes; top row grouped (blocked), bottom interleaved.
function Shape({ type, x, y }: { type: 'c' | 's' | 't'; x: number; y: number }) {
  if (type === 'c') {
    return <circle cx={x} cy={y} r="3.5" fill="none" stroke="#1C211C" strokeWidth="1.5" />
  }
  if (type === 's') {
    return (
      <rect x={x - 3.3} y={y - 3.3} width="6.6" height="6.6" fill="none" stroke="#1C211C" strokeWidth="1.5" />
    )
  }
  return (
    <polygon
      points={`${x},${y - 4.2} ${x + 4},${y + 3.4} ${x - 4},${y + 3.4}`}
      fill="none"
      stroke="#1C211C"
      strokeWidth="1.5"
    />
  )
}

function ScheduleDiagram() {
  type Mark = { t: 'c' | 's' | 't'; x: number }
  const xs = [20, 35, 50, 65, 80, 95, 110, 125, 140]
  const order = (seq: ('c' | 's' | 't')[]): Mark[] =>
    seq.map((t, i) => ({ t, x: xs[i] ?? 0 }))
  const blocked = order(['c', 'c', 'c', 's', 's', 's', 't', 't', 't'])
  const random = order(['c', 's', 't', 's', 'c', 't', 'c', 't', 's'])
  return (
    <div>
      <SvgPanel>
        <svg width="100%" viewBox="0 0 160 90" aria-hidden="true" style={{ display: 'block' }}>
          {blocked.map((m, i) => (
            <Shape key={`b-${i}`} type={m.t} x={m.x} y={28} />
          ))}
          {random.map((m, i) => (
            <Shape key={`r-${i}`} type={m.t} x={m.x} y={64} />
          ))}
        </svg>
      </SvgPanel>
      <div className="text-caddie-ink-mute" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 6 }}>
        Top row: blocked practice groups the same shot together. Bottom row:
        random practice interleaves club and target every ball.
      </div>
    </div>
  )
}

// Contextual interference: blocked wins in practice, random wins later.
function RetentionDiagram() {
  return (
    <div style={{ maxWidth: 360, marginBottom: 18 }}>
      <SvgPanel>
        <svg width="100%" viewBox="0 0 200 110" aria-hidden="true" style={{ display: 'block' }}>
          <line x1="24" y1="86" x2="188" y2="86" stroke="#9F9580" strokeWidth="1.5" />
          <line x1="24" y1="14" x2="24" y2="86" stroke="#9F9580" strokeWidth="1.5" />
          <line x1="106" y1="18" x2="106" y2="86" stroke="#D9D2BF" strokeWidth="1" strokeDasharray="3 3" />
          {/* blocked: high in practice, drops later */}
          <polyline points="30,44 106,30 182,68" fill="none" stroke="#9F9580" strokeWidth="2" />
          {/* random: low in practice, best later (accent) */}
          <polyline points="30,74 106,60 182,30" fill="none" stroke="#1F3D2C" strokeWidth="2" />
          <text x="54" y="100" fontSize="7" fontFamily="monospace" letterSpacing="1" fill="#8A8B7E">
            PRACTICE
          </text>
          <text x="136" y="100" fontSize="7" fontFamily="monospace" letterSpacing="1" fill="#8A8B7E">
            LATER
          </text>
        </svg>
      </SvgPanel>
      <div className="text-caddie-ink-mute" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 6 }}>
        Skill over time. Blocked practice (grey) looks better on the range; random
        practice (green) wins where it counts — days later, on the course.
      </div>
    </div>
  )
}

// Match the mode mix to the goal, and shift it as the movement stabilizes.
function CombineTable() {
  const rows: { goal: string; mix: string }[] = [
    {
      goal: 'Installing a new move',
      mix: 'Mostly blocked. Repeat the shot until the new feel is reliable before adding any variety.',
    },
    {
      goal: 'Building durable skill',
      mix: 'Mostly random. A different club and target every ball — this is where most practice should live.',
    },
    {
      goal: 'Getting ready to compete',
      mix: 'Add pressure. Put consequence on the shot, woven into random practice rather than tacked on at the end.',
    },
  ]
  return (
    <div style={{ maxWidth: 640, marginBottom: 18, borderTop: '1px solid #D9D2BF' }}>
      {rows.map((r) => (
        <div
          key={r.goal}
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
            style={{ fontSize: 15, fontStyle: 'italic', flex: '0 0 150px' }}
          >
            {r.goal}
          </div>
          <div className="text-caddie-ink-dim" style={{ fontSize: 14, lineHeight: 1.5 }}>
            {r.mix}
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
          <SrcLabel>The contextual interference effect (blocked vs random)</SrcLabel>
          <SrcBody>
            <Src href="https://www.nature.com/articles/s41598-024-65753-3">
              Scientific Reports (2024) · meta-analysis
            </Src>{' '}
            confirms high contextual interference improves retention, and{' '}
            <Src href="https://www.tandfonline.com/doi/abs/10.1080/00336297.1998.10484285">
              Brady, Quest (1998)
            </Src>{' '}
            reviews the effect first shown by Shea &amp; Morgan (1979): random
            order hurts practice, helps learning.
          </SrcBody>
        </div>
        <div>
          <SrcLabel>Random practice in golf specifically</SrcLabel>
          <SrcBody>
            <Src href="https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2024.1324615/full">
              Frontiers · motor learning in golf, a systematic review
            </Src>{' '}
            and{' '}
            <Src href="https://pubmed.ncbi.nlm.nih.gov/28449601/">
              Fazeli et al. (2017) · random vs blocked in golf putting
            </Src>{' '}
            — random groups putt worse in practice, better in retention, with a
            more skilled mental model.
          </SrcBody>
        </div>
        <div>
          <SrcLabel>Why harder practice helps — variability and desirable difficulty</SrcLabel>
          <SrcBody>
            <Src href="https://link.springer.com/article/10.3758/s13421-021-01168-z">
              Memory &amp; Cognition (2021) · interleaving and transfer
            </Src>{' '}
            and{' '}
            <Src href="https://pubmed.ncbi.nlm.nih.gov/14768838/">
              Sherwood &amp; Lee (2003) · schema theory review
            </Src>{' '}
            — variable, interleaved practice is a "desirable difficulty" that
            builds more general, robust skill.
          </SrcBody>
        </div>
        <div>
          <SrcLabel>Practicing under pressure</SrcLabel>
          <SrcBody>
            <Src href="https://www.tandfonline.com/doi/full/10.1080/1750984X.2017.1408134">
              Gröpel &amp; Mesagno, International Review of Sport &amp;
              Exercise Psychology (2019) · choking interventions, a systematic
              review
            </Src>{' '}
            — acclimatization and pre-performance routines help skills survive
            competitive anxiety.
          </SrcBody>
        </div>
        <div>
          <SrcLabel>Deliberate practice, and its limits</SrcLabel>
          <SrcBody>
            <Src href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6731745/">
              Macnamara &amp; Maitra, revisiting Ericsson, Krampe &amp;
              Tesch-Römer (1993)
            </Src>{' '}
            — practice quality matters enormously, though the strong claim that
            hours alone explain expertise has not fully replicated.
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
      Last reviewed July 2026
    </div>
  )
}
