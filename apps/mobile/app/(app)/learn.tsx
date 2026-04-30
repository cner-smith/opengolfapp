import { Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { AppBar } from '../../components/ui/AppBar'

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

interface Entry {
  kicker: string
  title: string
  body: string
}

const ENTRIES: Entry[] = [
  {
    kicker: 'Strokes gained',
    title: 'Where strokes come from.',
    body: 'Every shot is graded against an expected outcome at your handicap. Beat the expectation, you gain strokes; come up short, you lose them. Sum across a round and you find out which part of the game is paying you and which is leaking. Score alone tells you the result; SG tells you why.',
  },
  {
    kicker: 'Categories',
    title: 'Off tee · Approach · Around · Putting.',
    body: 'Off tee = par-4 and par-5 tee shots. Approach = anything outside 30 yd that is not a tee shot. Around the green = inside 30 yd, not on the green. Putting = every shot on the green.',
  },
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
  {
    label: 'GIR %',
    pga: '67%',
    scratch: '50%',
    mid: '30%',
    high: '15%',
  },
  {
    label: 'Putts / round',
    pga: '29',
    scratch: '32',
    mid: '34',
    high: '36',
  },
  {
    label: 'Driving distance',
    pga: '294 yd',
    scratch: '250 yd',
    mid: '220 yd',
    high: '190 yd',
  },
]

export default function LearnScreen() {
  const router = useRouter()

  return (
    <View style={{ flex: 1, backgroundColor: '#F2EEE5' }}>
      <AppBar
        eyebrow="Yardage book"
        title="Learn"
        right={
          <Pressable onPress={() => router.back()}>
            <Text
              style={{ ...KICKER, color: 'rgba(242,238,229,0.6)', padding: 4 }}
            >
              ← Back
            </Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 64 }}>
        <Text
          style={{
            color: '#1C211C',
            fontSize: 22,
            fontStyle: 'italic',
            fontWeight: '500',
            lineHeight: 28,
            marginBottom: 8,
          }}
        >
          A coach's column on the stats this app tracks.
        </Text>
        <Text style={{ color: '#5C6356', fontSize: 14, lineHeight: 20 }}>
          What they mean, why they matter, and what the numbers look like
          across the field.
        </Text>

        {ENTRIES.map((e) => (
          <View
            key={e.kicker}
            style={{
              borderTopWidth: 1,
              borderColor: '#D9D2BF',
              paddingTop: 18,
              marginTop: 22,
            }}
          >
            <Text style={{ ...KICKER, marginBottom: 10 }}>{e.kicker}</Text>
            <Text
              style={{
                color: '#1C211C',
                fontSize: 22,
                fontStyle: 'italic',
                fontWeight: '500',
                lineHeight: 28,
                marginBottom: 8,
              }}
            >
              {e.title}
            </Text>
            <Text
              style={{
                color: '#1C211C',
                fontSize: 15,
                lineHeight: 22,
              }}
            >
              {e.body}
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
          <Text style={{ ...KICKER, marginBottom: 10 }}>By the numbers</Text>
          <Text
            style={{
              color: '#1C211C',
              fontSize: 22,
              fontStyle: 'italic',
              fontWeight: '500',
              lineHeight: 28,
              marginBottom: 14,
            }}
          >
            Where the field sits.
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
          <Text
            style={{
              ...KICKER,
              color: '#8A8B7E',
              marginTop: 14,
              lineHeight: 14,
            }}
          >
            Benchmarks based on Mark Broadie's strokes gained research and
            PGA Tour ShotLink data. Amateur averages approximate.
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ minWidth: 80 }}>
      <Text
        style={{
          ...KICKER,
          color: '#5C6356',
          fontSize: 9,
          marginBottom: 4,
        }}
      >
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
