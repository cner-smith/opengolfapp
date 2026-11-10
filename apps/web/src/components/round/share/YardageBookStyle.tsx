import { formatToPar, marksPath, pencilUnderline, type ShareCardNine } from '@oga/core'
import { Card, Course, Dateline, Foot, HAND, MONO, Mark, SANS, TeeLine, TONES, nineName, serif, type StyleProps, type Tone } from './parts'

// Style 2: the yardage-book card, pencilled in Kalam.

const LABEL_W = 54
const COL_W = 40
const UNDERLINE = marksPath([{ m: pencilUnderline(), at: 0 }], 1e9)

export function YardageBookStyle({ model, tone }: StyleProps) {
  const c = TONES[tone]
  const { totals, facts } = model
  const notes: string[] = []
  if (facts.putts != null) notes.push(`${facts.putts} putts`)
  if (facts.fairways) notes.push(`${facts.fairways.hit} of ${facts.fairways.of} fairways`)
  if (facts.gir) notes.push(`${facts.gir.hit} greens in reg.`)
  if (facts.penaltyNote) notes.push(facts.penaltyNote)
  const nine = nineName(model)
  const aside = model.partialLabel ? (nine ? `${nine} only, ${model.partialLabel}` : model.partialLabel) : null
  return (
    <Card c={c}>
      <Dateline model={model} c={c} />
      <Course model={model} italic style={{ marginTop: 10 }} />
      <TeeLine model={model} c={c} />
      <div style={{ height: 20, flexShrink: 0 }} />
      {model.nines.map((n, i) => (
        <Panel key={n.label} nine={n} c={c} first={i === 0} />
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
        <div
          style={{
            fontFamily: HAND,
            fontSize: 21,
            lineHeight: 1.5,
            color: c.pencil,
            transform: 'rotate(-1.2deg)',
            transformOrigin: 'left top',
          }}
        >
          {notes.map((n) => (
            <div key={n}>{n}</div>
          ))}
          {aside && <div style={{ marginTop: 6, fontSize: 17, color: c.dim }}>{aside}</div>}
        </div>
        <div style={{ textAlign: 'right', paddingRight: 6 }}>
          <div style={{ fontFamily: HAND, fontSize: 96, lineHeight: 0.95, color: c.pencil, fontWeight: 400 }}>{totals.score}</div>
          <svg width={120} height={14} style={{ overflow: 'visible', display: 'block', margin: '-8px 0 0 auto' }}>
            <path d={UNDERLINE} fill={c.pencil} transform="translate(64 6) scale(2.6 1.6)" />
          </svg>
          <div style={{ fontSize: 13, color: c.dim, marginTop: 8 }}>
            <span style={{ ...serif, fontSize: 18, color: c.ink }}>{formatToPar(totals.toPar)}</span> on par {totals.par}
          </div>
        </div>
      </div>
      <Foot c={c} />
    </Card>
  )
}

function Panel({ nine, c, first }: { nine: ShareCardNine; c: Tone; first: boolean }) {
  const row = { position: 'relative', display: 'flex', alignItems: 'center' } as const
  const label = { width: LABEL_W, paddingLeft: 12, fontSize: 11, color: c.mute, flexShrink: 0, boxSizing: 'border-box' } as const
  const cell = { width: COL_W, textAlign: 'center', flexShrink: 0 } as const
  const total = { flex: 1, textAlign: 'center' } as const
  return (
    <div
      style={{
        background: c.surface,
        border: `1px solid ${c.line}`,
        borderRadius: 3,
        padding: '6px 0 4px',
        marginTop: first ? 0 : 12,
      }}
    >
      <div style={{ ...row, fontFamily: MONO, fontSize: 12, color: c.mute, height: 20 }}>
        <div style={label}>Hole</div>
        {nine.holes.map((h) => (
          <div key={h.number} style={cell}>
            {h.number}
          </div>
        ))}
        <div style={total}>{nine.label}</div>
      </div>
      <div style={{ ...row, fontFamily: MONO, fontSize: 14, color: c.dim, height: 22, borderBottom: `1px solid ${c.line}` }}>
        <div style={label}>Par</div>
        {nine.holes.map((h) => (
          <div key={h.number} style={cell}>
            {h.par}
          </div>
        ))}
        <div style={total}>{nine.par}</div>
      </div>
      <div style={{ ...row, fontFamily: HAND, height: 46, fontSize: 25, color: c.pencil, borderBottom: nine.putts != null ? `1px solid ${c.line}` : 'none' }}>
        <div style={{ ...label, fontFamily: SANS }}>Score</div>
        {nine.holes.map((h) => (
          <div key={h.number} style={cell}>
            {h.score}
          </div>
        ))}
        <div style={total}>{nine.score}</div>
        <svg width={480} height={44} style={{ position: 'absolute', left: 0, top: 1, overflow: 'visible' }}>
          {nine.holes.map((h, i) => (
            <Mark key={h.number} toPar={h.toPar} seed={h.number} x={LABEL_W + i * COL_W + COL_W / 2} y={22} scale={0.72} fill={c.pencil} />
          ))}
        </svg>
      </div>
      {nine.putts != null && (
        <div style={{ ...row, fontFamily: HAND, height: 28, fontSize: 16, color: c.dim }}>
          <div style={{ ...label, fontFamily: SANS }}>Putts</div>
          {nine.holes.map((h) => (
            <div key={h.number} style={cell}>
              {h.putts ?? ''}
            </div>
          ))}
          <div style={total}>{nine.putts}</div>
        </div>
      )}
    </div>
  )
}
