import { useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, Alert, ScrollView, Text, useWindowDimensions, View } from 'react-native'
import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  CLUBS,
  DEFAULT_BAG,
  SHOT_SHAPE_LABELS,
  YARDS_TO_METERS,
  clubNoun,
  clubTypicalDistance,
  computeDispersion,
  computeDispersionStats,
  MIN_SAMPLES_FOR_STATS,
  NOT_RECORDED,
  averageAimDistance,
  capFirst as cap,
  categoryOf,
  countWord,
  distanceText as dist,
  filterDispersionByLie,
  filtersDoneWords,
  findingLine,
  latestLine,
  puttMissHeadline,
  puttMissTally,
  mostlyTeeShots,
  practiceCategory,
  patternRowToShot,
  LIE_PHRASE,
  readQuality,
  recentPoints,
  recentVsAll,
  recordedNote,
  shapeTally,
  shotWords,
  tallyWords,
  teeBreakFor,
  wholeDistance as numIn,
  type Club,
  type ColourBy,
  type DispersionPoint,
  type LieSlope,
  type LieSlopeForward,
  type LieSlopeSide,
  type LieType,
  type ShotContact,
  type ShotExtras,
  type ShotShape,
  type ShotStartLine,
} from '@oga/core'
import { getMissedPutts, getShotsByClub } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useUnits } from '../../hooks/useUnits'
import { useUserBag } from '../../hooks/useUserBag'
import { AppBar } from '../../components/ui/AppBar'
import { Entrance } from '../../components/ui/Entrance'
import { PressableTouch } from '../../components/ui/PressableTouch'
import { TYPE } from '../../lib/typography'
import { Key, KeyText, PaperSurface } from '../../components/paper/Paper'
import { FONT_CAP, P } from '../../components/paper/tokens'
import { useClubDispersion } from '../../components/round/hole/useClubDispersion'
import { PatternsEmpty, PatternsProgress } from '../../components/patterns/PatternsPreview'
import { ClubLadder, ViewToggle, type ChartView } from '../../components/patterns/YardageBook'
import { AimPlot } from '../../components/patterns/AimPlot'
import { TeePlot } from '../../components/patterns/TeePlot'
import { flightOf, type ChartProps } from '../../components/patterns/chartParts'
import { ColourControl, LAYER_INFO, LayerBar, LegendBand, ScopeControl, type LegendEntry, type Scope } from '../../components/patterns/LayerControls'
import { FilterSheet } from '../../components/patterns/FilterSheet'
import { PatternNumbers } from '../../components/patterns/PatternNumbers'
import { PuttPatterns, type MissedPutt, type PuttView } from '../../components/patterns/PuttPatterns'
import { ShareCard } from '../../components/patterns/ShareCard'
import { COLOUR_BY, DEFAULT_LAYERS, UNRECORDED_INK, styledCategories, type Layer } from '../../components/patterns/layers'
import { useUnitsContext } from '../../contexts/UnitsContext'

interface ShotRow {
  id: string
  hole_score_id: string
  user_id: string
  shot_number: number
  aim_lat: number | null
  aim_lng: number | null
  end_lat: number | null
  end_lng: number | null
  start_lat: number | null
  start_lng: number | null
  distance_to_target: number | null
  club: string | null
  lie_type: LieType | null
  lie_slope: LieSlope | null
  lie_slope_forward: LieSlopeForward | null
  lie_slope_side: LieSlopeSide | null
  shot_result: string | null
  contact: ShotContact | null
  shape: ShotShape | null
  start_line: ShotStartLine | null
  penalty: boolean
  ob: boolean
  hole_scores: {
    round_id: string
    rounds: { played_at: string; courses: { name: string } | null } | null
    holes: { number: number } | null
  } | null
}

const RECENT = 20
const NO_ROWS: ShotRow[] = []

export default function Patterns() {
  const { user } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width: screenWidth } = useWindowDimensions()
  const { unit } = useUnits()
  const { playsLeftHanded: leftHanded } = useUnitsContext()
  const [club, setClub] = useState<Club>('7i')
  // The player's bag (DEFAULT_BAG while it loads or if empty), in catalog
  // order. The putter's stop is added at the end of the ladder for missed
  // putts (#747); it has no shot pattern.
  const { bag } = useUserBag()
  const clubOptions = useMemo(() => {
    const have = new Set<string>((bag.length ? bag : DEFAULT_BAG).map((c) => c.club_type))
    return CLUBS.filter((c) => c !== 'putter' && have.has(c))
  }, [bag])
  // The default 7i may not be in the bag: fall back to its first club.
  useEffect(() => {
    if (club !== 'putter' && clubOptions.length && !clubOptions.includes(club)) setClub(clubOptions[0]!)
  }, [clubOptions, club])
  // Per-club shot counts with start + aim + finish, the wheel's count (#1076).
  const { byClub, loading: countsLoading, error: countsError } = useClubDispersion(user?.id)
  const aimed = (c: Club) => byClub.get(c)?.points.length ?? 0
  const anyAimed = clubOptions.some((c) => aimed(c) > 0)
  // Open on the club with the most aimed shots when the 7i has none, so a
  // player with 4 drivers doesn't land on "0 of 5" for an iron. Once only.
  const pickedStart = useRef(false)
  useEffect(() => {
    if (countsLoading || pickedStart.current) return
    pickedStart.current = true
    if (aimed(club) > 0) return
    const best = clubOptions.reduce<Club | null>((b, c) => (aimed(c) > (b ? aimed(b) : 0) ? c : b), null)
    if (best) setClub(best)
  }, [countsLoading])
  // Typical distance from the player's own shots only (five or more aimed,
  // the wheel's rule); no typed estimate, so no data means no number.
  const typicalYards = (c: Club) => clubTypicalDistance(byClub.get(c)?.medianDistanceYards, aimed(c), null)?.yards ?? null
  const metres = unit === 'meters'
  const unitYd = metres ? 1 / YARDS_TO_METERS : 1
  const num = (yd: number) => String(numIn(yd, unit))
  const mag = (yd: number) => dist(yd, unit)
  const unitWord = metres ? 'm' : 'yd'
  const ladderNumber = (c: Club) => {
    const y = typicalYards(c)
    return y == null ? null : numIn(y, unit)
  }

  const [lieType, setLieType] = useState<LieType | null>(null)
  const [forward, setForward] = useState<LieSlopeForward | null>(null)
  const [side, setSide] = useState<LieSlopeSide | null>(null)
  const [view, setView] = useState<ChartView>('aim')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [layers, setLayers] = useState<Record<Layer, boolean>>(DEFAULT_LAYERS)
  const [colourBy, setColourBy] = useState<ColourBy>('none')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [focus, setFocus] = useState<string | null>(null)
  const [hot, setHot] = useState<string | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [scope, setScope] = useState<Scope>('all')
  useEffect(() => {
    setHidden(new Set())
    setFocus(null)
  }, [colourBy, club])
  useEffect(() => setHot(null), [club, view, lieType, forward, side])
  // Rows are kept with the club they belong to, so a new club never shows the
  // last one's shots, finding or share card while it loads.
  const [loaded, setLoaded] = useState<{ club: Club; rows: ShotRow[]; error: boolean } | null>(null)
  const [attempt, setAttempt] = useState(0)

  // Missed putts for the Putter stop, fetched once.
  const [putts, setPutts] = useState<{ rows: MissedPutt[]; error: boolean } | null>(null)
  const [puttView, setPuttView] = useState<PuttView>('length')
  useEffect(() => {
    if (!user) return
    let active = true
    getMissedPutts(supabase, user.id).then(({ data, error }) => {
      if (!active) return
      if (error) {
        // eslint-disable-next-line no-console -- dev diagnostic; the screen shows the error
        console.error('[patterns/getMissedPutts]', error.message)
      }
      const rows = (data ?? []).map((r) => {
        const hs = r.hole_scores as unknown as { round_id: string; rounds: { played_at: string; courses: { name: string } | null } | null; holes: { number: number } | null } | null
        return {
          id: r.id,
          puttDistanceResult: (r.putt_distance_result as MissedPutt['puttDistanceResult'] | null) ?? undefined,
          puttDirectionResult: (r.putt_direction_result as MissedPutt['puttDirectionResult'] | null) ?? undefined,
          puttDistanceFt: r.putt_distance_ft ?? undefined,
          playedAt: hs?.rounds?.played_at ?? null,
          course: hs?.rounds?.courses?.name ?? null,
          hole: hs?.holes?.number ?? null,
          roundId: hs?.round_id ?? null,
        }
      })
      setPutts({ rows, error: !!error })
    })
    return () => {
      active = false
    }
  }, [user?.id])
  const puttTally = useMemo(() => puttMissTally(putts?.rows ?? []), [putts])

  useEffect(() => {
    if (!user || club === 'putter') return
    let active = true
    getShotsByClub(supabase, user.id, club).then(({ data, error }) => {
      if (!active) return
      if (error) {
        // eslint-disable-next-line no-console -- dev diagnostic; the screen shows the error below
        console.error('[patterns/getShotsByClub]', error.message)
      }
      setLoaded({ club, rows: (data as unknown as ShotRow[] | null) ?? [], error: !!error })
    })
    return () => {
      active = false
    }
  }, [user?.id, club, attempt])
  const current = loaded?.club === club ? loaded : null
  const shots = current?.rows ?? NO_ROWS
  const loading = !current
  const loadError = current?.error ?? false
  const retry = () => {
    setLoaded(null)
    setAttempt((a) => a + 1)
  }

  const allPoints = useMemo(() => computeDispersion(shots.map(patternRowToShot)), [shots])
  const points = useMemo(
    () => filterDispersionByLie(allPoints, { lieType: lieType ?? undefined, lieSlopeForward: forward ?? undefined, lieSlopeSide: side ?? undefined }),
    [allPoints, lieType, forward, side],
  )
  const stats = useMemo(() => computeDispersionStats(points), [points])
  const allStats = useMemo(() => computeDispersionStats(allPoints), [allPoints])
  const rva = useMemo(() => recentVsAll(points, RECENT), [points])
  const extras = useMemo(() => {
    const m: Record<string, ShotExtras> = {}
    for (const r of shots) {
      m[r.id] = {
        contact: r.contact ?? null,
        hole: r.hole_scores?.holes?.number ?? null,
        roundId: r.hole_scores?.round_id ?? null,
        course: r.hole_scores?.rounds?.courses?.name ?? null,
      }
    }
    return m
  }, [shots])

  const shareCardRef = useRef<View>(null)
  const [sharing, setSharing] = useState(false)

  // Capture the off-screen 1200×630 share card and hand it to the native
  // share sheet via expo-sharing — same path as the scorecard share.
  async function handleShare() {
    if (sharing || !shareCardRef.current) return
    setSharing(true)
    try {
      const uri = await captureRef(shareCardRef, { format: 'png', quality: 1, result: 'tmpfile' })
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing unavailable', 'This device cannot share files.')
        return
      }
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share shot pattern' })
    } catch (err) {
      // eslint-disable-next-line no-console -- dev diagnostic; the user sees the Alert below
      console.error('[patterns/share]', err)
      Alert.alert('Share failed', (err as Error).message)
    } finally {
      setSharing(false)
    }
  }

  const ladderClubs = [...clubOptions, 'putter'] as Club[]
  const ladderRow = (
    <ClubLadder
      clubs={ladderClubs}
      value={club}
      onChange={setClub}
      typical={ladderNumber}
      aimed={aimed}
      unit={unit}
      width={screenWidth - 36}
      missedPutts={putts && !putts.error ? puttTally.misses : null}
    />
  )

  if (club === 'putter' && !countsLoading && !countsError && anyAimed) {
    const headline = puttMissHeadline(puttTally, puttView)
    const rounds = new Set((putts?.rows ?? []).map((p) => p.roundId)).size
    const m = puttTally.misses
    return (
      <PaperSurface style={{ flex: 1 }}>
        <AppBar title="Shot patterns" />
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
          {headline && (
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { fontSize: 20, lineHeight: 26, color: P.ink }]}>
              {headline}
            </Text>
          )}
          <Text accessibilityLiveRegion="polite" maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: putts?.error ? P.neg : P.inkDim, fontSize: 13, lineHeight: 19, marginTop: 4 }]}>
            {!putts
              ? 'Loading…'
              : putts.error
                ? "Couldn't load your putts. Go back and try again."
                : m > 0
                  ? `${m} missed putt${m === 1 ? '' : 's'}, last ${rounds} round${rounds === 1 ? '' : 's'}. Holed putts aren't counted.`
                  : 'Where your missed putts finish: short or long, left or right.'}
          </Text>
          <View style={{ marginTop: 12 }}>{ladderRow}</View>
          {putts && !putts.error && <PuttPatterns putts={putts.rows} tally={puttTally} view={puttView} onView={setPuttView} width={screenWidth - 36} />}
        </ScrollView>
      </PaperSurface>
    )
  }

  // No aimed shot anywhere → the example (B); this club under 5 → its
  // progress (P). Lie filters don't count: a filter can't unmake a pattern.
  if (countsLoading || countsError || !anyAimed || aimed(club) < MIN_SAMPLES_FOR_STATS) {
    return (
      <PaperSurface style={{ flex: 1 }}>
        <AppBar title="Shot patterns" />
        {countsLoading ? (
          <Text style={[TYPE.body, { color: P.inkDim, fontSize: 13, padding: 18 }]}>Loading…</Text>
        ) : countsError ? (
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.neg, fontSize: 13, padding: 18 }]}>
            Couldn't load your shots — go back and try again.
          </Text>
        ) : !anyAimed ? (
          <PatternsEmpty />
        ) : (
          <PatternsProgress
            club={club}
            points={byClub.get(club)?.points ?? []}
            bag={clubOptions.map((c) => ({
              club: c,
              label: c === 'driver' ? 'dr' : c,
              shots: aimed(c),
              typicalYards: byClub.get(c)?.medianDistanceYards ?? null,
            }))}
            onPickClub={setClub}
          />
        )}
      </PaperSurface>
    )
  }

  const noun = clubNoun(club)
  const pad = 18
  const chartWidth = screenWidth - pad * 2 - 2 - 16
  const n = points.length

  const slopes = [forward, side].filter((v): v is LieSlopeForward | LieSlopeSide => v != null).map((v) => v.replace(/_/g, ' '))
  const filterCount = (lieType ? 1 : 0) + slopes.length
  const filtered = filterCount > 0
  const filterPhrase = [lieType ? `from ${LIE_PHRASE[lieType]}` : '', ...slopes].filter(Boolean).join(', ')
  const clearFilters = () => {
    setLieType(null)
    setForward(null)
    setSide(null)
  }

  // Latest: the rings, the finding and the numbers all describe the newest
  // 20; the chart keeps the older shots in pencil under a ghost of all of them.
  const recentOn = scope === 'recent' && rva != null
  const newest = recentPoints(points, RECENT)
  const shown = recentOn ? newest.recent : points
  const shownStats = recentOn ? rva.recent : stats
  const shownN = shown.length
  const tee = mostlyTeeShots(shown)
  const ghost = recentOn ? { stats: rva.all, label: `all ${n}` } : filtered && allStats ? { stats: allStats, label: 'all lies' } : null
  const recentIds = recentOn ? new Set(newest.recent.map((p) => p.id)) : null

  const finding = shownStats && !loading ? findingLine(shownStats, shown, club, unit, tee) : null
  // One line, so the chart starts higher: the club is in the finding and the ladder.
  const subline = `${shownN} shot${shownN === 1 ? '' : 's'}${filterPhrase ? ` ${filterPhrase}` : ''}, measured from your aim${shownStats ? `: ${readQuality(shownN)}` : ''}.`
  const recentLine = rva ? latestLine(rva, RECENT, n, unit) : null

  // The legend: each group of shots under the chosen colour, with its count
  // (under Latest, the latest only: the older ones are in pencil).
  const cats = styledCategories(colourBy, leftHanded)
  const catMap = new Map(cats.map((c) => [c.key, c]))
  const counts = new Map<string, number>()
  for (const p of shown) {
    const k = categoryOf(p, extras[p.id], colourBy)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const legend: LegendEntry[] =
    colourBy === 'none'
      ? []
      : [
          ...cats.filter((c) => counts.has(c.key)).map((c) => ({ ...c, count: counts.get(c.key)! })),
          ...(counts.has(NOT_RECORDED) ? [{ key: NOT_RECORDED, label: 'Not recorded', color: UNRECORDED_INK, glyph: 'unrecorded' as const, count: counts.get(NOT_RECORDED)! }] : []),
        ]
  const recorded = colourBy === 'none' ? null : recordedNote(colourBy, shown, extras, noun)
  const available: Layer[] = [...(['shots', 'rings', 'average'] as Layer[]), ...(view === 'tee' ? (['flights'] as Layer[]) : [])]
  const disabled = new Set<Layer>(stats ? [] : ['rings', 'average'])
  const toggleGroup = (k: string) =>
    setHidden((h) => {
      const next = new Set(h)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  // As on the web on a touch screen: the first tap brings a group forward, the second hides it.
  const tapGroup = (k: string) => {
    if (!hidden.has(k) && focus !== k) return setFocus(k)
    toggleGroup(k)
    setFocus(null)
  }

  // How each flight's record reads (a conflict is flagged in every readout).
  const avgAim = averageAimDistance(points)
  const kinds = new Map(avgAim != null ? points.map((p) => [p.id, flightOf(p, avgAim, leftHanded).c.kind]) : [])
  const conflicts = [...kinds.values()].filter((k) => k === 'conflict').length
  const neither = [...kinds.values()].filter((k) => k === 'none').length

  const hiddenGroups = legend.filter((e) => hidden.has(e.key)).map((e) => (e.key === NOT_RECORDED ? `${e.count} not recorded` : countWord(e.key, e.label, e.count)))
  const offLayers = available.filter((l) => !layers[l] && !disabled.has(l)).map((l) => LAYER_INFO[l].hides)
  const hiddenText = offLayers.length || hiddenGroups.length ? `Hidden: ${[...offLayers, ...hiddenGroups].join('; ')}.` : ''
  const caption = [
    view === 'aim'
      ? stats && layers.rings
        ? `Your next ${noun} will probably finish inside the pencil ring; the brackets give its width and depth.`
        : ''
      : 'Lines leave on your recorded start line and bend by your recorded shape.',
    view === 'tee' && avgAim != null && teeBreakFor(points, stats, avgAim, unitYd) > 0 ? 'The bottom stretch is shortened, so angles there are widened.' : '',
    view === 'tee' && conflicts > 0 ? `${conflicts} shot${conflicts === 1 ? " doesn't" : "s don't"} add up, so the second half is dashed.` : '',
    view === 'tee' && neither > 0 ? `${neither} dashed straight line${neither === 1 ? ' has' : 's have'} neither recorded.` : '',
    view === 'tee' && n > 40 && layers.flights ? 'The bold line is the typical flight.' : '',
    recentOn ? `The rings are your latest ${RECENT} shots; the grey dotted ring is all ${n}, and older shots are in pencil.` : filtered && ghost ? 'The grey dotted ring is two in three from every lie.' : '',
    'Tap a shot to read it.',
    hiddenText,
    hiddenGroups.length && stats ? 'Hidden shots still count in the rings and the numbers.' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const summary = [
    `${cap(noun)} shot pattern, ${view === 'aim' ? 'around the aim' : 'from the tee'}: ${n} shots${recentOn ? `, rings and numbers on the latest ${shownN}` : ''}.`,
    finding ?? '',
    shownStats ? `Two in three finish inside ${mag(shownStats.cone68.lateral * 2)} wide and ${mag(shownStats.cone68.distance * 2)} deep.` : '',
    legend.length ? `${COLOUR_BY.find((o) => o.value === colourBy)!.label}: ${legend.map((e) => `${e.label} ${e.count}`).join(', ')}.` : '',
    hiddenText,
    'Use List the shots to read each one.',
  ]
    .filter(Boolean)
    .join(' ')

  const pickShot = (id: string | null) => {
    setHot(id)
    const p = id ? points.find((q) => q.id === id) : null
    if (p) AccessibilityInfo.announceForAccessibility(shotWords(p, extras[p.id], unit, kinds.get(p.id)).join('. '))
  }
  const chartProps: ChartProps = {
    points,
    stats: shownStats,
    ghost,
    extras,
    kinds,
    layers,
    colourBy,
    categories: catMap,
    hidden,
    focus,
    recentIds,
    leftHanded,
    width: chartWidth,
    unitYd,
    unit,
    label: num,
    unitWord,
    summary,
    hot,
    onHot: pickShot,
    onOpenRound: (id) => router.push(`/(app)/round/${id}`),
    empty: n === 0 ? `No ${noun} shots ${filterPhrase}` : undefined,
  }

  // With a filter on and too few shots for a pattern, still say how they
  // compare with the usual pattern when every one of them falls one way.
  const compare = (() => {
    if (stats || !allStats || n === 0) return ''
    const where = filterPhrase || 'here'
    const all = (f: (p: DispersionPoint) => boolean) => points.every(f)
    const sides = [
      all((p) => p.distanceOffsetYards < allStats.avgDistanceOffset) ? 'short' : all((p) => p.distanceOffsetYards > allStats.avgDistanceOffset) ? 'long' : '',
      all((p) => p.lateralOffsetYards > allStats.avgLateralOffset) ? 'right' : all((p) => p.lateralOffsetYards < allStats.avgLateralOffset) ? 'left' : '',
    ].filter(Boolean)
    if (!sides.length) return ''
    return ` ${n === 1 ? 'It' : `All ${n}`} ${where} finished ${sides.join(' and ')} of your usual average.`
  })()
  const doneLabel = filtersDoneWords(shownN, filtered, filterPhrase)
  const shapeValue = tallyWords(shapeTally(shown, leftHanded), SHOT_SHAPE_LABELS, shownN).value

  return (
    <PaperSurface style={{ flex: 1 }}>
      <AppBar title="Shot patterns" />
      <ScrollView contentContainerStyle={{ padding: pad, paddingBottom: 40 }}>
        <Entrance index={0}>
          {finding && (
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { fontSize: 20, lineHeight: 26, color: P.ink }]}>
              {finding}
            </Text>
          )}
          {!loading && !loadError && (
            <Text accessibilityLiveRegion="polite" maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 13, lineHeight: 19, marginTop: 4 }]}>
              {subline}
            </Text>
          )}
          {recentLine && (
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 13, lineHeight: 19, marginTop: 4 }]}>
              {recentLine}
            </Text>
          )}
          <View style={{ marginTop: 12 }}>
            {ladderRow}
          </View>
        </Entrance>

        <Entrance index={1}>
          <View style={{ marginTop: 6 }}>
            <ViewToggle
              value={view}
              onChange={setView}
              trailing={
                <Key
                  accessibilityLabel={filtered ? `Filters, ${filterCount} on: ${filterPhrase}` : 'Filters'}
                  latched={filtered}
                  onPress={() => setSheetOpen(true)}
                  faceStyle={{ minHeight: 40, paddingHorizontal: 12 }}
                >
                  <KeyText size={13} bold={filtered}>{filtered ? `Filters · ${filterCount}` : 'Filters'}</KeyText>
                </Key>
              }
            />
            <View style={{ marginTop: 10, backgroundColor: P.raised, borderWidth: 1, borderColor: P.line, borderRadius: 3 }}>
              <View style={{ padding: 8, gap: 8, borderBottomWidth: 1, borderColor: '#ECE6D8' }}>
                <LayerBar layers={layers} available={available} disabled={disabled} onToggle={(l) => setLayers((v) => ({ ...v, [l]: !v[l] }))} />
                {n > 0 && <ColourControl value={colourBy} onChange={setColourBy} />}
                {rva && <ScopeControl value={scope} onChange={setScope} total={n} latest={RECENT} />}
              </View>
              <View style={{ padding: 8 }}>
                {loading ? (
                  <View style={{ height: chartWidth, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={[TYPE.body, { color: P.inkDim, fontSize: 13 }]}>Loading…</Text>
                  </View>
                ) : loadError ? (
                  <View style={{ height: chartWidth, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                    <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.neg, fontSize: 13, textAlign: 'center' }]}>
                      Couldn't load your {noun} shots. Check your connection and try again.
                    </Text>
                    <Key accessibilityLabel="Try again" onPress={retry} faceStyle={{ minHeight: 44, paddingHorizontal: 14 }}>
                      <KeyText size={13}>Try again</KeyText>
                    </Key>
                  </View>
                ) : view === 'aim' ? (
                  <AimPlot {...chartProps} />
                ) : (
                  <TeePlot key={club} {...chartProps} />
                )}
              </View>
              {recorded && legend.length > 0 && <LegendBand entries={legend} hidden={hidden} focus={focus} onTap={tapGroup} note={recorded.note} />}
            </View>
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 13, lineHeight: 19, marginTop: 8 }]}>
              {caption}
            </Text>
            {n > 0 && (
              <Key
                accessibilityLabel={listOpen ? 'Hide the list of shots' : 'List the shots'}
                onPress={() => setListOpen((o) => !o)}
                style={{ alignSelf: 'flex-start', marginTop: 10 }}
                faceStyle={{ minHeight: 44, paddingHorizontal: 14 }}
              >
                <KeyText size={13}>{listOpen ? 'Hide the list' : 'List the shots'}</KeyText>
              </Key>
            )}
            {listOpen &&
              [...newest.recent, ...newest.older].map((p) => {
                  const words = shotWords(p, extras[p.id], unit, kinds.get(p.id))
                  const on = hot === p.id
                  return (
                    <PressableTouch
                      key={p.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={words.join('. ')}
                      accessibilityHint="Marks this shot on the chart"
                      onPress={() => pickShot(on ? null : p.id)}
                      style={{ paddingVertical: 10, borderBottomWidth: 1, borderColor: P.line }}
                    >
                      <Text maxFontSizeMultiplier={FONT_CAP} style={[on ? TYPE.serif : TYPE.serifUpright, { fontSize: 15, color: P.ink }]}>{words[0]}</Text>
                      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 12, lineHeight: 17, color: P.inkDim }]}>{words.slice(1).join(' · ')}</Text>
                    </PressableTouch>
                  )
                })}
          </View>
        </Entrance>

        <Entrance index={2}>
          {shownStats && !loading ? (
            <PatternNumbers
              stats={shownStats}
              points={shown}
              typicalYards={typicalYards(club)}
              unit={unit}
              shotsNote={recentOn ? `Your latest ${shownN} of ${n}` : filtered ? 'With these filters' : 'With an aim, from any lie'}
              filtered={filtered}
              teeShots={tee}
              leftHanded={leftHanded}
              onColour={setColourBy}
              practice={practiceCategory(club, shown)}
              onExport={handleShare}
              sharing={sharing}
            />
          ) : !loading && !loadError ? (
            <View style={{ marginTop: 26 }}>
              <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serifUpright, { color: P.ink, fontSize: 16, lineHeight: 24 }]}>
                {n === 0 ? 'None' : `Only ${n}`} of your {aimed(club)} {noun} shots {n === 1 ? 'was' : 'were'} {filterPhrase}. A pattern needs five.
                {compare}
              </Text>
              <Key accessibilityLabel="See every lie" onPress={clearFilters} style={{ alignSelf: 'flex-start', marginTop: 12 }} faceStyle={{ minHeight: 44, paddingHorizontal: 14 }}>
                <KeyText size={13}>See every lie</KeyText>
              </Key>
            </View>
          ) : null}
        </Entrance>
      </ScrollView>

      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        lieType={lieType}
        onLieType={setLieType}
        forward={forward}
        side={side}
        onForward={setForward}
        onSide={setSide}
        onClear={clearFilters}
        doneLabel={doneLabel}
        bottomInset={insets.bottom}
      />

      {/* Off-screen render target for react-native-view-shot. Laid out
          far off the left edge so it's never visible; collapsable={false}
          keeps RN from optimising out the subtree the rasteriser reads. */}
      {shownStats && finding && !loading && (
        <View pointerEvents="none" collapsable={false} style={{ position: 'absolute', left: -10000, top: 0 }}>
          <View ref={shareCardRef} collapsable={false}>
            <ShareCard points={shown} stats={shownStats} noun={noun} finding={finding} width68={mag(shownStats.cone68.lateral * 2)} shape={shapeValue} />
          </View>
        </View>
      )}
    </PaperSurface>
  )
}
