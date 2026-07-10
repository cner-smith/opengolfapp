import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import Svg, { Circle, Line, Rect } from 'react-native-svg'
import {
  ArticleHeader,
  ArticleFooter,
  BulletList,
  DefRow,
  Figure,
  GlanceBox,
  H3,
  Hr,
  Link,
  P,
  Sources,
  Subhead,
  Strong,
  Tag,
  C,
} from '../primitives'
import { FONT } from '../../../lib/typography'

export function TrainingAidsArticle() {
  return (
    <View>
      <ArticleHeader kicker="Your equipment · Training aids" title="Training aids." />

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

      <GlanceBox label="The test for any aid">
        <DefRow term={'“Does it show me something I can’t see myself?”'} first>
          If you can already feel it, you don’t need a device to tell you.
        </DefRow>
        <DefRow term={'“Can I trust the feedback on every rep?”'}>
          A gate that lies or a number that bounces around trains nothing.
        </DefRow>
        <DefRow term={'“Does the skill survive when I put it down?”'}>
          An aid you can’t wean off is a crutch, not a coach.
        </DefRow>
      </GlanceBox>

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
        caption="Railroad tracks: body parallel-left, clubface on the target line."
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
        caption="Two tees form a gate the putt must roll through, on line to the hole."
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
        caption="Clubface grid; the accent dot is where you actually struck it."
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
          The player who strikes it “fine sometimes” and loses distance for no
          obvious reason. Off-center contact is usually the answer, and you can't
          fix a pattern you can't see.
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
        caption="The inclined plane; the dashed line is an over-the-top, off-plane move."
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
        caption="The backswing runs roughly three times as long as the downswing."
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

      <Subhead>Worth owning</Subhead>
      <BulletList
        items={[
          <Text>
            <Strong>Two alignment sticks</Strong> — or two clubs. Aim, ball
            position, and a rough swing plane, all from one cheap pair.
          </Text>,
          <Text>
            <Strong>A mirror</Strong> — putting setup and a square face, the
            cheapest strokes to find at home.
          </Text>,
          <Text>
            <Strong>Impact spray or tape</Strong> — the unvarnished truth about
            where you strike it.
          </Text>,
          <Text>
            <Strong>A landing towel</Strong> — turns aimless chipping into reps at
            a real target.
          </Text>,
          <Text>
            <Strong>A free metronome app</Strong> — tempo, for nothing.
          </Text>,
        ]}
      />

      <Subhead>Skip, or wait</Subhead>
      <BulletList
        items={[
          <Text>
            Anything promising speed or distance from swinging it through the air
            alone.
          </Text>,
          <Text>
            Single-purpose gadgets that just duplicate a three-dollar stick.
          </Text>,
          <Text>
            A premium launch monitor before your carry and contact repeat — you'll
            only be measuring mishits.
          </Text>,
          <Text>
            Aids that work in the yard but never make it to the course, where the
            skill has to show up.
          </Text>,
        ]}
      />

      <P>
        The pattern holds across all of it: a real training aid shows you
        something you can't see, then gets out of the way. If the skill vanishes
        the moment you set the gadget down, it was a feeling — not a habit you
        built.
      </P>

      <Sources
        items={[
          {
            name: 'Why alignment is foundational',
            note: (
              <Text>
                <Link href="https://www.pga.com/story/4-alignment-mistakes-killing-your-golf-game-and-how-to-fix-them">
                  PGA of America · 4 alignment mistakes
                </Link>{' '}
                and{' '}
                <Link href="https://golf.com/instruction/why-aim-alignment-poor-how-fix/">
                  Golf.com · why your aim is poor
                </Link>{' '}
                — most golfers aim off the target without feeling it, and small
                errors miss by yards over distance.
              </Text>
            ),
          },
          {
            name: 'Face angle sets the start line',
            note: (
              <Text>
                <Link href="https://www.trackman.com/blog/golf/what-is-face-angle">
                  TrackMan · what is face angle
                </Link>{' '}
                and{' '}
                <Link href="https://www.trackman.com/blog/golf/6-trackman-numbers-all-amateur-golfers-should-know">
                  6 numbers every amateur should know
                </Link>{' '}
                — the clubface controls roughly 75–85% of where the ball starts
                (most with the driver), which is why putting and impact aids
                train a square strike.
              </Text>
            ),
          },
          {
            name: 'Tempo — the three-to-one ratio',
            note: (
              <Text>
                <Link href="https://tourtempo.com/pages/tour-tempo-app">
                  Tour Tempo
                </Link>{' '}
                on the 3:1 backswing-to-downswing finding, and{' '}
                <Link href="https://www.pga.com/story/find-a-rhythm-and-tempo-that-fits-your-game">
                  PGA of America · rhythm and tempo
                </Link>{' '}
                — tour players hold a steady ratio; amateurs often rush the
                transition.
              </Text>
            ),
          },
          {
            name: 'Launch monitors — which numbers, and what they cost',
            note: (
              <Text>
                <Link href="https://www.trackman.com/blog/golf/the-ultimate-guide-to-understanding-trackman">
                  TrackMan · the ultimate guide to the data
                </Link>{' '}
                and{' '}
                <Link href="https://mygolfspy.com/buyers-guide/we-tested-12-launch-monitors-ranging-from-500-to-5000-whats-the-real-difference/">
                  MyGolfSpy · $500 to $5,000 tested
                </Link>{' '}
                — ball speed and carry are reliable on budget units; spin and launch
                precision are what the expensive ones buy.
              </Text>
            ),
          },
        ]}
      />

      <ArticleFooter>
        Last reviewed May 2026
      </ArticleFooter>
    </View>
  )
}

// ── local helpers (article-specific, co-located) ────────────────────────────

// One aid category: an optional editorial diagram stacked above the prose.
function Aid({
  name,
  trains,
  svg,
  caption,
  children,
}: {
  name: string
  trains: string
  svg?: ReactNode
  caption?: string
  children: ReactNode
}) {
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 14, marginBottom: 14 }}>
      {svg ? <Figure caption={caption}>{svg}</Figure> : null}
      <Text style={{ color: C.ink, fontFamily: FONT.serifItalic, fontSize: 18, marginBottom: 6 }}>
        {name}
      </Text>
      <Text style={{ color: C.inkDim, fontFamily: FONT.body, fontSize: 14, lineHeight: 22, marginBottom: 8 }}>
        <Tag>Trains</Tag> {trains}
      </Text>
      {children}
    </View>
  )
}

function AidBody({ children }: { children: ReactNode }) {
  return (
    <Text style={{ color: C.inkDim, fontFamily: FONT.body, fontSize: 14, lineHeight: 22, marginBottom: 8 }}>
      {children}
    </Text>
  )
}

function LookFor({ children }: { children: ReactNode }) {
  return (
    <Text style={{ color: C.inkDim, fontFamily: FONT.body, fontSize: 14, lineHeight: 22 }}>
      <Tag>Look for</Tag> {children}
    </Text>
  )
}

// Which launch-monitor numbers are an amateur's, and which can wait.
// Web's 2-col table → stacked term/description rows on phone.
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
      who: 'Coaches and better players. Face angle alone sets about 75–85% of your start line (most with the driver) — worth knowing, hard to change without help.',
    },
  ]
  return (
    <View style={{ marginBottom: 18 }}>
      {rows.map((r, i) => (
        <DefRow key={r.num} term={r.num} first={i === 0}>
          {r.who}
        </DefRow>
      ))}
    </View>
  )
}

// ── editorial line-art diagrams (re-authored in react-native-svg) ────────────
// Each keeps the web inline svg's viewBox "0 0 160 96" + exact coordinate /
// path data. Palette via C; full-width to fit the phone Figure box.

// Railroad tracks: body parallel-left, clubface on the target line.
function AlignmentDiagram() {
  return (
    <Svg width="100%" height={96} viewBox="0 0 160 96">
      <Line x1={36} y1={68} x2={140} y2={30} stroke="#9F9580" strokeWidth={1.5} />
      <Line x1={26} y1={84} x2={130} y2={46} stroke="#9F9580" strokeWidth={1.5} />
      <Circle cx={36} cy={68} r={4} fill={C.ink} />
      <Circle cx={140} cy={30} r={5} fill="none" stroke={C.ink} strokeWidth={1.5} />
      <Circle cx={140} cy={30} r={1.5} fill={C.ink} />
    </Svg>
  )
}

// Two tees form a gate the putt must roll through, on line to the hole.
function PuttingGateDiagram() {
  return (
    <Svg width="100%" height={96} viewBox="0 0 160 96">
      <Line x1={28} y1={50} x2={134} y2={50} stroke="#9F9580" strokeWidth={1.5} />
      <Line x1={74} y1={36} x2={74} y2={44} stroke={C.ink} strokeWidth={1.5} />
      <Line x1={74} y1={56} x2={74} y2={64} stroke={C.ink} strokeWidth={1.5} />
      <Circle cx={28} cy={50} r={4} fill={C.ink} />
      <Circle cx={144} cy={50} r={6} fill="none" stroke={C.ink} strokeWidth={1.5} />
    </Svg>
  )
}

// Clubface grid; the accent dot is where you actually struck it.
function ImpactFaceDiagram() {
  return (
    <Svg width="100%" height={96} viewBox="0 0 160 96">
      <Rect x={56} y={16} width={48} height={64} rx={3} fill={C.bg} stroke={C.ink} strokeWidth={1.5} />
      <Line x1={72} y1={16} x2={72} y2={80} stroke={C.line} strokeWidth={1} />
      <Line x1={88} y1={16} x2={88} y2={80} stroke={C.line} strokeWidth={1} />
      <Line x1={56} y1={37} x2={104} y2={37} stroke={C.line} strokeWidth={1} />
      <Line x1={56} y1={59} x2={104} y2={59} stroke={C.line} strokeWidth={1} />
      <Circle cx={80} cy={48} r={4} fill="none" stroke="#9F9580" strokeWidth={1} />
      <Circle cx={92} cy={34} r={3.5} fill={C.accent} />
    </Svg>
  )
}

// The inclined plane; the dashed line is an over-the-top, off-plane move.
function SwingPlaneDiagram() {
  return (
    <Svg width="100%" height={96} viewBox="0 0 160 96">
      <Line x1={18} y1={80} x2={144} y2={80} stroke={C.line} strokeWidth={1.5} />
      <Line x1={42} y1={80} x2={138} y2={24} stroke="#9F9580" strokeWidth={1.5} />
      <Line x1={42} y1={80} x2={96} y2={18} stroke="#9F9580" strokeWidth={1.5} strokeDasharray="3 3" />
      <Line x1={42} y1={80} x2={80} y2={58} stroke={C.ink} strokeWidth={2.5} />
      <Circle cx={42} cy={80} r={4} fill={C.ink} />
    </Svg>
  )
}

// The backswing runs roughly three times as long as the downswing.
function TempoDiagram() {
  return (
    <Svg width="100%" height={96} viewBox="0 0 160 96">
      <Rect x={20} y={32} width={120} height={14} rx={2} fill="#9F9580" />
      <Rect x={20} y={56} width={40} height={14} rx={2} fill={C.ink} />
    </Svg>
  )
}
