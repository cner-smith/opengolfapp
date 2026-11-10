import { useMemo } from 'react'
import { View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { formatToPar, marksPath, pencilUnderline, type ShareCardNine } from '@oga/core'
import { FONT } from '../../../lib/typography'
import {
  CardFrame,
  CourseName,
  Foot,
  INNER_W,
  Kicker,
  MarksOverlay,
  NUM,
  T,
  TeeLine,
  TONES,
  type Ink,
  type ShareCardProps,
} from './cardParts'

const LABEL_W = 54
// Height budget (dp, line heights from T), inner 621: kicker 14 · course 10 + 32
// · tee 7 + 17 · gap 20 · two panels 2 × 128 + 12 = 268 · total column 110 + 6
// + 8 + 24 = 148 (taller than four 31.5 notes) · footer 60 = 576, 45 to spare.
const COL_W = 40

// Style 2: yardage-book card, pencilled in Kalam on a grey panel per nine,
// handwritten notes and a big pencilled total.
export function ShareCardYardageBook({ model, tone }: ShareCardProps) {
  const c = TONES[tone]
  const { totals, facts, partialLabel, playedNine } = model
  const underline = useMemo(() => marksPath([{ m: pencilUnderline(), at: 0 }], 1e9), [])
  const notes: string[] = []
  if (facts.putts != null) notes.push(`${facts.putts} putts`)
  if (facts.fairways) notes.push(`${facts.fairways.hit} of ${facts.fairways.of} fairways`)
  if (facts.gir) notes.push(`${facts.gir.hit} greens in reg.`)
  if (facts.penaltyNote) notes.push(facts.penaltyNote)
  const aside = partialLabel ? (playedNine ? `${playedNine} nine only, ${partialLabel}` : partialLabel) : null
  return (
    <CardFrame c={c}>
      <Kicker model={model} c={c} />
      <CourseName model={model} c={c} italic />
      <TeeLine model={model} c={c} />
      <View style={{ height: 20 }} />
      {model.nines.map((n, i) => (
        <Panel key={n.label} nine={n} c={c} putts={facts.putts != null} gap={i > 0} />
      ))}
      <View style={{ marginTop: 'auto', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View style={{ transform: [{ rotate: '-1.2deg' }], transformOrigin: 'left top', flexShrink: 1 }}>
          {notes.map((n) => (
            <T key={n} style={{ fontFamily: FONT.hand, fontSize: 21, lineHeight: 31.5, color: c.pencil }}>{n}</T>
          ))}
          {aside && <T style={{ fontFamily: FONT.hand, fontSize: 17, color: c.dim, marginTop: 6 }}>{aside}</T>}
        </View>
        <View style={{ alignItems: 'flex-end', paddingRight: 6 }}>
          <T style={{ fontFamily: FONT.hand, fontSize: 96, lineHeight: 110, color: c.pencil }}>{totals.score}</T>
          <Svg width={120} height={14} style={{ marginTop: -8 }}>
            <Path d={underline} fill={c.pencil} transform="translate(64 6) scale(2.6 1.6)" />
          </Svg>
          <T style={{ fontFamily: FONT.body, fontSize: 13, lineHeight: 24, color: c.dim, marginTop: 8 }}>
            <T style={[NUM, { fontSize: 18, lineHeight: 24, color: c.ink }]}>{formatToPar(totals.toPar)}</T> on par {totals.par}
          </T>
        </View>
      </View>
      <Foot c={c} />
    </CardFrame>
  )
}

function Panel({ nine, c, putts, gap }: { nine: ShareCardNine; c: Ink; putts: boolean; gap: boolean }) {
  const cell = { width: COL_W, textAlign: 'center' as const }
  const total = { flex: 1, textAlign: 'center' as const }
  const label = { width: LABEL_W, paddingLeft: 12, fontSize: 11, color: c.mute }
  const row = { flexDirection: 'row' as const, alignItems: 'center' as const }
  return (
    <View
      style={{
        marginTop: gap ? 12 : 0,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: 3,
        paddingTop: 6,
        paddingBottom: 4,
      }}
    >
      <View style={[row, { height: 20 }]}>
        <T style={[label, { fontFamily: FONT.mono }]}>Hole</T>
        {nine.holes.map((h) => (
          <T key={h.number} style={[cell, { fontFamily: FONT.mono, fontSize: 12, color: c.mute }]}>{h.number}</T>
        ))}
        <T style={[total, { fontFamily: FONT.mono, fontSize: 12, color: c.mute }]}>{nine.label}</T>
      </View>
      <View style={[row, { height: 22, borderBottomWidth: 1, borderColor: c.line }]}>
        <T style={[label, { fontFamily: FONT.mono }]}>Par</T>
        {nine.holes.map((h) => (
          <T key={h.number} style={[cell, { fontFamily: FONT.mono, fontSize: 14, color: c.dim }]}>{h.par}</T>
        ))}
        <T style={[total, { fontFamily: FONT.mono, fontSize: 14, color: c.dim }]}>{nine.par}</T>
      </View>
      <View style={[row, { height: 46, borderBottomWidth: putts ? 1 : 0, borderColor: c.line }]}>
        <T style={[label, { fontFamily: FONT.body }]}>Score</T>
        {nine.holes.map((h) => (
          <T key={h.number} style={[cell, { fontFamily: FONT.hand, fontSize: 25, color: c.pencil }]}>{h.score}</T>
        ))}
        <T style={[total, { fontFamily: FONT.hand, fontSize: 25, color: c.pencil }]}>{nine.score}</T>
        <MarksOverlay
          marks={nine.holes.map((h, i) => ({ x: LABEL_W + i * COL_W + COL_W / 2, toPar: h.toPar, seed: h.number }))}
          width={INNER_W}
          height={44}
          top={1}
          s={0.72}
          color={c.pencil}
        />
      </View>
      {putts && (
        <View style={[row, { height: 28 }]}>
          <T style={[label, { fontFamily: FONT.body }]}>Putts</T>
          {nine.holes.map((h) => (
            <T key={h.number} style={[cell, { fontFamily: FONT.hand, fontSize: 16, color: c.dim }]}>{h.putts ?? ''}</T>
          ))}
          <T style={[total, { fontFamily: FONT.hand, fontSize: 16, color: c.dim }]}>{nine.putts ?? ''}</T>
        </View>
      )}
    </View>
  )
}
