import { useEffect, useState } from 'react'
import { useDetailedStats } from '../../hooks/useDetailedStats'
import { useProfile } from '../../hooks/useProfile'
import { useUnits } from '../../hooks/useUnits'
import type { DetailedStats } from '@oga/core'

interface SectionLink {
  id: string
  label: string
}

const SECTION_LINKS: SectionLink[] = [
  { id: 'strokes-gained', label: 'Strokes gained' },
  { id: 'categories', label: 'Categories' },
  { id: 'benchmarks', label: 'By the numbers' },
  { id: 'handicap', label: 'Handicap' },
  { id: 'gir', label: 'GIR' },
  { id: 'scrambling', label: 'Scrambling' },
  { id: 'up-down', label: 'Up & down' },
  { id: 'sand-save', label: 'Sand save' },
  { id: 'dispersion', label: 'Dispersion' },
]

export function LearnPage() {
  const stats = useDetailedStats(10)
  const me = stats.data ?? null
  const activeId = useActiveSection()
  const [jumpOpen, setJumpOpen] = useState(false)

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-[1fr_220px]"
      style={{ gap: 32 }}
    >
      <div style={{ minWidth: 0 }}>
      <div style={{ marginBottom: 28 }}>
        <div className="kicker" style={{ marginBottom: 8 }}>
          Yardage book
        </div>
        <h1
          className="font-serif text-caddie-ink"
          style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.15 }}
        >
          Learn
        </h1>
        <p
          className="text-caddie-ink-dim"
          style={{ fontSize: 15, marginTop: 6, maxWidth: 640 }}
        >
          A coach's column on the stats this app tracks — what they
          mean, why they matter, and what the numbers look like across
          the field.
        </p>
      </div>

      <StrokesGainedEntry me={me} />
      <Entry id="categories" kicker="Reference">
        <SGCategoriesTable />
      </Entry>
      <BenchmarkSection me={me} />
      <Entry id="handicap" kicker="Handicap index" title="The handicap, briefly.">
        <Lede>
          A handicap index is your <em>potential best</em> — the
          average of your eight best score differentials over the last
          twenty rounds, give or take. It is not your average score;
          it's a portrait of what you can do when things go right.
        </Lede>
        <Body>
          Each round's "score differential" adjusts the raw score for
          course difficulty (rating + slope), so 84 at a brutal track
          is treated more kindly than 84 at a pitch-and-putt. After
          you post a round, the system recomputes your index, which
          is why your number can move a touch even after you played
          well.
        </Body>
      </Entry>

      <Entry id="gir" kicker="GIR" title="Greens in regulation.">
        <Lede>
          Reaching the green in <em>par minus two</em> strokes — one
          on a par-3, two on a par-4, three on a par-5. Once on, you
          have two putts to match par.
        </Lede>
        <Body>
          GIR percentage is the cleanest read on ball-striking. PGA
          Tour pros sit around 67%, scratch amateurs 50%, low double
          digits land closer to 30%. Ten extra GIRs across a season
          tend to translate to a couple of strokes in scoring average.
        </Body>
      </Entry>

      <Entry id="scrambling" kicker="Scrambling" title="When you miss the green.">
        <Lede>
          The percent of holes where you missed the green and{' '}
          <em>still made par or better</em>. It rewards saving strokes
          you should have lost.
        </Lede>
        <Body>
          A useful pair with GIR — high GIR with low scrambling means
          you bleed strokes whenever the ball-striking blinks. High
          scrambling with low GIR means your short game props you up,
          but a leak above the green still costs you long-term.
        </Body>
      </Entry>

      <Entry id="up-down" kicker="Up and down" title="Two strokes from off the green.">
        <Lede>
          A subset of scrambling: a <em>chip and a putt</em> from
          within ~30 yards of the green, completed without going to a
          third shot. Doesn't apply when you're already on the green
          or when you've reached green-side bunker territory.
        </Lede>
        <Body>
          Tour up-and-down rate hovers around 60%. For mid-handicaps
          it's closer to 30%. Improving here is largely about
          distance control on chips and reading the first putt.
        </Body>
      </Entry>

      <Entry id="sand-save" kicker="Sand save" title="From the bunker, par or better.">
        <Lede>
          A specific case: any hole where one of your shots was hit
          from a sand bunker and you still made par or better. Hard
          for amateurs because the shot itself is hard.
        </Lede>
        <Body>
          A 50% sand save is excellent recreational play; the field
          average is closer to 35%. The right baseline depends on how
          far from the hole you typically end up — a buried 30-yard
          bunker shot is a different animal than a tap from a green-
          side trap.
        </Body>
      </Entry>

      <Entry id="dispersion" kicker="Dispersion" title="Reading your shot pattern.">
        <Lede>
          The pattern of where your shots actually land relative to
          where you aimed. Centred on your aim point, not the pin.
        </Lede>
        <Body>
          The inner ellipse covers 68% of your shots — your typical
          window. The outer one covers 95% — including the bad ones.
          Two ellipses tilted right of centre means a fade pattern;
          shifted long means you over-club. Aim correction tips you
          to move the centre back over the target by adjusting aim
          the opposite way of the bias.
        </Body>
      </Entry>

      <Footnote>
        Benchmarks based on Mark Broadie's strokes gained research
        and PGA Tour ShotLink data. Amateur averages approximate.
      </Footnote>
      </div>

      <aside
        className="hidden lg:block"
        style={{
          alignSelf: 'start',
          position: 'sticky',
          top: 28,
        }}
      >
        <div className="kicker" style={{ marginBottom: 12 }}>
          On this page
        </div>
        <nav
          style={{
            display: 'flex',
            flexDirection: 'column',
            borderTop: '1px solid #D9D2BF',
          }}
        >
          {SECTION_LINKS.map((s) => {
            const active = activeId === s.id
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={(e) => {
                  e.preventDefault()
                  document
                    .getElementById(s.id)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                style={{
                  padding: '10px 0',
                  borderBottom: '1px solid #D9D2BF',
                  fontSize: 13,
                  color: active ? '#1F3D2C' : '#5C6356',
                  fontWeight: active ? 600 : 400,
                  textDecoration: 'none',
                }}
              >
                {s.label}
              </a>
            )
          })}
        </nav>
      </aside>

      <button
        type="button"
        onClick={() => setJumpOpen(true)}
        className="lg:hidden fixed"
        style={{
          right: 18,
          bottom: 18,
          background: '#FBF8F1',
          border: '1px solid #9F9580',
          borderRadius: 999,
          padding: '12px 16px',
          fontSize: 12,
          fontFamily: 'JetBrains Mono, monospace',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: '#1C211C',
          zIndex: 30,
        }}
      >
        Jump to section
      </button>

      {jumpOpen && (
        <JumpSheet
          activeId={activeId}
          onSelect={(id) => {
            document
              .getElementById(id)
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            setJumpOpen(false)
          }}
          onClose={() => setJumpOpen(false)}
        />
      )}
    </div>
  )
}

function JumpSheet({
  activeId,
  onSelect,
  onClose,
}: {
  activeId: string | null
  onSelect: (id: string) => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(28,33,28,0.55)' }}
      onClick={onClose}
    >
      <div
        className="bg-caddie-surface w-full"
        style={{
          maxWidth: 480,
          borderTop: '1px solid #9F9580',
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          padding: 18,
          paddingBottom: 28,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="kicker" style={{ marginBottom: 14 }}>
          Jump to section
        </div>
        <nav
          style={{
            display: 'flex',
            flexDirection: 'column',
            borderTop: '1px solid #D9D2BF',
          }}
        >
          {SECTION_LINKS.map((s) => {
            const active = activeId === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelect(s.id)}
                style={{
                  padding: '14px 0',
                  borderBottom: '1px solid #D9D2BF',
                  fontSize: 15,
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  color: active ? '#1F3D2C' : '#1C211C',
                  fontWeight: active ? 600 : 500,
                  fontFamily: 'Fraunces, serif',
                  fontStyle: 'italic',
                }}
              >
                {s.label}
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

function useActiveSection(): string | null {
  const [active, setActive] = useState<string | null>(SECTION_LINKS[0]!.id)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '0px 0px -60% 0px', threshold: 0.1 },
    )
    for (const link of SECTION_LINKS) {
      const el = document.getElementById(link.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])
  return active
}

// ===========================================================================
// 1. Strokes gained — the headline entry
// ===========================================================================
function StrokesGainedEntry({ me }: { me: DetailedStats | null }) {
  return (
    <Entry id="strokes-gained" kicker="Strokes gained" title="Strokes gained, in plain English.">
      <Lede>
        <em>Strokes gained</em> measures every shot against an
        expectation. Hit a shot from the same lie and distance as a
        pro might, beat the expected outcome, and you gained strokes;
        come up short, you lost some. Sum the deltas across a round
        and you get a precise read on where your strokes are
        actually coming from — or going.
      </Lede>
      <Body>
        Score alone tells you the result. Strokes gained tells you{' '}
        <em>why</em>. A 78 might be built on a great short game
        bailing out wayward irons, or it might be the iron play
        carrying a leaky putter. The overall score is identical;
        the work to fix it is not.
      </Body>
      <Subkicker>The four categories</Subkicker>
      <Body>
        Every shot fits in exactly one bucket:
      </Body>
      <ul style={{ listStyle: 'none', padding: 0, margin: '14px 0' }}>
        <Bullet term="Off the tee">
          Tee shots on par 4s and par 5s. Your driver swing,
          essentially.
        </Bullet>
        <Bullet term="Approach">
          Shots from outside 30 yards that aren't tee shots — the
          bulk of your iron and hybrid play.
        </Bullet>
        <Bullet term="Around the green">
          Shots from within 30 yards that are not on the green —
          chips, pitches, bunker shots.
        </Bullet>
        <Bullet term="Putting">
          Every shot taken from the green.
        </Bullet>
      </ul>

      <WorkedExample me={me} />

      <Subkicker>Reading the sign</Subkicker>
      <Body>
        Positive numbers mean you played better than the bracket
        baseline at your handicap. Negative means you lost strokes to
        that baseline. <em>+0.3 SG-Putting</em> means your putting
        gave you about a third of a stroke per round vs a typical
        player at your level. <em>−1.4 SG-Approach</em> means your
        irons are leaking 1.4 strokes a round.
      </Body>
      <Body>
        The forest in this app is always positive territory. The
        brick is where strokes leak. If a category sits at zero you
        are the average for your bracket — fine, not a leak.
      </Body>
    </Entry>
  )
}

function WorkedExample({ me: _me }: { me: DetailedStats | null }) {
  return (
    <div
      style={{
        border: '1px solid #D9D2BF',
        background: '#FBF8F1',
        borderRadius: 4,
        padding: 22,
        marginTop: 18,
      }}
    >
      <div className="kicker" style={{ marginBottom: 12 }}>
        A worked example
      </div>
      <p
        className="font-serif text-caddie-ink"
        style={{ fontSize: 17, lineHeight: 1.55, marginBottom: 14 }}
      >
        You hit a 7-iron from <em>155 yards</em> in the fairway and
        end up <em>22 feet</em> from the hole on the green.
      </p>
      <div
        className="grid grid-cols-1 sm:grid-cols-3"
        style={{ gap: 14, marginBottom: 14 }}
      >
        <ExampleRow
          label="Expected from 155 yd"
          value="2.86"
          note="Strokes a 10-handicap typically takes to hole out from there."
        />
        <ExampleRow
          label="Expected from 22 ft"
          value="1.97"
          note="What it usually takes to two-putt from that distance."
        />
        <ExampleRow
          label="Strokes gained"
          value="−0.11"
          note="2.86 − 1.97 − 1 (the shot you just hit)."
          tone="neg"
        />
      </div>
      <p
        className="text-caddie-ink-dim"
        style={{ fontSize: 13, lineHeight: 1.5 }}
      >
        Slightly below baseline. Hit it to <em>10 feet</em> instead
        and the number flips: 2.86 − 1.61 − 1 ={' '}
        <span className="font-serif" style={{ fontStyle: 'italic' }}>
          +0.25
        </span>{' '}
        — a quarter of a stroke gained on a single approach. Stack
        eighteen of those across a round and the difference is
        4–5 strokes.
      </p>
    </div>
  )
}

function ExampleRow({
  label,
  value,
  note,
  tone,
}: {
  label: string
  value: string
  note: string
  tone?: 'pos' | 'neg'
}) {
  const color = tone === 'pos' ? '#1F3D2C' : tone === 'neg' ? '#A33A2A' : '#1C211C'
  return (
    <div>
      <div className="kicker" style={{ marginBottom: 6 }}>
        {label}
      </div>
      <div
        className="font-serif tabular"
        style={{
          fontSize: 26,
          fontStyle: 'italic',
          fontWeight: 500,
          color,
          lineHeight: 1.05,
        }}
      >
        {value}
      </div>
      <div
        className="text-caddie-ink-dim"
        style={{ fontSize: 12, marginTop: 6, lineHeight: 1.4 }}
      >
        {note}
      </div>
    </div>
  )
}

function SGCategoriesTable() {
  const rows = [
    {
      cat: 'Off the tee',
      what: 'Tee shots on par 4s and par 5s.',
      example: 'Driver from the tee on a 410-yd hole.',
    },
    {
      cat: 'Approach',
      what: 'Anything outside 30 yd that isn’t a tee shot.',
      example: '155 yd 7-iron from the fairway. Tee shot on a par-3.',
    },
    {
      cat: 'Around the green',
      what: 'Inside 30 yd of the green, not on the putting surface.',
      example: 'Chip from the fringe; 20 yd flop from rough.',
    },
    {
      cat: 'Putting',
      what: 'Every shot played from the green.',
      example: '22-ft lag; 4-ft come-backer.',
    },
  ]
  return (
    <div>
      <div
        className="font-serif text-caddie-ink"
        style={{
          fontSize: 22,
          fontWeight: 500,
          fontStyle: 'italic',
          marginBottom: 14,
        }}
      >
        What counts where.
      </div>
      <div style={{ borderTop: '1px solid #D9D2BF' }}>
        {rows.map((r) => (
          <div
            key={r.cat}
            className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_2fr]"
            style={{
              gap: 18,
              padding: '14px 0',
              borderBottom: '1px solid #D9D2BF',
              alignItems: 'baseline',
            }}
          >
            <div
              className="font-serif text-caddie-ink"
              style={{ fontSize: 17, fontWeight: 500 }}
            >
              {r.cat}
            </div>
            <div className="text-caddie-ink" style={{ fontSize: 14, lineHeight: 1.5 }}>
              {r.what}
            </div>
            <div
              className="text-caddie-ink-dim"
              style={{ fontSize: 13, lineHeight: 1.5, fontStyle: 'italic' }}
            >
              {r.example}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ===========================================================================
// Benchmarks — by the numbers
// ===========================================================================
const BRACKETS = ['PGA Tour', 'Scratch', '5', '10', '15', '20', '25+'] as const
type BracketLabel = (typeof BRACKETS)[number]

interface BenchmarkRow {
  key: string
  label: string
  values: [number, number, number, number, number, number, number]
  unit?: string
  format: (v: number) => string
  lowerIsBetter?: boolean
  scratchHeadline?: string
  meValue?: number | null
}

function BenchmarkSection({ me }: { me: DetailedStats | null }) {
  const sg = me?.sg
  const ball = me?.ballStriking
  const scoring = me?.scoring
  const short = me?.shortGame
  const { toDisplay, toDisplayFt } = useUnits()

  const sgRows: BenchmarkRow[] = [
    {
      key: 'sg_off_tee',
      label: 'SG · Off the tee',
      values: [1.0, 0.0, -0.3, -0.6, -0.9, -1.2, -1.6],
      format: fmtSG,
      meValue: sg?.offTee ?? null,
    },
    {
      key: 'sg_approach',
      label: 'SG · Approach',
      values: [1.4, 0.0, -0.5, -1.1, -1.7, -2.3, -3.0],
      format: fmtSG,
      meValue: sg?.approach ?? null,
    },
    {
      key: 'sg_around',
      label: 'SG · Around the green',
      values: [0.6, 0.0, -0.3, -0.6, -0.9, -1.2, -1.5],
      format: fmtSG,
      meValue: sg?.aroundGreen ?? null,
    },
    {
      key: 'sg_putting',
      label: 'SG · Putting',
      values: [0.3, 0.0, -0.2, -0.5, -0.8, -1.1, -1.4],
      format: fmtSG,
      meValue: sg?.putting ?? null,
    },
    {
      key: 'sg_total',
      label: 'SG · Total',
      values: [3.3, 0.0, -1.3, -2.8, -4.3, -5.8, -7.5],
      format: fmtSG,
      meValue:
        sg?.offTee != null && sg.approach != null && sg.aroundGreen != null && sg.putting != null
          ? (sg.offTee ?? 0) + (sg.approach ?? 0) + (sg.aroundGreen ?? 0) + (sg.putting ?? 0)
          : null,
    },
  ]

  const scoringRows: BenchmarkRow[] = [
    {
      key: 'avg_score',
      label: 'Avg score',
      values: [69.5, 72, 77, 82, 87, 92, 99],
      format: (v) => v.toFixed(1),
      lowerIsBetter: true,
      meValue: scoring?.avgScore ?? null,
    },
    {
      key: 'gir',
      label: 'GIR %',
      values: [67, 50, 40, 30, 22, 15, 9],
      format: (v) => `${v.toFixed(0)}%`,
      meValue: ball?.girPct ?? null,
    },
    {
      key: 'fairways',
      label: 'Fairways hit',
      values: [62, 55, 50, 44, 38, 32, 26],
      format: (v) => `${v.toFixed(0)}%`,
      meValue: ball?.fairwayPct ?? null,
    },
  ]

  const puttingRows: BenchmarkRow[] = [
    {
      key: 'putts',
      label: 'Putts / round',
      values: [29, 32, 33, 34, 35, 36, 37],
      format: (v) => v.toFixed(1),
      lowerIsBetter: true,
      meValue: short?.puttsPerRound ?? null,
    },
    {
      key: 'three_putt',
      label: '3-putt rate',
      values: [2, 5, 8, 12, 17, 22, 28],
      format: (v) => `${v.toFixed(0)}%`,
      lowerIsBetter: true,
      meValue: short?.threePuttPct ?? null,
    },
    {
      key: 'make_5ft',
      label: 'Make % from 5 ft / 152 cm',
      values: [96, 85, 75, 63, 52, 42, 33],
      format: (v) => `${v.toFixed(0)}%`,
      meValue: null,
    },
    {
      key: 'make_10ft',
      label: 'Make % from 10 ft / 305 cm',
      values: [55, 38, 28, 20, 14, 10, 7],
      format: (v) => `${v.toFixed(0)}%`,
      meValue: null,
    },
  ]

  const ballStrikingRows: BenchmarkRow[] = [
    {
      key: 'driving',
      label: 'Driving distance',
      values: [294, 250, 235, 220, 205, 190, 175],
      format: (v) => toDisplay(v),
      meValue: ball?.drivingDistanceAvg ?? null,
    },
    {
      key: 'proximity',
      label: 'Proximity to pin',
      values: [25, 42, 52, 65, 82, 105, 130],
      format: (v) => toDisplayFt(v),
      lowerIsBetter: true,
      meValue: ball?.proximityAvg != null ? ball.proximityAvg * 3 : null,
    },
  ]

  const [view, setView] = useState<'chart' | 'table'>('chart')
  const profile = useProfile()
  const userBracketIndex = bracketIndexForHandicap(
    profile.data?.handicap_index ?? null,
  )

  return (
    <Entry id="benchmarks" kicker="By the numbers" title="Where you sit in the field.">
      <Lede>
        These bars show where each stat lands across the bell curve,
        from a 25-handicap weekend round all the way up to the PGA
        Tour. Your average for the last ten rounds is plotted as a
        burnt-amber dot — when one is missing it is because the app
        does not have enough rounds to compute it yet.
      </Lede>

      <BenchmarkViewTabs value={view} onChange={setView} />

      {view === 'chart' ? (
        <>
          <BenchmarkGroup title="Strokes gained" rows={sgRows} highlightScratch />
          <BenchmarkGroup title="Scoring + ball striking" rows={scoringRows} />
          <BenchmarkGroup title="Putting" rows={puttingRows} />
          <BenchmarkGroup title="Ball striking" rows={ballStrikingRows} />
        </>
      ) : (
        <BenchmarkTable
          groups={[
            { title: 'Strokes gained', rows: sgRows, isSg: true },
            { title: 'Scoring + ball striking', rows: scoringRows },
            { title: 'Putting', rows: puttingRows },
            { title: 'Ball striking', rows: ballStrikingRows },
          ]}
          userBracketIndex={userBracketIndex}
        />
      )}
    </Entry>
  )
}

function BenchmarkViewTabs({
  value,
  onChange,
}: {
  value: 'chart' | 'table'
  onChange: (v: 'chart' | 'table') => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 0,
        borderBottom: '1px solid #D9D2BF',
        marginTop: 14,
        marginBottom: 18,
      }}
    >
      {(['chart', 'table'] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className="font-mono uppercase"
          style={{
            background: 'transparent',
            border: 'none',
            padding: '8px 16px',
            fontSize: 10,
            letterSpacing: '0.14em',
            color: value === v ? '#1C211C' : '#8A8B7E',
            borderBottom:
              value === v ? '2px solid #1F3D2C' : '2px solid transparent',
            marginBottom: -1,
          }}
        >
          {v}
        </button>
      ))}
    </div>
  )
}

interface BenchmarkGroupSpec {
  title: string
  rows: BenchmarkRow[]
  isSg?: boolean
}

function BenchmarkTable({
  groups,
  userBracketIndex,
}: {
  groups: BenchmarkGroupSpec[]
  userBracketIndex: number | null
}) {
  const headerLabels = ['25+', '20', '15', '10', '5', 'SCR', 'PGA']
  // Reverse mapping: BRACKETS goes PGA → 25+, headerLabels here is 25+ → PGA.
  const reorderIdx = [6, 5, 4, 3, 2, 1, 0]
  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          minWidth: 640,
          width: '100%',
          borderCollapse: 'collapse',
        }}
      >
        <thead>
          <tr style={{ borderBottom: '1px solid #9F9580' }}>
            <th
              className="font-mono uppercase"
              style={{
                fontSize: 10,
                letterSpacing: '0.14em',
                color: '#8A8B7E',
                textAlign: 'left',
                padding: '10px 8px',
              }}
            >
              Stat
            </th>
            {headerLabels.map((h, i) => {
              const highlighted = userBracketIndex != null && i === userBracketIndex
              return (
                <th
                  key={h}
                  className="font-mono uppercase tabular"
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.14em',
                    color: '#8A8B7E',
                    textAlign: 'right',
                    padding: '10px 8px',
                    minWidth: 56,
                    background: highlighted
                      ? 'rgba(31,61,44,0.15)'
                      : 'transparent',
                  }}
                >
                  {h}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {groups.flatMap((g) => [
            <tr key={`group-${g.title}`}>
              <td
                colSpan={8}
                className="kicker"
                style={{
                  padding: '14px 8px 6px',
                  borderTop: '1px solid #D9D2BF',
                }}
              >
                {g.title}
              </td>
            </tr>,
            ...g.rows.map((r) => (
              <tr key={r.key}>
                <td
                  className="font-serif text-caddie-ink"
                  style={{
                    padding: '10px 8px',
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                >
                  {r.label}
                </td>
                {reorderIdx.map((origIdx, headIdx) => {
                  const v = r.values[origIdx]!
                  const tone =
                    g.isSg
                      ? v > 0
                        ? '#1F3D2C'
                        : v < 0
                          ? '#A33A2A'
                          : '#5C6356'
                      : '#1C211C'
                  const highlighted =
                    userBracketIndex != null && headIdx === userBracketIndex
                  return (
                    <td
                      key={origIdx}
                      className="font-serif tabular"
                      style={{
                        padding: '10px 8px',
                        fontSize: 14,
                        fontStyle: g.isSg ? 'italic' : 'normal',
                        textAlign: 'right',
                        color: tone,
                        background: highlighted
                          ? 'rgba(31,61,44,0.15)'
                          : 'transparent',
                      }}
                    >
                      {r.format(v)}
                    </td>
                  )
                })}
              </tr>
            )),
          ])}
        </tbody>
      </table>
    </div>
  )
}

// Convert handicap → table column index (0=25+, 6=PGA).
function bracketIndexForHandicap(h: number | null): number | null {
  if (h == null || !Number.isFinite(h)) return null
  if (h >= 25) return 0
  if (h >= 18) return 1
  if (h >= 13) return 2
  if (h >= 8) return 3
  if (h >= 3) return 4
  return 5 // scratch
}

function BenchmarkGroup({
  title,
  rows,
  highlightScratch,
}: {
  title: string
  rows: BenchmarkRow[]
  highlightScratch?: boolean
}) {
  return (
    <div style={{ marginTop: 22 }}>
      <Subkicker>{title}</Subkicker>
      <div className="flex flex-col" style={{ gap: 18 }}>
        {rows.map((r) => (
          <BenchmarkBar key={r.key} row={r} highlightScratch={highlightScratch} />
        ))}
      </div>
    </div>
  )
}

function BenchmarkBar({
  row,
  highlightScratch,
}: {
  row: BenchmarkRow
  highlightScratch?: boolean
}) {
  const min = Math.min(...row.values)
  const max = Math.max(...row.values)
  const project = (value: number): number => {
    if (max === min) return 50
    // x=0 = worst (left), x=100 = best (right).
    const best = row.lowerIsBetter ? min : max
    const worst = row.lowerIsBetter ? max : min
    const t = (value - worst) / (best - worst)
    return Math.max(0, Math.min(1, t)) * 100
  }

  const ordered = BRACKETS.map((bracket, i) => ({
    bracket,
    value: row.values[i]!,
    pct: project(row.values[i]!),
  })).sort((a, b) => a.pct - b.pct)

  const me = row.meValue
  const meValid = me != null && Number.isFinite(me)
  const mePct = meValid ? project(me!) : null
  // Scratch reference value (PGA = idx 0, Scratch = idx 1, etc.).
  const scratchValue = row.values[1]!

  return (
    <div>
      <div
        className="flex items-baseline justify-between"
        style={{ gap: 14, marginBottom: 8 }}
      >
        <span className="kicker">{row.label}</span>
        {highlightScratch && (
          <span
            className="font-serif tabular text-caddie-ink-dim"
            style={{ fontSize: 13, fontStyle: 'italic' }}
          >
            Scratch · {row.format(scratchValue)}
          </span>
        )}
      </div>
      <div
        style={{
          position: 'relative',
          height: 36,
          background: 'linear-gradient(to right, #FBF8F1 0%, #EBE5D6 50%, #1F3D2C 100%)',
          border: '1px solid #D9D2BF',
          borderRadius: 2,
        }}
      >
        {ordered.map((b) => (
          <div
            key={b.bracket}
            style={{
              position: 'absolute',
              left: `${b.pct}%`,
              top: 0,
              bottom: 0,
              width: 1,
              background: 'rgba(28,33,28,0.35)',
            }}
          />
        ))}
        {mePct != null && (
          <div
            title={`You · ${row.format(me!)}`}
            style={{
              position: 'absolute',
              left: `calc(${mePct}% - 7px)`,
              top: 'calc(50% - 7px)',
              width: 14,
              height: 14,
              borderRadius: 999,
              background: '#A66A1F',
              border: '2px solid #FBF8F1',
            }}
          />
        )}
      </div>
      <div
        className="font-mono uppercase tabular text-caddie-ink-mute"
        style={{
          fontSize: 9,
          letterSpacing: '0.14em',
          marginTop: 4,
          position: 'relative',
          height: 14,
        }}
      >
        {ordered.map((b) => (
          <span
            key={b.bracket}
            style={{
              position: 'absolute',
              left: `${b.pct}%`,
              transform: 'translateX(-50%)',
            }}
          >
            {labelForBracket(b.bracket)}
          </span>
        ))}
      </div>
      <div
        className="flex items-baseline justify-between"
        style={{ marginTop: 18 }}
      >
        <span className="text-caddie-ink-mute" style={{ fontSize: 11 }}>
          25+ HCP{' '}
          <span className="font-serif tabular" style={{ fontStyle: 'italic' }}>
            {row.format(row.values[6]!)}
          </span>
        </span>
        <span className="text-caddie-ink-mute" style={{ fontSize: 11 }}>
          PGA Tour{' '}
          <span className="font-serif tabular" style={{ fontStyle: 'italic' }}>
            {row.format(row.values[0]!)}
          </span>
        </span>
      </div>
      {mePct != null && (
        <div
          className="text-caddie-warn"
          style={{ fontSize: 12, marginTop: 6, fontWeight: 500 }}
        >
          You · <span className="font-serif tabular" style={{ fontStyle: 'italic' }}>{row.format(me!)}</span>
        </div>
      )}
    </div>
  )
}

function labelForBracket(b: BracketLabel): string {
  if (b === 'PGA Tour') return 'PGA'
  if (b === 'Scratch') return 'SCR'
  return b
}

// ===========================================================================
// Layout primitives
// ===========================================================================
function Entry({
  id,
  kicker,
  title,
  children,
}: {
  id: string
  kicker: string
  title?: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      style={{
        borderTop: '1px solid #D9D2BF',
        paddingTop: 22,
        marginBottom: 32,
      }}
    >
      <div className="kicker" style={{ marginBottom: 14 }}>
        {kicker}
      </div>
      {title && (
        <h2
          className="font-serif text-caddie-ink"
          style={{
            fontSize: 28,
            fontWeight: 500,
            fontStyle: 'italic',
            letterSpacing: '-0.015em',
            lineHeight: 1.15,
            marginBottom: 14,
          }}
        >
          {title}
        </h2>
      )}
      {children}
    </section>
  )
}

function Lede({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="font-serif text-caddie-ink"
      style={{
        fontSize: 17,
        lineHeight: 1.55,
        maxWidth: 640,
        marginBottom: 14,
      }}
    >
      {children}
    </p>
  )
}

function Body({ children }: { children: React.ReactNode }) {
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

function Subkicker({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="kicker"
      style={{ marginTop: 14, marginBottom: 12, color: '#5C6356' }}
    >
      {children}
    </div>
  )
}

function Bullet({
  term,
  children,
}: {
  term: string
  children: React.ReactNode
}) {
  return (
    <li
      style={{
        padding: '12px 0',
        borderTop: '1px solid #D9D2BF',
      }}
    >
      <div className="flex items-baseline" style={{ gap: 14 }}>
        <span
          className="font-serif text-caddie-ink"
          style={{ fontSize: 17, fontWeight: 500, fontStyle: 'italic', minWidth: 160 }}
        >
          {term}
        </span>
        <span
          className="text-caddie-ink-dim"
          style={{ fontSize: 14, lineHeight: 1.5 }}
        >
          {children}
        </span>
      </div>
    </li>
  )
}

function Footnote({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="font-mono uppercase text-caddie-ink-mute"
      style={{
        fontSize: 10,
        letterSpacing: '0.14em',
        borderTop: '1px solid #D9D2BF',
        paddingTop: 18,
        marginTop: 18,
        lineHeight: 1.6,
      }}
    >
      {children}
    </div>
  )
}

function fmtSG(v: number): string {
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}`
}
