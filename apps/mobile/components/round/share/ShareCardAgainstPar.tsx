import { useMemo } from 'react'
import { View } from 'react-native'
import Svg, { Circle, Line, Path } from 'react-native-svg'
import { formatToPar, marksPath, pencilEllipse, type ShareCardNote } from '@oga/core'
import { FONT } from '../../../lib/typography'
import { CardFrame, CourseName, Foot, INNER_W, Kicker, NUM, NUM_IT, T, TeeLine, TONES, type Ink, type ShareCardProps } from './cardParts'

// Plot box inside the 480-wide chart, as the mock: room left for the axis
// labels and right for the end label.
const PX = 34
const PW = INNER_W - PX - 46
const PY = 22
const PH = 300
const NOTE_W = 200

// Style 3: the running score against par as a line, hole by hole, with the
// scores and pars in a strip beneath.
export function ShareCardAgainstPar({ model, tone }: ShareCardProps) {
  const c = TONES[tone]
  const { holes, totals, facts, nines, partialLabel, playedNine, highlights } = model
  const ring = useMemo(() => marksPath(pencilEllipse(40, 26, 400, 3), 1e9), [])
  const n = holes.length
  // Chart scale only: the running values come from the model.
  const values = [0, ...holes.map((h) => h.runningToPar)]
  const maxV = Math.max(4, ...values)
  const minV = Math.min(0, ...values)
  const x = (i: number) => PX + (i / n) * PW
  const y = (v: number) => PY + PH - ((v - minV) / (maxV - minV)) * PH
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const grid: number[] = []
  for (let v = 0; v <= maxV; v += 5) grid.push(v)
  for (let v = -5; v >= minV; v -= 5) grid.push(v)
  const indexOf = (note: ShareCardNote) => holes.findIndex((h) => h.number === note.number) + 1
  const notes = [
    highlights.worst && { note: highlights.worst, dx: 12, dy: 44 },
    highlights.firstUnderPar && { note: highlights.firstUnderPar, dx: -30, dy: 34 },
  ].filter((o): o is { note: ShareCardNote; dx: number; dy: number } => o != null)
  const birdie = highlights.firstUnderPar ? indexOf(highlights.firstUnderPar) : null
  const split = nines.length === 2 ? nines[0]!.holes.length : null
  const cols = n > 9 ? 18 : 9
  const corner = partialLabel ? (playedNine ? `${playedNine} nine` : partialLabel) : `par ${totals.par}`
  const label = { position: 'absolute' as const, fontFamily: FONT.body }
  return (
    <CardFrame c={c}>
      <Kicker model={model} c={c} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <View style={{ flex: 1 }}>
          <CourseName model={model} c={c} />
          <TeeLine model={model} c={c} />
        </View>
        <View style={{ alignItems: 'flex-end', marginTop: 10 }}>
          <T style={[NUM_IT, { fontSize: 46, lineHeight: 52, color: c.ink }]}>{totals.score}</T>
          <T style={{ fontFamily: FONT.body, fontSize: 13, color: c.dim, marginTop: 4 }}>{corner}</T>
        </View>
      </View>
      <T style={{ fontFamily: FONT.body, fontSize: 13, color: c.dim, marginTop: 20 }}>
        Score against par, hole by hole{partialLabel ? ` · ${partialLabel}` : ''}
      </T>
      <View style={{ width: INNER_W, height: PY + PH + 26, marginTop: 6 }}>
        <Svg width={INNER_W} height={PY + PH + 26}>
          {grid.map((v) => (
            <Line
              key={v}
              x1={PX}
              x2={PX + PW}
              y1={y(v)}
              y2={y(v)}
              stroke={v === 0 ? c.strong : c.line}
              strokeDasharray={v === 0 ? '3 3' : undefined}
            />
          ))}
          {split != null && <Line x1={x(split)} x2={x(split)} y1={PY - 6} y2={PY + PH} stroke={c.line} />}
          <Path d={line} fill="none" stroke={c.ink} strokeWidth={2} strokeLinejoin="round" />
          {holes.map((h, k) => {
            const fill = h.toPar < 0 ? c.accent : h.toPar >= 2 ? c.neg : c.ink
            return (
              <Circle
                key={h.number}
                cx={x(k + 1)}
                cy={y(h.runningToPar)}
                r={h.toPar === 0 ? 2.4 : 3.6}
                fill={h.toPar === 0 ? c.bg : fill}
                stroke={fill}
                strokeWidth={1.6}
              />
            )
          })}
          {birdie != null && (
            <Path d={ring} fill={c.pencil} transform={`translate(${x(birdie)} ${y(values[birdie]!)}) scale(0.36 0.5)`} />
          )}
        </Svg>
        {grid.map((v) => (
          <T key={v} style={[label, { left: 0, width: PX - 8, top: y(v) - 8, textAlign: 'right', fontSize: 11, color: c.mute }]}>
            {v === 0 ? 'par' : formatToPar(v)}
          </T>
        ))}
        {split != null &&
          nines.map((nine, k) => {
            const mid = k === 0 ? split / 2 : split + nine.holes.length / 2
            return (
              <T key={nine.label} style={[label, { left: x(mid) - 50, width: 100, top: PY - 24, textAlign: 'center', fontSize: 12, color: c.dim }]}>
                {nine.label} {nine.score}
              </T>
            )
          })}
        {notes.map(({ note, dx, dy }) => {
          const i = indexOf(note)
          return (
            <T
              key={note.text}
              numberOfLines={1}
              style={[label, { fontFamily: FONT.hand, left: Math.min(x(i) + dx, INNER_W - NOTE_W), width: NOTE_W, top: y(values[i]!) + dy - 22, fontSize: 17, color: c.dim }]}
            >
              {note.text}
            </T>
          )
        })}
        <T style={[NUM_IT, { position: 'absolute', left: x(n) + 8, top: y(totals.toPar) - 20, fontSize: 20, color: c.ink }]}>
          {formatToPar(totals.toPar)}
        </T>
        {holes.map((h, k) => (
          <T key={h.number} style={[label, { left: x(k + 1) - 12, width: 24, top: PY + PH + 6, textAlign: 'center', fontSize: 10, color: c.mute }]}>
            {h.number}
          </T>
        ))}
      </View>
      <T style={{ fontFamily: FONT.body, fontSize: 12, color: c.dim, marginTop: 10, marginBottom: 6 }}>Score, with par beneath</T>
      <View style={{ flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.line, paddingVertical: 5 }}>
        {holes.map((h) => (
          <View key={h.number} style={{ width: INNER_W / cols, alignItems: 'center' }}>
            <T style={[NUM, { fontSize: n > 9 ? 16 : 20, color: h.toPar < 0 ? c.accent : h.toPar >= 2 ? c.neg : c.ink }]}>{h.score}</T>
            <T style={[NUM, { fontSize: 11, color: c.mute }]}>{h.par}</T>
          </View>
        ))}
      </View>
      <View style={{ marginTop: 'auto', flexDirection: 'row', flexWrap: 'wrap', columnGap: 22 }}>
        {facts.putts != null && <Fact c={c} value={facts.putts} rest=" putts" />}
        {facts.fairways && <Fact c={c} value={facts.fairways.hit} rest={` of ${facts.fairways.of} fairways`} />}
        {facts.gir && <Fact c={c} value={facts.gir.hit} rest={` of ${facts.gir.of} greens`} />}
      </View>
      <Foot c={c} />
    </CardFrame>
  )
}

function Fact({ c, value, rest }: { c: Ink; value: number; rest: string }) {
  return (
    <T style={{ fontFamily: FONT.body, fontSize: 13, color: c.dim }}>
      <T style={[NUM, { fontSize: 19, color: c.ink }]}>{value}</T>
      {rest}
    </T>
  )
}
