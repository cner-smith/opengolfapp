import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native'
import Svg, { Circle, Ellipse, Line, Rect, Text as SvgText } from 'react-native-svg'
import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  CLUBS,
  DEFAULT_BAG,
  LIE_TYPES,
  formatSignedPuttDistance,
  YARDS_TO_METERS,
  clubNoun,
  clubTypicalDistance,
  computeDispersion,
  computeDispersionStats,
  dispersionVerdict,
  MIN_SAMPLES_FOR_STATS,
  filterDispersionByLie,
  getAimCorrection,
  legacySlopeToAxes,
  type Club,
  type DispersionPoint,
  type DispersionStats,
  type DistanceUnit,
  type LieSlope,
  type LieSlopeForward,
  type LieSlopeSide,
  type LieType,
  type Shot,
} from '@oga/core'
import { getShotsByClub } from '@oga/supabase'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useUnits } from '../../hooks/useUnits'
import { useUserBag } from '../../hooks/useUserBag'
import { AppBar } from '../../components/ui/AppBar'
import { Entrance } from '../../components/ui/Entrance'
import { FONT, TYPE } from '../../lib/typography'
import { Key, KeyText, PaperSurface, HardShadow } from '../../components/paper/Paper'
import { StatTile } from '../../components/paper/Section'
import { SlopeGrid } from '../../components/paper/Pickers'
import { FONT_CAP, P } from '../../components/paper/tokens'
import { LedgerRow } from '../../components/stats/StatsLedger'
import { useClubDispersion } from '../../components/round/hole/useClubDispersion'
import { PatternsEmpty, PatternsProgress } from '../../components/patterns/PatternsPreview'
import { BallFlightChart, ClubLadder, ViewToggle, YardagePlot, type ChartView } from '../../components/patterns/YardageBook'

interface ShotRowMin {
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
  penalty: boolean
  ob: boolean
}

function rowToShot(r: ShotRowMin): Shot {
  // Most stored shots predate the two-axis slope columns and only carry the
  // legacy single-select `lie_slope`. Fall back to it so the slope filter
  // matches whichever axis those shots recorded — otherwise every selection
  // filters to zero. (A legacy shot only ever recorded one axis, so it can
  // never match a forward AND a side selection at once — that's unrecoverable.)
  const legacy = legacySlopeToAxes(r.lie_slope ?? null)
  return {
    id: r.id,
    holeScoreId: r.hole_score_id,
    userId: r.user_id,
    shotNumber: r.shot_number,
    aimLat: r.aim_lat ?? undefined,
    aimLng: r.aim_lng ?? undefined,
    endLat: r.end_lat ?? undefined,
    endLng: r.end_lng ?? undefined,
    startLat: r.start_lat ?? undefined,
    startLng: r.start_lng ?? undefined,
    distanceToTarget: r.distance_to_target ?? undefined,
    club: (r.club as Shot['club']) ?? undefined,
    lieType: r.lie_type ?? undefined,
    lieSlope: r.lie_slope ?? undefined,
    lieSlopeForward: r.lie_slope_forward ?? legacy.forward,
    lieSlopeSide: r.lie_slope_side ?? legacy.side,
    shotResult: (r.shot_result as Shot['shotResult']) ?? undefined,
    penalty: r.penalty,
    ob: r.ob,
  }
}

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

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)

export default function Patterns() {
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
  const { width: screenWidth } = useWindowDimensions()
  const { unit, toDisplay } = useUnits()
  const [club, setClub] = useState<Club>('7i')
  // Only the player's bag (DEFAULT_BAG while it loads / if empty), in
  // catalog order so the row reads driver → putter.
  const { bag } = useUserBag()
  const clubOptions = useMemo(() => {
    const have = new Set<string>((bag.length ? bag : DEFAULT_BAG).map((c) => c.club_type))
    return CLUBS.filter((c) => have.has(c))
  }, [bag])
  // The default 7i may not be in the bag: fall back to its first club.
  useEffect(() => {
    if (clubOptions.length && !clubOptions.includes(club)) setClub(clubOptions[0]!)
  }, [clubOptions, club])
  // Per-club shot counts with start + aim + finish, the wheel's count (#1076).
  const { byClub, loading: countsLoading } = useClubDispersion(user?.id)
  const aimed = (c: Club) => byClub.get(c)?.points.length ?? 0
  const anyAimed = [...byClub.values()].some((d) => d.points.length > 0)
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
  const typicalYards = (c: Club) =>
    c === 'putter' ? null : clubTypicalDistance(byClub.get(c)?.medianDistanceYards, aimed(c), null)?.yards ?? null
  const ladderNumber = (c: Club) => {
    const y = typicalYards(c)
    return y == null ? null : Math.round(unit === 'meters' ? y * YARDS_TO_METERS : y)
  }
  // Putter patterns read in feet like every other green distance (#923).
  const putter = club === 'putter'
  const dist = (yards: number, decimals = 0) =>
    putter ? formatSignedPuttDistance(yards * 3, unit) : toDisplay(yards, decimals)
  const mag = (yards: number) =>
    putter ? (unit === 'meters' ? `${(yards * YARDS_TO_METERS).toFixed(1)} m` : `${Math.round(yards * 3)} ft`) : toDisplay(yards)
  const gridLabel = (yd: number) =>
    putter
      ? unit === 'meters' ? (Math.abs(yd) * YARDS_TO_METERS).toFixed(1) : String(Math.round(Math.abs(yd) * 3))
      : String(Math.round(Math.abs(unit === 'meters' ? yd * YARDS_TO_METERS : yd)))
  const unitWord = putter ? (unit === 'meters' ? 'm' : 'ft') : unit === 'meters' ? 'm' : 'yd'

  const [lieType, setLieType] = useState<LieType | null>(null)
  const [forward, setForward] = useState<LieSlopeForward | null>(null)
  const [side, setSide] = useState<LieSlopeSide | null>(null)
  const [view, setView] = useState<ChartView>('aim')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [shots, setShots] = useState<ShotRowMin[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    let active = true
    setLoading(true)
    getShotsByClub(supabase, user.id, club).then(({ data, error }) => {
      if (!active) return
      if (error) {
        // eslint-disable-next-line no-console -- dev diagnostic; mobile has no logger/toast primitive
        console.error('[patterns/getShotsByClub]', error.message)
      }
      setShots((data as ShotRowMin[] | null) ?? [])
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [user?.id, club])

  const points = useMemo(
    () =>
      filterDispersionByLie(computeDispersion(shots.map(rowToShot)), {
        lieType: lieType ?? undefined,
        lieSlopeForward: forward ?? undefined,
        lieSlopeSide: side ?? undefined,
      }),
    [shots, lieType, forward, side],
  )
  const stats = useMemo(() => computeDispersionStats(points), [points])

  const slopes = [forward, side].filter((v): v is LieSlopeForward | LieSlopeSide => v != null).map((v) => v.replace(/_/g, ' '))
  const filtered = lieType != null || slopes.length > 0
  const filterSummary = [lieType ? cap(lieType) : 'Any lie', slopes.join(', ') || 'any slope'].join(' · ')
  const filterPhrase = [lieType ? `from ${LIE_PHRASE[lieType]}` : '', ...slopes].filter(Boolean).join(', ')

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

  // No aimed shot anywhere → the example (B); this club under 5 → its
  // progress (P). Lie filters don't count: a filter can't unmake a pattern.
  if (countsLoading || !anyAimed || aimed(club) < MIN_SAMPLES_FOR_STATS) {
    return (
      <PaperSurface style={{ flex: 1 }}>
        <AppBar title="Shot patterns" />
        {countsLoading ? (
          <Text style={[TYPE.body, { color: '#8A8B7E', fontSize: 13, padding: 18 }]}>Loading…</Text>
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
  const along = !stats
    ? ''
    : Math.abs(stats.avgDistanceOffset) < ON_AIM
      ? 'finishes as far as you aim'
      : `finishes ${mag(Math.abs(stats.avgDistanceOffset))} ${stats.avgDistanceOffset < 0 ? 'short' : 'long'}`
  const across = !stats
    ? ''
    : Math.abs(stats.avgLateralOffset) < ON_AIM
      ? 'stays on your line'
      : `misses ${mag(Math.abs(stats.avgLateralOffset))} ${stats.avgLateralOffset > 0 ? 'right' : 'left'}`
  const typical = typicalYards(club)

  return (
    <PaperSurface style={{ flex: 1 }}>
      <AppBar title="Shot patterns" />
      <ScrollView contentContainerStyle={{ padding: pad, paddingBottom: 40 }}>
        <Entrance index={0}>
          <ClubLadder clubs={clubOptions} value={club} onChange={setClub} typical={ladderNumber} width={screenWidth - pad * 2} />
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12, marginTop: 6 }]}>
            Typical distance in {unit === 'meters' ? 'metres' : 'yards'}, once a club has five aimed shots.
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 }}>
            <Key
              accessibilityLabel="Lie and slope"
              latched={filtered}
              onPress={() => setSheetOpen(true)}
              faceStyle={{ minHeight: 40, paddingHorizontal: 14 }}
            >
              <KeyText size={13} bold={filtered}>Lie and slope</KeyText>
            </Key>
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { flex: 1, color: P.inkDim, fontSize: 13 }]}>{filterSummary}</Text>
          </View>
        </Entrance>

        <Entrance index={1}>
          <View style={{ marginTop: 22 }}>
            <ViewToggle value={view} onChange={setView} />
            <View style={{ marginTop: 10, backgroundColor: P.raised, borderWidth: 1, borderColor: P.line, borderRadius: 3, padding: 8 }}>
              {loading ? (
                <View style={{ height: chartWidth, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={[TYPE.body, { color: '#8A8B7E', fontSize: 13 }]}>Loading…</Text>
                </View>
              ) : view === 'aim' ? (
                <YardagePlot
                  points={points}
                  stats={stats}
                  width={chartWidth}
                  step={putter ? 1 : 5}
                  label={gridLabel}
                  unitWord={unitWord}
                  empty={points.length === 0 ? `No ${noun} shots ${filterPhrase}` : undefined}
                />
              ) : (
                <BallFlightChart points={points} stats={stats} width={chartWidth} label={gridLabel} unitWord={unitWord} />
              )}
            </View>
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 13, lineHeight: 19, marginTop: 8 }]}>
              {view === 'aim'
                ? stats
                  ? `Each dot is where a shot finished. The ring holds about two shots in three; the open circle is the average finish. Squares are ${putter ? (unit === 'meters' ? '0.9 m' : '3 ft') : unit === 'meters' ? '4.6 m' : '5 yd'}.`
                  : 'Each dot is where a shot finished.'
                : 'Each line runs from the tee to where the shot finished; the green line is the average.'}
            </Text>
          </View>
        </Entrance>

        <Entrance index={2}>
          {stats ? (
            <View style={{ marginTop: 26 }}>
              <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { fontSize: 23, lineHeight: 30, color: P.ink, marginBottom: 16 }]}>
                Your {noun} {along} and {across}.
              </Text>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 6 }}>
                {!putter && <StatTile label="Typical distance" value={typical != null ? toDisplay(typical) : '—'} style={{ flex: 1 }} />}
                <StatTile label="Pattern width" value={mag(stats.cone68.lateral * 2)} style={{ flex: 1 }} />
              </View>
              <LedgerRow label="Shots" value={String(stats.sampleSize)} />
              <LedgerRow label="Pattern depth" value={mag(stats.cone68.distance * 2)} note="Short to long, two shots in three" />
              <LedgerRow label="Shape" value={cap(stats.shotShape)} />
              <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serifUpright, { color: P.ink, fontSize: 16, lineHeight: 24, marginTop: 16 }]}>
                {getAimCorrection(stats, unit)}
              </Text>
              <Key
                accessibilityLabel="Export shot pattern image"
                onPress={handleShare}
                disabled={sharing}
                hitSlop={8}
                style={{ alignSelf: 'flex-start', marginTop: 22 }}
                faceStyle={{ flexDirection: 'row', gap: 7, minHeight: 40, paddingHorizontal: 16 }}
              >
                <MaterialCommunityIcons name="tray-arrow-down" size={15} color={sharing ? P.ink35 : P.ink} />
                <KeyText size={13} disabled={sharing}>{sharing ? 'Rendering…' : 'Export image'}</KeyText>
              </Key>
            </View>
          ) : !loading ? (
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serifUpright, { color: P.ink, fontSize: 16, lineHeight: 24, marginTop: 26 }]}>
              {points.length === 0 ? 'None' : `Only ${points.length}`} of your {aimed(club)} {noun} shots{' '}
              {points.length === 1 ? 'was' : 'were'} {filterPhrase}. A pattern needs five: widen the lie or slope to see one.
            </Text>
          ) : null}
        </Entrance>
      </ScrollView>

      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable accessibilityLabel="Close" onPress={() => setSheetOpen(false)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: P.scrim }} />
          <View
            style={{
              backgroundColor: P.raised,
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
              borderTopWidth: 1,
              borderColor: P.ink,
              paddingHorizontal: pad,
              paddingTop: 12,
              paddingBottom: insets.bottom + 18,
            }}
          >
            <View style={{ width: 32, height: 4, backgroundColor: P.line, alignSelf: 'center', marginBottom: 12 }} />
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { fontSize: 22, color: P.ink, marginBottom: 14 }]}>Lie and slope</Text>
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 13, color: P.inkDim, marginBottom: 8 }]}>Lie</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {([null, ...LIE_TYPES] as const).map((v) => (
                <Key
                  key={v ?? 'any'}
                  accessibilityLabel={v ?? 'Any lie'}
                  latched={lieType === v}
                  onPress={() => setLieType(v)}
                  faceStyle={{ minHeight: 40, paddingHorizontal: 12 }}
                >
                  <KeyText size={13} bold={lieType === v}>{v ? cap(v) : 'Any'}</KeyText>
                </Key>
              ))}
            </View>
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 13, color: P.inkDim, marginTop: 18, marginBottom: 8 }]}>Slope</Text>
            <SlopeGrid forward={forward} side={side} onForward={setForward} onSide={setSide} />
            <Key
              accessibilityLabel="Done"
              tone="primary"
              onPress={() => setSheetOpen(false)}
              style={{ marginTop: 20 }}
              faceStyle={{ minHeight: 48 }}
            >
              <KeyText tone="primary" bold>Done</KeyText>
            </Key>
          </View>
        </View>
      </Modal>

      {/* Off-screen render target for react-native-view-shot. Laid out
          far off the left edge so it's never visible; collapsable={false}
          keeps RN from optimising out the subtree the rasteriser reads. */}
      {stats && (
        <View pointerEvents="none" collapsable={false} style={{ position: 'absolute', left: -10000, top: 0 }}>
          <View ref={shareCardRef} collapsable={false}>
            <ShotPatternsShareCard points={points} stats={stats} club={club} unit={unit} toDisplay={dist} />
          </View>
        </View>
      )}
    </PaperSurface>
  )
}


// Off-screen 1200×630 social share card — mobile parity of the web card
// (apps/web ShotPatternsShareCard). Captured via react-native-view-shot.
// Stats only — no username, email, or avatar.
const SHARE_C = {
  bg: '#FBF8F1',
  surface: '#F2EEE5',
  line: '#D9D2BF',
  ink: '#1C211C',
  inkDim: '#5C6356',
  inkMute: '#8A8B7E',
  accent: '#1F3D2C',
} as const

// Paper style, like the app and the scorecard share card: sentence-case
// Epilogue labels, Fraunces-italic figures, ink rules.
const SHARE_KICKER: import('react-native').TextStyle = {
  ...TYPE.body,
}

function ShotPatternsShareCard({
  points,
  stats,
  club,
  unit,
  toDisplay,
}: {
  points: DispersionPoint[]
  stats: DispersionStats
  club: Club
  unit: DistanceUnit
  toDisplay: (yards: number, decimals?: number) => string
}) {
  const c = SHARE_C
  return (
    <View
      style={{
        width: 1200,
        height: 630,
        backgroundColor: c.bg,
        paddingVertical: 44,
        paddingHorizontal: 56,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          paddingBottom: 22,
          borderBottomWidth: 1,
          borderColor: c.ink,
        }}
      >
        <View>
          <Text
            style={{ ...SHARE_KICKER, fontSize: 14, color: c.inkMute, marginBottom: 8 }}
          >
            Open Golf App
          </Text>
          <Text style={{ ...TYPE.serif, fontSize: 44, color: c.ink }}>
            oga<Text style={{ ...TYPE.serifUpright }}>.</Text>
          </Text>
        </View>
        <Text style={{ ...SHARE_KICKER, fontSize: 14, color: c.inkMute }}>
          Shot pattern
        </Text>
      </View>

      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 48,
          paddingVertical: 16,
        }}
      >
        <HardShadow dx={3} dy={3}>
          <View style={{ padding: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.ink, borderRadius: 3 }}>
            <DispersionPlot points={points} stats={stats} size={350} />
          </View>
        </HardShadow>

        <View style={{ flex: 1 }}>
          <Text
            style={{ ...SHARE_KICKER, fontSize: 15, color: c.inkMute, marginBottom: 10 }}
          >
            {club}
          </Text>
          <Text
            style={{
              ...TYPE.serif,
              fontSize: 46,
              lineHeight: 54,
              color: c.ink,
              marginBottom: 30,
            }}
          >
            {dispersionVerdict(stats)}
          </Text>
          <View style={{ flexDirection: 'row', gap: 40, marginBottom: 30 }}>
            <ShareStat label="Sample" value={`${stats.sampleSize} shots`} c={c} />
            <ShareStat
              label="68% spread"
              value={`±${toDisplay(stats.cone68.lateral, 1)} / ${toDisplay(stats.cone68.distance, 1)}`}
              c={c}
            />
            <ShareStat label="Dominant miss" value={stats.dominantMiss[0]!.toUpperCase() + stats.dominantMiss.slice(1)} c={c} />
          </View>
          <Text
            style={{
              ...TYPE.serifUpright,
              fontSize: 22,
              lineHeight: 33,
              color: c.inkDim,
            }}
          >
            {getAimCorrection(stats, unit)}
          </Text>
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 20,
          borderTopWidth: 1,
          borderColor: c.ink,
        }}
      >
        <Text style={{ ...SHARE_KICKER, fontSize: 15, color: c.accent }}>oga.golf</Text>
        <Text style={{ ...SHARE_KICKER, fontSize: 13, color: c.inkMute }}>
          Free forever · no paywalls
        </Text>
      </View>
    </View>
  )
}

function ShareStat({
  label,
  value,
  c,
}: {
  label: string
  value: string
  c: typeof SHARE_C
}) {
  return (
    <View>
      <Text style={{ ...SHARE_KICKER, fontSize: 12, color: c.inkMute, marginBottom: 6 }}>
        {label}
      </Text>
      <Text
        style={{
          ...TYPE.serif,
          fontSize: 28,
          color: c.ink,
        }}
      >
        {value}
      </Text>
    </View>
  )
}

const SVG_SIZE = 320

function pointColor(result: string | undefined): { fill: string; opacity: number } {
  if (result === 'solid') return { fill: '#1C211C', opacity: 0.75 }
  if (result === 'push_right' || result === 'pull_left')
    return { fill: '#A66A1F', opacity: 0.75 }
  if (result === undefined) return { fill: '#8A8B7E', opacity: 0.5 }
  return { fill: '#A33A2A', opacity: 0.8 }
}

function DispersionPlot({
  points,
  stats,
  size: sizeProp,
}: {
  points: DispersionPoint[]
  stats: DispersionStats | null
  // Fixed size for the share card; omitted on-screen → responsive width.
  size?: number
}) {
  const { width: screenWidth } = useWindowDimensions()
  const size = sizeProp ?? Math.min(SVG_SIZE, screenWidth - 56)

  const maxAbs = Math.max(
    ...points.map((p) =>
      Math.max(Math.abs(p.lateralOffsetYards), Math.abs(p.distanceOffsetYards)),
    ),
    stats ? stats.cone95.lateral : 0,
    stats ? stats.cone95.distance : 0,
    20,
  )
  const range = maxAbs * 1.15
  const cx = size / 2
  const cy = size / 2
  const scale = size / 2 / range
  const px = (lat: number) => cx + lat * scale
  const py = (dist: number) => cy - dist * scale

  const tickStep = range > 50 ? 20 : range > 20 ? 10 : 5
  const ticks: number[] = []
  for (let t = tickStep; t < range; t += tickStep) {
    ticks.push(t, -t)
  }

  return (
    <Svg width={size} height={size}>
      <Rect x={0} y={0} width={size} height={size} fill="#F2EEE5" rx={2} ry={2} />
      {ticks.map((t) => (
        <Line
          key={`v${t}`}
          x1={px(t)}
          y1={0}
          x2={px(t)}
          y2={size}
          stroke="#EBE5D6"
          strokeWidth={1}
        />
      ))}
      {ticks.map((t) => (
        <Line
          key={`h${t}`}
          x1={0}
          y1={py(t)}
          x2={size}
          y2={py(t)}
          stroke="#EBE5D6"
          strokeWidth={1}
        />
      ))}
      <Line x1={cx} y1={0} x2={cx} y2={size} stroke="#9F9580" strokeWidth={1} />
      <Line x1={0} y1={cy} x2={size} y2={cy} stroke="#9F9580" strokeWidth={1} />

      {stats && (
        <>
          <Ellipse
            cx={px(stats.avgLateralOffset)}
            cy={py(stats.avgDistanceOffset)}
            rx={stats.cone95.lateral * scale}
            ry={stats.cone95.distance * scale}
            fill="rgba(31,61,44,0.06)"
            stroke="#1F3D2C"
            strokeDasharray="5 4"
            strokeWidth={1}
          />
          <Ellipse
            cx={px(stats.avgLateralOffset)}
            cy={py(stats.avgDistanceOffset)}
            rx={stats.cone68.lateral * scale}
            ry={stats.cone68.distance * scale}
            fill="rgba(31,61,44,0.12)"
            stroke="#1F3D2C"
            strokeDasharray="4 3"
            strokeWidth={1}
          />
        </>
      )}

      <Circle cx={cx} cy={cy} r={3} fill="#A66A1F" />
      <SvgText x={cx + 6} y={cy + 14} fontSize={9} fill="#A66A1F" fontFamily={FONT.mono}>
        AIM
      </SvgText>

      {points.map((p) => {
        const c = pointColor(p.shotResult)
        return (
          <Circle
            key={p.id}
            cx={px(p.lateralOffsetYards)}
            cy={py(p.distanceOffsetYards)}
            r={3.5}
            fill={c.fill}
            fillOpacity={c.opacity}
          />
        )
      })}

      <SvgText x={cx + 6} y={12} fontSize={9} fill="#8A8B7E" fontFamily={FONT.mono}>
        LONG
      </SvgText>
      <SvgText x={cx + 6} y={size - 4} fontSize={9} fill="#8A8B7E" fontFamily={FONT.mono}>
        SHORT
      </SvgText>
      <SvgText x={4} y={cy - 4} fontSize={9} fill="#8A8B7E" fontFamily={FONT.mono}>
        L
      </SvgText>
      <SvgText x={size - 12} y={cy - 4} fontSize={9} fill="#8A8B7E" fontFamily={FONT.mono}>
        R
      </SvgText>
    </Svg>
  )
}
