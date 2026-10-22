import { Link } from 'react-router-dom'
import {
  SHOT_SHAPE_LABELS,
  SHOT_START_LINE_LABELS,
  categoriesFor,
  distanceText as dist,
  distanceUnitAbbr as unitWord,
  missTally,
  recentPoints,
  shotParts,
  tallyWords,
  wholeDistance as num,
  shapeTally,
  startLineTally,
  startShapeMatrix,
  type DispersionPoint,
  type DispersionStats,
  type DistanceUnit,
  type ColourBy,
  type FlightKind,
  type RecordedTally,
  type ShotExtras,
} from '@oga/core'
import { StatRow, StatTile } from '../../stats/components/StatTiles'
import { styledCategories } from '../layers'
import { Marker } from './chartParts'
import { FOCUS_RING } from './LayerControls'

// The numbers beside the chart: two tiles for the pattern's size and where it
// finishes, then rows. Shape and start line are printed tallies of what was
// recorded, so one word never hides the spread.

export function PatternNumbers({
  stats,
  points,
  typicalYards,
  unit,
  shotsNote,
  filtered,
  teeShots,
  leftHanded,
  onColour,
}: {
  stats: DispersionStats
  points: DispersionPoint[]
  typicalYards: number | null
  unit: DistanceUnit
  shotsNote: string
  filtered: boolean
  teeShots: boolean
  leftHanded: boolean
  onColour: (by: ColourBy) => void
}) {
  const n = points.length
  const u = unitWord(unit)
  const pair = (a: number, b: number) => `${num(a, unit)}\u00a0×\u00a0${num(b, unit)}\u00a0${u}`
  const nb = (s: string) => s.replace(/ /g, '\u00a0')
  const finish = stats.avgAimDistance != null ? stats.avgAimDistance + stats.avgDistanceOffset : null
  const misses = missTally(points)
  const shortMore = misses.short >= misses.long
  const shape = shapeTally(points, leftHanded)
  const start = startLineTally(points, leftHanded)
  const [leftKey, rightKey] = leftHanded ? (['push', 'pull'] as const) : (['pull', 'push'] as const)
  const aimNote =
    stats.avgAimDistance != null && !teeShots ? ` You aim it about ${dist(stats.avgAimDistance, unit)} on average.` : ''

  return (
    <div>
      <div className="grid grid-cols-2" style={{ gap: 12, marginBottom: 8 }}>
        <StatTile
          label="Two in three"
          value={`${num(stats.cone68.lateral * 2, unit)} × ${num(stats.cone68.distance * 2, unit)}`}
          subtle={`${u}, wide × deep`}
        />
        {finish != null ? (
          <StatTile
            label="Finishes"
            value={`${num(finish - stats.cone68.distance, unit)}–${num(finish + stats.cone68.distance, unit)}`}
            subtle={`${u} from where it was hit`}
          />
        ) : (
          <StatTile label="Typical distance" value={typicalYards != null ? dist(typicalYards, unit) : '—'} subtle="how far it goes, every lie" />
        )}
      </div>
      <div>
        {finish != null && (
          <StatRow
            label="Typical distance"
            value={typicalYards != null ? nb(dist(typicalYards, unit)) : '—'}
            note={`How far it goes, ${filtered ? 'all lies, not just these' : 'every lie'}.${aimNote}`}
          />
        )}
        <StatRow label="Shots" value={String(n)} note={shotsNote} />
        <StatRow
          label={shortMore ? 'Finishes short' : 'Finishes long'}
          value={nb(`${shortMore ? misses.short : misses.long} of ${n}`)}
          note={`${shortMore ? `${misses.long} long` : `${misses.short} short`}; ${misses.left} left, ${misses.right} right of the aim`}
        />
        <StatRow label="Nearly all" value={pair(stats.cone95.lateral * 2, stats.cone95.distance * 2)} note="Wide × deep. The dashed ring." />
        <TallyRow
          label="Shape"
          tally={shape}
          words={tallyWords(shape, SHOT_SHAPE_LABELS, n)}
          by="shape"
          leftHanded={leftHanded}
          onColour={onColour}
        />
        <TallyRow
          label="Start line"
          tally={start}
          words={(() => {
            const w = tallyWords(start, SHOT_START_LINE_LABELS, n)
            if (start.recorded === 0) return w
            return { ...w, note: `${w.note}. Starts right of your aim on ${start.counts[rightKey]}, left on ${start.counts[leftKey]}` }
          })()}
          by="start"
          leftHanded={leftHanded}
          onColour={onColour}
        />
        <Matrix points={points} leftHanded={leftHanded} />
      </div>
    </div>
  )
}

function TallyRow<K extends string>({ label, tally, words, by, leftHanded, onColour }: {
  label: string
  tally: RecordedTally<K>
  words: { value: string; note: string }
  by: 'shape' | 'start'
  leftHanded: boolean
  onColour: (by: ColourBy) => void
}) {
  const cats = styledCategories(by, leftHanded)
  const max = Math.max(1, ...cats.map((c) => tally.counts[c.key as K]))
  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid #E4DCC8' }}>
      <div className="flex items-baseline justify-between" style={{ gap: 12 }}>
        <div className="text-caddie-ink" style={{ fontSize: 15 }}>{label}</div>
        <div className="font-serif text-caddie-ink" style={{ fontSize: 20, fontWeight: 500, textAlign: 'right' }}>{words.value}</div>
      </div>
      {tally.recorded > 0 && (
        <button
          type="button"
          onClick={() => onColour(by)}
          title={`Colour the chart by ${label.toLowerCase()}`}
          aria-label={`${label}: ${cats.map((c) => `${c.label} ${tally.counts[c.key as K]}`).join(', ')}. Colour the chart by ${label.toLowerCase()}`}
          className={`hover:bg-caddie-surface-2 ${FOCUS_RING}`}
          style={{ display: 'grid', gridTemplateColumns: `repeat(${cats.length}, 1fr)`, gap: 4, width: '100%', marginTop: 8, padding: '4px 0', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 2 }}
        >
          {cats.map((c) => {
            const v = tally.counts[c.key as K]
            return (
              <span key={c.key} className="flex flex-col items-center" style={{ gap: 3 }}>
                <span className="font-serif tabular" style={{ fontSize: 14, color: v ? '#1C211C' : '#5C6356' }}>{v}</span>
                <span style={{ display: 'flex', alignItems: 'flex-end', height: 22, width: '100%', justifyContent: 'center', borderBottom: '1px solid #9F9580' }}>
                  <span style={{ width: '62%', height: `${(v / max) * 100}%`, background: '#5C6356', opacity: 0.85 }} />
                </span>
                <span className="inline-flex items-center text-caddie-ink-dim" style={{ gap: 4, fontSize: 12, whiteSpace: 'nowrap' }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                    <Marker x={5} y={5} r={3.2} glyph={c.glyph} color={c.color} />
                  </svg>
                  {c.label}
                </span>
              </span>
            )
          })}
        </button>
      )}
      <div className="text-caddie-ink-dim" style={{ fontSize: 12, marginTop: 6 }}>{words.note}.</div>
    </div>
  )
}

// Start line × shape: push-fade, pull-hook… from shots with both recorded.
function Matrix({ points, leftHanded }: { points: DispersionPoint[]; leftHanded: boolean }) {
  const m = startShapeMatrix(points)
  if (m.total === 0) return null
  const rows = categoriesFor('start', leftHanded)
  const cols = categoriesFor('shape', leftHanded)
  // "push-fade", "on-line draw".
  const name = (sl: string, sh: string) => {
    const shape = SHOT_SHAPE_LABELS[sh as keyof typeof SHOT_SHAPE_LABELS].toLowerCase()
    return sl === 'on_line' ? `on-line ${shape}` : `${sl}-${shape}`
  }
  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid #E4DCC8' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <caption className="text-caddie-ink" style={{ fontSize: 15, textAlign: 'left', marginBottom: 8 }}>Start line and shape</caption>
        <thead>
          <tr>
            <th scope="col" className="sr-only">Start line</th>
            {cols.map((c) => (
              <th key={c.key} scope="col" className="text-caddie-ink-dim" style={{ fontWeight: 400, padding: '0 0 4px', textAlign: 'center' }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} style={{ borderTop: '1px solid #ECE6D8' }}>
              <th scope="row" className="text-caddie-ink-dim" style={{ fontWeight: 400, textAlign: 'left', padding: '5px 4px 5px 0', whiteSpace: 'nowrap' }}>{r.label}</th>
              {cols.map((c) => {
                const v = m.counts[r.key as keyof typeof m.counts][c.key as keyof (typeof m.counts)['pull']]
                const top = m.commonest?.startLine === r.key && m.commonest?.shape === c.key
                return (
                  <td
                    key={c.key}
                    className="font-serif tabular"
                    style={{ textAlign: 'center', padding: '5px 0', fontSize: 14, color: v ? '#1C211C' : '#8A8B7E', fontWeight: top ? 700 : 400, background: top ? '#EBE5D6' : undefined }}
                  >
                    {v || '·'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-caddie-ink-dim" style={{ fontSize: 12, marginTop: 6 }}>
        {m.commonest ? `Most common: ${name(m.commonest.startLine, m.commonest.shape)} (${m.commonest.count}). ` : ''}
        From the {m.total} shot{m.total === 1 ? '' : 's'} with both recorded.
      </div>
    </div>
  )
}

/** The chart as a table: one row per shot, for screen readers and anyone who
 *  wants the numbers. */
export function ShotTable({ points, extras, unit, kinds, caption }: {
  points: DispersionPoint[]
  extras: Record<string, ShotExtras>
  unit: DistanceUnit
  kinds: Map<string, FlightKind>
  caption: string
}) {
  const rows = recentPoints(points, points.length).recent
  return (
    <div style={{ overflowX: 'auto', marginTop: 10 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <caption className="text-caddie-ink-dim" style={{ textAlign: 'left', fontSize: 13, marginBottom: 6 }}>{caption}</caption>
        <thead>
          <tr className="text-caddie-ink-dim" style={{ textAlign: 'left' }}>
            {['Where it finished', 'Recorded', 'Round'].map((h) => (
              <th key={h} scope="col" style={{ fontWeight: 400, padding: '4px 8px 4px 0', borderBottom: '1px solid #D9D2BF' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const { where, recorded, flag, when } = shotParts(p, extras[p.id], unit, kinds.get(p.id))
            return (
              <tr key={p.id} style={{ borderBottom: '1px solid #ECE6D8' }}>
                <td className="font-serif" style={{ padding: '6px 8px 6px 0' }}>{where}</td>
                <td style={{ padding: '6px 8px 6px 0' }}>{recorded}{flag ? <span className="text-caddie-ink-dim">. {flag}</span> : null}</td>
                <td className="text-caddie-ink-dim" style={{ padding: '6px 0', whiteSpace: 'nowrap' }}>
                  {when && extras[p.id]?.roundId ? (
                    <Link to={`/rounds/${extras[p.id]!.roundId}`} className="text-caddie-ink-dim" style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>{when}</Link>
                  ) : (when ?? '')}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
