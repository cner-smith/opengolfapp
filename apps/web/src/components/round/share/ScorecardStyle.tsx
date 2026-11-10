import { formatSG, formatToPar, type ShareCardNine } from '@oga/core'
import { Card, Course, Dateline, Foot, Mark, SANS, SERIF, TeeLine, TONES, serif, type StyleProps, type Tone } from './parts'

// Style 1: the clean paper scorecard.

const LABEL_W = 52
const COL_W = 41

export function ScorecardStyle({ model, tone }: StyleProps) {
  const c = TONES[tone]
  const { totals, facts } = model
  const missing =
    model.playedNine === 'front' ? 'Back nine not played.' : model.playedNine === 'back' ? 'Front nine not played.' : null
  const sub = model.partialLabel
    ? model.playedNine
      ? `${model.playedNine === 'front' ? 'Front' : 'Back'} nine · ${model.partialLabel}`
      : model.partialLabel
    : `${model.holeCount} holes`
  const rows: [string, string][] = []
  if (facts.putts != null) rows.push(['Putts', String(facts.putts)])
  if (facts.fairways) rows.push(['Fairways', `${facts.fairways.hit} of ${facts.fairways.of}`])
  if (facts.gir) rows.push(['Greens in regulation', `${facts.gir.hit} of ${facts.gir.of}`])
  if (model.sg) rows.push(['Strokes gained', formatSG(model.sg.total, 1)])
  return (
    <Card c={c}>
      <Dateline model={model} c={c} />
      <Course model={model} style={{ marginTop: 10 }} />
      <TeeLine model={model} c={c} />
      <div style={{ height: 22, flexShrink: 0 }} />
      {model.playedNine === 'back' && <Unplayed c={c} text={missing!} />}
      {model.nines.map((n) => (
        <Nine key={n.label} nine={n} c={c} />
      ))}
      {model.playedNine === 'front' && <Unplayed c={c} text={missing!} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, marginTop: 'auto' }}>
        <div>
          <div style={{ fontSize: 13, color: c.dim }}>{sub}</div>
          <div>
            <span style={{ ...serif, fontStyle: 'italic', fontWeight: 500, fontSize: 84, lineHeight: 1 }}>{totals.score}</span>
            <span style={{ ...serif, fontSize: 24, color: c.dim, marginLeft: 10 }}>{formatToPar(totals.toPar)}</span>
          </div>
          <div style={{ fontSize: 13, color: c.dim }}>par {totals.par}</div>
        </div>
        <div style={{ flex: 1, maxWidth: 250 }}>
          {rows.map(([label, value], i) => (
            <div
              key={label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                fontSize: 13,
                color: c.dim,
                padding: '7px 0',
                borderBottom: i < rows.length - 1 ? `1px solid ${c.line}` : 'none',
              }}
            >
              <span>{label}</span>
              <span style={{ ...serif, fontSize: 17, color: c.ink }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
      <Foot c={c} />
    </Card>
  )
}

function Unplayed({ c, text }: { c: Tone; text: string }) {
  return (
    <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 16, color: c.mute, padding: '10px 0 22px' }}>{text}</div>
  )
}

function Nine({ nine, c }: { nine: ShareCardNine; c: Tone }) {
  const row = { position: 'relative', display: 'flex', alignItems: 'center' } as const
  const label = { width: LABEL_W, fontSize: 12, color: c.dim, flexShrink: 0, fontFamily: SANS }
  const cell = { width: COL_W, textAlign: 'center', flexShrink: 0 } as const
  const total = { flex: 1, textAlign: 'right' } as const
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ ...row, fontSize: 11, color: c.mute, paddingBottom: 6, borderBottom: `1px solid ${c.line}` }}>
        <div style={label} />
        {nine.holes.map((h) => (
          <div key={h.number} style={cell}>
            {h.number}
          </div>
        ))}
        <div style={{ ...total, fontSize: 12, color: c.dim }}>{nine.label}</div>
      </div>
      <div style={{ ...row, ...serif, fontSize: 15, color: c.dim, height: 30 }}>
        <div style={label}>Par</div>
        {nine.holes.map((h) => (
          <div key={h.number} style={cell}>
            {h.par}
          </div>
        ))}
        <div style={total}>{nine.par}</div>
      </div>
      <div style={{ ...row, fontSize: 20, height: 34, borderBottom: `1px solid ${c.line}` }}>
        <div style={label}>Score</div>
        {nine.holes.map((h) => (
          <div key={h.number} style={{ ...cell, ...serif }}>
            {h.score}
          </div>
        ))}
        <div style={{ ...total, ...serif, fontStyle: 'italic', fontWeight: 500 }}>{nine.score}</div>
        <svg width={480} height={30} style={{ position: 'absolute', left: 0, top: 2, pointerEvents: 'none', overflow: 'visible' }}>
          {nine.holes.map((h, i) => (
            <Mark key={h.number} toPar={h.toPar} seed={h.number} x={LABEL_W + i * COL_W + COL_W / 2} y={15} scale={0.64} fill={c.pencil} />
          ))}
        </svg>
      </div>
    </div>
  )
}
