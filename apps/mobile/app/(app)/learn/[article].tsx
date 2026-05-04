import { useState } from 'react'
import { Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { AppBar } from '../../../components/ui/AppBar'
import { findArticle } from '../../../components/learn/sections'

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
  const found = slug ? findArticle(slug) : null

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
        ) : found.article.status === 'stub' ? (
          <StubBody title={found.article.title} />
        ) : (
          <LiveArticle id={found.article.id} />
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

      <WipBanner />

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

function WipBanner() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return (
    <View
      style={{
        backgroundColor: '#FBF8F1',
        borderLeftWidth: 3,
        borderLeftColor: '#A66A1F',
        borderTopWidth: 1,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#D9D2BF',
        borderRadius: 2,
        padding: 14,
        marginBottom: 18,
        flexDirection: 'row',
        gap: 12,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ ...KICKER, color: '#A66A1F', marginBottom: 6 }}>
          Work in progress
        </Text>
        <Text style={{ color: '#1C211C', fontSize: 14, lineHeight: 20 }}>
          This guide is being reviewed for accuracy. Treat specific
          technique advice as provisional until the notice is removed.
        </Text>
      </View>
      <Pressable
        onPress={() => setDismissed(true)}
        style={{
          borderWidth: 1,
          borderColor: '#D9D2BF',
          borderRadius: 2,
          paddingHorizontal: 10,
          paddingVertical: 6,
          alignSelf: 'flex-start',
        }}
      >
        <Text style={{ ...KICKER, color: '#5C6356' }}>Dismiss</Text>
      </Pressable>
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
