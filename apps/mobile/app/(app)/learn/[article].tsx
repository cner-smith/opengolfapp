import { Pressable, ScrollView, Text, View } from 'react-native'
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
