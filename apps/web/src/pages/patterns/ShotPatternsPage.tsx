import { useEffect, useMemo, useRef, useState } from 'react'
import { toBlob } from 'html-to-image'
import {
  CLUBS,
  DEFAULT_BAG,
  LIE_TYPES,
  MIN_SAMPLES_FOR_STATS,
  YARDS_TO_METERS,
  clubNoun,
  clubTypicalDistance,
  type Club,
  type DispersionPoint,
  type DispersionStats,
  type LieSlopeForward,
  type LieSlopeSide,
  type LieType,
} from '@oga/core'
import { useHasAimedShots, useShotPatterns } from '../../hooks/useShotPatterns'
import { LieSlopeGrid } from '../../components/forms/LieSlopeGrid'
import { useAuth } from '../../hooks/useAuth'
import { useUnits } from '../../hooks/useUnits'
import { useUserBag } from '../../hooks/useUserBag'
import { useClubDispersion } from '../rounds/hooks/useClubDispersion'
import { StatRow, StatTile } from '../stats/components/StatTiles'
import { ShotPatternsShareCard } from './components/ShotPatternsShareCard'
import { PatternExplainer, PatternProgress, PatternsEmpty } from './components/PatternsPreview'
import { ClubLadder } from './components/ClubLadder'
import { AimPlot, TeePlot, teeBreakYards, useNarrow, type ChartProps } from './components/PatternCharts'
import { ColourByControl, LAYER_INFO, LayerBar, Legend, type LegendEntry } from './components/LayerControls'
import {
  COLOUR_BY,
  DEFAULT_LAYERS,
  NOT_RECORDED,
  UNRECORDED_INK,
  categoriesFor,
  categoryOf,
  countWord,
  recordedSummary,
  type ColourBy,
  type Layer,
  type ShotAxes,
} from './layers'
import { useProfile } from '../../hooks/useProfile'

// Social share card — 1200×630 is Twitter/Facebook's preferred OG image
// size. Rendered off-screen, rasterised on Export. The plot inside is
// drawn at a fixed pixel size so the capture is viewport-independent.
const SHARE_CARD_W = 1200
const SHARE_CARD_H = 630

type View = 'aim' | 'tee'
const VIEWS: { value: View; label: string }[] = [
  { value: 'aim', label: 'Around the aim' },
  { value: 'tee', label: 'From the tee' },
]

// Within 2 yd reads as on the aim (the core's dominant-miss threshold).
const ON_AIM = 2

const LIE_PHRASE: Record<LieType, string> = {
  tee: 'the tee',
  fairway: 'the fairway',
  rough: 'the rough',
  sand: 'sand',
  fringe: 'the fringe',
  recovery: 'a recovery lie',
  green: 'the green',
}

export function ShotPatternsPage() {
  const { unit, toDisplay } = useUnits()
  const { user } = useAuth()
  const [club, setClub] = useState<Club>('7i')
  // Only the player's bag (DEFAULT_BAG while it loads / if empty), catalog order.
  const { bag } = useUserBag()
  const clubOptions = useMemo(() => {
    const have = new Set<string>((bag.length ? bag : DEFAULT_BAG).map((c) => c.club_type))
    return CLUBS.filter((c) => c !== 'putter' && have.has(c))
  }, [bag])
  useEffect(() => {
    if (clubOptions.length && !clubOptions.includes(club)) setClub(clubOptions[0]!)
  }, [clubOptions, club])
  const [lieType, setLieType] = useState<LieType | ''>('')
  const [lieSlopeForward, setLieSlopeForward] = useState<LieSlopeForward | undefined>(undefined)
  const [lieSlopeSide, setLieSlopeSide] = useState<LieSlopeSide | undefined>(undefined)
  const [view, setView] = useState<View>('aim')
  const [sheetOpen, setSheetOpen] = useState(false)
  // Layers: calm by default (rings, average, shots; flights on the tee view).
  const [layers, setLayers] = useState<Record<Layer, boolean>>(DEFAULT_LAYERS)
  const [colourBy, setColourBy] = useState<ColourBy>('none')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [focus, setFocus] = useState<string | null>(null)
  useEffect(() => {
    setHidden(new Set())
    setFocus(null)
  }, [colourBy, club])
  const narrow = useNarrow()
  const { data: profile } = useProfile()
  const leftHanded = profile?.plays_left_handed === true

  const hasAimed = useHasAimedShots()
  const { data, isLoading, clubShots } = useShotPatterns({
    club,
    lieType: lieType || undefined,
    lieSlopeForward,
    lieSlopeSide,
  })
  // Typical distance per club from the player's own shots (the live wheel's
  // rule: five or more aimed shots). No typed estimate: no data, no number.
  const { byClub } = useClubDispersion(user?.id)
  const typicalYards = (c: Club) => {
    const d = byClub.get(c)
    return clubTypicalDistance(d?.medianDistanceYards, d?.sampleSize ?? 0, null)?.yards ?? null
  }
  const ladderNumber = (c: Club) => {
    const y = typicalYards(c)
    return y == null ? null : Math.round(unit === 'meters' ? y * YARDS_TO_METERS : y)
  }

  const points = data?.points ?? []
  const stats = data?.stats ?? null
  const axes: Record<string, ShotAxes> = data?.axes ?? {}
  const filtered = !!(lieType || lieSlopeForward || lieSlopeSide)
  const slopes = [lieSlopeForward, lieSlopeSide].filter(Boolean).map((v) => v!.replace(/_/g, ' '))
  const filterSummary = [
    lieType ? cap(lieType) : 'Any lie',
    slopes.join(', ') || 'any slope',
    ...(colourBy !== 'none' ? [`colour by ${COLOUR_BY.find((o) => o.value === colourBy)!.label.toLowerCase()}`] : []),
  ].join(' · ')
  // "from the rough, uphill": the filters in a sentence.
  const filterPhrase = [lieType ? `from ${LIE_PHRASE[lieType]}` : '', ...slopes].filter(Boolean).join(', ')

  const shareCardRef = useRef<HTMLDivElement | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  // Off-screen share card mounts lazily on first export so it isn't laid out
  // on every club-chip re-render for users who never share.
  const [showShareCard, setShowShareCard] = useState(false)

  // Rasterise the off-screen 1200×630 share card and open the native
  // share sheet (Web Share API), falling back to a download where file
  // sharing isn't supported or the share fails for any reason other than
  // the user dismissing the sheet. The `await` before share() can expire the
  // iOS-Safari gesture token, in which case it degrades to the download path.
  async function handleExport() {
    if (exporting) return
    setExporting(true)
    setExportError(null)
    try {
      if (!shareCardRef.current) {
        setShowShareCard(true)
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        )
      }
      const node = shareCardRef.current
      if (!node) throw new Error('share card not ready')
      const blob = await toBlob(node, {
        width: SHARE_CARD_W,
        height: SHARE_CARD_H,
        cacheBust: true,
        backgroundColor: '#FBF8F1',
      })
      if (!blob) throw new Error('empty blob')
      const filename = `oga-${club}-pattern.png`
      const file = new File([blob], filename, { type: 'image/png' })
      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'OGA Shot Pattern' })
          return
        } catch (err) {
          if ((err as Error).name === 'AbortError') return
        }
      }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      // Firefox and older Safari only honour downloads from an attached anchor.
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setExportError('Could not export the image. Try again.')
    } finally {
      setExporting(false)
    }
  }

  // No aimed shot in any club → the example page (#1076).
  if (hasAimed.isLoading || hasAimed.data === false) {
    return (
      <div>
        <PageHeader
          subtitle={
            hasAimed.isLoading
              ? 'Loading…'
              : 'No shots with an aim yet. Here’s what one club’s pattern looks like once you have some.'
          }
        />
        {!hasAimed.isLoading && <PatternsEmpty />}
      </div>
    )
  }

  const noun = clubNoun(club)
  const emptyNote =
    clubShots === 0
      ? `No aimed ${noun} shots yet`
      : filtered
        ? `No ${noun} shots ${filterPhrase}`
        : undefined

  // The legend: each group of shots under the chosen colour, with its count.
  const cats = categoriesFor(colourBy, leftHanded)
  const colours = new Map(cats.map((c) => [c.key, c.color]))
  const counts = new Map<string, number>()
  for (const p of points) {
    const k = categoryOf(axes[p.id], colourBy)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const legend: LegendEntry[] =
    colourBy === 'none'
      ? []
      : [
          ...cats.filter((c) => counts.has(c.key)).map((c) => ({ ...c, count: counts.get(c.key)! })),
          ...(counts.has(NOT_RECORDED) ? [{ key: NOT_RECORDED, label: 'Not recorded', color: UNRECORDED_INK, count: counts.get(NOT_RECORDED)!, open: true }] : []),
        ]
  const recordedOf = colourBy === 'none' ? null : recordedSummary(colourBy, points.map((p) => p.id), axes)
  // Rings and the average need a pattern (five shots); without one they go.
  const available = (view === 'aim' ? (['rings', 'average', 'shots'] as Layer[]) : (['flights', 'shots', 'rings', 'average'] as Layer[])).filter(
    (l) => stats || (l !== 'rings' && l !== 'average'),
  )
  const toggleLayer = (l: Layer) => setLayers((v) => ({ ...v, [l]: !v[l] }))
  const toggleGroup = (k: string) =>
    setHidden((h) => {
      const n = new Set(h)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  const chartProps: ChartProps = { points, stats, unit, axes, layers, colourBy, colours, hidden, focus, leftHanded, empty: emptyNote }
  const caption = chartCaption({ view, layers, available, colourBy, legend, hidden, stats, points, axes, leftHanded, unit })

  const lieChips = (
    <div className="flex flex-wrap" style={{ gap: 6 }}>
      {(['', ...LIE_TYPES] as const).map((v) => (
        <button key={v || 'any'} type="button" onClick={() => setLieType(v)} style={chipStyle(lieType === v)}>
          {v === '' ? 'Any' : cap(v.replace(/_/g, ' '))}
        </button>
      ))}
    </div>
  )
  const slopeGrid = (
    <LieSlopeGrid
      forward={lieSlopeForward}
      side={lieSlopeSide}
      onChangeForward={setLieSlopeForward}
      onChangeSide={setLieSlopeSide}
      toggleable
    />
  )
  const finding = stats ? findingLine(stats, club, toDisplay) : null

  return (
    <div>
      <PageHeader
        subtitle={
          clubShots > 0
            ? `${points.length} ${noun} shot${points.length === 1 ? '' : 's'}${filterPhrase ? ` ${filterPhrase}` : ''}, measured from the aim you set.`
            : 'Where each club finishes, measured from the aim you set before the shot.'
        }
      />
      {finding && (
        <p className="font-serif text-caddie-ink" style={{ fontSize: 24, fontStyle: 'italic', fontWeight: 500, lineHeight: 1.3, margin: '-8px 0 20px', maxWidth: 760 }}>
          {finding}
        </p>
      )}

      <ClubLadder clubs={clubOptions} value={club} onChange={setClub} typical={ladderNumber} />
      <div className="text-caddie-ink-mute" style={{ fontSize: 12, marginTop: 6 }}>
        Typical distance in {unit === 'meters' ? 'metres' : 'yards'}, once a club has five aimed shots.
      </div>

      {/* Desktop: lie and slope as a compact second row. */}
      <div className="hidden lg:flex items-center" style={{ gap: 18, marginTop: 14, flexWrap: 'wrap' }}>
        <span className="text-caddie-ink-dim" style={{ fontSize: 13 }}>Lie</span>
        {lieChips}
        <SlopePopover summary={[lieSlopeForward, lieSlopeSide].filter(Boolean).map((s) => cap(s!.replace(/_/g, ' '))).join(', ') || 'Any'}>
          {slopeGrid}
        </SlopePopover>
      </div>
      {/* Phone: one button; lie, slope and the colour in a sheet. */}
      <div className="lg:hidden flex items-center" style={{ gap: 10, marginTop: 14 }}>
        <button type="button" onClick={() => setSheetOpen(true)} style={{ ...chipStyle(filtered || colourBy !== 'none'), padding: '8px 12px', fontSize: 13, flex: 'none' }}>
          Filters
        </button>
        <span className="text-caddie-ink-dim" style={{ fontSize: 13 }}>{filterSummary}</span>
      </div>

      <div
        className="grid grid-cols-1 lg:[grid-template-columns:minmax(0,2fr)_minmax(0,1fr)]"
        style={{ gap: 28, marginTop: 22, borderTop: '1px solid #D9D2BF', paddingTop: 18 }}
      >
        <div style={{ maxWidth: 600 }}>
          <ViewToggle value={view} onChange={setView} />
          <div className="bg-caddie-surface" style={{ border: '1px solid #D9D2BF', borderRadius: 4, marginTop: 10 }}>
            <div style={{ padding: '10px 10px 8px', borderBottom: '1px solid #ECE6D8' }}>
              <LayerBar layers={layers} available={available} onToggle={toggleLayer} compact={narrow} />
            </div>
            <div style={{ padding: '12px 12px 6px' }}>
              {isLoading ? (
                <div className="flex items-center justify-center text-caddie-ink-mute" style={{ aspectRatio: '1 / 1', fontSize: 13 }}>Loading…</div>
              ) : view === 'aim' ? (
                <AimPlot {...chartProps} />
              ) : (
                <TeePlot {...chartProps} />
              )}
            </div>
            {points.length > 0 && (
              <div className={legend.length ? 'grid' : 'hidden lg:grid'} style={{ padding: '10px 12px 12px', borderTop: '1px solid #ECE6D8', gap: 10 }}>
                <div className="hidden lg:block">
                  <ColourByControl value={colourBy} onChange={setColourBy} />
                </div>
                {legend.length > 0 && <Legend entries={legend} hidden={hidden} onToggle={toggleGroup} onFocus={setFocus} />}
                {recordedOf && (
                  <div className="text-caddie-ink-dim" style={{ fontSize: 12, lineHeight: 1.45 }}>
                    {recordedOf.recorded === 0
                      ? `No ${noun} shot here has its ${colourBy === 'start' ? 'start line' : colourBy} recorded yet. Set it in a shot's result after the hole.`
                      : `${recordedOf.note}. Tap a group to hide it.`}
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="text-caddie-ink-dim" style={{ fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>{caption}</p>
        </div>

        <div>
          {stats ? (
            <Numbers stats={stats} typical={typicalYards(club)} toDisplay={toDisplay} ids={points.map((p) => p.id)} axes={axes} filtered={filtered} />
          ) : !isLoading && clubShots < MIN_SAMPLES_FOR_STATS ? (
            <PatternProgress club={club} shots={clubShots} />
          ) : !isLoading ? (
            <p className="font-serif text-caddie-ink" style={{ fontSize: 17, lineHeight: 1.55 }}>
              {points.length === 0 ? 'None' : `Only ${points.length}`} of your {clubShots} {noun} shots {points.length === 1 ? 'was' : 'were'}{' '}
              {filterPhrase}. A pattern needs five: widen the lie or slope to see one.
            </p>
          ) : null}

          {stats && (
            <div className="flex items-center" style={{ gap: 12, marginTop: 22 }}>
              <button
                type="button"
                onClick={handleExport}
                onPointerEnter={() => setShowShareCard(true)}
                onFocus={() => setShowShareCard(true)}
                disabled={exporting}
                className="text-caddie-ink hover:bg-caddie-surface-2 disabled:opacity-40"
                style={{ background: 'transparent', border: '1px solid #9F9580', borderRadius: 2, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}
              >
                {exporting ? 'Rendering…' : 'Export image'}
              </button>
              {exportError && <span className="text-caddie-neg" style={{ fontSize: 12 }}>{exportError}</span>}
            </div>
          )}
        </div>
      </div>

      {!isLoading && clubShots < MIN_SAMPLES_FOR_STATS && <PatternExplainer />}

      {sheetOpen && (
        <FilterSheet onClose={() => setSheetOpen(false)}>
          <div className="text-caddie-ink-dim" style={{ fontSize: 13, marginBottom: 8 }}>Lie</div>
          {lieChips}
          <div className="text-caddie-ink-dim" style={{ fontSize: 13, margin: '18px 0 8px' }}>Slope</div>
          {slopeGrid}
          <div className="text-caddie-ink-dim" style={{ fontSize: 13, margin: '18px 0 8px' }}>Colour the shots by</div>
          <div className="flex flex-wrap" style={{ gap: 6 }}>
            {COLOUR_BY.map((o) => (
              <button key={o.value} type="button" onClick={() => setColourBy(o.value)} style={{ ...chipStyle(colourBy === o.value), padding: '8px 12px', fontSize: 13 }}>
                {o.label}
              </button>
            ))}
          </div>
          <div className="text-caddie-ink-mute" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.45 }}>
            Shape, start line and contact come from each shot's result, where you recorded one.
          </div>
        </FilterSheet>
      )}

      {/* Off-screen render target for the 1200×630 share card. */}
      {showShareCard && stats && (
        <div aria-hidden style={{ position: 'fixed', left: -99999, top: 0, pointerEvents: 'none' }}>
          <div ref={shareCardRef}>
            <ShotPatternsShareCard points={points} stats={stats} club={club} unit={unit} toDisplay={toDisplay} />
          </div>
        </div>
      )}
    </div>
  )
}

// "Your 7-iron finishes 4 yd short and 5 yd right. Aim 5 yd left."
function findingLine(stats: DispersionStats, club: Club, toDisplay: (y: number, d?: number) => string) {
  const d = stats.avgDistanceOffset
  const l = stats.avgLateralOffset
  const along = Math.abs(d) < ON_AIM ? 'as far as you aim' : `${toDisplay(Math.abs(d))} ${d < 0 ? 'short' : 'long'}`
  const across = Math.abs(l) < ON_AIM ? 'on your line' : `${toDisplay(Math.abs(l))} ${l > 0 ? 'right' : 'left'}`
  const fix = Math.abs(l) < ON_AIM ? '' : ` Aim ${toDisplay(Math.abs(l))} ${l > 0 ? 'left' : 'right'}.`
  return `Your ${clubNoun(club)} finishes ${along} and ${across}.${fix}`
}

// What the chart is showing right now, and what the toggles have hidden.
function chartCaption({ view, layers, available, colourBy, legend, hidden, stats, points, axes, leftHanded, unit }: {
  view: View
  layers: Record<Layer, boolean>
  available: Layer[]
  colourBy: ColourBy
  legend: LegendEntry[]
  hidden: Set<string>
  stats: DispersionStats | null
  points: DispersionPoint[]
  axes: Record<string, ShotAxes>
  leftHanded: boolean
  unit: 'yards' | 'meters'
}) {
  const by = COLOUR_BY.find((o) => o.value === colourBy)!.label.toLowerCase()
  const parts: string[] = []
  if (view === 'aim') {
    parts.push(`Each dot is where a shot finished${colourBy === 'none' ? '' : `, coloured by its ${by}`}.`)
  } else {
    const neither = points.filter((p) => !axes[p.id]?.startLine && !axes[p.id]?.shape).length
    parts.push(
      `Each line runs from where the shot was hit to where it finished. It leaves on the start line you recorded, or bends the way its recorded shape curves${leftHanded ? ' for a left-hander' : ''}.`,
    )
    if (teeBreakYards(points, stats) > 0) parts.push('Below the break on the distance scale the drawing is shortened; above it, across and along share one scale.')
    if (neither > 0) parts.push(`${neither} dashed ${neither === 1 ? 'line has' : 'lines have'} neither recorded, so ${neither === 1 ? 'it is' : 'they are'} drawn straight.`)
  }
  if (stats && layers.rings) parts.push('The solid ring holds about two shots in three; the dashed ring nearly all.')
  if (stats && layers.average) parts.push('The open circle is the average finish.')
  if (view === 'aim') parts.push(`Squares are ${unit === 'meters' ? '4.6 m' : '5 yd'}.`)
  const off = available.filter((l) => !layers[l]).map((l) => LAYER_INFO[l].hides)
  const groups = legend.filter((e) => hidden.has(e.key)).map((e) => (e.key === NOT_RECORDED ? `${e.count} not recorded` : countWord(e.key, e.label, e.count)))
  if (off.length || groups.length) {
    parts.push(`Hidden: ${[...off, ...groups].join('; ')}.`)
    if (groups.length && stats) parts.push('Hidden shots still count in the rings and the numbers.')
  }
  return parts.join(' ')
}

function Numbers({
  stats,
  typical,
  toDisplay,
  ids,
  axes,
  filtered,
}: {
  stats: DispersionStats
  typical: number | null
  toDisplay: (y: number, d?: number) => string
  ids: string[]
  axes: Record<string, ShotAxes>
  filtered: boolean
}) {
  const shape = recordedSummary('shape', ids, axes)
  const start = recordedSummary('start', ids, axes)
  return (
    <div>
      <div className="grid grid-cols-2" style={{ gap: 12, marginBottom: 8 }}>
        <StatTile label="Typical distance" value={typical != null ? toDisplay(typical) : '—'} subtle="every lie" />
        <StatTile label="Pattern width" value={toDisplay(stats.cone68.lateral * 2)} subtle="two shots in three" />
      </div>
      <div>
        <StatRow label="Shots" value={String(stats.sampleSize)} note={filtered ? 'With these filters' : 'With an aim, from any lie'} />
        <StatRow label="Pattern depth" value={toDisplay(stats.cone68.distance * 2)} note="Short to long, two shots in three" />
        <StatRow label="Nearly all" value={`${toDisplay(stats.cone95.lateral * 2)} wide`} note={`19 shots in 20, ${toDisplay(stats.cone95.distance * 2)} short to long`} />
        <StatRow label="Shape" value={shape.value.replace(' ', '\u00a0')} note={shape.note} />
        <StatRow label="Start line" value={start.value.replace(' ', '\u00a0')} note={start.note} />
      </div>
    </div>
  )
}

function PageHeader({ subtitle }: { subtitle: string }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h1 className="font-serif text-caddie-ink" style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.15 }}>
        Shot patterns
      </h1>
      <div className="text-caddie-ink-dim" style={{ fontSize: 15, marginTop: 6, maxWidth: 560 }}>
        {subtitle}
      </div>
    </div>
  )
}

// Two views of one hero chart, set like a printed tab: the active one inked
// and underlined, no fill (the accent stays on the club).
function ViewToggle({ value, onChange }: { value: View; onChange: (v: View) => void }) {
  return (
    <div role="tablist" aria-label="Chart" className="flex" style={{ gap: 18, borderBottom: '1px solid #D9D2BF' }}>
      {VIEWS.map((v) => {
        const on = v.value === value
        return (
          <button
            key={v.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(v.value)}
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
            }}
          >
            {v.label}
          </button>
        )
      })}
    </div>
  )
}

function SlopePopover({ summary, children }: { summary: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div ref={ref} style={{ position: 'relative' }} className="flex items-center">
      <span className="text-caddie-ink-dim" style={{ fontSize: 13, marginRight: 8 }}>Slope</span>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} style={{ ...chipStyle(summary !== 'Any'), padding: '6px 10px' }}>
        {summary} <span aria-hidden style={{ marginLeft: 4 }}>▾</span>
      </button>
      {open && (
        <div
          className="bg-caddie-surface"
          style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 20, width: 340, border: '1px solid #9F9580', borderRadius: 4, padding: 12 }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

function FilterSheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div role="dialog" aria-modal aria-label="Filters" style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(28,33,28,0.48)' }} />
      <div
        className="bg-caddie-surface"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, borderTop: '1px solid #9F9580', borderRadius: '12px 12px 0 0', padding: '12px 16px calc(18px + env(safe-area-inset-bottom))' }}
      >
        <div style={{ width: 32, height: 4, background: '#D9D2BF', margin: '0 auto 12px' }} />
        <h2 className="font-serif text-caddie-ink" style={{ fontSize: 22, fontStyle: 'italic', fontWeight: 500, marginBottom: 14 }}>Filters</h2>
        {children}
        <button
          type="button"
          onClick={onClose}
          className="bg-caddie-accent text-caddie-accent-ink"
          style={{ width: '100%', marginTop: 18, padding: '13px 16px', borderRadius: 2, border: 'none', fontSize: 14, fontWeight: 600 }}
        >
          Done
        </button>
      </div>
    </div>
  )
}

function cap(s: string) {
  return s[0]!.toUpperCase() + s.slice(1)
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    backgroundColor: active ? '#1C211C' : '#EBE5D6',
    color: active ? '#F2EEE5' : '#1C211C',
    border: 'none',
    borderRadius: 2,
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: active ? 500 : 400,
    cursor: 'pointer',
  }
}
