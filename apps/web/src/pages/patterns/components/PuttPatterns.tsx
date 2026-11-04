import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  MIN_PUTT_MISSES_FOR_BAR,
  PUTT_BANDS,
  shortDate,
  topPuttCorner,
  type PuttMissCounts,
  type PuttMissTally,
} from '@oga/core'
import { Rocker } from '../../../components/ui/Rocker'
import { StatRow } from '../../stats/components/StatTiles'
import type { MissedPutt } from '../../../hooks/useShotPatterns'
import { FOCUS_RING } from './LayerControls'

// The Putter stop on Shot patterns (#747): where missed putts finish, short or
// long and left or right, drawn three ways. Meaning is carried by position and
// number; the heavier side is inked only as a second cue.

export type PuttView = 'corners' | 'bars' | 'length'
const VIEWS: { value: PuttView; label: string }[] = [
  { value: 'corners', label: 'Corners' },
  { value: 'bars', label: 'Bars' },
  { value: 'length', label: 'By length' },
]
const INK = '#1C211C'
const PENCIL = '#B9B09C'
const CORNER_NAME = { shortLeft: 'short-left', shortRight: 'short-right', longLeft: 'long-left', longRight: 'long-right' } as const

const pct = (n: number, of: number) => (of > 0 ? Math.round((100 * n) / of) : 0)

export function PuttPatterns({ putts, tally, view, onView }: { putts: MissedPutt[]; tally: PuttMissTally; view: PuttView; onView: (v: PuttView) => void }) {
  const [showTable, setShowTable] = useState(false)
  const panel = useId()
  const t = tally
  const onLine = t.onLine.short + t.onLine.long
  const noLength = t.misses - PUTT_BANDS.reduce((a, { band }) => a + t.bands[band].misses, 0)
  const sided = t.left + t.right
  const top = topPuttCorner(t)

  if (t.misses === 0) {
    return (
      <p className="font-serif text-caddie-ink" style={{ fontSize: 17, lineHeight: 1.55, marginTop: 18, maxWidth: 560 }}>
        No missed putts with a result yet. When you log a putt that misses, mark it short or long and left or right, and it shows here.
      </p>
    )
  }

  const caption =
    view === 'corners'
      ? `Square size is the share of misses.${onLine ? ` On line, no side: ${t.onLine.short} short, ${t.onLine.long} long.` : ''}`
      : view === 'bars'
        ? `${onLine ? `${onLine} went on line: they count for short or long only. ` : ''}The heavier side is inked; position and number say it, not colour.`
        : `Bar length is the share within the row. A row under ${MIN_PUTT_MISSES_FOR_BAR} misses shows its counts and no bar. Bands follow the stored putt length (distance to the pin).${noLength ? ` ${noLength} miss${noLength === 1 ? ' has' : 'es have'} no length and count in All only.` : ''}`

  return (
    <div className="grid grid-cols-1 lg:[grid-template-columns:minmax(0,2fr)_minmax(0,1fr)]" style={{ gap: 28, marginTop: 16 }}>
      <div style={{ maxWidth: 600, minWidth: 0 }}>
        <div style={{ maxWidth: 360 }}>
          <Rocker options={VIEWS} value={view} onChange={onView} label="Putting chart" tabs />
        </div>
        <div id={panel} role="tabpanel" aria-label={VIEWS.find((v) => v.value === view)!.label} className="bg-caddie-surface" style={{ border: '1px solid #D9D2BF', borderRadius: 4, marginTop: 12, padding: '14px 14px 12px' }}>
          {view === 'corners' ? <Corners t={t} /> : view === 'bars' ? <Bars t={t} /> : <ByLength t={t} />}
        </div>
        <p className="text-caddie-ink-dim" style={{ fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>{caption}</p>
        <button
          type="button"
          aria-expanded={showTable}
          onClick={() => setShowTable((s) => !s)}
          className={`text-caddie-ink ${FOCUS_RING}`}
          style={{ background: 'none', border: 'none', padding: '4px 0', fontSize: 13, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }}
        >
          {showTable ? 'Hide the table' : 'Show the putts as a table'}
        </button>
        {showTable && <PuttTable putts={putts} />}
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        {t.short + t.long > 0 && (
          <StatRow
            label={t.short >= t.long ? 'Missed short' : 'Missed long'}
            value={`${pct(Math.max(t.short, t.long), t.short + t.long)}%`}
            note={`${Math.max(t.short, t.long)} of ${t.short + t.long}`}
          />
        )}
        {sided > 0 && (
          <StatRow
            label={`Missed ${t.right >= t.left ? 'right' : 'left'}, of those with a side`}
            value={`${pct(Math.max(t.left, t.right), sided)}%`}
            note={`${Math.max(t.left, t.right)} of ${sided}`}
          />
        )}
        {top && <StatRow label="Most common corner" value={`${CORNER_NAME[top.corner]} · ${top.count}`} />}
        <StatRow label="On line, short or long only" value={String(onLine)} />
      </div>
    </div>
  )
}

// A: four squares around the hole (seen from above, long at the top). Square
// area is the corner's count against the biggest corner.
function Corners({ t }: { t: PuttMissTally }) {
  const c = t.corners
  const max = Math.max(c.shortLeft, c.shortRight, c.longLeft, c.longRight, 1)
  const top = topPuttCorner(t)
  const side = (n: number) => (n ? 22 + 96 * Math.sqrt(n / max) : 0)
  const cells: { key: keyof typeof c; dx: -1 | 1; dy: -1 | 1 }[] = [
    { key: 'longLeft', dx: -1, dy: -1 },
    { key: 'longRight', dx: 1, dy: -1 },
    { key: 'shortLeft', dx: -1, dy: 1 },
    { key: 'shortRight', dx: 1, dy: 1 },
  ]
  const C = 180
  const M = 160
  const words = cells.map(({ key }) => `${CORNER_NAME[key]} ${c[key]}`).join(', ')
  return (
    <svg viewBox="0 0 360 320" role="img" aria-label={`Missed putts by corner: ${words}. ${t.long} long, ${t.short} short, ${t.left} left, ${t.right} right.`} style={{ display: 'block', width: '100%', maxWidth: 400, margin: '0 auto' }}>
      <line x1={14} x2={346} y1={M} y2={M} stroke="#9F9580" strokeWidth={1} />
      <line y1={26} y2={294} x1={C} x2={C} stroke="#9F9580" strokeWidth={1} />
      {cells.map(({ key, dx, dy }) => {
        const s = side(c[key])
        if (!s) return null
        const inked = top?.corner === key
        const x = dx < 0 ? C - s : C
        const y = dy < 0 ? M - s : M
        return (
          <g key={key}>
            <rect x={x} y={y} width={s} height={s} fill={inked ? '#2B3A2E' : '#EBE5D6'} stroke={inked ? INK : '#9F9580'} strokeWidth={1} />
            <text x={x + s / 2} y={y + s / 2} textAnchor="middle" className="font-serif" style={{ fontSize: s > 60 ? 22 : 15, fontStyle: inked ? 'italic' : 'normal', fill: inked ? '#F2EEE5' : INK }}>
              {c[key]}
            </text>
            {s > 44 && (
              <text x={x + s / 2} y={y + s / 2 + 15} textAnchor="middle" style={{ fontSize: 10, fill: inked ? '#F2EEE5' : '#5C6356' }}>
                {pct(c[key], t.misses)}%
              </text>
            )}
          </g>
        )
      })}
      <circle cx={C} cy={M} r={5} fill="#FBF8F1" stroke={INK} strokeWidth={1.5} />
      <text x={C} y={16} textAnchor="middle" style={{ fontSize: 11, fill: '#5C6356' }}>long ↑ · {t.long}</text>
      <text x={C} y={312} textAnchor="middle" style={{ fontSize: 11, fill: '#5C6356' }}>short ↓ · {t.short}</text>
      <text x={6} y={M - 8} style={{ fontSize: 11, fill: '#5C6356' }}>← left {t.left}</text>
      <text x={354} y={M - 8} textAnchor="end" style={{ fontSize: 11, fill: '#5C6356' }}>right {t.right} →</text>
    </svg>
  )
}

// One diverging bar from a centre rule: the two ends' share and count.
function Diverging({ a, b, aWord, bWord, big, share }: { a: number; b: number; aWord: string; bWord: string; big?: boolean; share?: boolean }) {
  const of = a + b
  const wa = of ? (50 * a) / of : 0
  const wb = of ? (50 * b) / of : 0
  const h = big ? 12 : 9
  // The two shares always add to 100.
  const pa = pct(a, of)
  const share100 = (n: number) => (n === a ? pa : of ? 100 - pa : 0)
  // Both ends the same width, so the centre rule lines up row to row.
  const end = (n: number, heavier: boolean, align: 'left' | 'right') => (
    <span className="font-serif tabular text-caddie-ink" style={{ width: big ? 46 : 30, flex: 'none', textAlign: align, lineHeight: 1.1 }}>
      <span style={{ fontSize: big ? 19 : 14, fontStyle: 'italic' }}>{big ? `${share100(n)}%` : n}</span>
      {share && heavier && <span className="block text-caddie-ink-dim" style={{ fontSize: 10 }}>{share100(n)}%</span>}
    </span>
  )
  return (
    <div role="img" aria-label={`${aWord} ${a}, ${bWord} ${b}`}>
      <div className="flex items-center" style={{ gap: 6 }}>
        {end(a, a > b, 'right')}
        <div style={{ position: 'relative', flex: 1, height: h, minWidth: 40 }}>
          <div style={{ position: 'absolute', right: '50%', width: `${wa}%`, top: 0, bottom: 0, background: a > b ? INK : PENCIL }} />
          <div style={{ position: 'absolute', left: '50%', width: `${wb}%`, top: 0, bottom: 0, background: b > a ? INK : PENCIL }} />
          <div style={{ position: 'absolute', left: '50%', top: -3, bottom: -3, width: 1, background: '#5C6356' }} />
        </div>
        {end(b, b > a, 'left')}
      </div>
      {big && (
        <div className="flex justify-between text-caddie-ink-dim" style={{ fontSize: 11, marginTop: 3, padding: '0 4px' }}>
          <span>← {aWord} · {a}</span>
          <span>{b} · {bWord} →</span>
        </div>
      )}
    </div>
  )
}

// B: short against long and left against right, every putt length together.
function Bars({ t }: { t: PuttMissTally }) {
  return (
    <div className="grid" style={{ gap: 18 }}>
      <div>
        <div className="flex justify-between" style={{ fontSize: 13, marginBottom: 6 }}>
          <span className="text-caddie-ink">Short or long</span>
          <span className="text-caddie-ink-dim" style={{ fontSize: 12 }}>{t.short + t.long} putts</span>
        </div>
        <Diverging a={t.short} b={t.long} aWord="short" bWord="long" big />
      </div>
      <div>
        <div className="flex justify-between" style={{ fontSize: 13, marginBottom: 6 }}>
          <span className="text-caddie-ink">Left or right</span>
          <span className="text-caddie-ink-dim" style={{ fontSize: 12 }}>{t.left + t.right} with a side</span>
        </div>
        <Diverging a={t.left} b={t.right} aWord="left" bWord="right" big />
      </div>
    </div>
  )
}

// C: B's two bars for every putt, then for each length band. A thin row
// prints its counts and draws no bar, so noise doesn't read as a finding.
function ByLength({ t }: { t: PuttMissTally }) {
  const rows: { key: string; label: string; c: PuttMissCounts }[] = [
    { key: 'all', label: 'All', c: t },
    ...PUTT_BANDS.map(({ band, label }) => ({ key: band, label, c: t.bands[band] })),
  ]
  // A phone gives the row label its own line so each bar gets half the width.
  const grid = 'grid grid-cols-2 sm:[grid-template-columns:minmax(64px,0.8fr)_minmax(0,1fr)_minmax(0,1fr)]'
  return (
    <div role="table" aria-label="Missed putts by putt length">
      <div role="row" className={`${grid} text-caddie-ink-dim`} style={{ columnGap: 14, fontSize: 11, paddingBottom: 6 }}>
        <span role="columnheader" className="sr-only">Putt length</span>
        <span role="columnheader" className="sm:col-start-2" style={{ textAlign: 'center' }}>← short · long →</span>
        <span role="columnheader" style={{ textAlign: 'center' }}>← left · right →</span>
      </div>
      {rows.map(({ key, label, c }) => {
        const thin = c.misses < MIN_PUTT_MISSES_FOR_BAR
        return (
          <div role="row" key={key} className={`${grid} items-center`} style={{ columnGap: 14, rowGap: 6, padding: '10px 0', borderTop: '1px solid #ECE6D8' }}>
            <div role="rowheader" className="col-span-2 sm:col-span-1" style={{ fontSize: 13, lineHeight: 1.25 }}>
              <span className="text-caddie-ink">{label}</span>
              <span className="text-caddie-ink-dim" style={{ fontSize: 11 }}> · {c.misses} miss{c.misses === 1 ? '' : 'es'}</span>
            </div>
            {thin ? (
              <>
                <span role="cell" className="text-caddie-ink-dim" style={{ fontSize: 12, textAlign: 'center' }}>{c.short} short · {c.long} long</span>
                <span role="cell" className="text-caddie-ink-dim" style={{ fontSize: 12, textAlign: 'center' }}>{c.left} left · {c.right} right</span>
              </>
            ) : (
              <>
                <div role="cell"><Diverging a={c.short} b={c.long} aWord="short" bWord="long" share={key === 'all'} /></div>
                <div role="cell"><Diverging a={c.left} b={c.right} aWord="left" bWord="right" share={key === 'all'} /></div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Every missed putt, newest first: the corner pairing the bars leave out. */
function PuttTable({ putts }: { putts: MissedPutt[] }) {
  return (
    <div style={{ overflowX: 'auto', marginTop: 10 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <caption className="text-caddie-ink-dim" style={{ textAlign: 'left', fontSize: 13, marginBottom: 6 }}>Your {putts.length} missed putts, newest first</caption>
        <thead>
          <tr className="text-caddie-ink-dim" style={{ textAlign: 'left' }}>
            {['Length', 'Missed', 'Round'].map((h) => (
              <th key={h} scope="col" style={{ fontWeight: 400, padding: '4px 8px 4px 0', borderBottom: '1px solid #D9D2BF' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {putts.map((p) => {
            const when = [p.hole != null ? `Hole ${p.hole}` : null, p.playedAt ? shortDate(p.playedAt) : null, p.course].filter(Boolean).join(' · ')
            const miss = [p.puttDistanceResult, p.puttDirectionResult ?? (p.puttDistanceResult ? 'on line' : null)].filter(Boolean).join(', ')
            return (
              <tr key={p.id} style={{ borderBottom: '1px solid #ECE6D8' }}>
                <td className="font-serif tabular" style={{ padding: '6px 8px 6px 0', whiteSpace: 'nowrap' }}>{p.puttDistanceFt != null ? `${Math.round(p.puttDistanceFt)} ft` : '—'}</td>
                <td style={{ padding: '6px 8px 6px 0' }}>{miss.charAt(0).toUpperCase() + miss.slice(1)}</td>
                <td className="text-caddie-ink-dim" style={{ padding: '6px 0', whiteSpace: 'nowrap' }}>
                  {when && p.roundId ? (
                    <Link to={`/rounds/${p.roundId}`} className="text-caddie-ink-dim" style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>{when}</Link>
                  ) : when}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
