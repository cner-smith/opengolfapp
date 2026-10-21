import { useEffect, useId, useMemo, useState } from 'react'
import {
  NOT_RECORDED,
  SHOT_CONTACTS,
  SHOT_SHAPES,
  SHOT_START_LINES,
  categoryOf,
  clubNoun,
  computeDispersionStats,
  findingLine,
  median,
  mostlyTeeShots,
  recordedNote,
  type Club,
  type ColourBy,
  type DispersionPoint,
  type LieType,
  type ShotContact,
  type ShotExtras,
  type ShotShape,
  type ShotStartLine,
} from '@oga/core'
import { ClubLadder } from '../../pages/patterns/components/ClubLadder'
import { AimPlot } from '../../pages/patterns/components/AimPlot'
import { TeePlot, teeGeometry } from '../../pages/patterns/components/TeePlot'
import { useNarrow, type ChartProps } from '../../pages/patterns/components/chartParts'
import { ColourByControl, FOCUS_RING, LayerBar, Legend, rovingKey, type LegendEntry } from '../../pages/patterns/components/LayerControls'
import { DEFAULT_LAYERS, UNRECORDED_INK, styledCategories, type Layer } from '../../pages/patterns/layers'

// The landing page's live Shot patterns chart: the app's own chart parts, fed
// a made-up bag of shots built here (no account, no network). Lazy-loaded so
// it never holds up the headline.

// ---------------------------------------------------------------------------
// The example bag: one invented 14-handicap. Each shot gets a start line and a
// shape, and its finish is bent from them the way the tee view draws a flight,
// so the two views agree.
// ---------------------------------------------------------------------------

interface Profile {
  club: Club
  aim: number
  shots: number
  lie: LieType
  /** Shape weights: hook, draw, straight, fade, slice. */
  shape: number[]
  /** Start weights: pull, on line, push. */
  start: number[]
  /** How much this club curves (driver 1). */
  bend: number
  /** Spread of the finish along the line, yards. */
  depth: number
  /** Average finish against the aim, yards (negative = short). */
  short: number
}

const BAG: Profile[] = [
  { club: 'driver', aim: 245, shots: 28, lie: 'tee', shape: [1, 3, 5, 9, 3], start: [2, 5, 4], bend: 1, depth: 13, short: -2 },
  { club: '3w', aim: 226, shots: 14, lie: 'tee', shape: [1, 3, 6, 6, 2], start: [3, 6, 3], bend: 0.9, depth: 12, short: -4 },
  { club: '5w', aim: 208, shots: 12, lie: 'fairway', shape: [1, 4, 6, 5, 1], start: [3, 6, 3], bend: 0.85, depth: 11, short: -5 },
  { club: '4h', aim: 192, shots: 13, lie: 'fairway', shape: [1, 5, 6, 4, 1], start: [3, 6, 2], bend: 0.8, depth: 10, short: -6 },
  { club: '6i', aim: 172, shots: 16, lie: 'fairway', shape: [0, 4, 7, 5, 1], start: [2, 7, 3], bend: 0.75, depth: 9, short: -5 },
  { club: '7i', aim: 160, shots: 24, lie: 'fairway', shape: [0, 3, 7, 7, 1], start: [2, 7, 4], bend: 0.7, depth: 8, short: -4 },
  { club: '8i', aim: 148, shots: 18, lie: 'fairway', shape: [0, 3, 8, 5, 1], start: [3, 7, 3], bend: 0.6, depth: 7, short: -3 },
  { club: '9i', aim: 136, shots: 17, lie: 'fairway', shape: [0, 3, 8, 4, 0], start: [3, 7, 2], bend: 0.5, depth: 6, short: -3 },
  { club: 'pw', aim: 121, shots: 20, lie: 'fairway', shape: [0, 2, 9, 3, 0], start: [4, 7, 2], bend: 0.4, depth: 5, short: -2 },
]
const START_DEG: Record<ShotStartLine, [number, number]> = { pull: [-6, -2], on_line: [-1, 1], push: [2, 6] }
const HALF_TURN: Record<ShotShape, number> = { hook: -6, draw: -2.5, straight: 0, fade: 2.5, slice: 6 }
const CONTACT_W = [16, 2, 2, 0.5, 0.3]

// A small seeded generator: the same example on every visit.
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function sampleBag() {
  const r = rng(14)
  const pick = <T,>(items: readonly T[], w: number[]) => {
    let x = r() * w.reduce((a, b) => a + b, 0)
    for (let i = 0; i < items.length; i++) if ((x -= w[i]!) < 0) return items[i]!
    return items[items.length - 1]!
  }
  const normal = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
  const points = new Map<Club, DispersionPoint[]>()
  const extras: Record<string, ShotExtras> = {}
  const day0 = Date.UTC(2026, 3, 4)
  for (const p of BAG) {
    const list: DispersionPoint[] = []
    for (let i = 0; i < p.shots; i++) {
      const id = `${p.club}-${i}`
      const contact = pick(SHOT_CONTACTS, CONTACT_W) as ShotContact
      const shape = pick(SHOT_SHAPES, p.shape)
      const startLine = pick(SHOT_START_LINES, p.start)
      const [lo, hi] = START_DEG[startLine]
      const startDeg = lo + r() * (hi - lo)
      const bend = shape === 'straight' ? (r() - 0.5) * 1.6 : HALF_TURN[shape] * p.bend * (0.75 + r() * 0.5)
      const chordDeg = startDeg + bend
      const lost = contact === 'fat' ? -0.12 : contact === 'thin' ? -0.07 : contact === 'topped' ? -0.35 : contact === 'shank' ? -0.4 : 0
      const along = p.short + normal() * p.depth + lost * p.aim
      const D = p.aim + along
      // One in ten without a shape or start line: the chart says so.
      const unrecorded = r() < 0.1
      list.push({
        id,
        lateralOffsetYards: D * Math.sin((chordDeg * Math.PI) / 180) + normal() * 1.2,
        distanceOffsetYards: D * Math.cos((chordDeg * Math.PI) / 180) - p.aim,
        startDistanceOffsetYards: -p.aim,
        lieType: p.lie,
        shape: unrecorded ? null : shape,
        startLine: unrecorded ? null : startLine,
        playedAt: new Date(day0 + Math.floor(i / 3) * 6 * 86_400_000).toISOString(),
      })
      extras[id] = { contact: unrecorded ? null : contact, hole: 1 + Math.floor(r() * 18), roundId: null, course: null }
    }
    points.set(p.club, list)
  }
  return { points, extras }
}

const CLUBS = BAG.map((p) => p.club)
type View = 'aim' | 'tee'
const VIEWS: { value: View; label: string }[] = [
  { value: 'aim', label: 'Around the aim' },
  { value: 'tee', label: 'From the tee' },
]

export default function PatternsDemo() {
  const bag = useMemo(sampleBag, [])
  const [club, setClub] = useState<Club>('driver')
  const [view, setView] = useState<View>('tee')
  const [layers, setLayers] = useState<Record<Layer, boolean>>(DEFAULT_LAYERS)
  const [colourBy, setColourBy] = useState<ColourBy>('shape')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [focus, setFocus] = useState<string | null>(null)
  useEffect(() => {
    setHidden(new Set())
    setFocus(null)
  }, [colourBy, club])
  const narrow = useNarrow()
  const ids = { label: useId(), desc: useId(), tab: useId(), panel: useId() }

  const points = bag.points.get(club)!
  const extras = bag.extras
  const stats = useMemo(() => computeDispersionStats(points), [points])
  const kinds = useMemo(() => new Map(teeGeometry(points, false).shots.map((s) => [s.p.id, s.kind])), [points])
  const typical = (c: Club) => {
    const list = bag.points.get(c)!
    return Math.round(median(list.map((p) => p.distanceOffsetYards - (p.startDistanceOffsetYards ?? 0))) ?? 0)
  }
  const noun = clubNoun(club)

  const cats = styledCategories(colourBy, false)
  const colours = new Map(cats.map((c) => [c.key, { color: c.color, glyph: c.glyph }]))
  const counts = new Map<string, number>()
  for (const p of points) {
    const k = categoryOf(p, extras[p.id], colourBy)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const legend: LegendEntry[] =
    colourBy === 'none'
      ? []
      : [
          ...cats.filter((c) => counts.has(c.key)).map((c) => ({ ...c, count: counts.get(c.key)! })),
          ...(counts.has(NOT_RECORDED)
            ? [{ key: NOT_RECORDED, label: 'Not recorded', color: UNRECORDED_INK, glyph: 'unrecorded' as const, count: counts.get(NOT_RECORDED)! }]
            : []),
        ]
  const legendNote = colourBy === 'none' ? '' : recordedNote(colourBy, points, extras, noun).note
  const available: Layer[] = view === 'aim' ? ['shots', 'rings', 'average'] : ['shots', 'rings', 'average', 'flights']

  const chartProps: ChartProps = {
    points,
    older: [],
    stats,
    ghost: null,
    unit: 'yards',
    extras,
    kinds,
    layers,
    colourBy,
    colours,
    hidden,
    focus,
    leftHanded: false,
    club,
    labelId: ids.label,
    descId: ids.desc,
  }
  const finding = stats ? findingLine(stats, points, club, 'yards', mostlyTeeShots(points)) : null

  return (
    <div>
      {finding && (
        <p className="font-serif text-caddie-ink" style={{ fontSize: 19, fontStyle: 'italic', fontWeight: 500, lineHeight: 1.35, margin: '0 0 14px', minHeight: '2.7em', textWrap: 'balance' } as React.CSSProperties}>
          {finding}
        </p>
      )}
      <ClubLadder clubs={CLUBS} value={club} onChange={setClub} typical={typical} aimed={(c) => bag.points.get(c)!.length} unit="yards" />

      <div role="tablist" aria-label="Chart" className="flex" style={{ gap: 18, marginTop: 12, borderBottom: '1px solid #D9D2BF' }}>
        {VIEWS.map((v, j) => {
          const on = v.value === view
          return (
            <button
              key={v.value}
              id={`${ids.tab}-${v.value}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={ids.panel}
              tabIndex={on ? 0 : -1}
              onClick={() => setView(v.value)}
              onKeyDown={(e) => {
                const k = rovingKey(e, j, VIEWS.length)
                if (k != null) setView(VIEWS[k]!.value)
              }}
              className={`pat-tap ${FOCUS_RING}`}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: on ? '2px solid #1C211C' : '2px solid transparent',
                marginBottom: -1,
                padding: '6px 0 8px',
                fontSize: 14,
                fontWeight: on ? 600 : 400,
                color: on ? '#1C211C' : '#5C6356',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {v.label}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" id={ids.panel} aria-labelledby={`${ids.tab}-${view}`}>
        <div className="flex flex-wrap items-center justify-between" style={{ gap: 10, padding: '10px 0 8px', borderBottom: '1px solid #ECE6D8' }}>
          <LayerBar layers={layers} available={available} disabled={new Set()} onToggle={(l) => setLayers((v) => ({ ...v, [l]: !v[l] }))} compact={narrow} />
          <ColourByControl value={colourBy} onChange={setColourBy} compact={narrow} />
        </div>
        <div style={{ padding: '12px 0 6px' }}>
          <span id={ids.label} className="sr-only">{`Example ${noun} shots, ${view === 'aim' ? 'around the aim' : 'from the tee'}`}</span>
          <p id={ids.desc} className="sr-only">{`${points.length} example shots with a ${noun}. ${finding ?? ''}`}</p>
          {view === 'aim' ? <AimPlot {...chartProps} /> : <TeePlot {...chartProps} />}
        </div>
        {legend.length > 0 && (
          <div style={{ padding: '10px 0 0', borderTop: '1px solid #ECE6D8' }}>
            <Legend
              entries={legend}
              hidden={hidden}
              focus={focus}
              onToggle={(k) =>
                setHidden((h) => {
                  const n = new Set(h)
                  if (n.has(k)) n.delete(k)
                  else n.add(k)
                  return n
                })
              }
              onFocus={setFocus}
              note={legendNote}
            />
          </div>
        )}
      </div>
    </div>
  )
}
