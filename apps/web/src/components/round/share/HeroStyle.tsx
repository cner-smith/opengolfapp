import { formatToPar, type ShareCardNine } from '@oga/core'
import { Card, Course, Dateline, Foot, Mark, SANS, SERIF, TeeLine, TONES, nineName, serif, type StyleProps, type Tone } from './parts'

// Style 4: the score as the hero, and a strip of pencil marks per nine.

const CW = 44

export function HeroStyle({ model, tone }: StyleProps) {
  const c = TONES[tone]
  const { totals, facts } = model
  const nine = nineName(model)
  const facts3: { v: number; of?: number; label: string }[] = []
  if (facts.putts != null) facts3.push({ v: facts.putts, label: 'putts' })
  if (facts.fairways) facts3.push({ v: facts.fairways.hit, of: facts.fairways.of, label: 'fairways' })
  if (facts.gir) facts3.push({ v: facts.gir.hit, of: facts.gir.of, label: 'greens in regulation' })
  return (
    <Card c={c}>
      <Dateline model={model} c={c} />
      <Course model={model} size={26} style={{ marginTop: 10 }} />
      <TeeLine model={model} c={c} />
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginTop: 14 }}>
        <span style={{ ...serif, fontStyle: 'italic', fontWeight: 500, fontSize: 176, lineHeight: 0.82, letterSpacing: '-0.02em' }}>
          {totals.score}
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', paddingBottom: 6 }}>
          <span style={{ ...serif, fontSize: 40, lineHeight: 1, fontWeight: 400 }}>{formatToPar(totals.toPar)}</span>
          <span style={{ fontSize: 13, color: c.dim, marginTop: 6, lineHeight: 1.4 }}>
            {nine ? `${nine}, par ${totals.par}` : `par ${totals.par}`}
            {model.partialLabel && (
              <>
                <br />
                {model.partialLabel}
              </>
            )}
          </span>
        </span>
      </div>
      <div style={{ marginTop: 34, borderTop: `1px solid ${c.line}`, paddingTop: 14 }}>
        {model.nines.map((n) => (
          <MarkRow key={n.label} nine={n} c={c} />
        ))}
        <div style={{ fontSize: 11, color: c.mute, marginTop: 4 }}>
          Circle birdie, dot par, square bogey, two squares double or worse.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 34, marginTop: 'auto', borderTop: `1px solid ${c.line}`, paddingTop: 14 }}>
        {facts3.map((f) => (
          <div key={f.label}>
            <div style={{ ...serif, fontSize: 30, fontWeight: 500, lineHeight: 1 }}>
              {f.v}
              {f.of != null && <span style={{ fontSize: 17, color: c.dim, fontWeight: 400 }}> of {f.of}</span>}
            </div>
            <div style={{ fontSize: 12, color: c.dim, marginTop: 5 }}>{f.label}</div>
          </div>
        ))}
      </div>
      <Foot c={c} />
    </Card>
  )
}

function MarkRow({ nine, c }: { nine: ShareCardNine; c: Tone }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <svg width={CW * 9} height={58} style={{ overflow: 'visible', display: 'block' }}>
        {nine.holes.map((h, i) => {
          const cx = i * CW + CW / 2
          return (
            <g key={h.number}>
              {h.toPar === 0 ? (
                <circle cx={cx} cy={20} r={2.6} fill={c.mute} />
              ) : (
                <>
                  <Mark toPar={h.toPar} seed={h.number} x={cx} y={20} scale={0.62} fill={c.pencil} />
                  <text x={cx} y={25.5} textAnchor="middle" fontFamily={SERIF} fontSize={15} fill={c.ink}>
                    {h.score}
                  </text>
                </>
              )}
              <text x={cx} y={52} textAnchor="middle" fontFamily={SANS} fontSize={10} fill={c.mute}>
                {h.number}
              </text>
            </g>
          )
        })}
      </svg>
      <div style={{ textAlign: 'right', fontSize: 11, color: c.mute, paddingBottom: 16 }}>
        <div style={{ ...serif, fontSize: 22, color: c.ink, fontStyle: 'italic' }}>{nine.score}</div>
        <div>{nine.label}</div>
      </div>
    </div>
  )
}
