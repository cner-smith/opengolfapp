import { formatSG, formatToPar, type ShareCardNote, type ShareCardSG } from '@oga/core'
import { CARD_W, Card, Course, Dateline, Foot, HAND, SANS, TeeLine, TONES, serif, type StyleProps } from './parts'

// Style 5: where the strokes went. Offered only when the model has SG.

const PW = CARD_W - 60
const PH = 230
const MID = 104
const CAT_MAX = 2.5

export function StrokesGainedStyle({ model, tone }: StyleProps) {
  const c = TONES[tone]
  const sg = model.sg as ShareCardSG
  const { holes, totals, facts } = model
  const maxAbs = Math.max(1.5, ...holes.map((h) => Math.abs(h.sg ?? 0)))
  const sc = 96 / maxAbs
  const bw = PW / (holes.length > 9 ? 18 : 9)
  const cx = (i: number) => i * bw + bw / 2
  const at = (note: ShareCardNote) => {
    const i = holes.findIndex((h) => h.number === note.number)
    return { i, sg: holes[i]!.sg ?? 0 }
  }
  const best = sg.best && at(sg.best)
  const worst = sg.worst && at(sg.worst)
  // A note near the right edge reads leftward so it stays on the card.
  const worstLeft = worst != null && worst.i > holes.length / 2
  const bestAnchor = best == null ? 'middle' : best.i === 0 ? 'start' : best.i === holes.length - 1 ? 'end' : 'middle'
  const factLine = [
    facts.putts != null ? `${facts.putts} putts` : null,
    facts.fairways ? `${facts.fairways.hit} of ${facts.fairways.of} fairways` : null,
    facts.gir ? `${facts.gir.hit} of ${facts.gir.of} greens` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <Card c={c}>
      <Dateline model={model} c={c} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10, gap: 14 }}>
        <div>
          <Course model={model} size={27} />
          <TeeLine model={model} c={c} />
        </div>
        <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
          <span style={{ ...serif, fontSize: 44, fontStyle: 'italic', fontWeight: 500, lineHeight: 1 }}>{totals.score}</span>
          <span style={{ ...serif, fontSize: 18, color: c.dim, marginLeft: 8 }}>{formatToPar(totals.toPar)}</span>
        </div>
      </div>
      <div
        style={{
          ...serif,
          fontStyle: 'italic',
          fontWeight: 500,
          fontSize: 23,
          lineHeight: 1.2,
          marginTop: 22,
          paddingTop: 16,
          borderTop: `1px solid ${c.line}`,
        }}
      >
        {sg.headline}
      </div>
      <div style={{ fontSize: 12, color: c.dim, marginTop: 5 }}>
        {sg.basis}
        {model.partialLabel ? ` · ${model.partialLabel}` : ''}
      </div>
      <div style={{ fontFamily: HAND, marginTop: 26, height: PH, flexShrink: 0 }}>
        <svg width={PW} height={PH} style={{ overflow: 'visible', display: 'block' }}>
          <line x1={0} x2={PW} y1={MID} y2={MID} stroke={c.strong} />
          {holes.map((h, i) => {
            const hgt = Math.abs(h.sg ?? 0) * sc
            return (
              <g key={h.number}>
                {h.sg != null && (
                  <rect
                    x={cx(i) - bw * 0.28}
                    y={h.sg >= 0 ? MID - hgt : MID}
                    width={bw * 0.56}
                    height={Math.max(1, hgt)}
                    fill={h.sg >= 0 ? c.accent : c.neg}
                  />
                )}
                <text x={cx(i)} y={MID + 96 + 22} textAnchor="middle" fontFamily={SANS} fontSize={10} fill={c.mute}>
                  {h.number}
                </text>
              </g>
            )
          })}
          {best && sg.best && (
            <text x={cx(best.i)} y={MID - Math.abs(best.sg) * sc - 8} textAnchor={bestAnchor} fontFamily={HAND} fontSize={16} fill={c.dim}>
              {sg.best.text}
            </text>
          )}
          {worst && sg.worst && (
            <text
              x={worstLeft ? cx(worst.i) - bw * 0.28 - 8 : cx(worst.i) + bw * 0.28 + 8}
              y={MID + Math.abs(worst.sg) * sc * 0.6}
              textAnchor={worstLeft ? 'end' : 'start'}
              fontFamily={HAND}
              fontSize={16}
              fill={c.dim}
            >
              {sg.worst.text}
            </text>
          )}
        </svg>
      </div>
      <div style={{ borderTop: `1px solid ${c.line}`, paddingTop: 10, marginTop: 4 }}>
        {sg.areas.map(({ key, label, value }) => {
          const w = value == null ? 0 : (Math.min(Math.abs(value), CAT_MAX) / CAT_MAX) * 120
          const col = value == null ? c.mute : value >= 0 ? c.accent : c.neg
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
              <div style={{ width: 130, fontSize: 13, color: c.dim }}>{label}</div>
              <svg width={250} height={22} style={{ display: 'block' }}>
                <line x1={0} x2={250} y1={11} y2={11} stroke={c.line} />
                <line x1={125} x2={125} y1={5} y2={17} stroke={c.strong} />
                {value != null && <rect x={value >= 0 ? 125 : 125 - w} y={7} width={Math.max(1.5, w)} height={8} fill={col} />}
              </svg>
              <div style={{ ...serif, width: 60, textAlign: 'right', fontStyle: 'italic', fontSize: 18, fontWeight: 500, color: col }}>
                {value == null ? '—' : formatSG(value, 1)}
              </div>
            </div>
          )
        })}
      </div>
      {factLine && <div style={{ fontSize: 13, color: c.dim, marginTop: 'auto', paddingTop: 10 }}>{factLine}</div>}
      <Foot c={c} />
    </Card>
  )
}
