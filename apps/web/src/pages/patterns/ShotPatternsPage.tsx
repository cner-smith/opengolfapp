import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { toBlob } from 'html-to-image'
import { useNavigate } from 'react-router-dom'
import {
  CLUBS,
  DEFAULT_BAG,
  LIE_TYPES,
  MIN_SAMPLES_FOR_STATS,
  SHOT_SHAPE_LABELS,
  YARDS_TO_METERS,
  clubNoun,
  clubTypicalDistance,
  recentVsAll,
  shapeTally,
  type Club,
  type DispersionPoint,
  type DispersionStats,
  type LieSlopeForward,
  type LieSlopeSide,
  type LieType,
} from '@oga/core'
import { useClubLadder, useShotPatterns } from '../../hooks/useShotPatterns'
import { LieSlopeGrid } from '../../components/forms/LieSlopeGrid'
import { useUnits } from '../../hooks/useUnits'
import { useUserBag } from '../../hooks/useUserBag'
import { useProfile } from '../../hooks/useProfile'
import { ShotPatternsShareCard } from './components/ShotPatternsShareCard'
import { PatternExplainer, PatternProgress, PatternsEmpty } from './components/PatternsPreview'
import { ClubLadder } from './components/ClubLadder'
import { AimPlot, squaresWord } from './components/AimPlot'
import { TeePlot, teeGeometry } from './components/TeePlot'
import { useNarrow, type ChartProps, type Ghost } from './components/chartParts'
import { ColourByControl, FOCUS_RING, LAYER_INFO, LayerBar, Legend, rovingKey, type LegendEntry } from './components/LayerControls'
import { PatternNumbers, ShotTable } from './components/PatternNumbers'
import { COLOUR_BY, DEFAULT_LAYERS, NOT_RECORDED, UNRECORDED_INK, categoriesFor, categoryOf, countWord, type ColourBy, type Layer } from './layers'
import { cap, dist, findingLine, mostlyTeeShots, readQuality, tallyWords } from './words'

// Social share card — 1200×630 is Twitter/Facebook's preferred OG image
// size. Rendered off-screen, rasterised on Export. The plot inside is
// drawn at a fixed pixel size so the capture is viewport-independent.
const SHARE_CARD_W = 1200
const SHARE_CARD_H = 630
const RECENT = 20

type View = 'aim' | 'tee'
type Scope = 'all' | 'recent'
const VIEWS: { value: View; label: string }[] = [
  { value: 'aim', label: 'Around the aim' },
  { value: 'tee', label: 'From the tee' },
]

const LIE_PHRASE: Record<LieType, string> = {
  tee: 'the tee',
  fairway: 'the fairway',
  rough: 'the rough',
  sand: 'sand',
  fringe: 'the fringe',
  recovery: 'a recovery lie',
  green: 'the green',
}

const newestFirst = (a: DispersionPoint, b: DispersionPoint) => (b.playedAt ?? '').localeCompare(a.playedAt ?? '')

export function ShotPatternsPage() {
  const { unit, toDisplay } = useUnits()
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
  const [scope, setScope] = useState<Scope>('all')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [showTable, setShowTable] = useState(false)
  const [layers, setLayers] = useState<Record<Layer, boolean>>(DEFAULT_LAYERS)
  const [colourBy, setColourBy] = useState<ColourBy>('none')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [focus, setFocus] = useState<string | null>(null)
  useEffect(() => {
    setHidden(new Set())
    setFocus(null)
  }, [colourBy, club])
  const narrow = useNarrow()
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const leftHanded = profile?.plays_left_handed === true
  const filtersButton = useRef<HTMLButtonElement | null>(null)
  const ids = { label: useId(), desc: useId(), panel: useId(), tab: useId() }

  const ladder = useClubLadder()
  const { data, isLoading, clubShots } = useShotPatterns({
    club,
    lieType: lieType || undefined,
    lieSlopeForward,
    lieSlopeSide,
  })
  // Typical distance per club from the player's own shots (the live wheel's
  // rule: five or more aimed shots). No typed estimate: no data, no number.
  const typicalYards = (c: Club) => {
    const d = ladder.data?.get(c)
    return clubTypicalDistance(d?.medianYards, d?.aimed ?? 0, null)?.yards ?? null
  }
  const ladderNumber = (c: Club) => {
    const y = typicalYards(c)
    return y == null ? null : Math.round(unit === 'meters' ? y * YARDS_TO_METERS : y)
  }

  const filteredPoints = useMemo(() => data?.points ?? [], [data])
  const extras = data?.extras ?? {}
  const filtered = !!(lieType || lieSlopeForward || lieSlopeSide)
  // The latest twenty against all of them, once there are more than twenty.
  const rva = useMemo(() => recentVsAll(filteredPoints, RECENT), [filteredPoints])
  const recentOn = scope === 'recent' && !!rva
  const { points, older } = useMemo(() => {
    if (!recentOn) return { points: filteredPoints, older: [] as DispersionPoint[] }
    const sorted = [...filteredPoints].sort(newestFirst)
    return { points: sorted.slice(0, RECENT), older: sorted.slice(RECENT) }
  }, [recentOn, filteredPoints])
  const stats: DispersionStats | null = recentOn ? rva!.recent : data?.stats ?? null
  const ghost: Ghost | null = recentOn
    ? { stats: rva!.all, label: `all ${filteredPoints.length}` }
    : filtered && data?.allStats
      ? { stats: data.allStats, label: 'all lies' }
      : null
  const kinds = useMemo(() => new Map(teeGeometry(points, leftHanded).shots.map((s) => [s.p.id, s.kind])), [points, leftHanded])
  const teeShots = mostlyTeeShots(points)

  const slopes = [lieSlopeForward, lieSlopeSide].filter(Boolean).map((v) => v!.replace(/_/g, ' '))
  const filterSummary = [lieType ? cap(lieType) : '', ...slopes].filter(Boolean).join(' · ')
  // "from the rough, uphill": the filters in a sentence.
  const filterPhrase = [lieType ? `from ${LIE_PHRASE[lieType]}` : '', ...slopes].filter(Boolean).join(', ')
  const clearFilters = () => {
    setLieType('')
    setLieSlopeForward(undefined)
    setLieSlopeSide(undefined)
  }

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
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      }
      const node = shareCardRef.current
      if (!node) throw new Error('share card not ready')
      const blob = await toBlob(node, { width: SHARE_CARD_W, height: SHARE_CARD_H, cacheBust: true, backgroundColor: '#FBF8F1' })
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
  const hasAimed = ladder.data ? [...ladder.data.values()].some((c) => c.aimed > 0) : undefined
  if (ladder.isLoading || hasAimed === false) {
    return (
      <div>
        <PageHeader />
        <p className="text-caddie-ink-dim" style={{ fontSize: 15, marginTop: -12, marginBottom: 22, maxWidth: 560 }}>
          {ladder.isLoading ? 'Loading…' : 'No shots with an aim yet. Here’s what one club’s pattern looks like once you have some.'}
        </p>
        {!ladder.isLoading && <PatternsEmpty />}
      </div>
    )
  }

  const noun = clubNoun(club)
  const emptyNote = clubShots === 0 ? `No aimed ${noun} shots yet` : filtered ? `No ${noun} shots ${filterPhrase}` : undefined

  // The legend: each group of shots under the chosen colour, with its count.
  const cats = categoriesFor(colourBy, leftHanded)
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
  const recorded = points.length - (counts.get(NOT_RECORDED) ?? 0)
  const byWord = colourBy === 'start' ? 'start line' : colourBy
  const legendNote =
    colourBy === 'none'
      ? ''
      : recorded === 0
        ? `No ${noun} shot here has its ${byWord} recorded yet. Set it in a shot’s result after the hole.`
        : `${cap(byWord)} recorded on ${recorded} of ${points.length}.`

  // Same layers in the same order on both views; flights only from the tee.
  // Rings and the average stay in the bar without a pattern, switched off.
  const available: Layer[] = view === 'aim' ? ['shots', 'rings', 'average'] : ['shots', 'rings', 'average', 'flights']
  const disabled = new Set<Layer>(stats ? [] : ghost ? ['average'] : ['rings', 'average'])
  const toggleLayer = (l: Layer) => setLayers((v) => ({ ...v, [l]: !v[l] }))
  const toggleGroup = (k: string) =>
    setHidden((h) => {
      const n = new Set(h)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  const shownLayers = { ...layers, rings: layers.rings && !disabled.has('rings'), average: layers.average && !disabled.has('average') }
  const chartProps: ChartProps = {
    points,
    older,
    stats,
    ghost,
    unit,
    extras,
    kinds,
    layers: shownLayers,
    colourBy,
    colours,
    hidden,
    focus,
    leftHanded,
    club,
    labelId: ids.label,
    descId: ids.desc,
    empty: emptyNote,
    onOpenShot: (id) => {
      const round = extras[id]?.roundId
      if (round) navigate(`/rounds/${round}`)
    },
  }

  const hiddenWords = [
    ...available.filter((l) => !shownLayers[l] && !disabled.has(l)).map((l) => LAYER_INFO[l].hides),
    ...legend.filter((e) => hidden.has(e.key)).map((e) => (e.key === NOT_RECORDED ? `${e.count} not recorded` : countWord(e.key, e.label, e.count))),
  ]
  const conflicts = points.filter((p) => kinds.get(p.id) === 'conflict').length
  const caption = chartCaption({ view, stats, ghost, recentOn, colourBy, shownLayers, points, older, unit, narrow, noun, conflicts, hiddenWords, legendHidden: hidden.size > 0 })
  const finding = stats ? findingLine(stats, points, club, unit, teeShots) : null
  const summary = chartSummary({ stats, points, unit, legend, colourBy, hiddenWords })

  const lieChips = (
    <div role="group" aria-label="Lie" className="flex flex-wrap" style={{ gap: 6 }}>
      {(['', ...LIE_TYPES] as const).map((v) => (
        <button key={v || 'any'} type="button" aria-pressed={lieType === v} onClick={() => setLieType(v)} className={`pat-tap ${FOCUS_RING}`} style={chipStyle(lieType === v)}>
          {v === '' ? 'Any' : cap(v.replace(/_/g, ' '))}
        </button>
      ))}
    </div>
  )
  const anySlope = !lieSlopeForward && !lieSlopeSide
  const slopeGrid = (
    <div className="grid" style={{ gap: 8 }}>
      <button
        type="button"
        aria-pressed={anySlope}
        onClick={() => {
          setLieSlopeForward(undefined)
          setLieSlopeSide(undefined)
        }}
        className={`pat-tap ${FOCUS_RING}`}
        style={{ ...chipStyle(anySlope), justifySelf: 'start' }}
      >
        Any slope
      </button>
      <LieSlopeGrid forward={lieSlopeForward} side={lieSlopeSide} onChangeForward={setLieSlopeForward} onChangeSide={setLieSlopeSide} toggleable />
    </div>
  )
  const scopeControl = rva ? <ScopeControl value={scope} onChange={setScope} total={filteredPoints.length} /> : null
  const recentLine = rva ? recentWords(rva.recent, rva.all, filteredPoints.length, unit) : null

  return (
    <div>
      <PageHeader />
      {finding && (
        <p className="font-serif text-caddie-ink" style={{ fontSize: 24, fontStyle: 'italic', fontWeight: 500, lineHeight: 1.3, margin: '-10px 0 6px', maxWidth: 780, textWrap: 'balance' } as React.CSSProperties}>
          {finding}
        </p>
      )}
      <p className="text-caddie-ink-dim" style={{ fontSize: 15, maxWidth: 640, margin: finding ? 0 : '-10px 0 0' }}>
        {clubShots > 0 && points.length > 0
          ? `${points.length} shot${points.length === 1 ? '' : 's'} with your ${noun}${filterPhrase ? ` ${filterPhrase}` : ''}, measured from the aim you set: ${readQuality(points.length)}.`
          : 'Where each club finishes, measured from the aim you set before the shot.'}
        {recentLine && ` ${recentLine}`}
      </p>

      <div style={{ marginTop: 18 }}>
        <ClubLadder clubs={clubOptions} value={club} onChange={setClub} typical={ladderNumber} aimed={(c) => ladder.data?.get(c)?.aimed ?? 0} unit={unit} />
      </div>

      {/* Tabs left; desktop: which shots, lie and slope right; phone: one Filters button. */}
      <div className="flex items-end flex-wrap" style={{ gap: 18, marginTop: 16, borderBottom: '1px solid #D9D2BF' }}>
        <ViewTabs value={view} onChange={setView} tabId={ids.tab} panelId={ids.panel} />
        <div className="flex-1" />
        <div className="hidden lg:flex items-center" style={{ gap: 12, paddingBottom: 6, flexWrap: 'wrap' }}>
          <span className="text-caddie-ink-dim" style={{ fontSize: 13 }} aria-hidden>Lie</span>
          {lieChips}
          <SlopePopover summary={slopes.map(cap).join(', ') || 'Any'}>{slopeGrid}</SlopePopover>
        </div>
        <div className="lg:hidden flex items-center" style={{ gap: 8, paddingBottom: 6, minWidth: 0 }}>
          {filterSummary && <span className="text-caddie-ink-dim" style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{filterSummary}</span>}
          <button
            ref={filtersButton}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            onClick={() => setSheetOpen(true)}
            className={`pat-tap ${FOCUS_RING}`}
            style={{ ...chipStyle(filtered || recentOn), padding: '8px 12px', fontSize: 13, flex: 'none' }}
          >
            Filters
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:[grid-template-columns:minmax(0,2fr)_minmax(0,1fr)]" style={{ gap: 28, marginTop: 14 }}>
        <div style={{ maxWidth: 600, minWidth: 0 }}>
          <div role="tabpanel" id={ids.panel} aria-labelledby={`${ids.tab}-${view}`} className="bg-caddie-surface" style={{ border: '1px solid #D9D2BF', borderRadius: 4 }}>
            <div className="flex flex-wrap items-center justify-between" style={{ gap: 10, padding: '10px 10px 8px', borderBottom: '1px solid #ECE6D8' }}>
              <LayerBar layers={layers} available={available} disabled={disabled} onToggle={toggleLayer} compact={narrow} />
              {points.length > 0 && <ColourByControl value={colourBy} onChange={setColourBy} compact={narrow} />}
              {scopeControl && <div className="hidden lg:block">{scopeControl}</div>}
            </div>
            <div style={{ padding: '12px 12px 6px' }}>
              <span id={ids.label} className="sr-only">{`${cap(noun)} shots, ${VIEWS.find((v) => v.value === view)!.label.toLowerCase()}`}</span>
              <p id={ids.desc} className="sr-only">{summary}</p>
              {isLoading ? (
                <div className="flex items-center justify-center text-caddie-ink-dim" style={{ aspectRatio: '1 / 1', fontSize: 13 }}>Loading…</div>
              ) : view === 'aim' ? (
                <AimPlot {...chartProps} />
              ) : (
                <TeePlot {...chartProps} />
              )}
            </div>
            {legend.length > 0 && (
              <div style={{ padding: '10px 12px 12px', borderTop: '1px solid #ECE6D8' }}>
                <Legend entries={legend} hidden={hidden} focus={focus} onToggle={toggleGroup} onFocus={setFocus} note={legendNote} />
              </div>
            )}
          </div>
          <p className="text-caddie-ink-dim" style={{ fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>{caption}</p>
          {points.length > 0 && (
            <button
              type="button"
              aria-expanded={showTable}
              onClick={() => setShowTable((s) => !s)}
              className={`text-caddie-ink ${FOCUS_RING}`}
              style={{ background: 'none', border: 'none', padding: '4px 0', fontSize: 13, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }}
            >
              {showTable ? 'Hide the table' : 'Show the shots as a table'}
            </button>
          )}
          {showTable && <ShotTable points={points} extras={extras} unit={unit} kinds={kinds} caption={`Your ${points.length} ${noun} shots, newest first`} />}
          <div role="status" aria-live="polite" className="sr-only">
            {isLoading ? '' : `Showing ${points.length} ${noun} shot${points.length === 1 ? '' : 's'}${filterPhrase ? ` ${filterPhrase}` : ''}.${hiddenWords.length ? ` Hidden: ${hiddenWords.join('; ')}.` : ''}`}
          </div>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          {stats ? (
            <PatternNumbers
              stats={stats}
              points={points}
              typicalYards={typicalYards(club)}
              unit={unit}
              shotsNote={recentOn ? `Your latest ${points.length} of ${filteredPoints.length}` : filtered ? `With an aim, ${filterPhrase}` : 'With an aim, from any lie'}
              filtered={filtered}
              teeShots={teeShots}
              leftHanded={leftHanded}
              onColour={setColourBy}
            />
          ) : !isLoading && clubShots < MIN_SAMPLES_FOR_STATS ? (
            <PatternProgress club={club} shots={clubShots} />
          ) : !isLoading ? (
            <p className="font-serif text-caddie-ink" style={{ fontSize: 17, lineHeight: 1.55 }}>
              {points.length === 0 ? 'None' : `Only ${points.length}`} of your {clubShots} shots with the {noun} {points.length === 1 ? 'was' : 'were'} {filterPhrase}.{' '}
              {fewShotsCompare(points, data?.allStats ?? null, filterPhrase)}A pattern needs five.{' '}
              <button type="button" onClick={clearFilters} className={`text-caddie-ink ${FOCUS_RING}`} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }}>
                See every lie
              </button>
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
                className={`text-caddie-ink hover:bg-caddie-surface-2 disabled:opacity-40 pat-tap ${FOCUS_RING}`}
                style={{ background: 'transparent', border: '1px solid #9F9580', borderRadius: 2, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}
              >
                {exporting ? 'Rendering…' : 'Export image'}
              </button>
              {exportError && <span className="text-caddie-neg" style={{ fontSize: 13 }}>{exportError}</span>}
            </div>
          )}
        </div>
      </div>

      {!isLoading && clubShots < MIN_SAMPLES_FOR_STATS && <PatternExplainer />}

      {sheetOpen && (
        <FilterSheet
          onClose={() => {
            setSheetOpen(false)
            requestAnimationFrame(() => filtersButton.current?.focus())
          }}
          done={
            points.length >= MIN_SAMPLES_FOR_STATS || !filtered
              ? `Show ${points.length} shot${points.length === 1 ? '' : 's'}`
              : points.length === 0
                ? `No shots ${filterPhrase}`
                : `Only ${points.length} ${filterPhrase}`
          }
        >
          {scopeControl && (
            <>
              <div className="text-caddie-ink-dim" style={{ fontSize: 13, marginBottom: 4 }}>Shots</div>
              <div style={{ marginBottom: 14 }}>{scopeControl}</div>
            </>
          )}
          <div className="text-caddie-ink-dim" style={{ fontSize: 13, marginBottom: 8 }}>Lie</div>
          {lieChips}
          <div className="text-caddie-ink-dim" style={{ fontSize: 13, margin: '18px 0 8px' }}>Slope</div>
          {slopeGrid}
        </FilterSheet>
      )}

      {/* Off-screen render target for the 1200×630 share card. */}
      {showShareCard && stats && (
        <div aria-hidden style={{ position: 'fixed', left: -99999, top: 0, pointerEvents: 'none' }}>
          <div ref={shareCardRef}>
            <ShotPatternsShareCard
              points={points}
              stats={stats}
              club={club}
              finding={finding!}
              shape={tallyWords(shapeTally(points, leftHanded), SHOT_SHAPE_LABELS, points.length).value}
              toDisplay={toDisplay}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// "Your latest 20: two in three inside 24 yd wide, down from 31 over all 98."
function recentWords(recent: DispersionStats, all: DispersionStats, total: number, unit: 'yards' | 'meters') {
  const now = recent.cone68.lateral * 2
  const was = all.cone68.lateral * 2
  const change = Math.abs(now - was) < 1 ? 'about the same as' : now < was ? 'down from' : 'up from'
  return `Your latest ${RECENT}: two in three inside ${dist(now, unit)} wide, ${change} ${dist(was, unit).replace(/ (yd|m)$/, '')} over all ${total}.`
}

// "All 3 finished short of your usual average." With a filter under five shots.
function fewShotsCompare(points: DispersionPoint[], all: DispersionStats | null, phrase: string) {
  if (!all || points.length < 2) return ''
  const n = points.length
  const short = points.every((p) => p.distanceOffsetYards < all.avgDistanceOffset)
  const long = points.every((p) => p.distanceOffsetYards > all.avgDistanceOffset)
  const left = points.every((p) => p.lateralOffsetYards < all.avgLateralOffset)
  const right = points.every((p) => p.lateralOffsetYards > all.avgLateralOffset)
  const way = short ? 'short of' : long ? 'past' : left ? 'left of' : right ? 'right of' : null
  return way ? `${n === 2 ? 'Both' : `All ${n}`} ${phrase} finished ${way} your usual average. ` : ''
}

// What the chart is showing right now, and what the toggles have hidden.
function chartCaption(a: {
  view: View
  stats: DispersionStats | null
  ghost: Ghost | null
  recentOn: boolean
  colourBy: ColourBy
  shownLayers: Record<Layer, boolean>
  points: DispersionPoint[]
  older: DispersionPoint[]
  unit: 'yards' | 'meters'
  narrow: boolean
  noun: string
  conflicts: number
  hiddenWords: string[]
  legendHidden: boolean
}) {
  const by = COLOUR_BY.find((o) => o.value === a.colourBy)!.label.toLowerCase()
  const parts: string[] = []
  if (a.view === 'aim') {
    parts.push(`Each mark is where a shot finished${a.colourBy === 'none' ? '' : `, marked by its ${by}`}.`)
  } else {
    const aim = a.stats?.avgAimDistance
    if (a.narrow) {
      // A phone gets one line; the chart labels the rest.
      parts.push('Lines leave on your recorded start line and bend by your recorded shape. The bottom stretch is shortened.')
      if (a.conflicts) parts.push(`${a.conflicts} shot${a.conflicts === 1 ? ', dashed at the end, doesn’t' : 's, dashed at the end, don’t'} add up.`)
      if (a.hiddenWords.length) parts.push(`Hidden: ${a.hiddenWords.join('; ')}.`)
      return parts.join(' ')
    }
    parts.push('Each line runs from where you hit it to where it finished, leaving on its recorded start line and bending by its recorded shape.')
    parts.push(`The stretch below the break is shortened, which widens the start angles${aim ? `; every finish is drawn as if aimed at ${dist(aim, a.unit)}, your average` : ''}.`)
    if (a.points.length > 40 && a.shownLayers.flights) parts.push('With this many shots each faint line is one shot and the bold line is the typical flight.')
    const neither = a.points.filter((p) => !p.startLine && !p.shape).length
    if (neither) parts.push(`${neither} dashed ${neither === 1 ? 'line has' : 'lines have'} nothing recorded.`)
    if (a.conflicts) parts.push(`${a.conflicts} shot${a.conflicts === 1 ? ' doesn’t' : 's don’t'} add up: the second half is dashed. Select one to see why.`)
  }
  if (a.stats && a.shownLayers.rings) parts.push(`Your next ${a.noun} will probably finish inside the solid ring; nearly all inside the dashed one.`)
  if (a.ghost && a.shownLayers.rings) parts.push(a.recentOn ? `The dotted ring is all of them, and the pencil dots the older shots.` : 'The dotted ring is your pattern from every lie.')
  if (a.view === 'aim') parts.push(squaresWord(a.points, a.older, a.stats, a.ghost, a.unit, a.narrow))
  if (a.hiddenWords.length) {
    parts.push(`Hidden: ${a.hiddenWords.join('; ')}.`)
    if (a.legendHidden && a.stats) parts.push('Hidden shots still count in the rings and the numbers.')
  }
  return parts.join(' ')
}

// The chart in words, for a screen reader (the svg's description).
function chartSummary(a: {
  stats: DispersionStats | null
  points: DispersionPoint[]
  unit: 'yards' | 'meters'
  legend: LegendEntry[]
  colourBy: ColourBy
  hiddenWords: string[]
}) {
  const parts = [`${a.points.length} shot${a.points.length === 1 ? '' : 's'}.`]
  const s = a.stats
  if (s) {
    const along = Math.abs(s.avgDistanceOffset) < 1 ? 'level with the aim' : `${dist(s.avgDistanceOffset, a.unit)} ${s.avgDistanceOffset < 0 ? 'short' : 'long'}`
    const across = Math.abs(s.avgLateralOffset) < 1 ? 'on line' : `${dist(s.avgLateralOffset, a.unit)} ${s.avgLateralOffset > 0 ? 'right' : 'left'}`
    parts.push(`The average finish is ${along} and ${across} of the aim.`)
    parts.push(`Two in three finish inside ${dist(s.cone68.lateral * 2, a.unit)} wide by ${dist(s.cone68.distance * 2, a.unit)} deep; nearly all inside ${dist(s.cone95.lateral * 2, a.unit)} by ${dist(s.cone95.distance * 2, a.unit)}.`)
  }
  if (a.legend.length) parts.push(`Marked by ${a.colourBy === 'start' ? 'start line' : a.colourBy}: ${a.legend.map((e) => `${e.label.toLowerCase()} ${e.count}`).join(', ')}.`)
  if (a.hiddenWords.length) parts.push(`Hidden: ${a.hiddenWords.join('; ')}.`)
  parts.push('Use the arrow keys on a shot to step through them, short to long.')
  return parts.join(' ')
}

function PageHeader() {
  return (
    <h1 className="font-serif text-caddie-ink" style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.15, marginBottom: 18 }}>
      Shot patterns
    </h1>
  )
}

// Two views of one hero chart, set like a printed tab: the active one inked
// and underlined, no fill (the accent stays on the club).
function ViewTabs({ value, onChange, tabId, panelId }: { value: View; onChange: (v: View) => void; tabId: string; panelId: string }) {
  return (
    <div role="tablist" aria-label="Chart" className="flex" style={{ gap: 18 }}>
      {VIEWS.map((v, j) => {
        const on = v.value === value
        return (
          <button
            key={v.value}
            id={`${tabId}-${v.value}`}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={panelId}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(v.value)}
            onKeyDown={(e) => {
              const k = rovingKey(e, j, VIEWS.length)
              if (k != null) onChange(VIEWS[k]!.value)
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
  )
}

// All shots, or the latest twenty against a ghost of all of them.
function ScopeControl({ value, onChange, total }: { value: Scope; onChange: (s: Scope) => void; total: number }) {
  const opts: { value: Scope; label: string }[] = [
    { value: 'all', label: `All ${total}` },
    { value: 'recent', label: `Latest ${RECENT}` },
  ]
  return (
    <div role="radiogroup" aria-label="Which shots" className="flex items-center" style={{ gap: 14, paddingBottom: 0 }}>
      {opts.map((o, j) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const k = rovingKey(e, j, opts.length)
              if (k != null) onChange(opts[k]!.value)
            }}
            className={`pat-tap ${FOCUS_RING}`}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: on ? '2px solid #5C6356' : '2px solid transparent',
              marginBottom: -1,
              padding: '6px 0 8px',
              fontSize: 13,
              fontWeight: on ? 600 : 400,
              color: on ? '#1C211C' : '#5C6356',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function SlopePopover({ summary, children }: { summary: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  const button = useRef<HTMLButtonElement | null>(null)
  const panelId = useId()
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      button.current?.focus()
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', key)
    }
  }, [open])
  return (
    <div
      ref={ref}
      style={{ position: 'relative' }}
      className="flex items-center"
      onBlur={(e) => {
        if (open && !ref.current?.contains(e.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <span className="text-caddie-ink-dim" style={{ fontSize: 13, marginRight: 8 }} aria-hidden>Slope</span>
      <button
        ref={button}
        type="button"
        aria-label={`Slope: ${summary}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={`pat-tap ${FOCUS_RING}`}
        style={{ ...chipStyle(summary !== 'Any'), padding: '6px 10px' }}
      >
        {summary} <span aria-hidden style={{ marginLeft: 4 }}>▾</span>
      </button>
      {open && (
        <div
          id={panelId}
          role="group"
          aria-label="Slope"
          className="bg-caddie-surface"
          style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 20, width: 340, maxWidth: 'calc(100vw - 32px)', border: '1px solid #9F9580', borderRadius: 4, padding: 12 }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

// The phone's filter sheet: a modal dialog (focus moves in and is held there,
// the page behind is inert, Escape closes, focus returns to Filters).
function FilterSheet({ onClose, done, children }: { onClose: () => void; done: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement | null>(null)
  const heading = useRef<HTMLHeadingElement | null>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (!d.open) d.showModal()
    heading.current?.focus()
    return () => d.close()
  }, [])
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="pat-dialog"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      style={{ margin: 0, padding: 0, border: 'none', width: '100vw', height: '100dvh', maxWidth: '100vw', maxHeight: '100dvh', background: 'transparent', overscrollBehavior: 'contain' }}
    >
      <div className="pat-scrim" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(28,33,28,0.48)' }} />
      <div
        className="bg-caddie-surface pat-sheet"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '88dvh', overflowY: 'auto', borderTop: '1px solid #9F9580', borderRadius: '4px 4px 0 0', padding: '12px 16px calc(18px + env(safe-area-inset-bottom))' }}
      >
        <div aria-hidden style={{ width: 32, height: 4, background: '#D9D2BF', margin: '0 auto 12px' }} />
        <h2 ref={heading} id={titleId} tabIndex={-1} className="font-serif text-caddie-ink" style={{ fontSize: 22, fontStyle: 'italic', fontWeight: 500, marginBottom: 14, outline: 'none' }}>
          Filters
        </h2>
        {children}
        <button
          type="button"
          onClick={onClose}
          className={`bg-caddie-accent text-caddie-accent-ink ${FOCUS_RING}`}
          style={{ width: '100%', marginTop: 18, padding: '13px 16px', borderRadius: 2, border: 'none', fontSize: 14, fontWeight: 600 }}
        >
          {done}
        </button>
      </div>
    </dialog>
  )
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    // Ink, not the accent, for the chosen chip: the accent stays on the club.
    backgroundColor: active ? '#1C211C' : '#EBE5D6',
    color: active ? '#F2EEE5' : '#1C211C',
    border: 'none',
    borderRadius: 2,
    padding: '6px 10px',
    minHeight: 30,
    fontSize: 13,
    fontWeight: active ? 500 : 400,
    cursor: 'pointer',
  }
}

