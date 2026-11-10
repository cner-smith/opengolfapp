import { View } from 'react-native'
import Svg, { Line, Rect } from 'react-native-svg'
import { formatSG, formatToPar, type ShareCardNote } from '@oga/core'
import { FONT } from '../../../lib/typography'
import { CardFrame, CourseName, Foot, INNER_W, Kicker, NUM, NUM_IT, T, TeeLine, TONES, type ShareCardProps } from './cardParts'

// Height budget (dp, line heights from T): the card's inner 621 = 675 − 30 − 24.
//   kicker 14 · header row 63 (course 10 + 29, tee 7 + 17) · headline 18 + 14 + 1 + 28 = 61
//   · basis 5 + 15 = 20 · chart 24 + PH = 220 · categories 4 + 1 + 10 + 4 × 30 = 135
//   · facts 17 · footer 26 + 1 + 12 + 21 = 60
//   = 590, leaving 31 above the footer (a two-line headline still fits).
const PH = 196
const MID = 92
// Tallest bar, dp; a round whose biggest hole is under 1.5 strokes keeps the
// 1.5 scale so small swings don't fill the chart. Hole numbers sit under the
// lowest bar: MID + BAR_MAX + 6, 13 tall, inside PH.
const BAR_MAX = 80
const BAR_FLOOR = 1.5
const NOTE_W = 220
const CAT_W = 250
const CAT_MAX = 2.5

// Style 5: where the strokes went. Strokes gained per hole as bars about
// zero, then by category. Only offered when the round has SG (model.sg).
export function ShareCardStrokesGained({ model, tone }: ShareCardProps) {
  const c = TONES[tone]
  const { holes, totals, facts, partialLabel } = model
  const sg = model.sg
  if (!sg) return null
  const n = holes.length
  // Chart scale only.
  const maxAbs = Math.max(BAR_FLOOR, ...holes.map((h) => Math.abs(h.sg ?? 0)))
  const sc = BAR_MAX / maxAbs
  const bw = INNER_W / (n > 9 ? 18 : 9)
  const centre = (i: number) => i * bw + bw / 2
  const at = (note: ShareCardNote) => {
    const i = holes.findIndex((h) => h.number === note.number)
    return { i, v: holes[i]!.sg ?? 0 }
  }
  const factLine = [
    facts.putts != null ? `${facts.putts} putts` : null,
    facts.fairways ? `${facts.fairways.hit} of ${facts.fairways.of} fairways` : null,
    facts.gir ? `${facts.gir.hit} of ${facts.gir.of} greens` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const note = { position: 'absolute' as const, fontFamily: FONT.hand, fontSize: 16, color: c.dim, width: NOTE_W }
  return (
    <CardFrame c={c}>
      <Kicker model={model} c={c} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 14 }}>
        <View style={{ flex: 1 }}>
          <CourseName model={model} c={c} size={27} />
          <TeeLine model={model} c={c} />
        </View>
        <T style={{ lineHeight: 50 }}>
          <T style={[NUM_IT, { fontSize: 44, lineHeight: 50, paddingRight: 4, color: c.ink }]}>{totals.score}</T>
          <T style={[NUM, { fontSize: 18, lineHeight: 50, color: c.dim }]}>{`  ${formatToPar(totals.toPar)}`}</T>
        </T>
      </View>
      <View style={{ marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderColor: c.line }}>
        <T style={[NUM_IT, { fontSize: 23, lineHeight: 28, color: c.ink }]}>{sg.headline}</T>
      </View>
      <T style={{ fontFamily: FONT.body, fontSize: 12, color: c.dim, marginTop: 5 }}>
        {sg.basis}
        {partialLabel ? ` · ${partialLabel}` : ''}
      </T>
      <View style={{ width: INNER_W, height: PH, marginTop: 24 }}>
        <Svg width={INNER_W} height={PH}>
          <Line x1={0} x2={INNER_W} y1={MID} y2={MID} stroke={c.strong} />
          {holes.map((h, i) => {
            if (h.sg == null) return null
            const hgt = Math.abs(h.sg) * sc
            return (
              <Rect
                key={h.number}
                x={centre(i) - bw * 0.28}
                y={h.sg >= 0 ? MID - hgt : MID}
                width={bw * 0.56}
                height={Math.max(1, hgt)}
                fill={h.sg >= 0 ? c.accent : c.neg}
              />
            )
          })}
        </Svg>
        {holes.map((h, i) => (
          <T
            key={h.number}
            style={{ position: 'absolute', left: centre(i) - 12, width: 24, top: MID + BAR_MAX + 6, textAlign: 'center', fontFamily: FONT.body, fontSize: 10, color: c.mute }}
          >
            {h.number}
          </T>
        ))}
        {sg.best &&
          (() => {
            const { i, v } = at(sg.best)
            const left = Math.min(Math.max(centre(i) - NOTE_W / 2, 0), INNER_W - NOTE_W)
            return (
              <T numberOfLines={1} style={[note, { left, top: MID - Math.abs(v) * sc - 30, textAlign: 'center' }]}>
                {sg.best.text}
              </T>
            )
          })()}
        {sg.worst &&
          (() => {
            const { i, v } = at(sg.worst)
            const right = centre(i) + bw * 0.28 + 8
            // Beside the bar, on its left when there's no room on its right.
            const left = right + NOTE_W <= INNER_W ? right : Math.max(0, centre(i) - bw * 0.28 - 8 - NOTE_W)
            return (
              <T
                numberOfLines={1}
                style={[note, { left, top: MID + Math.abs(v) * sc * 0.6 - 22, textAlign: left < right ? 'right' : 'left' }]}
              >
                {sg.worst.text}
              </T>
            )
          })()}
      </View>
      <View style={{ borderTopWidth: 1, borderColor: c.line, paddingTop: 10, marginTop: 4 }}>
        {sg.areas.map((a) => {
          const v = a.value
          const w = v == null ? 0 : (Math.min(Math.abs(v), CAT_MAX) / CAT_MAX) * 120
          const col = v == null ? c.mute : v >= 0 ? c.accent : c.neg
          return (
            <View key={a.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
              <T style={{ width: 130, fontFamily: FONT.body, fontSize: 13, color: c.dim }}>{a.label}</T>
              <Svg width={CAT_W} height={22}>
                <Line x1={0} x2={CAT_W} y1={11} y2={11} stroke={c.line} />
                <Line x1={CAT_W / 2} x2={CAT_W / 2} y1={5} y2={17} stroke={c.strong} />
                {v != null && <Rect x={v >= 0 ? CAT_W / 2 : CAT_W / 2 - w} y={7} width={Math.max(1.5, w)} height={8} fill={col} />}
              </Svg>
              <T style={[NUM_IT, { width: 60, textAlign: 'right', fontSize: 18, color: col }]}>{v == null ? '—' : formatSG(v, 1)}</T>
            </View>
          )
        })}
      </View>
      <T style={{ fontFamily: FONT.body, fontSize: 13, color: c.dim, marginTop: 'auto' }}>{factLine}</T>
      <Foot c={c} />
    </CardFrame>
  )
}
