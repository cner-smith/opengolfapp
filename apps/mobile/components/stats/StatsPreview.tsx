import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { barScale } from '@oga/core'
import { TYPE } from '../../lib/typography'
import { Key, KeyText } from '../paper/Paper'
import { PaperTile } from '../paper/Section'
import { FONT_CAP, P } from '../paper/tokens'
import { SGBar } from '../home/SGBreakdown'

// #1076: Stats before the player has a whole round. A = no rounds (what the
// page answers, on a sample 14-handicap); P = only partial rounds (#1078: the
// averages read 0.00 there), Home's words first, then the same sample.

const SAMPLE = [
  { label: 'Off tee', value: 0.42 },
  { label: 'Approach', value: -1.61 },
  { label: 'Around green', value: 0.28 },
  { label: 'Putting', value: 0.53 },
] as const

function ExampleTag() {
  return (
    <View style={{ borderWidth: 1, borderColor: P.brassEdge, backgroundColor: '#F3E6C2', paddingHorizontal: 7, paddingVertical: 2, transform: [{ rotate: '-2deg' }] }}>
      <Text allowFontScaling={false} style={[TYPE.kicker, { fontSize: 10, letterSpacing: 1.6, color: P.brassEdge }]}>EXAMPLE</Text>
    </View>
  )
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <Text
      maxFontSizeMultiplier={FONT_CAP}
      style={[TYPE.serifUpright, { fontSize: 16, lineHeight: 23, color: P.ink, borderLeftWidth: 2, borderColor: P.ink, paddingLeft: 12, marginBottom: 14 }]}
    >
      {children}
    </Text>
  )
}

function Bars() {
  const max = barScale(1.61)
  return (
    <View style={{ gap: 14 }}>
      {SAMPLE.map((s) => <SGBar key={s.label} label={s.label} value={s.value} max={max} bold={s.value < 0} />)}
    </View>
  )
}

function LogARound() {
  const router = useRouter()
  return (
    <View style={{ marginTop: 22 }}>
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.bodyBold, { fontSize: 15, color: P.ink, marginBottom: 8 }]}>Log a round</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Key tone="primary" accessibilityLabel="Log a round on the course" onPress={() => router.push('/(app)/round/new?mode=live')} style={{ flex: 1 }} faceStyle={{ minHeight: 50 }}>
          <KeyText tone="primary" bold>On the course →</KeyText>
        </Key>
        <Key tone="primary" accessibilityLabel="Log a round you’ve played" onPress={() => router.push('/(app)/round/new?mode=past')} style={{ flex: 1 }} faceStyle={{ minHeight: 50 }}>
          <KeyText tone="primary" bold>One you’ve played →</KeyText>
        </Key>
      </View>
    </View>
  )
}

// A: no rounds at all.
export function StatsEmpty() {
  return (
    <View>
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { fontSize: 25, lineHeight: 32, color: P.ink, marginBottom: 8 }]}>
        Where do your strokes go?
      </Text>
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 14, lineHeight: 21, color: P.inkDim, marginBottom: 16 }]}>
        Stats weighs every shot against golfers at your handicap, so you see where you lose strokes and where you win
        them back.
      </Text>
      <PaperTile>
        <Callout>
          <Text style={TYPE.serif}>Approach.</Text> Your biggest leak, about 1.6 strokes a round. Putting is the bright
          spot at +0.53.
        </Callout>
        <Bars />
        {/* paddingLeft 44: the bars' zero line sits 22 right of centre (label 112 vs value 68). */}
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.hand, { fontSize: 13, color: P.graphite, textAlign: 'center', marginTop: 6, paddingLeft: 44 }]}>
          ↑ a typical 14-handicap
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 12, color: P.inkDim, flex: 1 }]}>
            Sample: a 14-handicap, last 10 rounds.
          </Text>
          <ExampleTag />
        </View>
      </PaperTile>
      <LogARound />
    </View>
  )
}

// P: rounds, but none whole. `saved` names the latest one ("9 holes at …").
export function StatsPartialOnly({ holes, course }: { holes: number | null; course: string | null }) {
  const saved = holes ? `Your ${holes} hole${holes === 1 ? '' : 's'}${course ? ` at ${course}` : ''} are saved.` : 'Your round is saved.'
  return (
    <View>
      <PaperTile innerStyle={{ padding: 18 }}>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { fontSize: 22, color: P.ink }]}>No full rounds yet.</Text>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 14, lineHeight: 20, color: P.inkDim, marginTop: 6 }]}>
          {saved} Finish a full round to see your own numbers.
        </Text>
      </PaperTile>
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { fontSize: 19, color: P.ink, marginTop: 22, marginBottom: 10 }]}>
        What you’ll see
      </Text>
      <PaperTile>
        <View style={{ position: 'absolute', right: 10, top: -12 }}>
          <ExampleTag />
        </View>
        <Callout>
          <Text style={TYPE.serif}>Approach</Text> is the biggest leak, about 1.6 strokes a round.
        </Callout>
        <Bars />
      </PaperTile>
      <LogARound />
    </View>
  )
}
