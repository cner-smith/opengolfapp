import { SrcBody, SrcLabel } from '../components/ArticlePrimitives'
import type { ReactNode } from 'react'

export function MeasurableGoalsArticle() {
  return (
    <article
      id="measurable-goals"
      style={{
        borderTop: '1px solid #D9D2BF',
        paddingTop: 22,
        marginBottom: 32,
      }}
    >
      <div className="kicker" style={{ marginBottom: 14 }}>
        Improving your game · Measurable goals
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
        A goal you can pass or fail.
      </h2>

      <P>
        Most practice goals are wishes wearing a goal's clothes — work on my
        irons, get more consistent, fix the slice. None of them can be passed or
        failed, so none of them can tell you whether the session worked. A real
        goal has a number and a verdict: when you're done you either hit it or
        you didn't. This is how to build one.
      </P>
      <P>
        It starts with picking the right <em>kind</em> of goal — because not all
        of them are yours to control.
      </P>

      <H3>Three kinds of goal</H3>
      <GoalGlance />
      <P>
        The trouble with outcome goals is that you don't fully own them: a clean
        round can still lose to someone putting out of their mind. Hang your sense
        of a good day on the outcome and you've imported anxiety you can't do
        anything about. Performance and process goals are the ones worth setting
        in practice — and of the two, process goals travel best under pressure. In
        a study of club golfers, the players trained to set process goals
        controlled their competitive anxiety and held their concentration better
        than players given no goals at all. Keep the outcome as the direction
        you're heading; score yourself on the performance and process steps that
        get you there.
      </P>

      <Hr />

      <H3>Start with a baseline</H3>
      <P>
        You can't make a goal measurable until you know your current number.
        Before you set a target, measure where you stand: hit ten wedges from 60
        yards, count how many finish within a flagstick's length — say four. Now
        the goal isn't a figure you invented out of optimism; it's "beat four." A
        baseline turns every later session into a comparison instead of a guess,
        and it keeps the target honest — pinned to your actual game rather than to
        what you wish your game looked like.
      </P>

      <Hr />

      <H3>Calibrate the difficulty</H3>
      <P>
        Goal-setting research is consistent on one point: specific, hard goals
        beat vague or easy ones — but only up to the edge of what you can actually
        do. A goal you clear every single time just confirms what you already had.
        A goal you never reach only tells you, again, that you failed. Aim for the
        band in between — the target you make roughly half the time. That's the
        version that pulls your skill forward without snapping your commitment to
        chasing it, the same "harder on purpose" principle behind random and
        pressure practice.
      </P>
      <DifficultyBand />

      <Hr />

      <H3>The anatomy of a testable goal</H3>
      <P>
        Whatever the skill, a goal you can score has the same four parts. Leave
        any one of them vague and the verdict goes fuzzy with it.
      </P>
      <AnatomyTable />

      <Hr />

      <H3>Then move it</H3>
      <P>
        The whole point of a baseline is that you re-set it. Clear your target a
        few sessions running and it has gone too easy — raise it. A measurable
        goal isn't a finish line you cross once; it's a number you keep nudging
        upward as the skill comes in. What never changes is the test itself: at
        the end of every session you can say plainly whether you passed. A goal you
        can't score isn't a goal. It's a hope.
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

// The goal hierarchy: what each kind is, and how much of it you control.
function GoalGlance() {
  const rows: { kind: string; example: string; control: string }[] = [
    {
      kind: 'Outcome',
      example: 'Win the match. Beat Dave.',
      control: 'Depends on other people — you can play your best and still lose.',
    },
    {
      kind: 'Performance',
      example: 'Break 85. Hit 7 of 10 greens.',
      control: 'Your own number, measured against yourself, not the field.',
    },
    {
      kind: 'Process',
      example: 'Commit to the routine. Finish the swing.',
      control: 'The action itself — entirely under your control, every shot.',
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
        From least to most controllable
      </div>
      {rows.map((r, i) => (
        <div
          key={r.kind}
          style={{
            paddingTop: i === 0 ? 0 : 12,
            marginTop: i === 0 ? 0 : 12,
            borderTop: i === 0 ? 'none' : '1px solid #D9D2BF',
          }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', marginBottom: 3 }}>
            <div
              className="font-serif text-caddie-ink"
              style={{ fontSize: 15, fontStyle: 'italic', flex: '0 0 96px' }}
            >
              {r.kind}
            </div>
            <div className="text-caddie-ink" style={{ fontSize: 14 }}>
              {r.example}
            </div>
          </div>
          <div
            className="text-caddie-ink-dim"
            style={{ fontSize: 13, lineHeight: 1.5, paddingLeft: 108 }}
          >
            {r.control}
          </div>
        </div>
      ))}
    </div>
  )
}

// Editorial line-art: the success-rate band, productive middle in accent.
function DifficultyBand() {
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
        <svg width="100%" viewBox="0 0 220 76" aria-hidden="true" style={{ display: 'block' }}>
          {/* full success-rate track */}
          <rect x="14" y="26" width="192" height="14" fill="none" stroke="#9F9580" strokeWidth="1.5" />
          {/* the productive middle band, ~40–70%, in accent */}
          <rect x="90" y="26" width="58" height="14" fill="#1F3D2C" opacity="0.16" />
          <line x1="90" y1="22" x2="90" y2="44" stroke="#1F3D2C" strokeWidth="1.5" />
          <line x1="148" y1="22" x2="148" y2="44" stroke="#1F3D2C" strokeWidth="1.5" />
          <text x="14" y="58" fontSize="7" fontFamily="monospace" letterSpacing="1" fill="#8A8B7E">
            TOO EASY
          </text>
          <text x="98" y="58" fontSize="7" fontFamily="monospace" letterSpacing="1" fill="#1F3D2C">
            THE ZONE
          </text>
          <text x="168" y="58" fontSize="7" fontFamily="monospace" letterSpacing="1" fill="#8A8B7E">
            TOO HARD
          </text>
          <text x="10" y="20" fontSize="7" fontFamily="monospace" fill="#8A8B7E">
            0%
          </text>
          <text x="196" y="20" fontSize="7" fontFamily="monospace" fill="#8A8B7E">
            100%
          </text>
        </svg>
      </div>
      <div className="text-caddie-ink-mute" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 6 }}>
        Success rate on the goal. Clear it every time and it teaches nothing; never
        clear it and it only demoralizes. The target you make about half the time
        is the one that moves your skill.
      </div>
    </div>
  )
}

// The four parts every scoreable goal shares.
function AnatomyTable() {
  const rows: { part: string; detail: string }[] = [
    {
      part: 'The shot',
      detail: 'Exactly what you’re hitting — 7-iron, 60-yard wedge, 6-foot putt. Not “irons.”',
    },
    {
      part: 'The standard',
      detail: 'What counts as a success — inside 20 feet, on the green, holed.',
    },
    {
      part: 'The sample',
      detail: 'How many attempts — ten balls, so one lucky or unlucky swing can’t decide it.',
    },
    {
      part: 'The verdict',
      detail: 'The number to beat — 6 of 10, up from last week’s 4.',
    },
  ]
  return (
    <div style={{ maxWidth: 640, marginBottom: 18, borderTop: '1px solid #D9D2BF' }}>
      {rows.map((r) => (
        <div
          key={r.part}
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
            style={{ fontSize: 15, fontStyle: 'italic', flex: '0 0 110px' }}
          >
            {r.part}
          </div>
          <div className="text-caddie-ink-dim" style={{ fontSize: 14, lineHeight: 1.5 }}>
            {r.detail}
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
          <SrcLabel>Specific, hard goals beat "do your best"</SrcLabel>
          <SrcBody>
            <Src href="https://doi.org/10.1037/0003-066X.57.9.705">
              Locke &amp; Latham, American Psychologist (2002) · goal-setting theory,
              a 35-year review
            </Src>{' '}
            — specific and difficult goals consistently produce higher performance
            than vague or easy ones, up to the limit of ability.
          </SrcBody>
        </div>
        <div>
          <SrcLabel>Process goals in golf — anxiety and concentration</SrcLabel>
          <SrcBody>
            <Src href="https://journals.humankinetics.com/view/journals/tsp/11/3/article-p277.xml">
              Kingston &amp; Hardy, The Sport Psychologist (1997)
            </Src>{' '}
            — club golfers trained on process goals controlled competitive anxiety
            and held concentration better than a no-goal group.
          </SrcBody>
        </div>
        <div>
          <SrcLabel>Which goal types actually help — the evidence base</SrcLabel>
          <SrcBody>
            <Src href="https://www.tandfonline.com/doi/full/10.1080/1750984X.2022.2116723">
              International Review of Sport &amp; Exercise Psychology (2022) ·
              systematic review and meta-analysis of goal setting in sport
            </Src>{' '}
            — pooled evidence that goal setting improves performance, with process
            and performance goals carrying the effect.
          </SrcBody>
        </div>
        <div>
          <SrcLabel>Process goals under pressure</SrcLabel>
          <SrcBody>
            <Src href="https://www.sciencedirect.com/science/article/abs/pii/S1469029214001800">
              Psychology of Sport &amp; Exercise (2015) · holistic process goals for
              learning and performance under pressure
            </Src>{' '}
            — a process focus helps skills hold up when the pressure is on.
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
