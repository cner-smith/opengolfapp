import {
  Suspense,
  lazy,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { Database } from '@oga/supabase'
import { HoleScoreCard } from '../../components/rounds/HoleScoreCard'
import { ShotEntryModal } from '../../components/rounds/ShotEntryModal'
import { RoundSummary } from '../../components/rounds/RoundSummary'
import type {
  ExistingShot,
  HoleGeo,
  PlacedPoint,
} from '../../components/round/RoundMap'
import { RoundMapInstructionStrip } from '../../components/round/RoundMap'
import { combinedPuttResult, getShotCategory, haversineYards } from '@oga/core'

// Lazy-load Mapbox GL JS only when the map tab is opened. Cuts ~2 MB off
// the initial bundle for users who never leave the scorecard.
const RoundMap = lazy(() =>
  import('../../components/round/RoundMap').then((m) => ({
    default: m.RoundMap,
  })),
)
import {
  HoleReviewSheet,
  type ReviewedShotRow,
} from '../../components/round/HoleReviewSheet'
import { useDeleteRound, useRound, useRounds } from '../../hooks/useRounds'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useCourseTees, useHolesForCourse } from '../../hooks/useCourses'
import { useHoleScores, useUpsertHoleScore } from '../../hooks/useHoleScores'
import { useCreateShot, useShotsForRound } from '../../hooks/useShots'
import { useCompleteRound } from '../../hooks/useCompleteRound'
import { useProfile } from '../../hooks/useProfile'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']

type ViewMode = 'scorecard' | 'map'

export function RoundDetailPage() {
  const { id: roundId } = useParams()
  const navigate = useNavigate()
  const round = useRound(roundId)
  const profile = useProfile()
  const { user } = useAuth()
  const courseId = round.data?.course_id
  const holesQuery = useHolesForCourse(courseId)
  const teesQuery = useCourseTees(courseId)
  const holeScoresQuery = useHoleScores(roundId)
  const shotsQuery = useShotsForRound(roundId)
  const upsertHoleScore = useUpsertHoleScore(roundId)
  const createShot = useCreateShot(roundId)
  const completeMutation = useCompleteRound()
  const deleteMutation = useDeleteRound()
  const allRounds = useRounds(50)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [shotsModalFor, setShotsModalFor] = useState<{
    holeScoreId: string
    holeNumber: number
    holePar: number
  } | null>(null)
  const [completeError, setCompleteError] = useState<string | null>(null)
  const [searchParams] = useSearchParams()
  // Live-round entries land on the map view directly so the user can
  // start dropping shots; everything else opens on the scorecard.
  const [view, setView] = useState<ViewMode>(() =>
    searchParams.get('view') === 'map' ? 'map' : 'scorecard',
  )
  const [activeHoleNumber, setActiveHoleNumber] = useState<number>(1)
  const [placedPoints, setPlacedPoints] = useState<PlacedPoint[]>([])
  const [pinOverride, setPinOverride] = useState<PlacedPoint | null>(null)
  const [teeOverride, setTeeOverride] = useState<PlacedPoint | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [editingOnMap, setEditingOnMap] = useState(false)
  const [savingHole, setSavingHole] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const holes = useMemo(() => holesQuery.data ?? [], [holesQuery.data])
  const rawScores: Array<HoleScoreRow & { holes?: HoleRow | null }> = useMemo(
    () => holeScoresQuery.data ?? [],
    [holeScoresQuery.data],
  )
  const holeScores: HoleScoreRow[] = useMemo(
    () =>
      rawScores.map((row) => {
        const { holes: _h, ...rest } = row
        return rest
      }),
    [rawScores],
  )
  const scoresByHoleId = useMemo(() => {
    const m = new Map<string, HoleScoreRow>()
    for (const s of holeScores) m.set(s.hole_id, s)
    return m
  }, [holeScores])
  const shotCountByHoleScore = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of shotsQuery.data ?? []) {
      m.set(s.hole_score_id, (m.get(s.hole_score_id) ?? 0) + 1)
    }
    return m
  }, [shotsQuery.data])

  const activeHole = useMemo(
    () => holes.find((h) => h.number === activeHoleNumber) ?? null,
    [holes, activeHoleNumber],
  )
  const activeHoleScore = activeHole
    ? scoresByHoleId.get(activeHole.id) ?? null
    : null
  // Pull the round-specific pin off the hole_scores row when present so
  // it wins over the holes-table default.
  const persistedRoundPin: PlacedPoint | null =
    activeHoleScore?.pin_lat != null && activeHoleScore?.pin_lng != null
      ? { lat: activeHoleScore.pin_lat, lng: activeHoleScore.pin_lng }
      : null
  const effectivePin: PlacedPoint | null =
    pinOverride ??
    persistedRoundPin ??
    (activeHole?.pin_lat != null && activeHole?.pin_lng != null
      ? { lat: activeHole.pin_lat, lng: activeHole.pin_lng }
      : null)
  const effectiveTee: PlacedPoint | null =
    teeOverride ??
    (activeHole?.tee_lat != null && activeHole?.tee_lng != null
      ? { lat: activeHole.tee_lat, lng: activeHole.tee_lng }
      : null)
  const activeHoleGeo: HoleGeo | null = activeHole
    ? {
        id: activeHole.id,
        number: activeHole.number,
        par: activeHole.par,
        yards: activeHole.yards,
        teeLat: effectiveTee?.lat ?? null,
        teeLng: effectiveTee?.lng ?? null,
        pinLat: effectivePin?.lat ?? null,
        pinLng: effectivePin?.lng ?? null,
      }
    : null
  const activeHoleShots = useMemo<ExistingShot[]>(() => {
    if (!activeHoleScore) return []
    return (shotsQuery.data ?? [])
      .filter((s) => s.hole_score_id === activeHoleScore.id)
      .map((s) => ({
        id: s.id,
        shotNumber: s.shot_number,
        endLat: s.end_lat,
        endLng: s.end_lng,
        startLat: s.start_lat,
        startLng: s.start_lng,
        category: categorizeShot(s, activeHole?.par ?? 4),
      }))
      .sort((a, b) => a.shotNumber - b.shotNumber)
  }, [activeHoleScore, shotsQuery.data])

  // The round-pin write is best-effort — we update local state synchronously
  // so the map + review sheet update immediately, then persist to
  // hole_scores.pin_lat/lng if we have a row to attach it to.
  const persistRoundPin = useCallback(
    async (point: PlacedPoint) => {
      setPinOverride(point)
      const hs = activeHoleScore
      if (!hs || !roundId) return
      // Belt-and-suspenders: constrain by round_id alongside row id, so a
      // misconfigured RLS policy can't let a stray UUID write another
      // user's pin.
      const { error } = await supabase
        .from('hole_scores')
        .update({ pin_lat: point.lat, pin_lng: point.lng })
        .eq('id', hs.id)
        .eq('round_id', roundId)
      if (error) {
        // Don't roll back the local override — the user's intent stays
        // visible while they retry. Surface the error for diagnostics.
        // eslint-disable-next-line no-console
        console.error('round pin update failed', error)
      }
    },
    [activeHoleScore, roundId],
  )

  const placeHandlers = useMemo(
    () => ({
      onPlace: (p: PlacedPoint) =>
        setPlacedPoints((prev) => [...prev, p]),
      onMovePoint: (idx: number, p: PlacedPoint) =>
        setPlacedPoints((prev) => {
          const next = prev.slice()
          next[idx] = p
          return next
        }),
      onMovePin: (p: PlacedPoint) => {
        void persistRoundPin(p)
      },
      onMoveTee: (p: PlacedPoint) => setTeeOverride(p),
      onClearPoints: () => setPlacedPoints([]),
      onUndoPoint: () =>
        setPlacedPoints((prev) => prev.slice(0, -1)),
      onDoneWithHole: () => setReviewOpen(true),
      onDoneEditing: () => {
        setEditingOnMap(false)
        setReviewOpen(true)
      },
    }),
    [persistRoundPin],
  )

  const switchHole = useCallback((n: number) => {
    setActiveHoleNumber(n)
    setPlacedPoints([])
    setPinOverride(null)
    setTeeOverride(null)
    setReviewOpen(false)
    setEditingOnMap(false)
    setSaveError(null)
  }, [])

  if (round.isLoading || holesQuery.isLoading) {
    return (
      <div className="text-caddie-ink-mute" style={{ fontSize: 13 }}>
        Loading round…
      </div>
    )
  }
  if (round.error) {
    return (
      <div
        className="text-caddie-neg"
        style={{
          border: '1px solid #A33A2A',
          borderRadius: 4,
          padding: '14px 18px',
          fontSize: 13,
        }}
      >
        Error: {(round.error as Error).message}
      </div>
    )
  }
  if (!round.data) {
    return <div style={{ fontSize: 13 }}>Round not found.</div>
  }

  const holesPlayed = holeScores.length
  const totalRoundsLogged = allRounds.data?.length ?? 0

  async function handleComplete() {
    if (!round.data || !courseId || !user) return
    setCompleteError(null)
    try {
      const handicap = profile.data?.handicap_index ?? 15
      await completeMutation.mutateAsync({
        roundId: round.data.id,
        courseId,
        handicap,
        courseTeeId: round.data.course_tee_id,
        teeColor: round.data.tee_color,
        userId: user.id,
      })
    } catch (err) {
      setCompleteError((err as Error).message)
    }
  }

  async function handleDelete() {
    if (!round.data) return
    try {
      await deleteMutation.mutateAsync(round.data.id)
      setConfirmDelete(false)
      navigate('/rounds')
    } catch (err) {
      setCompleteError((err as Error).message)
      setConfirmDelete(false)
    }
  }

  async function saveReviewedHole(rows: ReviewedShotRow[]) {
    if (!user || !activeHole || !round.data) return
    setSavingHole(true)
    setSaveError(null)
    try {
      // Ensure a hole_score row exists; the score equals the placed
      // shot count, which is what the player just confirmed. Putts is
      // derived from the rows so the scorecard reflects what was placed
      // without needing a manual entry.
      const existing = scoresByHoleId.get(activeHole.id)
      const puttCount = rows.filter(
        (r) => r.lieType === 'green' || r.club === 'putter',
      ).length
      const hsResult = await upsertHoleScore.mutateAsync({
        id: existing?.id,
        round_id: round.data.id,
        hole_id: activeHole.id,
        score: rows.length,
        putts: puttCount,
        fairway_hit: existing?.fairway_hit ?? null,
        gir: existing?.gir ?? null,
      })
      const hs = hsResult ?? existing
      if (!hs) throw new Error('hole_score upsert returned no row')

      for (const row of rows) {
        const isPuttRow = row.lieType === 'green' || row.club === 'putter'
        await createShot.mutateAsync({
          hole_score_id: hs.id,
          user_id: user.id,
          shot_number: row.shotNumber,
          start_lat: row.startLat,
          start_lng: row.startLng,
          end_lat: row.endLat,
          end_lng: row.endLng,
          aim_lat: null,
          aim_lng: null,
          distance_to_target: isPuttRow ? null : Math.round(row.distanceToPin),
          club: row.club,
          lie_type: row.lieType,
          shot_result: null,
          penalty: false,
          ob: false,
          // Putt-specific fields. distanceYards on a putt row is the
          // tap-to-tap distance in yards; * 3 = feet (US convention),
          // and putt_distance_ft is what the rest of the app reads.
          putt_distance_ft: isPuttRow
            ? Math.round(row.distanceYards * 3)
            : null,
          // Distance + direction are independent axes; legacy putt_result
          // is reconstructed for back-compat readers.
          putt_result: !isPuttRow
            ? null
            : combinedPuttResult({
                made: row.puttMade,
                distance: row.puttDistanceResult ?? null,
                direction: row.puttDirectionResult ?? null,
              }),
          putt_distance_result:
            !isPuttRow || row.puttMade ? null : row.puttDistanceResult ?? null,
          putt_direction_result:
            !isPuttRow || row.puttMade ? null : row.puttDirectionResult ?? null,
          notes: null,
        })
      }
      setReviewOpen(false)
      setPlacedPoints([])
    } catch (err) {
      setSaveError((err as Error).message)
    } finally {
      setSavingHole(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/rounds')}
        className="font-mono uppercase text-caddie-ink-mute hover:text-caddie-ink"
        style={{
          fontSize: 10,
          letterSpacing: '0.14em',
          marginBottom: 18,
        }}
      >
        ← All rounds
      </button>

      <div
        className="flex flex-col sm:flex-row sm:items-end sm:justify-between"
        style={{ marginBottom: 28, gap: 14 }}
      >
        <div>
          <div className="kicker" style={{ marginBottom: 8 }}>
            Round detail
          </div>
          <h1
            className="font-serif text-caddie-ink"
            style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.15 }}
          >
            {round.data.courses?.name ?? 'Round'}
          </h1>
          <div
            className="font-mono uppercase tabular text-caddie-ink-mute"
            style={{
              fontSize: 10,
              letterSpacing: '0.14em',
              marginTop: 6,
            }}
          >
            {round.data.played_at}
            {round.data.tee_color ? ` · ${round.data.tee_color} tees` : ''} ·{' '}
            {holesPlayed}/18 holes scored
          </div>
          <RoundRatingLine
            round={round.data as unknown as RoundRow}
            tees={teesQuery.data ?? []}
          />
        </div>
        <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={deleteMutation.isPending}
            className="text-caddie-neg hover:bg-caddie-neg/10 disabled:opacity-40"
            style={{
              background: 'transparent',
              border: '1px solid #A33A2A',
              borderRadius: 2,
              padding: '12px 14px',
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: '0.02em',
            }}
          >
            Delete round
          </button>
          <button
            type="button"
            onClick={handleComplete}
            disabled={completeMutation.isPending || holesPlayed === 0}
            className="bg-caddie-accent text-caddie-accent-ink hover:opacity-90 disabled:opacity-40"
            style={{
              borderRadius: 2,
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.02em',
            }}
          >
            {completeMutation.isPending ? 'Calculating…' : 'Save SG + finalize'}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this round?"
        message="This cannot be undone. Hole scores and shots are removed too."
        confirmLabel="Delete"
        destructive
        busy={deleteMutation.isPending}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      {completeError && (
        <div
          className="text-caddie-neg"
          style={{
            border: '1px solid #A33A2A',
            borderRadius: 4,
            padding: '14px 18px',
            fontSize: 13,
            marginBottom: 18,
          }}
        >
          {completeError}
        </div>
      )}

      {round.data.sg_total !== null && (
        <div style={{ marginBottom: 28 }}>
          <RoundSummary
            round={round.data as unknown as RoundRow}
            holes={holes}
            holeScores={holeScores}
            totalRoundsLogged={totalRoundsLogged}
          />
        </div>
      )}

      <ViewTabs value={view} onChange={setView} />

      {view === 'scorecard' ? (
        <ScorecardView
          holes={holes}
          scoresByHoleId={scoresByHoleId}
          shotCountByHoleScore={shotCountByHoleScore}
          roundId={round.data.id}
          onEditShots={(args) => setShotsModalFor(args)}
        />
      ) : (
        <MapView
          holes={holes}
          activeHoleNumber={activeHoleNumber}
          onSwitchHole={switchHole}
          activeHoleGeo={activeHoleGeo}
          existingShots={activeHoleShots}
          placedPoints={placedPoints}
          pinOverride={pinOverride}
          teeOverride={teeOverride}
          handlers={placeHandlers}
          saveError={saveError}
          editingOnMap={editingOnMap}
          reviewSheet={
            activeHole ? (
              <HoleReviewSheet
                open={reviewOpen}
                holeNumber={activeHole.number}
                par={activeHole.par}
                totalPar={holes.reduce((s, h) => s + h.par, 0)}
                pinLat={effectivePin?.lat ?? null}
                pinLng={effectivePin?.lng ?? null}
                placedPoints={placedPoints}
                saving={savingHole}
                onEditOnMap={() => {
                  setReviewOpen(false)
                  setEditingOnMap(true)
                }}
                onSave={saveReviewedHole}
              />
            ) : null
          }
        />
      )}

      {shotsModalFor && round.data && (
        <ShotEntryModal
          roundId={round.data.id}
          holeScoreId={shotsModalFor.holeScoreId}
          holeNumber={shotsModalFor.holeNumber}
          holePar={shotsModalFor.holePar}
          onClose={() => setShotsModalFor(null)}
        />
      )}
    </div>
  )
}

function ViewTabs({
  value,
  onChange,
}: {
  value: ViewMode
  onChange: (v: ViewMode) => void
}) {
  const tabs: { key: ViewMode; label: string }[] = [
    { key: 'scorecard', label: 'Scorecard' },
    { key: 'map', label: 'Map' },
  ]
  return (
    <div
      style={{
        display: 'flex',
        gap: 0,
        borderBottom: '1px solid #D9D2BF',
        marginBottom: 18,
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className="font-mono uppercase"
          style={{
            background: 'transparent',
            border: 'none',
            padding: '10px 18px',
            fontSize: 10,
            letterSpacing: '0.14em',
            color: value === t.key ? '#1C211C' : '#8A8B7E',
            borderBottom:
              value === t.key
                ? '2px solid #1F3D2C'
                : '2px solid transparent',
            marginBottom: -1,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

interface ScorecardViewProps {
  holes: HoleRow[]
  scoresByHoleId: Map<string, HoleScoreRow>
  shotCountByHoleScore: Map<string, number>
  roundId: string
  onEditShots: (args: {
    holeScoreId: string
    holeNumber: number
    holePar: number
  }) => void
}

function ScorecardView({
  holes,
  scoresByHoleId,
  shotCountByHoleScore,
  roundId,
  onEditShots,
}: ScorecardViewProps) {
  return (
    <div style={{ borderTop: '1px solid #D9D2BF', paddingTop: 14 }}>
      <div className="kicker" style={{ marginBottom: 14 }}>
        Scorecard
      </div>
      <div
        style={{
          borderTop: '1px solid #D9D2BF',
          overflowX: 'auto',
        }}
      >
        <div style={{ minWidth: 720 }}>
        <div
          className="grid grid-cols-12 items-center font-mono uppercase text-caddie-ink-mute"
          style={{
            padding: '10px 0',
            fontSize: 10,
            letterSpacing: '0.14em',
            gap: 12,
            borderBottom: '1px solid #D9D2BF',
          }}
        >
          <div className="col-span-2">Hole</div>
          <div className="col-span-1 text-center">Score</div>
          <div className="col-span-1" />
          <div className="col-span-2 text-center">Putts</div>
          <div className="col-span-2 text-center">Fairway</div>
          <div className="col-span-1 text-center">GIR</div>
          <div className="col-span-3 text-right">Shots</div>
        </div>
        {holes.map((h) => {
          const hs = scoresByHoleId.get(h.id)
          return (
            <HoleScoreCard
              key={h.id}
              roundId={roundId}
              hole={h}
              holeScore={hs}
              shotCount={hs ? (shotCountByHoleScore.get(hs.id) ?? 0) : 0}
              onEditShots={(holeScoreId) =>
                onEditShots({
                  holeScoreId,
                  holeNumber: h.number,
                  holePar: h.par,
                })
              }
            />
          )
        })}
        </div>
      </div>
    </div>
  )
}

interface MapViewProps {
  holes: HoleRow[]
  activeHoleNumber: number
  onSwitchHole: (n: number) => void
  activeHoleGeo: HoleGeo | null
  existingShots: ExistingShot[]
  placedPoints: PlacedPoint[]
  pinOverride: PlacedPoint | null
  teeOverride: PlacedPoint | null
  handlers: {
    onPlace: (p: PlacedPoint) => void
    onMovePoint: (idx: number, p: PlacedPoint) => void
    onMovePin: (p: PlacedPoint) => void
    onMoveTee: (p: PlacedPoint) => void
    onClearPoints: () => void
    onUndoPoint: () => void
    onDoneWithHole: () => void
    onDoneEditing: () => void
  }
  saveError: string | null
  editingOnMap: boolean
  reviewSheet?: ReactNode
}

function MapView({
  holes,
  activeHoleNumber,
  onSwitchHole,
  activeHoleGeo,
  existingShots,
  placedPoints,
  pinOverride,
  teeOverride,
  handlers,
  saveError,
  editingOnMap,
  reviewSheet,
}: MapViewProps) {
  const hasExistingShots = existingShots.some(
    (s) => s.endLat != null && s.endLng != null,
  )
  const lastPoint = placedPoints[placedPoints.length - 1] ?? null
  const effectivePin =
    pinOverride ??
    (activeHoleGeo?.pinLat != null && activeHoleGeo?.pinLng != null
      ? { lat: activeHoleGeo.pinLat, lng: activeHoleGeo.pinLng }
      : null)
  const remainingToPin =
    lastPoint && effectivePin
      ? Math.round(
          haversineYards(
            lastPoint.lat,
            lastPoint.lng,
            effectivePin.lat,
            effectivePin.lng,
          ),
        )
      : null

  return (
    <div>
      <HoleSelector
        holes={holes}
        activeNumber={activeHoleNumber}
        onSelect={onSwitchHole}
      />
      <div style={{ marginTop: 14 }}>
        <RoundMapInstructionStrip
          hasExistingShots={hasExistingShots}
          editing={editingOnMap}
          shotsPlaced={placedPoints.length}
          remainingToPin={remainingToPin}
          onUndo={handlers.onUndoPoint}
          onClear={handlers.onClearPoints}
          onDone={handlers.onDoneWithHole}
          onDoneEditing={handlers.onDoneEditing}
        />
      </div>
      <div
        style={{
          marginTop: 10,
          height: 540,
          border: '1px solid #D9D2BF',
          borderRadius: 4,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <Suspense fallback={<MapLoading />}>
          <RoundMap
            hole={activeHoleGeo}
            existingShots={existingShots}
            placedPoints={placedPoints}
            pinOverride={pinOverride}
            teeOverride={teeOverride}
            tapToPlaceDisabled={editingOnMap}
            onPlace={handlers.onPlace}
            onMovePoint={handlers.onMovePoint}
            onMovePin={handlers.onMovePin}
            onMoveTee={handlers.onMoveTee}
          />
        </Suspense>
        {reviewSheet}
      </div>
      {saveError && (
        <div
          className="text-caddie-neg"
          style={{
            border: '1px solid #A33A2A',
            borderRadius: 4,
            padding: '12px 14px',
            fontSize: 13,
            marginTop: 14,
          }}
        >
          {saveError}
        </div>
      )}
    </div>
  )
}

function MapLoading() {
  return (
    <div
      className="flex items-center justify-center text-caddie-ink-mute"
      style={{ height: '100%', width: '100%', fontSize: 13 }}
    >
      Loading map…
    </div>
  )
}

function HoleSelector({
  holes,
  activeNumber,
  onSelect,
}: {
  holes: HoleRow[]
  activeNumber: number
  onSelect: (n: number) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
      }}
    >
      {holes.map((h) => {
        const active = h.number === activeNumber
        return (
          <button
            key={h.id}
            type="button"
            onClick={() => onSelect(h.number)}
            className="font-mono tabular"
            style={{
              minWidth: 36,
              height: 36,
              padding: '0 10px',
              borderRadius: 2,
              background: active ? '#1F3D2C' : '#EBE5D6',
              color: active ? '#F2EEE5' : '#1C211C',
              border: 'none',
              fontSize: 12,
              fontWeight: active ? 600 : 500,
              letterSpacing: '0.04em',
              cursor: 'pointer',
            }}
            title={`Hole ${h.number} · Par ${h.par}`}
          >
            {h.number}
          </button>
        )
      })}
    </div>
  )
}

// Categorize a shot row for marker coloring on the map.
type RoundRow = Database['public']['Tables']['rounds']['Row']
type CourseTeeRow = Database['public']['Tables']['course_tees']['Row']

function RoundRatingLine({
  round,
  tees,
}: {
  round: RoundRow
  tees: CourseTeeRow[]
}) {
  const tee =
    tees.find((t) => t.id === round.course_tee_id) ??
    (round.tee_color
      ? tees.find((t) => t.tee_color === round.tee_color!.toLowerCase())
      : null) ??
    null
  const hasRating =
    tee && tee.course_rating != null && tee.slope_rating != null
  const diff = round.score_differential

  if (!tee && diff == null) return null

  return (
    <div
      className="font-mono uppercase tabular text-caddie-ink-mute"
      style={{
        fontSize: 10,
        letterSpacing: '0.14em',
        marginTop: 4,
      }}
    >
      {hasRating
        ? `Rating ${tee.course_rating?.toFixed(1)} · slope ${tee.slope_rating}`
        : tee
          ? 'No course rating on file'
          : 'Add course rating to calculate handicap differential'}
      {diff != null
        ? ` · diff ${diff >= 0 ? '+' : ''}${diff.toFixed(1)}`
        : ''}
    </div>
  )
}

function categorizeShot(
  s: {
    shot_number: number
    lie_type: string | null
    distance_to_target: number | null
  },
  par: number,
): ExistingShot['category'] {
  // Visual override: any tee-lie shot (incl. par 3) renders as a tee
  // marker even though SG-wise par 3 tee shots count as approach.
  if (s.lie_type === 'tee') return 'tee'
  const cat = getShotCategory(
    {
      lieType:
        (s.lie_type as
          | 'tee'
          | 'fairway'
          | 'rough'
          | 'sand'
          | 'fringe'
          | 'recovery'
          | 'green'
          | null) ?? undefined,
      distanceToTarget: s.distance_to_target ?? undefined,
    },
    par,
    s.shot_number,
  )
  if (cat === 'putting') return 'putt'
  if (cat === 'around_green') return 'around-green'
  if (cat === 'off_tee') return 'tee'
  return 'approach'
}
