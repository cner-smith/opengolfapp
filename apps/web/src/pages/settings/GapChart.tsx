import { HOLE_YARDS, MIN_SAMPLES_FOR_STATS, YARDS_TO_METERS, clubNoun, distanceUnitAbbr, formatClubLabel, wholeDistance, type BagClub, type BagGap, type BagGaps, type DistanceUnit } from '@oga/core'
import type { UserClub } from '../../hooks/useUserBag'

/** One in-bag club as the chart and the yardage card read it. */
export interface BagRung extends BagClub {
  club: UserClub
}

const ROW = 30
const WARN = '#A66A1F'
const NEG = '#A33A2A'
const HATCH = 'repeating-linear-gradient(135deg, rgba(166,106,31,0.22) 0 4px, rgba(166,106,31,0.06) 4px 8px)'

const words = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

// A gap whose empty stretch is HOLE_YARDS or more reads as a hole, even with
// unmeasured clubs inside it (the headline counts it the same way).
function holeSize(g: BagGap<BagRung>): number | null {
  if (!g.span || g.kind === 'overlap' || g.kind === 'step') return null
  const size = g.span.high - g.span.low
  return size >= HOLE_YARDS ? size : null
}

// The gapping chart: one row per in-bag club in the bag's order, a bar where
// two in three of its shots finish, a tick at its typical distance, holes
// hatched and overlaps shaded between neighbours. The gap math is core's
// bagGaps; this only draws it. `example` is the landing page's editable bag:
// numbers are typed beside the chart, and none come from shots.
export function GapChart({ bag, unit, example }: { bag: BagGaps<BagRung>; unit: DistanceUnit; example?: boolean }) {
  const u = distanceUnitAbbr(unit)
  const show = (yd: number) => wholeDistance(yd, unit)

  if (!bag.headline) {
    return (
      <p className="text-caddie-ink-dim" style={{ fontSize: 14, marginBottom: 24, maxWidth: 620 }}>
        {example
          ? 'Give two clubs a typical distance and the gaps between them show here.'
          : 'Give two clubs a typical distance (open a club on the card below) and the gaps between them show here.'}
      </p>
    )
  }

  const rungs = bag.rungs
  const numbered = rungs.filter((r) => r.typical)
  const top = Math.max(...numbered.map((r) => r.range?.high ?? r.typical!.yards))
  const bottom = Math.min(...numbered.map((r) => r.range?.low ?? r.typical!.yards))
  // Axis ticks every 25 in the player's unit.
  const step = unit === 'meters' ? 25 / YARDS_TO_METERS : 25
  const min = Math.max(0, Math.floor(bottom / step) * step)
  const max = Math.ceil((top + 12) / step) * step
  const x = (yd: number) => `${((yd - min) / (max - min)) * 100}%`
  const ticks: number[] = []
  for (let t = min; t <= max + 0.01; t += step) ticks.push(t)
  const rowOf = (r: BagRung) => rungs.indexOf(r)

  const holes = bag.gaps
    .filter((g) => holeSize(g) != null)
    .sort((a, b) => holeSize(b)! - holeSize(a)!)
  const overlaps = bag.gaps
    .filter((g) => g.kind === 'overlap')
    .sort((a, b) => b.span!.high - b.span!.low - (a.span!.high - a.span!.low))
  const measured = numbered.filter((r) => r.range).length

  return (
    <section style={{ marginBottom: 34 }} aria-label="Gapping chart">
      <p
        className="font-serif text-caddie-ink"
        style={{ fontSize: 22, fontStyle: 'italic', fontWeight: 500, lineHeight: 1.3, marginBottom: 16, maxWidth: 640 }}
        data-testid="bag-headline"
      >
        {bag.headline}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'clamp(44px, 16vw, 128px) minmax(0,1fr)', columnGap: 10, paddingRight: 30 }}>
        <div>
          {rungs.map((r) => (
            <div
              key={r.club.id}
              className={r.typical ? 'text-caddie-ink' : 'text-caddie-ink-dim'}
              style={{ height: ROW, display: 'flex', alignItems: 'center', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden' }}
            >
              <span className="hidden sm:inline" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {r.club.name}
              </span>
              <span className="sm:hidden">{formatClubLabel(r.club)}</span>
            </div>
          ))}
        </div>

        <div aria-hidden style={{ position: 'relative', height: rungs.length * ROW, borderLeft: '1px solid #9F9580' }}>
          {ticks.map((t) => (
            <div key={t} style={{ position: 'absolute', left: x(t), top: 0, bottom: 0, width: 1, background: '#E4DCCA' }} />
          ))}
          {[...holes, ...overlaps].map((g, i) => {
            const a = rowOf(g.longer) * ROW + ROW / 2
            const b = rowOf(g.shorter) * ROW + ROW / 2
            const hole = g.kind !== 'overlap'
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: x(g.span!.low),
                  width: `calc(${x(g.span!.high)} - ${x(g.span!.low)})`,
                  top: Math.min(a, b),
                  height: Math.abs(b - a),
                  background: hole ? HATCH : 'rgba(163,58,42,0.16)',
                  borderLeft: hole ? `1px dashed ${WARN}` : 'none',
                  borderRight: hole ? `1px dashed ${WARN}` : 'none',
                }}
              />
            )
          })}
          {rungs.map((r, i) => {
            const y = i * ROW + ROW / 2
            if (!r.typical) {
              return (
                <div
                  key={r.club.id}
                  className="text-caddie-ink-dim"
                  style={{ position: 'absolute', left: 8, top: y - 9, fontSize: 12, lineHeight: '18px', fontStyle: 'italic', whiteSpace: 'nowrap' }}
                >
                  no number yet
                </div>
              )
            }
            const shots = r.typical.source === 'shots'
            return (
              <div key={r.club.id}>
                {r.range ? (
                  <div
                    style={{
                      position: 'absolute',
                      left: x(r.range.low),
                      width: `calc(${x(r.range.high)} - ${x(r.range.low)})`,
                      top: y - 5,
                      height: 10,
                      background: '#8FA493',
                      borderRadius: 1,
                    }}
                  />
                ) : null}
                <div
                  style={{
                    position: 'absolute',
                    left: x(r.typical.yards),
                    top: y - 9,
                    width: 2,
                    height: 18,
                    marginLeft: -1,
                    background: shots ? '#1F3D2C' : '#8A8B7E',
                  }}
                />
                <div
                  className="font-serif tabular"
                  style={{
                    position: 'absolute',
                    left: `calc(${x(r.range?.high ?? r.typical.yards)} + 6px)`,
                    top: y - 9,
                    fontSize: 14,
                    lineHeight: '18px',
                    color: shots ? '#1C211C' : '#5C6356',
                    fontStyle: shots ? 'normal' : 'italic',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {show(r.typical.yards)}
                </div>
              </div>
            )
          })}
        </div>
        <div />
        <div aria-hidden style={{ position: 'relative', height: 22, borderTop: '1px solid #9F9580' }}>
          {ticks.map((t, i) => (
            <span
              key={t}
              className={`text-caddie-ink-dim tabular ${i % 2 ? 'hidden sm:inline' : ''}`}
              style={{ position: 'absolute', left: x(t), top: 4, fontSize: 11, transform: 'translateX(-50%)' }}
            >
              {show(t)}
            </span>
          ))}
        </div>
      </div>

      <div className="text-caddie-ink-dim" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', fontSize: 12, marginTop: 10 }}>
        {example ? null : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span aria-hidden style={{ width: 18, height: 8, background: '#8FA493', position: 'relative' }}>
              <span style={{ position: 'absolute', left: 8, top: -4, width: 2, height: 16, background: '#1F3D2C' }} />
            </span>
            Typical distance, and where two in three shots finish ({measured} club{measured === 1 ? '' : 's'} with {MIN_SAMPLES_FOR_STATS}+ shots)
          </span>
        )}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span aria-hidden style={{ width: 2, height: 14, background: '#8A8B7E' }} />
          Your estimate
        </span>
        {holes.length ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span aria-hidden style={{ width: 14, height: 10, background: HATCH, border: `1px dashed ${WARN}` }} />
            Hole, {wholeDistance(HOLE_YARDS, unit)} {u} or more
          </span>
        ) : null}
        {overlaps.length ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span aria-hidden style={{ width: 14, height: 10, background: 'rgba(163,58,42,0.25)' }} />
            Overlap
          </span>
        ) : null}
      </div>

      {bag.unmeasured.length ? (
        <p className="text-caddie-ink-dim" style={{ fontSize: 13, marginTop: 10, maxWidth: 640 }}>
          No number yet for your {words(bag.unmeasured.map((r) => clubNoun(r.club.club_type)))}
          {example
            ? '.'
            : `: log five shots with ${bag.unmeasured.length === 1 ? 'it' : 'each'}, or open the club on the card and type a typical distance.`}
        </p>
      ) : null}

      {holes.length + overlaps.length > 0 ? (
        <ul style={{ marginTop: 14, borderTop: '1px solid #D9D2BF', maxWidth: 640 }} aria-label="Holes and overlaps">
          {[...holes, ...overlaps].map((g, i) => {
            const hole = g.kind !== 'overlap'
            return (
              <li
                key={i}
                className="text-caddie-ink"
                style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid #D9D2BF', fontSize: 14 }}
              >
                <span>
                  {hole ? 'Hole' : 'Overlap'} between {clubNoun(g.longer.clubType)} and {clubNoun(g.shorter.clubType)}
                  {g.unmeasured.length ? (
                    <span className="text-caddie-ink-dim">
                      {' '}
                      · no number yet for {words(g.unmeasured.map((r) => clubNoun(r.clubType)))}
                    </span>
                  ) : null}
                </span>
                <span className="font-serif tabular" style={{ fontSize: 16, whiteSpace: 'nowrap', color: hole ? WARN : NEG }}>
                  {show(g.span!.high - g.span!.low)} {u}
                </span>
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}
