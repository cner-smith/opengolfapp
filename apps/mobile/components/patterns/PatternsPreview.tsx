import { useRef, type ReactNode } from 'react'
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import Svg, { Circle, Ellipse, Line, Path, Rect, Text as SvgText } from 'react-native-svg'
import { useRouter } from 'expo-router'
import { MIN_SAMPLES_FOR_STATS as MIN_SHOTS, clubNoun, type Club } from '@oga/core'
import { useUnits } from '../../hooks/useUnits'
import { FONT, TYPE } from '../../lib/typography'
import { Key, KeyText } from '../paper/Paper'
import { PaperTile, SectionHead } from '../paper/Section'
import { FONT_CAP, P } from '../paper/tokens'

// #1076: what Shot Patterns shows before the player has a pattern. B = no
// aimed shots at all (a marked-up example 7-iron), P = the club in view is
// still under the wheel's 5-shot rule. Both end on the same explainer.

const PAD = 18
const NUMBER_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five']

// Pencil note in the chart: Kalam over a paper halo (react-native-svg has no
// paint-order, so the halo is its own text underneath).
function Hand({ x, y, children, anchor = 'start', size = 14, color = P.graphite }: {
  x: number
  y: number
  children: string
  anchor?: 'start' | 'middle' | 'end'
  size?: number
  color?: string
}) {
  const t = { x, y, fontSize: size, fontFamily: FONT.hand, textAnchor: anchor }
  return (
    <>
      <SvgText {...t} stroke={P.raised} strokeWidth={4} strokeLinejoin="round" fill={P.raised}>{children}</SvgText>
      <SvgText {...t} fill={color}>{children}</SvgText>
    </>
  )
}

function Arrow({ d, head }: { d: string; head: string }) {
  const s = { fill: 'none', stroke: P.graphite, strokeWidth: 1.3, strokeLinecap: 'round' as const }
  return (
    <>
      <Path d={d} {...s} />
      <Path d={head} {...s} strokeLinejoin="round" />
    </>
  )
}

function ExampleTag({ style }: { style?: object }) {
  return (
    <View
      style={[
        { borderWidth: 1, borderColor: P.brassEdge, backgroundColor: '#F3E6C2', paddingHorizontal: 7, paddingVertical: 2, transform: [{ rotate: '-2deg' }] },
        style,
      ]}
    >
      <Text allowFontScaling={false} style={[TYPE.kicker, { fontSize: 10, letterSpacing: 1.6, color: P.brassEdge }]}>EXAMPLE</Text>
    </View>
  )
}

// Grid + axes shared by both charts (yardage-book squares, left/right labels).
// axisY = the aim's row (the sample chart sits it above centre).
function Grid({ w, h, axisY, xs, ys }: { w: number; h: number; axisY: number; xs: number[]; ys: number[] }) {
  return (
    <>
      <Rect width={w} height={h} fill={P.chrome} />
      {xs.map((x) => <Line key={`x${x}`} x1={x} y1={0} x2={x} y2={h} stroke="#EBE5D6" strokeWidth={1} />)}
      {ys.map((y) => <Line key={`y${y}`} x1={0} y1={y} x2={w} y2={y} stroke="#EBE5D6" strokeWidth={1} />)}
      <Line x1={w / 2} y1={0} x2={w / 2} y2={h} stroke={P.lineStrong} strokeOpacity={0.55} />
      <Line x1={0} y1={axisY} x2={w} y2={axisY} stroke={P.lineStrong} strokeOpacity={0.55} />
      <SvgText x={5} y={axisY - 5} fontSize={10} fontFamily={FONT.body} fill="#8A8B7E">left</SvgText>
      <SvgText x={w - 5} y={axisY - 5} fontSize={10} fontFamily={FONT.body} fill="#8A8B7E" textAnchor="end">right</SvgText>
    </>
  )
}

// A 14-handicap's 7-iron, 24 shots at a 150 yd flag: finishes 6 right and 4
// short on average. Geometry from the v2 mockup (352 × 236 units).
const SAMPLE_DOTS = [
  [163.9, 160.4], [182.7, 139.2], [286.5, 102.8], [242.2, 73], [268.2, 68.2], [180.9, 136.8],
  [109.8, 193.8], [157.2, 92.5], [223.9, 158], [233.7, 153.2], [296.2, 84], [188.1, 226.6],
  [266.4, 101.6], [122.6, 122.8], [282.8, 62.7], [242.8, 42.1], [245.8, 188.4], [117.1, 158],
  [234.9, 142.8], [239.1, 159.8], [275.5, 93.7], [190.6, 98.5], [160.2, 150.7], [186.3, 169.5],
] as const

function SampleChart({ width }: { width: number }) {
  const mean = { x: 212.41, y: 128.28 }
  return (
    <Svg width={width} height={(width * 236) / 352} viewBox="0 0 352 236">
      <Grid w={352} h={236} axisY={104} xs={[54.6, 115.3, 236.7, 297.4]} ys={[43.3, 164.7, 225.4]} />
      <Ellipse cx={mean.x} cy={mean.y} rx={82.46} ry={68.71} fill="rgba(31,61,44,.10)" stroke={P.forest} strokeWidth={1.5} />
      {SAMPLE_DOTS.map(([x, y]) => <Circle key={`${x},${y}`} cx={x} cy={y} r={3} fill={P.ink} fillOpacity={0.42} />)}
      <Line x1={176} y1={104} x2={mean.x} y2={mean.y} stroke={P.graphite} strokeWidth={1.3} strokeDasharray="4 3" />
      <Circle cx={mean.x} cy={mean.y} r={2.6} fill={P.forest} />
      <Circle cx={176} cy={104} r={5.5} fill={P.warn} stroke={P.raised} strokeWidth={2} />
      <Circle cx={139.59} cy={104} r={6.5} fill="none" stroke={P.graphite} strokeWidth={1.2} strokeDasharray="2.5 2.5" />
      <Hand x={10} y={55.6}>you aimed here</Hand>
      <Arrow d="M68.8 61.6 Q127.8 57.7 170.5 98.5" head="M168.6 91.8 L170.5 98.5 L163.7 96.9" />
      <Hand x={10} y={209.9}>aim here instead</Hand>
      <Hand x={10} y={226}>— 6 yd left</Hand>
      <Arrow d="M74.4 195.8 Q122.6 166.4 137.2 111.9" head="M132.2 116.9 L137.2 111.9 L139.0 118.7" />
      <Hand x={342} y={22} anchor="end">two shots in three</Hand>
      <Hand x={342} y={38.1} anchor="end">land in this ring</Hand>
      <Arrow d="M319.6 44.1 Q305.3 72.3 274.2 77.7" head="M280.8 80.1 L274.2 77.7 L279.6 73.2" />
      <Hand x={342} y={226} anchor="end">on average 6 right, 4 short</Hand>
      <Arrow d="M265.0 210.0 Q254.3 163.1 216.1 133.7" head="M218.8 140.2 L216.1 133.7 L223.0 134.7" />
    </Svg>
  )
}

// Start → aim → finish, measured along the line you meant (352 × 226 units).
function BuiltDiagram({ width }: { width: number }) {
  const ink = { stroke: P.graphite, strokeWidth: 1.2 }
  return (
    <Svg width={width} height={(width * 226) / 352} viewBox="0 0 352 226">
      <Rect width={352} height={226} fill={P.chrome} />
      <Line x1={197.12} y1={204} x2={163.38} y2={57.84} stroke={P.warn} strokeWidth={1.6} strokeDasharray="5 4" />
      <Line x1={163.38} y1={57.84} x2={157.98} y2={34.46} stroke={P.warn} strokeOpacity={0.45} strokeWidth={1.2} strokeDasharray="2 4" />
      <Path d="M197.12 204 Q236.38 141.41 223.64 78.83" fill="none" stroke={P.ink} strokeOpacity={0.35} strokeWidth={1.2} />
      <Line x1={171.03} y1={90.97} x2={223.64} y2={78.83} {...ink} />
      <Line x1={171.93} y1={94.87} x2={170.13} y2={87.08} {...ink} />
      <Line x1={224.54} y1={82.72} x2={222.74} y2={74.93} {...ink} />
      <Line x1={149.74} y1={60.99} x2={157.38} y2={94.12} {...ink} />
      <Line x1={154.61} y1={59.87} x2={144.86} y2={62.12} {...ink} />
      <Line x1={162.26} y1={93} x2={152.51} y2={95.25} {...ink} />
      <Circle cx={171.03} cy={90.97} r={1.8} fill={P.graphite} />
      <Circle cx={197.12} cy={204} r={5} fill={P.raised} stroke={P.ink} strokeWidth={1.6} />
      <Circle cx={163.38} cy={57.84} r={11} fill="none" stroke={P.warn} strokeOpacity={0.6} />
      <Circle cx={163.38} cy={57.84} r={5.5} fill={P.warn} stroke={P.raised} strokeWidth={2} />
      <Circle cx={223.64} cy={78.83} r={5} fill={P.ink} />
      <Hand x={209.1} y={208} size={13.5}>you hit from here</Hand>
      <Hand x={149.4} y={31.8} size={13.5} anchor="end">your aim: a spot,</Hand>
      <Hand x={149.4} y={46.8} size={13.5} anchor="end">at a distance</Hand>
      <Hand x={233.6} y={60.8} size={13.5}>it finished here</Hand>
      <Hand x={233.6} y={75.8} size={12} color={P.inkDim}>(your next shot)</Hand>
      <Hand x={199.3} y={102.9} size={13.5} anchor="middle">6 right</Hand>
      <Hand x={145.8} y={84.4} size={13.5} anchor="end">4 short</Hand>
      <Hand x={185.3} y={160.9} size={12.5} anchor="end" color={P.inkDim}>the line you meant</Hand>
    </Svg>
  )
}

function Body({ children, style }: { children: ReactNode; style?: object }) {
  return (
    <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.ink, fontSize: 14, lineHeight: 21, marginBottom: 10 }, style]}>
      {children}
    </Text>
  )
}

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Text
      maxFontSizeMultiplier={FONT_CAP}
      accessibilityRole="link"
      onPress={onPress}
      suppressHighlighting
      style={[TYPE.bodyBold, { color: P.forest, textDecorationLine: 'underline' }]}
    >
      {label}
    </Text>
  )
}

// The "how", under both previews.
function PatternExplainer() {
  const { width } = useWindowDimensions()
  return (
    <View>
      <SectionHead title="How your pattern is built" />
      <PaperTile style={{ marginBottom: 14 }} innerStyle={{ padding: 0, overflow: 'hidden' }}>
        <BuiltDiagram width={width - PAD * 2 - 2} />
      </PaperTile>
      <Body>
        <Text style={TYPE.bodyBold}>Aim at a spot, not just a line.</Text> Put the aim where you want the ball to
        finish: the middle of the green, or the 150 marker on the right side of the fairway.
      </Body>
      <Body>
        Playing a fade or a draw? Still aim where you want it to finish. Your pattern then shows how often the shape
        comes off: a fade that doesn’t turn shows up as a miss left.
      </Body>
      <Body>
        For every shot OGA has three points: where you hit from, where you aimed, and where the ball finished. It
        measures the finish against your aim, along the line you meant to hit: how far left or right, and how far
        long or short.
      </Body>
      <Body>
        After five or more shots with one club, that becomes your estimated pattern: the ring where about two shots in
        three finish, and your average miss.
      </Body>
      <Body>
        It’s where the ball came to rest on the course, with roll, wind and lies included. A simulator or launch
        monitor measures carry and flight in the air, and OGA doesn’t, so your typical distance is total distance on
        real turf.
      </Body>
      <Body style={[TYPE.bodyItalic, { color: P.inkDim, fontSize: 13 }]}>
        Bringing in launch-monitor data is something we’re looking at.
      </Body>
    </View>
  )
}

// Scroll that can jump to the explainer (v3 scroll cue b).
function useExplainerJump() {
  const scroll = useRef<ScrollView>(null)
  const y = useRef(0)
  return {
    scroll,
    onExplainerLayout: (e: { nativeEvent: { layout: { y: number } } }) => {
      y.current = e.nativeEvent.layout.y
    },
    jump: () => scroll.current?.scrollTo({ y: y.current, animated: true }),
  }
}

const ANSWERS = [
  ['Where do my misses go?', 'Right, and a touch short'],
  ['How far does it really go?', '146 yd is a typical 7-iron'],
  ['Where should I aim?', '6 yd left of your target'],
  ['And if I aim there?', '15 of 24 on the green, not 9'],
] as const

// B: no aimed shots yet. Example chart first, four answers, one action; the
// explainer heading peeks under the button so the page reads as going on.
export function PatternsEmpty() {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const { scroll, onExplainerLayout, jump } = useExplainerJump()
  return (
    <ScrollView ref={scroll} contentContainerStyle={{ padding: PAD, paddingBottom: 40 }}>
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { fontSize: 25, lineHeight: 32, color: P.ink, marginBottom: 12 }]}>
        Your misses have a shape.
      </Text>
      <PaperTile innerStyle={{ padding: 0, overflow: 'hidden' }}>
        <View>
          <SampleChart width={width - PAD * 2 - 2} />
          <ExampleTag style={{ position: 'absolute', left: 10, top: 10 }} />
        </View>
        <Text
          maxFontSizeMultiplier={FONT_CAP}
          style={[TYPE.body, { fontSize: 12, color: P.inkDim, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderColor: P.line }]}
        >
          A 14-handicap’s 7-iron · 24 shots aimed at a 150 yd flag
        </Text>
      </PaperTile>
      <View style={{ marginTop: 12, borderTopWidth: 1, borderColor: P.line }}>
        {ANSWERS.map(([q, a]) => (
          <View key={q} style={{ paddingVertical: 3, borderBottomWidth: 1, borderColor: P.line }}>
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 12, color: P.inkDim }]}>{q}</Text>
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { fontSize: 17, lineHeight: 22, color: P.ink }]}>{a}</Text>
          </View>
        ))}
      </View>
      <Key
        tone="primary"
        accessibilityLabel="Track shot patterns on your next round"
        onPress={() => router.push('/(app)/round/new?mode=live&capture=track_patterns')}
        style={{ marginTop: 14 }}
        faceStyle={{ minHeight: 50, paddingHorizontal: 14 }}
      >
        <KeyText tone="primary" bold>Track shot patterns on your next round →</KeyText>
      </Key>
      <View style={{ alignItems: 'center', marginTop: 10, marginBottom: 6 }}>
        <Link label="How your pattern is built ↓" onPress={jump} />
      </View>
      <View onLayout={onExplainerLayout}>
        <PatternExplainer />
      </View>
    </ScrollView>
  )
}

export interface BagProgressRow {
  club: Club
  label: string
  /** Shots with start, aim and finish: the wheel's count. */
  shots: number
  typicalYards: number | null
}

function Pips({ n, size = 6 }: { n: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: size / 2 }}>
      {Array.from({ length: MIN_SHOTS }, (_, i) => (
        <View
          key={i}
          style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: P.ink, backgroundColor: i < n ? P.ink : 'transparent' }}
        />
      ))}
    </View>
  )
}

// The player's own finishes so far (aim-relative), with a pencilled ring
// standing in for the one that draws itself at 5 shots (352 × 190 units).
function ProgressChart({ width, points }: { width: number; points: { alongYards: number; perpYards: number }[] }) {
  const maxAbs = Math.max(20, ...points.map((p) => Math.max(Math.abs(p.alongYards), Math.abs(p.perpYards))))
  const k = 95 / (maxAbs * 1.15)
  const pts = points.map((p) => ({ x: 176 + p.perpYards * k, y: 95 - p.alongYards * k }))
  const mx = pts.length ? pts.reduce((s, p) => s + p.x, 0) / pts.length : 176
  const my = pts.length ? pts.reduce((s, p) => s + p.y, 0) / pts.length : 95
  return (
    <Svg width={width} height={(width * 190) / 352} viewBox="0 0 352 190">
      <Grid w={352} h={190} axisY={95} xs={[40.6, 108.3, 243.7, 311.4]} ys={[27.3, 162.7]} />
      <Ellipse cx={mx} cy={my} rx={54} ry={44} fill="none" stroke={P.graphite} strokeOpacity={0.8} strokeWidth={1.1} strokeDasharray="3 4" strokeLinecap="round" />
      {pts.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={3.7} fill={P.ink} stroke={P.raised} strokeWidth={1.2} />)}
      <Circle cx={176} cy={95} r={5.5} fill={P.warn} stroke={P.raised} strokeWidth={2} />
      <Hand x={10} y={150}>your ring draws</Hand>
      <Hand x={10} y={166}>itself at 5 shots</Hand>
    </Svg>
  )
}

// P: the club in view is filling in. Its own dots, "N of 5", what it unlocks,
// then the bag with each club's progress (tap one to switch).
export function PatternsProgress({
  club,
  points,
  bag,
  onPickClub,
}: {
  club: Club
  points: { alongYards: number; perpYards: number }[]
  bag: BagProgressRow[]
  onPickClub: (c: Club) => void
}) {
  const { width } = useWindowDimensions()
  const { toDisplay } = useUnits()
  const { scroll, onExplainerLayout, jump } = useExplainerJump()
  const n = Math.min(points.length, MIN_SHOTS - 1)
  const left = MIN_SHOTS - n
  const noun = clubNoun(club)
  return (
    <ScrollView ref={scroll} contentContainerStyle={{ padding: PAD, paddingBottom: 40 }}>
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { fontSize: 25, lineHeight: 32, color: P.ink, marginBottom: 12 }]}>
        Your {noun} is filling in.
      </Text>
      <PaperTile innerStyle={{ padding: 0, overflow: 'hidden' }}>
        <ProgressChart width={width - PAD * 2 - 2} points={points} />
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderColor: P.line }}
        >
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 15, color: P.ink }]}>
            <Text style={[TYPE.serif, { fontSize: 28 }]}>{n}</Text> of {MIN_SHOTS} shots
          </Text>
          <Pips n={n} size={13} />
        </View>
      </PaperTile>
      <Body style={{ marginTop: 12, marginBottom: 18 }}>
        {NUMBER_WORDS[left]} more aimed {left === 1 ? noun : `${noun}s`} and you get your own ring, your miss and your
        typical distance. Until then the wheel won’t pick it for you, so choose it when it’s the club.{' '}
        <Link label="How a pattern is built →" onPress={jump} />
      </Body>

      <SectionHead title="Your bag" style={{ marginBottom: 0 }} />
      {bag.map((r) => {
        const ready = r.shots >= MIN_SHOTS
        return (
          <Pressable
            key={r.club}
            accessibilityRole="button"
            accessibilityLabel={`${r.label}, ${ready ? 'pattern ready' : `${MIN_SHOTS - r.shots} more shots`}`}
            accessibilityState={{ selected: r.club === club }}
            onPress={() => onPickClub(r.club)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              minHeight: 44,
              paddingHorizontal: 8,
              marginHorizontal: -8,
              borderBottomWidth: 1,
              borderColor: P.line,
              backgroundColor: r.club === club ? P.well : 'transparent',
            }}
          >
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { fontSize: 19, color: P.ink, flex: 1 }]}>{r.label}</Text>
            {ready ? (
              <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 13, color: P.ink }]}>
                Pattern ready
                {r.typicalYards != null && r.club !== 'putter' ? ` · ${toDisplay(r.typicalYards)} typical` : ''}  →
              </Text>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 13, color: P.ink }]}>{MIN_SHOTS - r.shots} more</Text>
                <Pips n={r.shots} />
              </View>
            )}
          </Pressable>
        )
      })}

      <View onLayout={onExplainerLayout} style={{ marginTop: 22 }}>
        <PatternExplainer />
      </View>
    </ScrollView>
  )
}
