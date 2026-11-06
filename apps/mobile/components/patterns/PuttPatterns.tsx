import { useState } from 'react'
import { Text, View } from 'react-native'
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg'
import {
  MIN_PUTT_MISSES_FOR_BAR,
  PUTT_BANDS,
  shortDate,
  topPuttCorner,
  type PuttDirectionResult,
  type PuttDistanceResult,
  type PuttMissCounts,
  type PuttMissTally,
} from '@oga/core'
import { TYPE, FONT } from '../../lib/typography'
import { Key, KeyText, Rocker } from '../paper/Paper'
import { FONT_CAP, P } from '../paper/tokens'

// The Putter stop on Shot patterns (#747), as on the web: where missed putts
// finish, short or long and left or right, drawn three ways. Meaning is carried
// by position and number; the heavier side is inked only as a second cue.

export type PuttView = 'corners' | 'bars' | 'length'
export interface MissedPutt {
  id: string
  puttDistanceResult?: PuttDistanceResult
  puttDirectionResult?: PuttDirectionResult
  puttDistanceFt?: number
  playedAt: string | null
  course: string | null
  hole: number | null
  roundId: string | null
}

const VIEWS: { value: PuttView; label: string }[] = [
  { value: 'corners', label: 'Corners' },
  { value: 'bars', label: 'Bars' },
  { value: 'length', label: 'By length' },
]
const PENCIL = '#B9B09C'
const CORNER_NAME = { shortLeft: 'short-left', shortRight: 'short-right', longLeft: 'long-left', longRight: 'long-right' } as const
const pct = (n: number, of: number) => (of > 0 ? Math.round((100 * n) / of) : 0)
const dim = [TYPE.body, { color: P.inkDim, fontSize: 12, lineHeight: 17 }]

export function PuttPatterns({ putts, tally: t, view, onView, width }: { putts: MissedPutt[]; tally: PuttMissTally; view: PuttView; onView: (v: PuttView) => void; width: number }) {
  const [listOpen, setListOpen] = useState(false)
  if (t.misses === 0) {
    return (
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serifUpright, { color: P.ink, fontSize: 16, lineHeight: 24, marginTop: 18 }]}>
        No missed putts with a result yet. When you log a putt that misses, mark it short or long and left or right, and it shows here.
      </Text>
    )
  }
  const onLine = t.onLine.short + t.onLine.long
  const noLength = t.misses - PUTT_BANDS.reduce((a, { band }) => a + t.bands[band].misses, 0)
  const caption =
    view === 'corners'
      ? `Square size is the share of misses.${onLine ? ` On line, no side: ${t.onLine.short} short, ${t.onLine.long} long.` : ''}`
      : view === 'bars'
        ? `${onLine ? `${onLine} went on line: they count for short or long only. ` : ''}The heavier side is inked; position and number say it, not colour.`
        : `Bar length is the share within the row. A row under ${MIN_PUTT_MISSES_FOR_BAR} misses shows its counts and no bar. Bands follow the stored putt length (distance to the pin).${noLength ? ` ${noLength} miss${noLength === 1 ? ' has' : 'es have'} no length and count in All only.` : ''}`

  return (
    <View style={{ marginTop: 14 }}>
      <Rocker options={VIEWS} value={view} onChange={(v) => v && onView(v)} />
      <View style={{ marginTop: 10, backgroundColor: P.raised, borderWidth: 1, borderColor: P.line, borderRadius: 3, padding: 12 }}>
        {view === 'corners' ? <Corners t={t} width={width - 26} /> : view === 'bars' ? <Bars t={t} /> : <ByLength t={t} />}
      </View>
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 13, lineHeight: 19, marginTop: 8 }]}>
        {caption}
      </Text>
      <Key
        accessibilityLabel={listOpen ? 'Hide the list of putts' : 'List the putts'}
        onPress={() => setListOpen((o) => !o)}
        style={{ alignSelf: 'flex-start', marginTop: 10 }}
        faceStyle={{ minHeight: 44, paddingHorizontal: 14 }}
      >
        <KeyText size={13}>{listOpen ? 'Hide the list' : 'List the putts'}</KeyText>
      </Key>
      {listOpen &&
        putts.map((p) => {
          const miss = [p.puttDistanceResult, p.puttDirectionResult ?? (p.puttDistanceResult ? 'on line' : null)].filter(Boolean).join(', ')
          const head = `${p.puttDistanceFt != null ? `${Math.round(p.puttDistanceFt)} ft` : 'No length'}: ${miss}`
          const when = [p.hole != null ? `Hole ${p.hole}` : null, p.playedAt ? shortDate(p.playedAt) : null, p.course].filter(Boolean).join(' · ')
          return (
            <View key={p.id} accessible accessibilityLabel={`${head}. ${when}`} style={{ paddingVertical: 10, borderBottomWidth: 1, borderColor: P.line }}>
              <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serifUpright, { fontSize: 15, color: P.ink }]}>{head}</Text>
              {!!when && <Text maxFontSizeMultiplier={FONT_CAP} style={dim}>{when}</Text>}
            </View>
          )
        })}
    </View>
  )
}

// A: four squares around the hole (seen from above, long at the top). Square
// area is the corner's count against the biggest corner.
function Corners({ t, width }: { t: PuttMissTally; width: number }) {
  const c = t.corners
  const max = Math.max(c.shortLeft, c.shortRight, c.longLeft, c.longRight, 1)
  const top = topPuttCorner(t)
  const W = 360
  const H = 320
  const C = 180
  const M = 160
  const side = (n: number) => (n ? 22 + 96 * Math.sqrt(n / max) : 0)
  const cells: { key: keyof typeof c; dx: -1 | 1; dy: -1 | 1 }[] = [
    { key: 'longLeft', dx: -1, dy: -1 },
    { key: 'longRight', dx: 1, dy: -1 },
    { key: 'shortLeft', dx: -1, dy: 1 },
    { key: 'shortRight', dx: 1, dy: 1 },
  ]
  const w = Math.min(width, 400)
  const words = cells.map(({ key }) => `${CORNER_NAME[key]} ${c[key]}`).join(', ')
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Missed putts by corner: ${words}. ${t.long} long, ${t.short} short, ${t.left} left, ${t.right} right.`} style={{ alignItems: 'center' }}>
      <Svg width={w} height={(w * H) / W} viewBox={`0 0 ${W} ${H}`}>
        <Line x1={14} x2={W - 14} y1={M} y2={M} stroke={P.lineStrong} strokeWidth={1} />
        <Line y1={26} y2={H - 26} x1={C} x2={C} stroke={P.lineStrong} strokeWidth={1} />
        {cells.map(({ key, dx, dy }) => {
          const s = side(c[key])
          if (!s) return null
          const inked = top?.corner === key
          const x = dx < 0 ? C - s : C
          const y = dy < 0 ? M - s : M
          return (
            <G key={key}>
              <Rect x={x} y={y} width={s} height={s} fill={inked ? '#2B3A2E' : '#EBE5D6'} stroke={inked ? P.ink : P.lineStrong} strokeWidth={1} />
              <SvgText x={x + s / 2} y={y + s / 2 + 4} textAnchor="middle" fontFamily={inked ? FONT.serifItalic : FONT.serif} fontSize={s > 60 ? 22 : 15} fill={inked ? P.chrome : P.ink}>
                {String(c[key])}
              </SvgText>
              {s > 44 && (
                <SvgText x={x + s / 2} y={y + s / 2 + 19} textAnchor="middle" fontFamily={FONT.body} fontSize={10} fill={inked ? P.chrome : P.inkDim}>
                  {`${pct(c[key], t.misses)}%`}
                </SvgText>
              )}
            </G>
          )
        })}
        <Circle cx={C} cy={M} r={5} fill={P.raised} stroke={P.ink} strokeWidth={1.5} />
        <SvgText x={C} y={16} textAnchor="middle" fontFamily={FONT.body} fontSize={12} fill={P.inkDim}>{`long ↑ · ${t.long}`}</SvgText>
        <SvgText x={C} y={H - 6} textAnchor="middle" fontFamily={FONT.body} fontSize={12} fill={P.inkDim}>{`short ↓ · ${t.short}`}</SvgText>
        <SvgText x={6} y={M - 8} fontFamily={FONT.body} fontSize={12} fill={P.inkDim}>{`← left ${t.left}`}</SvgText>
        <SvgText x={W - 6} y={M - 8} textAnchor="end" fontFamily={FONT.body} fontSize={12} fill={P.inkDim}>{`right ${t.right} →`}</SvgText>
      </Svg>
    </View>
  )
}

// One diverging bar from a centre rule: the two ends' share or count. Both
// ends are the same width, so the centre rule lines up row to row.
function Diverging({ a, b, aWord, bWord, big, share }: { a: number; b: number; aWord: string; bWord: string; big?: boolean; share?: boolean }) {
  const of = a + b
  const pa = pct(a, of)
  const pb = of ? 100 - pa : 0
  const end = (n: number, p: number, heavier: boolean, align: 'left' | 'right') => (
    <View style={{ width: big ? 50 : 32 }}>
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { fontSize: big ? 19 : 14, color: P.ink, textAlign: align }]}>{big ? `${p}%` : n}</Text>
      {share && heavier && <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 10, color: P.inkDim, textAlign: align }]}>{p}%</Text>}
    </View>
  )
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`${aWord} ${a}${share || big ? `, ${pa}%` : ''}; ${bWord} ${b}${share || big ? `, ${pb}%` : ''}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {end(a, pa, a > b, 'right')}
        <View style={{ flex: 1, height: big ? 12 : 9, flexDirection: 'row' }}>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <View style={{ width: `${of ? (100 * a) / of : 0}%`, height: '100%', backgroundColor: a > b ? P.ink : PENCIL }} />
          </View>
          <View style={{ width: 1, marginVertical: -3, backgroundColor: P.inkDim }} />
          <View style={{ flex: 1 }}>
            <View style={{ width: `${of ? (100 * b) / of : 0}%`, height: '100%', backgroundColor: b > a ? P.ink : PENCIL }} />
          </View>
        </View>
        {end(b, pb, b > a, 'left')}
      </View>
      {big && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
          <Text maxFontSizeMultiplier={FONT_CAP} style={dim}>{`← ${aWord} · ${a}`}</Text>
          <Text maxFontSizeMultiplier={FONT_CAP} style={dim}>{`${b} · ${bWord} →`}</Text>
        </View>
      )}
    </View>
  )
}

function Bars({ t }: { t: PuttMissTally }) {
  const block = (title: string, note: string, bar: React.ReactNode) => (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 13, color: P.ink }]}>{title}</Text>
        <Text maxFontSizeMultiplier={FONT_CAP} style={dim}>{note}</Text>
      </View>
      {bar}
    </View>
  )
  return (
    <View style={{ gap: 18 }}>
      {block('Short or long', `${t.short + t.long} putts`, <Diverging a={t.short} b={t.long} aWord="short" bWord="long" big />)}
      {block('Left or right', `${t.left + t.right} with a side`, <Diverging a={t.left} b={t.right} aWord="left" bWord="right" big />)}
    </View>
  )
}

// C: B's two bars for every putt, then for each length band. A thin row
// prints its counts and draws no bar, so noise doesn't read as a finding.
function ByLength({ t }: { t: PuttMissTally }) {
  const rows: { key: string; label: string; c: PuttMissCounts }[] = [
    { key: 'all', label: 'All', c: t },
    ...PUTT_BANDS.map(({ band, label }) => ({ key: band, label, c: t.bands[band] })),
  ]
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 14, paddingBottom: 6 }}>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[dim, { flex: 1, textAlign: 'center', fontSize: 11 }]}>← short · long →</Text>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[dim, { flex: 1, textAlign: 'center', fontSize: 11 }]}>← left · right →</Text>
      </View>
      {rows.map(({ key, label, c }) => {
        const thin = c.misses < MIN_PUTT_MISSES_FOR_BAR
        return (
          <View key={key} style={{ paddingVertical: 10, borderTopWidth: 1, borderColor: '#ECE6D8', gap: 6 }}>
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 13, color: P.ink }]}>
              {label}
              <Text style={{ color: P.inkDim, fontSize: 11 }}>{` · ${c.misses} miss${c.misses === 1 ? '' : 'es'}`}</Text>
            </Text>
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
              {thin ? (
                <>
                  <Text maxFontSizeMultiplier={FONT_CAP} style={[dim, { flex: 1, textAlign: 'center' }]}>{`${c.short} short · ${c.long} long`}</Text>
                  <Text maxFontSizeMultiplier={FONT_CAP} style={[dim, { flex: 1, textAlign: 'center' }]}>{`${c.left} left · ${c.right} right`}</Text>
                </>
              ) : (
                <>
                  <View style={{ flex: 1 }}><Diverging a={c.short} b={c.long} aWord="short" bWord="long" share={key === 'all'} /></View>
                  <View style={{ flex: 1 }}><Diverging a={c.left} b={c.right} aWord="left" bWord="right" share={key === 'all'} /></View>
                </>
              )}
            </View>
          </View>
        )
      })}
    </View>
  )
}
