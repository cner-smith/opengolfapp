import { View } from 'react-native'
import { formatSG, formatToPar, type ShareCardNine } from '@oga/core'
import { FONT } from '../../../lib/typography'
import {
  CardFrame,
  CourseName,
  Foot,
  INNER_W,
  Kicker,
  MarksOverlay,
  NINE_NAME,
  NUM,
  NUM_IT,
  T,
  TeeLine,
  TONES,
  type Ink,
  type ShareCardProps,
} from './cardParts'

const LABEL_W = 52
// Height budget (dp, line heights from T), inner 621: kicker 14 · course 10 + 32
// · tee 7 + 17 · gap 22 · two nines 2 × (22 + 30 + 34 + 26) = 224 · totals row
// 143 (the fact list: 4 × 35 + 3 rules) · footer 60 = 529, 92 to spare.
const COL_W = 41

// Style 1: clean paper scorecard, each nine as a printed grid with pencil
// marks, the total and the round's facts beneath.
export function ShareCardScorecard({ model, tone }: ShareCardProps) {
  const c = TONES[tone]
  const { totals, facts, partialLabel, playedNine } = model
  const sub = partialLabel
    ? playedNine
      ? `${NINE_NAME[playedNine]} · ${partialLabel}`
      : partialLabel
    : `${model.holeCount} holes`
  const rows: [string, string][] = []
  if (facts.putts != null) rows.push(['Putts', String(facts.putts)])
  if (facts.fairways) rows.push(['Fairways', `${facts.fairways.hit} of ${facts.fairways.of}`])
  if (facts.gir) rows.push(['Greens in regulation', `${facts.gir.hit} of ${facts.gir.of}`])
  if (model.sg) rows.push(['Strokes gained', formatSG(model.sg.total, 1)])
  return (
    <CardFrame c={c}>
      <Kicker model={model} c={c} />
      <CourseName model={model} c={c} />
      <TeeLine model={model} c={c} />
      <View style={{ height: 22 }} />
      {playedNine === 'back' && <Unplayed c={c} text="Front nine not played." />}
      {model.nines.map((n) => (
        <Nine key={n.label} nine={n} c={c} />
      ))}
      {playedNine === 'front' && <Unplayed c={c} text="Back nine not played." />}
      <View style={{ marginTop: 'auto', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24 }}>
        <View>
          <T style={{ fontFamily: FONT.body, fontSize: 13, color: c.dim }}>{sub}</T>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <T style={[NUM_IT, { fontSize: 84, lineHeight: 92, paddingRight: 6, color: c.ink }]}>{totals.score}</T>
            <T style={[NUM, { fontSize: 24, color: c.dim, marginLeft: 10 }]}>{formatToPar(totals.toPar)}</T>
          </View>
          <T style={{ fontFamily: FONT.body, fontSize: 13, color: c.dim }}>par {totals.par}</T>
        </View>
        <View style={{ flex: 1, maxWidth: 250 }}>
          {rows.map(([label, value], i) => (
            <View
              key={label}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                paddingVertical: 7,
                borderBottomWidth: i === rows.length - 1 ? 0 : 1,
                borderColor: c.line,
              }}
            >
              <T style={{ fontFamily: FONT.body, fontSize: 13, color: c.dim }}>{label}</T>
              <T style={[NUM, { fontSize: 17, color: c.ink }]}>{value}</T>
            </View>
          ))}
        </View>
      </View>
      <Foot c={c} />
    </CardFrame>
  )
}

function Unplayed({ c, text }: { c: Ink; text: string }) {
  return (
    <T style={{ fontFamily: FONT.serifItalic, fontSize: 16, color: c.mute, paddingTop: 10, paddingBottom: 22 }}>{text}</T>
  )
}

function Nine({ nine, c }: { nine: ShareCardNine; c: Ink }) {
  const cell = { width: COL_W, textAlign: 'center' as const }
  return (
    <View style={{ marginBottom: 26 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingBottom: 6, borderBottomWidth: 1, borderColor: c.line }}>
        <View style={{ width: LABEL_W }} />
        {nine.holes.map((h) => (
          <T key={h.number} style={[cell, { fontFamily: FONT.body, fontSize: 11, color: c.mute }]}>{h.number}</T>
        ))}
        <T style={{ flex: 1, textAlign: 'right', fontFamily: FONT.body, fontSize: 12, color: c.dim }}>{nine.label}</T>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 30 }}>
        <T style={{ width: LABEL_W, fontFamily: FONT.body, fontSize: 12, color: c.dim }}>Par</T>
        {nine.holes.map((h) => (
          <T key={h.number} style={[cell, NUM, { fontSize: 15, color: c.dim }]}>{h.par}</T>
        ))}
        <T style={[NUM, { flex: 1, textAlign: 'right', fontSize: 15, color: c.dim }]}>{nine.par}</T>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 34, borderBottomWidth: 1, borderColor: c.line }}>
        <T style={{ width: LABEL_W, fontFamily: FONT.body, fontSize: 12, color: c.dim }}>Score</T>
        {nine.holes.map((h) => (
          <T key={h.number} style={[cell, NUM, { fontSize: 20, color: c.ink }]}>{h.score}</T>
        ))}
        <T style={[NUM_IT, { flex: 1, textAlign: 'right', fontSize: 20, paddingRight: 3, color: c.ink }]}>{nine.score}</T>
        <MarksOverlay
          marks={nine.holes.map((h, i) => ({ x: LABEL_W + i * COL_W + COL_W / 2, toPar: h.toPar, seed: h.number }))}
          width={INNER_W}
          height={30}
          top={2}
          s={0.64}
          color={c.pencil}
        />
      </View>
    </View>
  )
}
