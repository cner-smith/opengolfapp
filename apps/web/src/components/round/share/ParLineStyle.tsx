import { formatToPar, marksPath, pencilEllipse } from '@oga/core'
import { CARD_W, Card, Course, Dateline, Foot, HAND, SANS, SERIF, TeeLine, TONES, nineName, serif, type StyleProps } from './parts'

// Style 3: score against par, a line hole by hole, with the round's moments
// pencilled beside it. Facts only, never advice.

const PX = 34
const PW = CARD_W - 60 - 34 - 46
const PY = 22
const PH = 300
const RING = marksPath(pencilEllipse(40, 26, 400, 3), 1e9)

export function ParLineStyle({ model, tone }: StyleProps) {
  const c = TONES[tone]
  const { holes, totals, facts, highlights } = model
  const n = holes.length
  const pts = [{ i: 0, v: 0 }, ...holes.map((h, i) => ({ i: i + 1, v: h.runningToPar }))]
  const maxV = Math.max(4, ...pts.map((p) => p.v))
  const minV = Math.min(0, ...pts.map((p) => p.v))
  const x = (i: number) => PX + (i / n) * PW
  const y = (v: number) => PY + PH - ((v - minV) / (maxV - minV)) * PH
  const line = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ')
  const grid: number[] = []
  for (let v = Math.ceil(minV / 5) * 5; v <= maxV; v += 5) grid.push(v)
  const indexOf = (number: number) => holes.findIndex((h) => h.number === number) + 1
  // Where a note sits: below its point, pulled left (Kalam 17 px is about
  // 7.5 px a letter) so it never runs off the card.
  const note = (number: number, text: string, dx: number, dy: number) => {
    const i = indexOf(number)
    return (
      <text
        key={text}
        x={Math.min(x(i) + dx, CARD_W - 60 - text.length * 7.5)}
        y={y(pts[i]!.v) + dy}
        fontFamily={HAND}
        fontSize={17}
        fill={c.dim}
      >
        {text}
      </text>
    )
  }
  const under = highlights.firstUnderPar
  const split = model.nines.length === 2 ? model.nines[0]!.holes.length : null
  const nine = nineName(model)
  const cols = n > 9 ? 18 : 9
  const factItems: [number, string][] = []
  if (facts.putts != null) factItems.push([facts.putts, 'putts'])
  if (facts.fairways) factItems.push([facts.fairways.hit, `of ${facts.fairways.of} fairways`])
  if (facts.gir) factItems.push([facts.gir.hit, `of ${facts.gir.of} greens`])
  return (
    <Card c={c}>
      <Dateline model={model} c={c} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 10, gap: 16 }}>
        <div>
          <Course model={model} />
          <TeeLine model={model} c={c} />
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ ...serif, fontSize: 46, fontStyle: 'italic', fontWeight: 500, lineHeight: 1 }}>{totals.score}</div>
          <div style={{ fontSize: 13, color: c.dim, marginTop: 4 }}>{nine ?? `par ${totals.par}`}</div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: c.dim, marginTop: 20 }}>
        Score against par, hole by hole{model.partialLabel ? ` · ${model.partialLabel}` : ''}
      </div>
      <div style={{ fontFamily: HAND, marginTop: 6, height: PY + PH + 26, flexShrink: 0 }}>
        <svg width={CARD_W - 60} height={PY + PH + 26} style={{ overflow: 'visible', display: 'block' }}>
          {grid.map((v) => (
            <g key={v}>
              <line
                x1={PX}
                x2={PX + PW}
                y1={y(v)}
                y2={y(v)}
                stroke={v === 0 ? c.strong : c.line}
                strokeDasharray={v === 0 ? '3 3' : undefined}
              />
              <text x={PX - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill={c.mute} fontFamily={SANS}>
                {v === 0 ? 'par' : formatToPar(v)}
              </text>
            </g>
          ))}
          {split != null && (
            <>
              <line x1={x(split)} x2={x(split)} y1={PY - 6} y2={PY + PH} stroke={c.line} />
              {model.nines.map((nn, k) => (
                <text
                  key={nn.label}
                  x={x(k === 0 ? split / 2 : (split + n) / 2)}
                  y={PY - 8}
                  textAnchor="middle"
                  fontSize={12}
                  fill={c.dim}
                  fontFamily={SANS}
                >
                  {nn.label} {nn.score}
                </text>
              ))}
            </>
          )}
          <path d={line} fill="none" stroke={c.ink} strokeWidth={2} strokeLinejoin="round" />
          {holes.map((h, k) => {
            const fill = h.toPar < 0 ? c.accent : h.toPar >= 2 ? c.neg : c.ink
            return (
              <circle
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
          {under && (
            <path
              d={RING}
              fill={c.pencil}
              transform={`translate(${x(indexOf(under.number))} ${y(pts[indexOf(under.number)]!.v)}) scale(0.36 0.5)`}
            />
          )}
          {highlights.worst && note(highlights.worst.number, highlights.worst.text, 12, 44)}
          {under && note(under.number, under.text, -30, 34)}
          <text
            x={x(n) + 8}
            y={y(totals.toPar) + 6}
            fontFamily={SERIF}
            fontStyle="italic"
            fontWeight={500}
            fontSize={20}
            fill={c.ink}
          >
            {formatToPar(totals.toPar)}
          </text>
          {holes.map((h, k) => (
            <text key={h.number} x={x(k + 1)} y={PY + PH + 18} textAnchor="middle" fontSize={10} fill={c.mute} fontFamily={SANS}>
              {h.number}
            </text>
          ))}
        </svg>
      </div>
      <div style={{ fontSize: 12, color: c.dim, margin: '10px 0 6px' }}>Score, with par beneath</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          borderTop: `1px solid ${c.line}`,
          borderBottom: `1px solid ${c.line}`,
          padding: '5px 0',
        }}
      >
        {holes.map((h) => (
          <div key={h.number} style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: SERIF,
                fontSize: n > 9 ? 16 : 20,
                color: h.toPar < 0 ? c.accent : h.toPar >= 2 ? c.neg : c.ink,
                fontWeight: h.toPar < 0 ? 600 : 400,
              }}
            >
              {h.score}
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 11, color: c.mute }}>{h.par}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 22, marginTop: 'auto', fontSize: 13, color: c.dim }}>
        {factItems.map(([v, label]) => (
          <span key={label}>
            <b style={{ ...serif, fontSize: 19, fontWeight: 500, color: c.ink, marginRight: 2 }}>{v}</b> {label}
          </span>
        ))}
      </div>
      <Foot c={c} />
    </Card>
  )
}
