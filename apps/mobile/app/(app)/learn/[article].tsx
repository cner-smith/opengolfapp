import { Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { findLearnArticle } from '@oga/core'
import { AppBar } from '../../../components/ui/AppBar'

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

const TITLE: import('react-native').TextStyle = {
  color: '#1C211C',
  fontSize: 26,
  fontStyle: 'italic',
  fontWeight: '500',
  lineHeight: 32,
  marginBottom: 14,
}

const BODY: import('react-native').TextStyle = {
  color: '#1C211C',
  fontSize: 15,
  lineHeight: 22,
  marginBottom: 14,
}

const SUBKICKER: import('react-native').TextStyle = {
  ...KICKER,
  color: '#5C6356',
  marginTop: 14,
  marginBottom: 10,
}

export default function ArticleScreen() {
  const router = useRouter()
  const { article: slug } = useLocalSearchParams<{ article: string }>()
  const found = slug ? findLearnArticle(slug) : null

  return (
    <View style={{ flex: 1, backgroundColor: '#F2EEE5' }}>
      <AppBar
        eyebrow={found?.section.title ?? 'Yardage book'}
        title={found?.article.title ?? 'Article'}
        right={
          <Pressable onPress={() => router.back()}>
            <Text style={{ ...KICKER, color: 'rgba(242,238,229,0.6)', padding: 4 }}>
              ← Back
            </Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 64 }}>
        {!found ? (
          <NotFound />
        ) : found.article.status === 'soon' ? (
          <StubBody title={found.article.title} />
        ) : (
          <>
            {found.article.status === 'draft' && <DraftBanner />}
            <LiveArticle id={found.article.id} />
          </>
        )}
      </ScrollView>
    </View>
  )
}

function NotFound() {
  return (
    <View>
      <Text style={TITLE}>Article not found.</Text>
      <Text style={{ ...BODY, color: '#5C6356', fontStyle: 'italic' }}>
        That guide does not exist yet.
      </Text>
    </View>
  )
}

function DraftBanner() {
  return (
    <View
      style={{
        borderLeftWidth: 3,
        borderLeftColor: '#A66A1F',
        borderTopWidth: 1,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderTopColor: '#D9D2BF',
        borderRightColor: '#D9D2BF',
        borderBottomColor: '#D9D2BF',
        borderRadius: 2,
        backgroundColor: '#FBF8F1',
        padding: 14,
        marginBottom: 18,
      }}
    >
      <Text style={{ ...KICKER, color: '#A66A1F', marginBottom: 6 }}>
        Work in progress
      </Text>
      <Text style={{ color: '#1C211C', fontSize: 13, lineHeight: 19 }}>
        This guide is being reviewed for accuracy. Treat specific technique
        advice as provisional until the notice is removed.
      </Text>
    </View>
  )
}

function StubBody({ title }: { title: string }) {
  return (
    <View>
      <Text style={{ ...KICKER, marginBottom: 10 }}>Coming soon</Text>
      <Text style={TITLE}>{title}</Text>
      <Text style={{ ...BODY, color: '#8A8B7E', fontStyle: 'italic' }}>
        This guide is being written. Check back soon.
      </Text>
    </View>
  )
}

function LiveArticle({ id }: { id: string }) {
  switch (id) {
    case 'strokes-gained':
      return <StrokesGainedArticle />
    case 'benchmarks':
      return <BenchmarksArticle />
    case 'glossary':
      return <GlossaryArticle />
    case 'how-to-practice':
      return <HowToPracticeArticle />
    case 'course-management':
      return <CourseManagementArticle />
    case 'mental-game':
      return <MentalGameArticle />
    case 'skill-games-pressure-games':
      return <SkillGamesArticle />
    default:
      return <StubBody title="Article" />
  }
}

function StrokesGainedArticle() {
  return (
    <View>
      <Text style={{ ...KICKER, marginBottom: 10 }}>Strokes gained</Text>
      <Text style={TITLE}>Where strokes come from.</Text>
      <Text style={BODY}>
        Every shot is graded against an expected outcome at your handicap. Beat
        the expectation, you gain strokes; come up short, you lose them. Sum
        across a round and you find out which part of the game is paying you
        and which is leaking. Score alone tells you the result; SG tells you
        why.
      </Text>

      <Text style={SUBKICKER}>The four categories</Text>
      <Text style={BODY}>
        Off tee = par-4 and par-5 tee shots. Approach = anything outside 30 yd
        that is not a tee shot. Around the green = inside 30 yd, not on the
        green. Putting = every shot on the green.
      </Text>
    </View>
  )
}

function BenchmarksArticle() {
  return (
    <View>
      <Text style={{ ...KICKER, marginBottom: 10 }}>By the numbers</Text>
      <Text style={TITLE}>Where the field sits.</Text>
      <Text style={BODY}>
        Reference benchmarks for the stats this app tracks, from a 25-handicap
        weekend round up to the PGA Tour. Use the table to see where you sit
        relative to the bracket above and below your handicap.
      </Text>

      {BENCHMARKS.map((b) => (
        <View
          key={b.label}
          style={{
            borderWidth: 1,
            borderColor: '#D9D2BF',
            backgroundColor: '#FBF8F1',
            borderRadius: 4,
            padding: 14,
            marginBottom: 10,
          }}
        >
          <Text style={{ ...KICKER, marginBottom: 8 }}>{b.label}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            <Stat label="PGA" value={b.pga} />
            <Stat label="Scratch" value={b.scratch} />
            <Stat label="Mid" value={b.mid} />
            <Stat label="High" value={b.high} />
          </View>
        </View>
      ))}

      <Text style={{ ...KICKER, color: '#8A8B7E', marginTop: 14, lineHeight: 14 }}>
        Benchmarks based on Mark Broadie's strokes gained research and PGA
        Tour ShotLink data. Amateur averages approximate.
      </Text>
    </View>
  )
}

function GlossaryArticle() {
  return (
    <View>
      <Text style={{ ...KICKER, marginBottom: 10 }}>Glossary</Text>
      <Text style={TITLE}>Stats glossary.</Text>
      <Text style={BODY}>
        The terms used across the dashboard, defined in plain English.
      </Text>

      {GLOSSARY.map((g) => (
        <View
          key={g.kicker}
          style={{
            borderTopWidth: 1,
            borderColor: '#D9D2BF',
            paddingTop: 18,
            marginTop: 18,
          }}
        >
          <Text style={{ ...KICKER, marginBottom: 8 }}>{g.kicker}</Text>
          <Text
            style={{
              color: '#1C211C',
              fontSize: 20,
              fontStyle: 'italic',
              fontWeight: '500',
              lineHeight: 26,
              marginBottom: 8,
            }}
          >
            {g.title}
          </Text>
          <Text style={{ color: '#1C211C', fontSize: 15, lineHeight: 22 }}>
            {g.body}
          </Text>
        </View>
      ))}
    </View>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ minWidth: 80 }}>
      <Text style={{ ...KICKER, color: '#5C6356', fontSize: 9, marginBottom: 4 }}>
        {label}
      </Text>
      <Text
        style={{
          color: '#1C211C',
          fontSize: 17,
          fontWeight: '500',
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
    </View>
  )
}

const GLOSSARY = [
  {
    kicker: 'Handicap',
    title: 'Your potential best, not your average.',
    body: 'Average of your eight best score differentials over the last twenty rounds. Differentials normalize for course rating + slope so the same number means the same thing across courses.',
  },
  {
    kicker: 'GIR',
    title: 'On the green in regulation.',
    body: 'Reaching the green in (par − 2) strokes. Tour pros sit around 67 percent, scratch amateurs 50, low double digits 30. The cleanest read on ball-striking.',
  },
  {
    kicker: 'Scrambling · Up & down',
    title: 'When you miss the green.',
    body: 'Scrambling = par or better after missing the green. Up and down = chip and a putt from within 30 yd, no extra strokes. Tour up-and-down hovers around 60 percent; mid-handicaps closer to 30.',
  },
  {
    kicker: 'Sand save',
    title: 'Par from the bunker.',
    body: 'A hole where one of your shots was hit from sand and you still made par or better. 50 percent is excellent recreational play; field average 35.',
  },
  {
    kicker: 'Dispersion',
    title: 'Reading the pattern.',
    body: 'The inner ellipse covers 68 percent of your shots — your typical window. The outer one covers 95. A pattern shifted right of centre means a fade bias; the aim correction tip moves the centre back over your target.',
  },
]

function HowToPracticeArticle() {
  return (
    <View>
      <Text style={{ ...KICKER, marginBottom: 10 }}>Improving your game · Draft</Text>
      <Text style={TITLE}>How to practice.</Text>

      <H3>The uncomfortable truth</H3>
      <Para>
        Most golfers practice in a way that feels productive but isn't. They
        hit a bucket of balls, stripe a few drives, feel good, and leave.
        Their handicap doesn't move.
      </Para>
      <Para>
        This isn't laziness. It's that no one ever explained what practice
        is actually for — or that there's a difference between hitting balls
        and getting better.
      </Para>
      <Para>
        There's nothing wrong with going to the range to unwind, enjoy the
        weather, or just swing a club. That's a legitimate and enjoyable
        thing to do. But if your goal is to improve, that's a different
        activity and it requires a different approach.
      </Para>

      <Divider />

      <H3>What practice is actually for</H3>
      <Para>
        Practice exists to change your behavior on the golf course. Not to
        feel good on the range. Not to hit your best shots. To change what
        you do under pressure, on uneven lies, with something at stake.
      </Para>
      <Para>
        If your practice doesn't eventually show up on the course, it wasn't
        practice — it was entertainment. Which, again, is fine. Just know
        which one you're doing.
      </Para>

      <Divider />

      <H3>The four types of practice</H3>

      <H4>Block practice</H4>
      <KV label="What it is">
        Repeating the same shot over and over. 50 7-irons in a row to the
        same target.
      </KV>
      <KV label="Good for">
        Learning a brand new movement. If you're working on a swing change
        with your coach, some repetition helps establish the new pattern.
        Use it sparingly and early.
      </KV>
      <KV label="Not good for">
        Building skills that transfer to the course. Research consistently
        shows that improvement during block practice doesn't stick. You get
        better within the session and worse by the next round.
      </KV>
      <KV label="The trap">
        Block practice feels like learning because you do get better within
        the session. That feeling is misleading. It is one of the most
        well-replicated findings in motor learning research.
      </KV>
      <Note variant="research">
        Research basis: Robert Bjork (UCLA) — contextual interference
        effect. See also: "Make It Stick" by Brown, Roediger, McDaniel.
      </Note>
      <Note variant="todo">TODO: Add specific study citations</Note>

      <H4>Random practice</H4>
      <KV label="What it is">
        Varying every shot. 7-iron, driver, wedge, 5-iron — never hitting
        the same club twice in a row.
      </KV>
      <KV label="Good for">
        Building skills that actually transfer to the course. The research
        on this is consistent across many studies. Random practice feels
        harder and messier but produces dramatically better retention.
      </KV>
      <KV label="Why it works">
        Each time you pick up a different club, your brain has to fully
        reconstruct the motor pattern from scratch. That reconstruction
        process is where learning happens.
      </KV>
      <KV label="Not good for">
        Learning a brand new movement. Don't randomize before you have a
        basic pattern to work with.
      </KV>
      <Note variant="research">
        Research basis: Contextual interference effect, Battig (1979),
        confirmed in many subsequent studies.
      </Note>
      <Note variant="todo">
        TODO: Verify whether the beginner exception is well-established or
        still debated
      </Note>

      <H4>Variable practice</H4>
      <KV label="What it is">
        Same club, different conditions. 9-iron from 100 yards, then 90,
        then uphill, then into wind, then from a downslope.
      </KV>
      <KV label="Good for">
        Building adaptability. Golf never gives you the same shot twice.
        Variable practice trains you for that reality.
      </KV>
      <KV label="Combine it with">
        Random practice for maximum transfer.
      </KV>

      <H4>Pressure practice</H4>
      <KV label="What it is">
        Creating consequences in practice. Something is at stake on each
        shot.
      </KV>
      <Bullets
        items={[
          'Make 5 putts in a row from 6 feet or start over from 0',
          'Last ball in your bucket must hit a specific target',
          'Play a simulated 9 holes on the range — pick targets, keep score',
          'Clock drill: 12 balls around the hole at 3 feet (clock positions), make all 12 in a row or start over',
        ]}
      />
      <KV label="Good for">
        Training your nervous system to perform under pressure. If you've
        never practiced with consequences, your body hasn't learned how to
        handle them on the course.
      </KV>
      <Note variant="research">
        Research basis: Dr. Sian Beilock — "Choke" (2010). Bob Rotella —
        "Golf Is Not a Game of Perfect" (1995).
      </Note>
      <Note variant="todo">
        TODO: Add more specific pressure practice examples from tour player
        documented routines
      </Note>

      <Divider />

      <H3>How to structure a session</H3>
      <Para>
        A well-structured session has a flow. Adjust based on your time and
        current focus area.
      </Para>
      <SessionRows />
      <Note variant="todo">
        TODO: Review these time allocations with a teaching professional.
        The short game / full swing split in particular (Dave Pelz suggests
        ~60% short game) needs more exploration.
      </Note>

      <Divider />

      <H3>Having a goal for the session</H3>
      <Para>
        Before you hit a single ball, decide what you're trying to
        accomplish today.
      </Para>
      <Bullets
        items={[
          'Bad goal: Work on my irons.',
          'Better goal: Work on my ball striking.',
          'Good goal: Hit 7 of 10 approach shots within 20 yards of the target from 150 yards.',
        ]}
      />
      <Para>
        The difference is measurability. If you can't tell whether you
        achieved your goal, it wasn't a goal — it was a vague intention.
      </Para>
      <Para>
        Your OGA strokes gained data tells you exactly where to focus. If
        you're losing 1.2 strokes per round on approach shots, that's your
        focus area. Your practice goal should be specific to that weakness.
      </Para>
      <H4>How to quantify your practice</H4>
      <Bullets
        items={[
          'Track your success rate on pressure games over time',
          'Note which club and distance you practiced',
          'Write down what you worked on and what changed',
          'Connect practice focus to round data over time',
        ]}
      />

      <Divider />

      <H3>What bad practice looks like</H3>

      <H4>The range bucket spiral</H4>
      <Para>
        Buy a large bucket. Hit wedges, feel good. Move to 7-iron, stripe a
        few. Pull out the driver. Spend 45 minutes hitting drivers because
        that's the most fun. Leave feeling like you worked hard. Nothing
        about your game changed.
      </Para>

      <H4>Same shot, same target, same lie</H4>
      <Para>
        You struggle with your 6-iron so you hit 60 6-irons to the same
        target from a flat lie. On the course you face a 6-iron from a
        downslope with water left. These are completely different skills.
      </Para>

      <H4>Practicing your strengths</H4>
      <Para>
        You putt well so you skip the green. You hit your driver well so
        you spend an hour on the tee line. Improvement comes from
        addressing weaknesses, not reinforcing strengths.
      </Para>

      <H4>No target, no feedback</H4>
      <Para>
        Hitting shots without a specific target or any way to evaluate the
        result is exercise, not practice. Useful and enjoyable — but not
        improvement.
      </Para>

      <H4>Working on technique under pressure</H4>
      <Para>
        The course is for playing. The range is for working on technique.
        Working on a swing change during a round rarely ends well.
      </Para>

      <Divider />

      <H3>Practice round vs scoring round</H3>
      <Para>
        Two completely different activities. Mixing them is one of the most
        common mistakes amateurs make.
      </Para>
      <KV label="Practice round mode">
        Experiment. Try the risky shot. Play from a bad lie on purpose. Hit
        two balls. Explore. Score doesn't matter — you're gathering
        information.
      </KV>
      <KV label="Scoring round mode">
        Full pre-shot routine on every shot. Full commitment. No mulligans.
        Track everything. This is performance mode.
      </KV>
      <Para>
        The mistake is being half-committed to both — sort of practicing,
        sort of scoring. You get the anxiety of performance without the
        data of tracking, and the experimentation of practice without the
        freedom of no consequences.
      </Para>
      <Para>
        Before you tee off, decide which mode you're in and commit to it
        fully.
      </Para>

      <Divider />

      <H3>Resources</H3>
      <Note variant="todo">
        These are starting points for further research, not endorsements.
        Verify all links are current before publishing.
      </Note>

      <H4>Books</H4>
      {BOOKS.map((b) => (
        <View
          key={b.title}
          style={{
            borderTopWidth: 1,
            borderColor: '#D9D2BF',
            paddingVertical: 12,
          }}
        >
          <Text
            style={{
              color: '#1C211C',
              fontSize: 15,
              fontStyle: 'italic',
              fontWeight: '500',
            }}
          >
            {b.title}
            {b.by && (
              <Text style={{ color: '#5C6356', fontStyle: 'normal', fontWeight: '400' }}>
                {' '}— {b.by}
              </Text>
            )}
          </Text>
          <Text style={{ color: '#5C6356', fontSize: 14, lineHeight: 20, marginTop: 4 }}>
            {b.note}
          </Text>
        </View>
      ))}

      <H4>Research worth knowing</H4>
      <Bullets
        items={[
          'Robert Bjork — contextual interference, desirable difficulties (UCLA)',
          'Anders Ericsson — deliberate practice and expert performance',
          'Gabriele Wulf — attentional focus research showing external focus cues outperform internal focus cues',
          'Sian Beilock — choking under pressure',
        ]}
      />

      <H4>Online resources</H4>
      <ResourceLink label="TPI (Titleist Performance Institute)" url="https://mytpi.com" />
      <ResourceLink label="Robert Bjork's lab" url="https://bjorklab.psych.ucla.edu" />
      <Note variant="todo" inline>
        TODO: Verify Bjork lab URL is current
      </Note>

      <View
        style={{
          borderTopWidth: 1,
          borderColor: '#D9D2BF',
          paddingTop: 18,
          marginTop: 22,
        }}
      >
        <Text
          style={{
            ...KICKER,
            color: '#8A8B7E',
            lineHeight: 14,
          }}
        >
          Last reviewed May 2026 · Draft, needs instructor review · Edit
          docs/learn/how-to-practice.md to contribute
        </Text>
      </View>
    </View>
  )
}

function H3({ children }: { children: string }) {
  return (
    <Text
      style={{
        color: '#1C211C',
        fontSize: 22,
        fontStyle: 'italic',
        fontWeight: '500',
        lineHeight: 28,
        marginTop: 20,
        marginBottom: 12,
      }}
    >
      {children}
    </Text>
  )
}

function H4({ children }: { children: string }) {
  return (
    <Text
      style={{
        color: '#1C211C',
        fontSize: 17,
        fontStyle: 'italic',
        fontWeight: '500',
        marginTop: 16,
        marginBottom: 6,
      }}
    >
      {children}
    </Text>
  )
}

function Para({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        color: '#1C211C',
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 12,
      }}
    >
      {children}
    </Text>
  )
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Text
      style={{
        color: '#1C211C',
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 10,
      }}
    >
      <Text
        style={{
          fontStyle: 'italic',
          fontWeight: '500',
          color: '#1C211C',
        }}
      >
        {label}.{' '}
      </Text>
      {children}
    </Text>
  )
}

function Bullets({ items }: { items: string[] }) {
  return (
    <View style={{ marginBottom: 12 }}>
      {items.map((item) => (
        <View
          key={item}
          style={{
            flexDirection: 'row',
            marginBottom: 6,
          }}
        >
          <Text style={{ color: '#1C211C', fontSize: 15, lineHeight: 22, marginRight: 6 }}>
            •
          </Text>
          <Text
            style={{
              color: '#1C211C',
              fontSize: 15,
              lineHeight: 22,
              flex: 1,
            }}
          >
            {item}
          </Text>
        </View>
      ))}
    </View>
  )
}

function Divider() {
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderColor: '#D9D2BF',
        marginVertical: 18,
      }}
    />
  )
}

function SessionRows() {
  const rows = [
    { phase: 'Warm up', dur: '10–15 min', why: 'Easy wedges, get body ready. Not practice time.' },
    { phase: 'Skill work', dur: '20–30 min', why: 'Current focus area. Deliberate, with feedback.' },
    { phase: 'Random / variable', dur: '20–30 min', why: 'Whole bag, random clubs, real targets.' },
    { phase: 'Pressure games', dur: '10–15 min', why: 'Consequences on every shot. Keep score.' },
    { phase: 'Short game', dur: '15–20 min', why: 'Chipping and pitching. Don’t skip.' },
    { phase: 'Putting', dur: '10–15 min', why: 'Always end on the green. End by holing putts.' },
  ]
  return (
    <View style={{ borderTopWidth: 1, borderColor: '#D9D2BF', marginBottom: 14 }}>
      {rows.map((r) => (
        <View
          key={r.phase}
          style={{
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderColor: '#D9D2BF',
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ color: '#1C211C', fontSize: 15, fontStyle: 'italic', fontWeight: '500' }}>
              {r.phase}
            </Text>
            <Text style={{ color: '#5C6356', fontSize: 12, fontVariant: ['tabular-nums'] }}>
              {r.dur}
            </Text>
          </View>
          <Text style={{ color: '#5C6356', fontSize: 14, lineHeight: 20 }}>{r.why}</Text>
        </View>
      ))}
    </View>
  )
}

function Note({
  variant,
  inline,
  children,
}: {
  variant: 'research' | 'todo'
  inline?: boolean
  children: React.ReactNode
}) {
  if (!__DEV__) return null
  const tone = variant === 'research' ? '#1F3D2C' : '#A66A1F'
  const label = variant === 'research' ? 'Source' : 'Todo'
  if (inline) {
    return (
      <Text style={{ ...KICKER, color: tone, marginTop: 4 }}>
        [{label}] {children}
      </Text>
    )
  }
  return (
    <View
      style={{
        backgroundColor: '#EBE5D6',
        borderLeftWidth: 3,
        borderLeftColor: tone,
        padding: 12,
        marginBottom: 12,
      }}
    >
      <Text style={{ ...KICKER, color: tone, marginBottom: 4 }}>
        {label} · dev only
      </Text>
      <Text style={{ color: '#5C6356', fontSize: 13, fontStyle: 'italic', lineHeight: 19 }}>
        {children}
      </Text>
    </View>
  )
}

function ResourceLink({ label, url }: { label: string; url: string }) {
  return (
    <Pressable onPress={() => Linking.openURL(url)} style={{ paddingVertical: 8 }}>
      <Text style={{ color: '#1C211C', fontSize: 15, lineHeight: 22 }}>
        {label}:{' '}
        <Text style={{ color: '#1F3D2C', textDecorationLine: 'underline' }}>{url}</Text>
      </Text>
    </Pressable>
  )
}

const BOOKS = [
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
    by: '',
    note: 'Research-based approach to practice from inside 100 yards.',
  },
  {
    title: '"Harvey Penick\'s Little Red Book"',
    by: '',
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
]

const BENCHMARKS = [
  {
    label: 'Avg score',
    pga: '69.5',
    scratch: '72',
    mid: '82 at 10 hcp',
    high: '92 at 20 hcp',
  },
  { label: 'GIR %', pga: '67%', scratch: '50%', mid: '30%', high: '15%' },
  { label: 'Putts / round', pga: '29', scratch: '32', mid: '34', high: '36' },
  {
    label: 'Driving distance',
    pga: '294 yd',
    scratch: '250 yd',
    mid: '220 yd',
    high: '190 yd',
  },
]

function CourseManagementArticle() {
  return (
    <View>
      <Text style={{ ...KICKER, marginBottom: 10 }}>On the course · Draft</Text>
      <Text style={TITLE}>Course management.</Text>

      <H3>You are not on the range anymore</H3>
      <Para>
        The driving range is where you work on your golf swing. The
        golf course is where you work on your score. These are two
        different activities requiring two different mindsets.
      </Para>
      <Para>
        On the range, perfect is the goal. On the course, useful is
        the goal. The player who shoots 78 with ugly but functional
        golf beats the player who shoots 84 hitting it beautifully.
        Score is the only thing the card cares about.
      </Para>
      <Para>
        The moment you step onto the first tee, stop being a golfer
        working on your swing and become a player trying to shoot
        the lowest number possible with the tools you have today.
        Your clubs are tools to get the ball in the hole. Not every
        shot needs to be pretty. It just needs to work.
      </Para>

      <Divider />

      <H3>Know your game, not your best game</H3>
      <Para>
        Course management starts with brutal honesty about what you
        actually do — not what you're capable of on a perfect day.
      </Para>
      <Para>
        Every player has tendencies. You probably miss in a
        predictable direction. You probably have a club you don't
        fully trust. You probably have a shot shape that shows up
        under pressure whether you want it or not.
      </Para>
      <Para>
        The player who knows they hit a soft fade under pressure and
        plays for it will outscore the player who aims straight and
        gets "surprised" by the same fade every time.
      </Para>
      <Para>Before you play, know:</Para>
      <Bullets
        items={[
          'Your predominant miss direction',
          "Which clubs you genuinely trust vs which ones you're hoping work out",
          'How far you actually carry the ball — not your best carry, your reliable carry',
          'Where your game breaks down under pressure',
        ]}
      />
      <Para>
        Your OGA strokes gained data tells you this more clearly
        than your gut does. If SG approach is -1.4 per round, your
        irons are leaking. If SG putting is +0.8, your putter is an
        asset. Play accordingly.
      </Para>

      <Divider />

      <H3>The confidence club rule</H3>
      <Para>
        For any shot on the course, choose the club you can hit the
        shot you need 8 times out of 10. Not the club that gets you
        there if you pure it. Not the club that's technically correct
        on paper. The club you trust.
      </Para>
      <Para>
        Standing over a shot with doubt is one of the most expensive
        things you can do in golf. A committed swing with the "wrong"
        club almost always beats a tentative swing with the "right"
        one. If you're between clubs and one of them makes you
        nervous — hit the other one. Every time.
      </Para>
      <Para>
        Off the tee: hit the longest club you can confidently keep
        in play. That is it. You don't need a perfect drive. You
        need a ball in play. A 220-yard drive in the fairway beats a
        280-yard drive in the trees every single time. Driver is not
        always the answer and there is no shame in hitting 3-wood or
        hybrid off the tee on a tight hole. The Playa doesn't care
        what club anyone else is hitting. The Playa cares about the
        score.
      </Para>

      <Divider />

      <H3>The Way of the Playa</H3>
      <Para>
        Golf content creator Golf Sidekick has articulated a
        philosophy called the Way of the Playa that every amateur
        should understand. The core idea is simple: your ego is the
        most expensive thing in your bag.
      </Para>
      <Para>
        The Playa doesn't care about looking good. The Playa doesn't
        care what club other people are hitting or whether the shot
        looks impressive. The Playa cares about one thing — getting
        the ball in the hole in as few strokes as possible — and
        makes every decision in service of that goal.
      </Para>
      <Para>In practice this looks like:</Para>
      <Bullets
        items={[
          'Hitting 3-wood off the tee when driver puts you in trouble',
          'Laying up short of a hazard even when you think you can probably carry it',
          'Chipping out sideways without shame when trees are in the way',
          'Playing to the fat part of the green instead of attacking a tucked pin',
          'Accepting the penalty and moving on instead of compounding the mistake',
        ]}
      />
      <Para>
        None of these decisions feel exciting. All of them save
        strokes.
      </Para>
      <Para>
        The Playa understands that golf is not a contest of who hits
        the most impressive shots. It's a contest of who takes the
        fewest. These are different games and most amateurs are
        playing the wrong one.
      </Para>
      <Note variant="research">
        Golf Sidekick — YouTube. Search "Way of the Playa." Practical,
        ego-free approach to scoring.
      </Note>

      <Divider />

      <H3>Aim at the center of the green</H3>
      <Para>
        This is a simple rule that will immediately save you strokes.
      </Para>
      <Para>
        Most amateur golfers aim at the pin. The pin is rarely in
        the center of the green. This means most amateur golfers are
        constantly playing the hardest target available — the one
        with the least margin for error.
      </Para>
      <Para>
        Aim at the center of the green unless you have a very
        specific, very good reason not to. The center of the green
        is always a good shot. It never leaves you with a chip from
        the wrong side. It gives you the most margin for your miss.
      </Para>
      <Para>
        A birdie putt from 25 feet is still a birdie putt. What you
        won't have is a chip from the rough, or a three-putt from 60
        feet, or a false front situation because you were attacking
        a back left pin from 170 yards.
      </Para>

      <Divider />

      <H3>Plan the hole backwards</H3>
      <Para>
        Most amateurs walk up to the tee and hit their driver as far
        as they can, then figure out what to do next. This is
        reactive golf. It works well enough on straightforward holes
        and falls apart on anything with a hazard, a difficult
        green, or a premium on position.
      </Para>
      <Para>
        The better approach is to plan the hole in reverse —
        starting at the pin and working back to the tee.
      </Para>
      <Para>
        Start on the green. Where is the pin today? Is it tucked
        behind a bunker, on a shelf, near a false front? Now ask:
        where on the green do I want to be putting from? That tells
        you the ideal approach angle and the ideal landing zone for
        your approach shot.
      </Para>
      <Para>
        Now work back one more shot. To hit the approach from that
        ideal spot, where does your previous shot need to land?
        What's the right side of the fairway? What distance leaves
        you a comfortable full shot rather than an awkward partial?
      </Para>
      <Para>
        Now you know where your tee shot needs to go. Not just "in
        the fairway" — a specific zone that sets up everything that
        follows.
      </Para>
      <Para>
        On a par 5: the same logic applies across three shots
        instead of two. Where do you want to be for your pitch or
        third shot? What does the layup need to accomplish to get
        you there? Where does the tee shot need to go to make the
        layup straightforward?
      </Para>
      <Para>
        This is how caddies think. This is how tour professionals
        think. And it's available to any amateur willing to spend 60
        seconds on the tee thinking before swinging.
      </Para>
      <Para>
        The practice round is where you build this map. Walk the
        hole from green to tee. Stand where the approach shot will
        be played from and look back at the fairway — you'll see
        angles and landing zones you never noticed from the tee.
        That knowledge compounds over time. Players who know a
        course well aren't lucky. They've done this work.
      </Para>

      <Divider />

      <H3>Your free throw range</H3>
      <Para>
        Every player has a distance where they feel genuinely
        comfortable — a yardage where they know, without much doubt,
        that they can get the ball close. This is your free throw
        range.
      </Para>
      <Para>
        For most amateurs it's somewhere between 50 and 100 yards.
        For better players it might be 100-120. Whatever yours is,
        identify it honestly.
      </Para>
      <Para>
        Now start playing shots to leave yourself that number rather
        than just maximizing distance on every shot. Course
        management is partly about engineering the right approach
        shot.
      </Para>
      <Para>
        A 60-yard full wedge from a clean lie is easier than an
        85-yard partial wedge from an awkward distance. Partial
        wedge shots are hard. Full swing wedges are repeatable.
        Don't manufacture difficult shots when strategy can avoid
        them.
      </Para>
      <Para>
        Off the tee on a long par 4: consider what club leaves you a
        full shot in your free throw range rather than just
        grip-and-ripping driver. On a par 5: a layup to your number
        beats going for it from 230 yards with a marginal lie.
      </Para>

      <Divider />

      <H3>The Scoring Method and the Scoring Zone</H3>
      <Para>
        Will Robins, PGA member and Golf Digest Best Young Teachers
        honoree, developed a course management system called The
        Scoring Method that reframes how amateurs think about every
        hole.
      </Para>
      <Para>
        The core concept is the Scoring Zone — a distance close
        enough to the green that you're confident you can finish the
        hole in 3 more shots or fewer. For most beginners and high
        handicappers, start at 75 yards. As your game improves,
        tighten it.
      </Para>
      <Para>
        The Scoring Method tracks just two things per hole on a
        modified scorecard:
      </Para>
      <H4>1. Did you reach the Scoring Zone in two shots?</H4>
      <Para>
        After your first two shots, are you inside your distance?
        Yes or no.
      </Para>
      <H4>
        2. Did you get up and down in 3 shots or fewer from the
        Scoring Zone?
      </H4>
      <Para>
        Once inside your zone, did you convert? Or did you take 4
        from there?
      </Para>
      <Para>
        Track these two numbers for a few rounds and patterns emerge
        fast. Most amateurs discover they're actually reaching the
        Scoring Zone regularly — the problem is converting once they
        get there. That tells you exactly where to practice.
      </Para>
      <Para>
        The deeper power of this system is that it shifts your
        measure of success away from score and toward process. A
        player who reaches the Scoring Zone in two shots and
        converts every time will shoot in the 80s almost regardless
        of how their ball-striking looks. The system shows you what
        actually matters hole by hole.
      </Para>
      <Note variant="research">
        Will Robins — The Scoring Method. thescoringmethod.com and
        YouTube @thescoringmethod
      </Note>

      <Divider />

      <H3>Think target, not trouble</H3>
      <Para>
        When you stand over a shot thinking "don't hit it in the
        water" — you are thinking about the water. Your brain
        doesn't process the "don't" particularly well. You are
        programming yourself to think about exactly what you want to
        avoid.
      </Para>
      <Para>
        Instead: pick a specific, positive target. Not "away from
        the bunker" but "at that tree on the left edge of the
        fairway." A specific target gives your brain and body
        something to work toward rather than something to flee from.
      </Para>
      <Para>
        Manu from The Upbeat Golfer talks extensively about this —
        committing fully to a target and a process before stepping
        into the ball, then letting go of the result. The shot is
        decided before you address it. Doubt after you've committed
        is the enemy. Indecision kills golf shots more reliably than
        poor mechanics.
      </Para>
      <Note variant="research">
        The Upbeat Golfer (Manu) — YouTube. Process-driven approach,
        target commitment, playing without fear.
      </Note>

      <Divider />

      <H3>Never make two mistakes in a row</H3>
      <Para>
        You will hit bad shots. Every player at every level hits bad
        shots. A bad shot is not a crisis — it's golf.
      </Para>
      <Para>
        What turns a bad shot into a big number is the decision that
        follows it.
      </Para>
      <Para>
        After a bad shot, your only job is to get back into
        position. Not to make up for it. Not to be a hero. Not to
        erase it. Just to get somewhere you can play a normal golf
        shot from.
      </Para>
      <Para>Punch out. Accept the bogey. Move on.</Para>
      <Para>
        The double bogey that becomes a triple happens because the
        player tried to thread the needle through the trees instead
        of punching out sideways. The bogey that becomes a triple
        happens because the player went for the green from an
        impossible lie when laying up was obviously the right call.
      </Para>
      <Para>
        A bogey is one over par. A triple is three over. The shots
        themselves might be identical — the decisions are what
        separate them. The Playa takes his medicine every time. The
        Playa never follows a bad shot with a stupid shot.
      </Para>

      <Divider />

      <H3>Be process-driven, not results-driven</H3>
      <Para>
        Most golfers think too little on the golf course. They step
        up to the ball, swing, and react emotionally to wherever it
        goes. There's no plan and no process.
      </Para>
      <Para>
        But there's an opposite problem: once golfers start trying
        to improve, they often start thinking too much. They
        outthink themselves — grinding over swing thoughts, worrying
        about mechanics, replaying the last bad shot — because they
        aren't yet good enough to execute what they're thinking
        about. Analysis paralysis is just as damaging as
        mindlessness.
      </Para>
      <Para>
        The sweet spot is a clear, repeatable pre-shot process:
      </Para>
      <Bullets
        items={[
          'Pick a specific target',
          'Commit fully to the shot',
          'Go through your routine',
          'Pull the trigger',
        ]}
      />
      <Para>
        That's it. You don't need to solve the hole. You need to
        play one shot at a time with full commitment.
      </Para>
      <Para>
        Try tracking — alongside your score — whether you committed
        to each shot. Not whether it went where you wanted. Whether
        you actually went through your process and pulled the
        trigger without doubt.
      </Para>
      <Para>
        Players who track this consistently find their scores drop
        naturally. Not because they're grinding harder on results,
        but because they've replaced reactive, emotional golf with a
        repeatable approach. Results-oriented thinking leads to
        tension, steering, and the exact outcome you were afraid of.
        Process-oriented thinking gives you the best chance of
        executing the shot.
      </Para>

      <Divider />

      <H3>The practice round</H3>
      <Para>
        Course management is not something you can learn sitting in
        a cart or watching videos. It's learned by doing — and the
        practice round is where you do it.
      </Para>
      <Para>
        Play two balls off the tee on every hole. Hit the aggressive
        line you want to hit and the conservative line you think you
        should hit. See which one actually leaves you the better
        approach. You will be surprised how often the conservative
        play gives you just as good an angle — sometimes better.
      </Para>
      <Para>
        From trouble, play a second ball both ways. Hit the hero
        shot you were tempted to play AND the safe punch-out. See
        what actually happens. Most of the time the hero shot costs
        you more than the punch-out. Your gut will stop suggesting
        it so often once your eyes have seen the real results.
      </Para>
      <Para>
        Use the practice round to find your Scoring Zone entry
        points on each hole. Where do you need to be after two shots
        to have a comfortable third? Work backwards from there to
        plan your tee shot.
      </Para>
      <Para>
        A practice round played thoughtfully and with intention is
        worth more for course management than ten range sessions.
        The course is the classroom.
      </Para>

      <Divider />

      <H3>Keep it simple</H3>
      <Para>
        The fundamentals that will lower your score, in order of
        importance:
      </Para>
      <Bullets
        items={[
          'Ball in play off the tee with the longest club you trust',
          'Plan the hole backwards from the pin before you swing',
          "Think about your target, not about where you can't go",
          'Aim at the center of the green',
          'Play to your free throw range',
          'Commit to every shot through your full routine',
          'Never follow a bad shot with a dumb shot',
          'Take your medicine, make your bogey, move on',
        ]}
      />
      <Para>
        That's course management for most amateurs. It's not
        complicated. It's just hard to actually do when there's
        water on the left and your playing partners are watching.
      </Para>
      <Para>
        The Way of the Playa is not a swing philosophy. It's a
        mindset. And it's available to every player at every level
        starting on the very next round they play.
      </Para>

      <Divider />

      <H3>Resources</H3>
      <Note variant="todo">
        Verify all links before publishing.
      </Note>
      {RESOURCES.map((r) => (
        <View
          key={r.title}
          style={{
            borderTopWidth: 1,
            borderColor: '#D9D2BF',
            paddingVertical: 12,
          }}
        >
          <Text
            style={{
              color: '#1C211C',
              fontSize: 15,
              fontStyle: 'italic',
              fontWeight: '500',
            }}
          >
            {r.title}
            {r.by && (
              <Text style={{ color: '#5C6356', fontStyle: 'normal', fontWeight: '400' }}>
                {' '}— {r.by}
              </Text>
            )}
          </Text>
          <Text style={{ color: '#5C6356', fontSize: 14, lineHeight: 20, marginTop: 4 }}>
            {r.note}
          </Text>
        </View>
      ))}

      <View
        style={{
          borderTopWidth: 1,
          borderColor: '#D9D2BF',
          paddingTop: 18,
          marginTop: 22,
        }}
      >
        <Text style={{ ...KICKER, color: '#8A8B7E', lineHeight: 14 }}>
          Last reviewed May 2026 · Draft, needs instructor review ·
          Edit docs/learn/course-management.md to contribute
        </Text>
      </View>
    </View>
  )
}

const RESOURCES = [
  {
    title: 'Golf Sidekick',
    by: '',
    note: 'YouTube. Search "Way of the Playa." Ego-free, score-focused course management for amateurs.',
  },
  {
    title: 'The Upbeat Golfer (Manu)',
    by: '',
    note: 'YouTube. Process-driven mental approach and target commitment.',
  },
  {
    title: 'Will Robins — The Scoring Method',
    by: '',
    note: 'thescoringmethod.com and YouTube @thescoringmethod. The Scoring Zone framework and modified scorecard system.',
  },
  {
    title: '"Golf Is Not a Game of Perfect"',
    by: 'Bob Rotella.',
    note: 'The standard text on playing with what you have that day.',
  },
]

function MentalGameArticle() {
  return (
    <View>
      <Text style={{ ...KICKER, marginBottom: 10 }}>On the course · Draft</Text>
      <Text style={TITLE}>The mental game.</Text>

      <H3>Golf is you versus you</H3>
      <Para>
        Every other sport has an opponent actively trying to stop
        you. In golf, the course is static. The ball sits still and
        waits. Nobody is trying to beat you except you.
      </Para>
      <Para>
        Once you have a functional swing, the game becomes almost
        entirely mental. Most amateurs spend 95% of their practice
        on the physical game and almost none on the mental game.
        The swing is largely solved. The mental game is the frontier.
      </Para>
      <Para>
        Golf is also one of the most humbling experiences available.
        It will find every weakness in your ego and expose it
        repeatedly. Either reduce the ego or suffer. There is no
        third option.
      </Para>

      <Divider />

      <H3>One shot at a time</H3>
      <Para>
        Every touring professional eventually says the same thing:
        one shot at a time. It is repeated so often because it is
        literally true. You cannot replay the last shot. You cannot
        hit the next one until this one is done. The only shot that
        exists is the one in front of you.
      </Para>
      <Para>
        The brain doesn't work this way naturally. It replays the
        shot you just botched. It fast-forwards to the putt on 18.
        It calculates score. All of this thinking happens at exactly
        the moment you need to be doing one thing.
      </Para>
      <Para>
        Bob Rotella describes this as refusing to be seduced by
        results. At the 2008 Masters, Trevor Immelman did not look
        at a single leaderboard until walking up 18. The routine
        protected him all day. The moment he stepped outside it,
        the pressure arrived.
      </Para>
      <Para>
        The short memory is a skill, not a trait. Give yourself a
        window to feel the emotion — Rotella calls it walking it
        off — then drop it. The bad shot already happened. Carrying
        it into the next shot is a choice.
      </Para>

      <Divider />

      <H3>Sulking won't get you anything</H3>
      <Para>
        When Padraig Harrington won the 2007 British Open, he
        knocked two balls into the water on the last hole and made
        double bogey. He still won. He told Rotella afterward that
        it never entered his mind he might blow it. His only
        thought was getting the ball in the hole so he could make
        the playoff.
      </Para>
      <Para>
        Rotella is direct: sulking won't get you anything. Feeling
        sorry, replaying the mistake — none of it changes what
        happened, all of it damages what comes next.
      </Para>

      <Divider />

      <H3>The productive delusion</H3>
      <Para>
        Rotella's first rule: believe you can win. Not hope. Not
        think you have a chance. Believe.
      </Para>
      <Para>
        The player on a putting heater approaches the next putt
        believing it's going in. The player who has been missing
        all afternoon thinks: I'm due. Both are irrational. But the
        golfer who believes stands over the ball with a different
        quality of attention — and that affects the outcome.
      </Para>
      <Para>
        It is the deliberate construction of a mental state that
        serves performance. Call it confidence, call it a productive
        delusion. You are allowed to be delusional in your own
        favor. In golf, it is the correct strategy.
      </Para>

      <Divider />

      <H3>Visualization</H3>
      <Para>
        Before a shot, the mental game starts. Not on the backswing
        — before you take the club out of the bag.
      </Para>
      <Para>
        See the shot you want to hit. The flight, the trajectory,
        the bounce and roll. Like a video, in real time, as if it
        already happened. For putting: see the line, see the ball
        rolling along it, see it drop.
      </Para>
      <Para>
        This is not mysticism. The brain rehearses motor patterns
        through visualization in ways that translate into physical
        execution. Pick a target, visualize the shot, let it rip.
        In that order, every time.
      </Para>
      <Note variant="research">
        Research basis: mental imagery and motor performance. See
        Guillot &amp; Collet (2008) on mental simulation of motor
        actions.
      </Note>

      <Divider />

      <H3>The routine as an anchor</H3>
      <Para>
        A consistent pre-shot routine prepares you physically and
        gives you a repeatable process. But it has a third purpose
        most golfers miss: the routine is an anchor to the present
        moment.
      </Para>
      <Para>
        Curtis Strange won the 1988 U.S. Open looking calm on TV
        but with his heart pounding. He told Rotella he was working
        his tail off just to stay in the present. The routine made
        him look calm and kept him functional.
      </Para>
      <Para>
        When the mind is scattered, going through the routine
        brings you back. Not magic — executing familiar physical
        actions requires present-moment attention.
      </Para>
      <Para>
        Routine must be consistent. Same grip check, same practice
        swing, same target look — every time. The bigger the
        moment, the more important it is the routine does not change.
      </Para>
      <Note variant="research">
        Manu, The Upbeat Golfer — YouTube. Target commitment and
        pre-shot routine for process-driven play.
      </Note>

      <Divider />

      <H3>Patience over aggression</H3>
      <Para>
        Rotella's fourth rule: every time you have the urge to make
        an aggressive play, go with the more conservative one. You
        will always be okay.
      </Para>
      <Para>
        At the 1992 U.S. Open, Tom Kite shot even par in 35-mph
        wind and won by two. Most players didn't break 80. He did
        it by staying patient and letting others beat themselves.
        Patience compounds across 18 holes.
      </Para>

      <Divider />

      <H3>Ignore unsolicited swing advice</H3>
      <Para>
        Rotella tells of a player who made eight birdies in round
        one, stopped by the putting green, got two unsolicited
        comments on his setup, and was a mess by the next day.
      </Para>
      <Para>
        Stop them before they speak. Their comments will creep in
        at the moment you need to be thinking about your target.
        File anything observed for the range later — or let it go.
      </Para>

      <Divider />

      <H3>Calm is a superpower</H3>
      <Para>
        You cannot make good decisions when angry. You cannot swing
        well when amped up or seething. The state of anger is the
        opposite of the state required to hit a golf ball.
      </Para>
      <Para>
        This is not about being emotionless. Feel it briefly,
        privately, then drop it. The next shot needs your full
        attention.
      </Para>
      <Para>
        Hand on chest, feel your breath, look at something specific
        in your environment — grounding techniques exist to pull
        you out of your own mind and back to the course where the
        actual game is being played.
      </Para>

      <Divider />

      <H3>Grounding and the present moment</H3>
      <Para>
        When the mind spirals, the way back is through the body,
        not through more thinking. Feel your feet on the ground.
        Feel the grip in your hands. Look at the grass, the trees,
        the sky.
      </Para>
      <Para>
        The mind in a spiral is pulling you into the past or the
        future. The body only exists in the present. Returning
        attention to physical sensation is the fastest route back
        to where the golf shot actually lives.
      </Para>
      <Para>
        Golf becomes deeply Buddhist here — not attached to
        outcomes, not grasping at results, returning again and
        again to what is actually happening right now. Everything
        else is noise.
      </Para>

      <Divider />

      <H3>Find someone who believes in you</H3>
      <Para>
        Ben Hogan considered quitting early in his career. Valerie
        Hogan wouldn't let him. Confidence in yourself is essential.
        Having someone who sees what you can't yet see in yourself
        — a spouse, a friend, a coach — compounds it.
      </Para>
      <Para>
        For amateurs this might be a playing partner who knows your
        game, or a coach who genuinely believes in your potential.
        Anyone who reflects your capability back to you on the days
        you can't see it. The mental game is not fought entirely
        alone.
      </Para>

      <Divider />

      <H3>Be process-driven, not results-driven</H3>
      <Para>
        Most golfers think too little — react emotionally to where
        the ball goes. The opposite problem: thinking too much.
        Grinding swing thoughts, replaying the last bad shot.
        Analysis paralysis is just as damaging as mindlessness.
      </Para>
      <Para>The sweet spot is a clear, repeatable pre-shot process:</Para>
      <Bullets
        items={[
          'Pick a specific target',
          'Visualize the shot',
          'Commit fully',
          'Go through your routine',
          'Pull the trigger',
        ]}
      />
      <Para>
        Try tracking — alongside your score — whether you committed
        to each shot. Not whether the result was what you wanted.
        Whether you actually went through your process without
        doubt. Process-oriented thinking gives you the best chance
        of executing.
      </Para>

      <Divider />

      <H3>It never gets fully solved</H3>
      <Para>
        Tour pros — with decades of experience and sports
        psychologists — still get in their own way. The goal is
        not to eliminate the mental challenge. It is to recover
        more quickly. The pro who has a double on 6 and is back to
        full focus on 7 has the same challenge as the amateur who
        takes four holes to recover. They just recover faster.
      </Para>
      <Para>That recovery time is what you are training.</Para>

      <Divider />

      <H3>Resources</H3>
      <Note variant="todo">
        Verify all links before publishing.
      </Note>
      {MENTAL_GAME_RESOURCES.map((r) => (
        <View
          key={r.title}
          style={{
            borderTopWidth: 1,
            borderColor: '#D9D2BF',
            paddingVertical: 12,
          }}
        >
          <Text
            style={{
              color: '#1C211C',
              fontSize: 15,
              fontStyle: 'italic',
              fontWeight: '500',
            }}
          >
            {r.title}
            {r.by && (
              <Text style={{ color: '#5C6356', fontStyle: 'normal', fontWeight: '400' }}>
                {' '}— {r.by}
              </Text>
            )}
          </Text>
          <Text style={{ color: '#5C6356', fontSize: 14, lineHeight: 20, marginTop: 4 }}>
            {r.note}
          </Text>
        </View>
      ))}

      <View
        style={{
          borderTopWidth: 1,
          borderColor: '#D9D2BF',
          paddingTop: 18,
          marginTop: 22,
        }}
      >
        <Text style={{ ...KICKER, color: '#8A8B7E', lineHeight: 14 }}>
          Last reviewed May 2026 · Draft, needs review · Edit
          docs/learn/mental-game.md to contribute
        </Text>
      </View>
    </View>
  )
}

const MENTAL_GAME_RESOURCES = [
  {
    title: '"Golf Is Not a Game of Perfect"',
    by: 'Bob Rotella.',
    note: 'The gold standard in golf psychology. Essential reading.',
  },
  {
    title: '"Golf Is a Game of Confidence"',
    by: 'Bob Rotella.',
    note: 'The follow-up, equally valuable.',
  },
  {
    title: 'Bob Rotella — "My 10 Rules on Mental Fitness"',
    by: '',
    note: 'GolfWRX. The ten rules referenced throughout this article.',
  },
  {
    title: '"Zen Golf"',
    by: 'Joseph Parent.',
    note: 'Buddhist-influenced approach to present-moment play.',
  },
  {
    title: 'The Upbeat Golfer (Manu)',
    by: '',
    note: 'YouTube. Process-driven mental approach, target commitment, playing without fear.',
  },
  {
    title: '"The Inner Game of Tennis"',
    by: 'Tim Gallwey.',
    note: 'Not golf-specific but the foundational text on getting out of your own way in sport.',
  },
  {
    title: '"Choke"',
    by: 'Sian Beilock.',
    note: 'The neuroscience of why we perform poorly under pressure and what to do about it.',
  },
]

function SkillGamesArticle() {
  return (
    <View>
      <Text style={{ ...KICKER, marginBottom: 10 }}>Improving your game · Draft</Text>
      <Text style={TITLE}>Skill games and pressure games.</Text>

      <H3>Why games beat mindless repetition</H3>
      <Para>
        Hitting the same shot over and over until you run out of
        balls is the default range session. It feels like practice.
        It largely isn't.
      </Para>
      <Para>
        Games change the dynamic. A target, a score, stakes. You're
        tracking something. You either succeed or you don't. That
        structure forces commitment on each shot — the same
        commitment you need on the course.
      </Para>
      <Para>
        End sessions with games. Technical work belongs earlier
        when focus is fresh. Finish with games when you're shifting
        from mechanics to performance.
      </Para>

      <Divider />

      <H3>The pressure problem</H3>
      <Para>
        The fundamental challenge of practice: you know you have
        another ball. On the course, you don't. That knowledge
        removes consequence from every range swing. You never
        practice the mental state you need when something is
        riding on the shot.
      </Para>
      <Para>
        Pressure games solve this. Create enough consequence that
        missing would genuinely bother you. Not so much that you're
        miserable. Just enough that each shot matters.
      </Para>
      <Para>
        Stakes must be real but not ruinous. A candy bar, ten
        pushups, coffee with a buddy. Too small and you don't
        care. Too large and anxiety takes over.
      </Para>
      <Para>
        The last few balls of any range bucket are a natural
        pressure game. You're out of balls. Make them count.
      </Para>

      <Divider />

      <H3>Putting games</H3>

      <H4>The clock drill</H4>
      <Para>
        Place twelve balls around a hole at three feet — clock
        positions. Make all twelve in a row. Miss and start over.
      </Para>
      <Para>
        Deceptively brutal. Getting to eleven and then missing is
        genuinely painful. That pain is the point — it simulates
        the pressure of needing to make a putt with something on
        the line.
      </Para>
      <Para>
        Move to four feet, then five. Tour players do this from
        six feet as a warm-up. Make all twelve from six and your
        short putting is tour-level.
      </Para>
      <KV label="Variation">
        Use one ball. Walk around the clock, replace after each
        putt, make all twelve in a row. Harder — no second chances,
        and the walk resets your mental state between putts.
      </KV>

      <H4>Three-station pressure drill</H4>
      <Para>
        Three feet, six feet, nine feet. Make ten putts at each
        station before moving on. Miss more than one and start the
        station over.
      </Para>
      <Para>
        Escalating pressure. Three feet is achievable. Six with
        the threat of restart matters. Nine, after completing the
        first two — real pressure. Track total attempts to complete
        all three across sessions.
      </Para>

      <H4>The putting circuit</H4>
      <Para>
        Pick nine holes on the practice green. Par 2 each — one
        putt, two-putt is par, three-putt is bogey. Play it as a
        proper round. Same nine holes every session so you can
        track improvement.
      </Para>
      <KV label="Competitive version">
        Head to head with a partner. Stroke or match play. Adds
        pressure solo practice can't replicate.
      </KV>

      <H4>The gate drill</H4>
      <Para>
        Two tees just wider than your putter, a foot in front of
        the ball on your line. Roll the ball through without
        touching either tee.
      </Para>
      <Para>
        Trains starting line. Most missed putts are missed before
        the ball breaks. Start at six feet straight, then ten,
        then a breaker. Exposes inconsistency in stroke path fast.
      </Para>

      <H4>Speed control — the ladder drill</H4>
      <Para>
        Five balls at ten feet. Hit the first putt — note where it
        finishes. The second must finish on the opposite side of
        the hole from the first. The third must finish between the
        first two.
      </Para>
      <Para>
        Move back five feet and repeat. Trains intentional pace
        variation — directly transferable to lag putting and fast
        greens.
      </Para>

      <Divider />

      <H3>Chipping and short game games</H3>

      <H4>Up and down challenge</H4>
      <Para>
        Five spots around the practice green at varying distances.
        From each spot, chip and putt out. Sum strokes. Set a
        target — maybe 12 — and try to beat it. Lower as you
        improve.
      </Para>
      <KV label="Pressure version">
        Five up-and-downs in a row. Miss one and the streak
        restarts. Getting to four and chunking the next chip is
        exactly the pressure the course creates.
      </KV>

      <H4>Three clubs, one ball per station</H4>
      <Para>
        Three distances — 20, 40, 60 yards. One ball from each.
        No mulligan. The single-ball constraint is everything.
      </Para>

      <H4>Flag left or flag right</H4>
      <Para>
        At the range pick a flag. Before each shot, declare: left
        or right. Within ten feet on the declared side = birdie.
        Correct side, outside the window = par. Wrong side =
        double bogey.
      </Para>
      <Para>
        Teaches two things. First, controlling shot shape under
        pressure — you have to commit before you swing. Second,
        the cost of the short side. Score over ten shots; -4 or
        better is good.
      </Para>

      <Divider />

      <H3>Full swing games</H3>

      <H4>Horse at the range</H4>
      <Para>
        Like the basketball game. Pick a target. Hit. Partner has
        to match it. Miss the match and you get a letter. First
        to H-O-R-S-E loses. Calling your shot before swinging is
        the same skill the course demands.
      </Para>

      <H4>The imaginary fairway</H4>
      <Para>
        Two targets define a fairway, 25–30 yards wide. Ten tee
        shots. Driver in the fairway = 3, fairway wood = 2, iron
        = 1. -2 if you imagine a hazard side and find it.
      </Para>
      <Para>
        Incentivizes driver — the most distance, the most risk.
        Forces a real reward-vs-risk decision on every shot.
      </Para>

      <H4>Same distance, different clubs</H4>
      <Para>
        Pick a flag at 100 yards. Hit it with five different clubs.
        9-iron, 8-iron, PW, GW, SW — each requires a different
        swing length and speed.
      </Para>
      <Para>
        Builds feel for partial shots. Teaches your actual
        distances better than full swings — you're forced to
        feel a 75% swing with each club.
      </Para>

      <H4>Three club challenge</H4>
      <Para>
        Simulated nine-hole round on the range with only three
        clubs — driver, mid iron, wedge. Tee shot, approach, chip
        — each to a different target. Forces creativity. You
        learn to work the ball.
      </Para>

      <Divider />

      <H3>The last ball rule</H3>
      <Para>
        Whatever you're practicing, save your last ball for a
        specific challenge. Announce it before you hit:
      </Para>
      <Bullets
        items={[
          '"This drive has to find the fairway."',
          '"This wedge has to finish within ten feet of the flag."',
          '"This 7-iron has to carry the 150 marker."',
        ]}
      />
      <Para>
        One ball, no second chance. The session ends on this shot
        — and you find out whether the work translates when
        something is riding on it.
      </Para>

      <Divider />

      <H3>Building your own pressure games</H3>
      <Para>
        Generic drills work. Customized stakes work better.
      </Para>
      <KV label="Stakes must be real but not ruinous">
        Candy bar, coffee, pushups, bragging rights. Twenty dollars
        or public embarrassment shuts down performance instead of
        training it.
      </KV>
      <KV label="Streaks beat totals">
        10 of 15 creates less pressure than 5 in a row. Streaks
        carry the weight of every previous success — closer to
        how the course feels.
      </KV>
      <KV label="One-and-done beats best-of">
        A single attempt, no mulligans. The closer to the
        one-chance nature of a real shot, the better.
      </KV>
      <KV label="Track scores over time">
        A game without a scoreboard is a drill. Watching your
        score improve across months is genuinely motivating.
      </KV>

      <Divider />

      <H3>Resources</H3>
      <Note variant="todo">
        Verify all links before publishing.
      </Note>
      {SKILL_GAMES_RESOURCES.map((r) => (
        <View
          key={r.title}
          style={{
            borderTopWidth: 1,
            borderColor: '#D9D2BF',
            paddingVertical: 12,
          }}
        >
          <Text
            style={{
              color: '#1C211C',
              fontSize: 15,
              fontStyle: 'italic',
              fontWeight: '500',
            }}
          >
            {r.title}
            {r.by && (
              <Text style={{ color: '#5C6356', fontStyle: 'normal', fontWeight: '400' }}>
                {' '}— {r.by}
              </Text>
            )}
          </Text>
          <Text style={{ color: '#5C6356', fontSize: 14, lineHeight: 20, marginTop: 4 }}>
            {r.note}
          </Text>
        </View>
      ))}

      <View
        style={{
          borderTopWidth: 1,
          borderColor: '#D9D2BF',
          paddingTop: 18,
          marginTop: 22,
        }}
      >
        <Text style={{ ...KICKER, color: '#8A8B7E', lineHeight: 14 }}>
          Last reviewed May 2026 · Draft, needs review · Edit
          docs/learn/skill-games-pressure-games.md to contribute
        </Text>
      </View>
    </View>
  )
}

const SKILL_GAMES_RESOURCES = [
  {
    title: 'Golf Digest — 15 Best Golf Practice Games',
    by: '',
    note: 'golfdigest.com. Good overview of range and putting green games.',
  },
  {
    title: 'Practical Golf — 5 Games That Build Real Skills',
    by: '',
    note: 'practical-golf.com. Solid pressure games with scoring systems.',
  },
  {
    title: '"Dave Pelz\'s Short Game Bible"',
    by: '',
    note: 'Research-based approach to short game practice. Specific drills backed by data.',
  },
  {
    title: 'The Upbeat Golfer (Manu)',
    by: '',
    note: 'YouTube. Process under pressure, routine under stakes.',
  },
]
