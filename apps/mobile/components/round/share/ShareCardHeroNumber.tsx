import { View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { formatToPar, type ShareCardNine } from '@oga/core'
import { FONT } from '../../../lib/typography'
import {
  CardFrame,
  CourseName,
  Foot,
  Kicker,
  MarkPath,
  NUM,
  NUM_IT,
  T,
  TeeLine,
  TONES,
  type Ink,
  type ShareCardProps,
} from './cardParts'

const CELL_W = 44
const ROW_W = CELL_W * 9
// Marks and dots sit on this line; the hole number hangs beneath.
const MARK_Y = 20
const PAD = 14

// Style 4: the score as a hero number, each nine as a strip of pencil marks
// (a dot for par), the round's facts at the foot.
export function ShareCardHeroNumber({ model, tone }: ShareCardProps) {
  const c = TONES[tone]
  const { totals, facts, partialLabel, playedNine } = model
  const caption = partialLabel
    ? `${playedNine ? `${playedNine} nine, par ${totals.par}` : `par ${totals.par}`}\n${partialLabel}`
    : `par ${totals.par}`
  return (
    <CardFrame c={c}>
      <Kicker model={model} c={c} />
      <CourseName model={model} c={c} size={26} />
      <TeeLine model={model} c={c} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginTop: 14 }}>
        <T style={[NUM_IT, { fontSize: 176, lineHeight: 150, letterSpacing: -3.5, color: c.ink }]}>{totals.score}</T>
        <View style={{ paddingBottom: 6 }}>
          <T style={[NUM, { fontSize: 40, lineHeight: 44, color: c.ink }]}>{formatToPar(totals.toPar)}</T>
          <T style={{ fontFamily: FONT.body, fontSize: 13, lineHeight: 18, color: c.dim, marginTop: 6 }}>{caption}</T>
        </View>
      </View>
      <View style={{ marginTop: 34, borderTopWidth: 1, borderColor: c.line, paddingTop: 14 }}>
        {model.nines.map((n) => (
          <MarkRow key={n.label} nine={n} c={c} />
        ))}
        <T style={{ fontFamily: FONT.body, fontSize: 11, color: c.mute, marginTop: 4 }}>
          Circle birdie, dot par, square bogey, two squares double or worse.
        </T>
      </View>
      <View style={{ marginTop: 'auto', flexDirection: 'row', gap: 34, borderTopWidth: 1, borderColor: c.line, paddingTop: 14 }}>
        {facts.putts != null && <Fact c={c} value={facts.putts} label="putts" />}
        {facts.fairways && <Fact c={c} value={facts.fairways.hit} of={facts.fairways.of} label="fairways" />}
        {facts.gir && <Fact c={c} value={facts.gir.hit} of={facts.gir.of} label="greens in regulation" />}
      </View>
      <Foot c={c} />
    </CardFrame>
  )
}

function MarkRow({ nine, c }: { nine: ShareCardNine; c: Ink }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ width: ROW_W, height: 58 }}>
        <View pointerEvents="none" style={{ position: 'absolute', left: -PAD, top: -PAD }}>
          <Svg width={ROW_W + PAD * 2} height={58 + PAD * 2}>
            {nine.holes.map((h, i) => {
              const cx = i * CELL_W + CELL_W / 2 + PAD
              return h.toPar === 0 ? (
                <Circle key={h.number} cx={cx} cy={MARK_Y + PAD} r={2.6} fill={c.mute} />
              ) : (
                <MarkPath key={h.number} toPar={h.toPar} seed={h.number} x={cx} y={MARK_Y + PAD} s={0.62} color={c.pencil} />
              )
            })}
          </Svg>
        </View>
        {nine.holes.map((h, i) => (
          <View key={h.number} style={{ position: 'absolute', left: i * CELL_W, width: CELL_W, top: 0, alignItems: 'center' }}>
            <T style={[NUM, { height: 2 * MARK_Y, lineHeight: 2 * MARK_Y, fontSize: 15, color: c.ink, textAlign: 'center' }]}>
              {h.toPar === 0 ? '' : h.score}
            </T>
            <T style={{ fontFamily: FONT.body, fontSize: 10, color: c.mute, marginTop: 2 }}>{h.number}</T>
          </View>
        ))}
      </View>
      <View style={{ alignItems: 'flex-end', paddingBottom: 16 }}>
        <T style={[NUM_IT, { fontSize: 22, color: c.ink }]}>{nine.score}</T>
        <T style={{ fontFamily: FONT.body, fontSize: 11, color: c.mute }}>{nine.label}</T>
      </View>
    </View>
  )
}

function Fact({ c, value, of, label }: { c: Ink; value: number; of?: number; label: string }) {
  return (
    <View>
      <T style={[NUM, { fontSize: 30, lineHeight: 34, color: c.ink }]}>
        {value}
        {of != null && <T style={{ fontSize: 17, color: c.dim }}> of {of}</T>}
      </T>
      <T style={{ fontFamily: FONT.body, fontSize: 12, color: c.dim, marginTop: 5 }}>{label}</T>
    </View>
  )
}
