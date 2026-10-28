import {
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ShotEntryModal } from '../../components/rounds/ShotEntryModal'
import { RoundSide, RoundTotals, type ScoredHole } from '../../components/rounds/RoundSummary'
import { ShareableScorecardCard } from '../../components/round/ShareableScorecardCard'
import { HoleReviewSheet } from '../../components/round/HoleReviewSheet'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import {
  DEFAULT_HANDICAP,
  inferHoleCount,
  isFinishedRound,
  projectShotMove,
  resolveCourseTee,
  type CaptureMode,
} from '@oga/core'
import { useAuth } from '../../hooks/useAuth'
import { useDeleteShot, useInsertShot } from '../../hooks/useShots'
import { useProfile } from '../../hooks/useProfile'
import { toUserMessage } from '../../lib/errors'
import type { PlacedPoint } from '../../components/round/RoundMap'
import {
  HOLE_VIEW_INITIAL,
  holeViewReducer,
} from './state/holeViewReducer'
import { useRoundData, type RoundRow } from './hooks/useRoundData'
import { useRoundActions, type ShotDragUndo } from './hooks/useRoundActions'
import { RoundHeader } from './components/RoundHeader'
import { ScorecardView } from './components/ScorecardView'
import { MapView } from './components/MapView'
import { Rocker } from '../../components/ui/Rocker'

type ViewMode = 'scorecard' | 'map'

export function RoundDetailPage() {
  const { id: roundId } = useParams()
  const navigate = useNavigate()
  const profile = useProfile()
  const { user } = useAuth()

  const [confirmDelete, setConfirmDelete] = useState(false)
  // "Set an aim point?" prompt — opens after every non-putt PUSH_POINT
  // so the player decides explicitly whether this shot has aim data.
  // Replaces the easy-to-miss "Set aim" button on the bottom chrome as the
  // primary aim-collection moment. Putt placements skip it (putts
  // capture aim through the putting sheet's break/aim-offset fields).
  const [aimPromptOpen, setAimPromptOpen] = useState(false)
  // First-use hint shown the first time the player ever places an aim
  // point: aim where you want the ball to finish (#1076). Gated by
  // localStorage so it appears once per device and auto-dismisses after
  // 3s or on tap.
  const [aimHintVisible, setAimHintVisible] = useState(false)
  const [shareTone, setShareTone] = useState<'light' | 'dark'>('light')
  const [sharing, setSharing] = useState(false)
  const shareCardRef = useRef<HTMLDivElement | null>(null)
  const [shotsModalFor, setShotsModalFor] = useState<{
    holeScoreId: string
    holeNumber: number
    holePar: number
    shotId?: string
  } | null>(null)
  const [completeError, setCompleteError] = useState<string | null>(null)
  const [searchParams] = useSearchParams()
  // Live-round entries land on the map view directly so the user can
  // start dropping shots; everything else opens on the scorecard.
  const [view, setView] = useState<ViewMode>(() =>
    searchParams.get('view') === 'map' ? 'map' : 'scorecard',
  )
  // Capture "session started in live mode" at mount. `view` is a
  // runtime Scorecard | Map rocker — past-round reviewers can switch to the
  // map tab and we don't want that to suppress the shot mini-map for
  // them. The mini-map suppression is for genuine live entry only.
  const [isLiveEntry] = useState(
    () =>
      searchParams.get('mode') === 'live' ||
      searchParams.get('view') === 'map',
  )
  const [holeView, dispatchHoleView] = useReducer(holeViewReducer, HOLE_VIEW_INITIAL)
  const {
    activeHoleNumber,
    placedPoints,
    placedAims,
    placedAimAuto,
    aimMode,
    pinOverride,
    teeOverride,
    placementMode,
    reviewOpen,
    editingOnMap,
    saveError,
  } = holeView
  const [savingHole, setSavingHole] = useState(false)

  const [shotDragUndo, setShotDragUndo] = useState<ShotDragUndo | null>(null)
  const undoTimerRef = useRef<number | null>(null)
  useEffect(() => {
    if (undoTimerRef.current != null) {
      window.clearTimeout(undoTimerRef.current)
    }
    if (!shotDragUndo) return
    undoTimerRef.current = window.setTimeout(() => {
      setShotDragUndo(null)
    }, 5000)
    return () => {
      if (undoTimerRef.current != null) {
        window.clearTimeout(undoTimerRef.current)
      }
    }
  }, [shotDragUndo])

  const placedAimsHaveAny = placedAims.some((a) => a != null)
  useEffect(() => {
    if (!placedAimsHaveAny) return
    if (typeof window === 'undefined') return
    if (window.localStorage.getItem('oga.aim-hint-shown')) return
    window.localStorage.setItem('oga.aim-hint-shown', '1')
    setAimHintVisible(true)
    const t = window.setTimeout(() => setAimHintVisible(false), 3000)
    return () => window.clearTimeout(t)
  }, [placedAimsHaveAny])

  const data = useRoundData({
    roundId,
    activeHoleNumber,
    pinOverride,
    teeOverride,
  })
  const {
    round,
    holesQuery,
    teesQuery,
    holes,
    holeScores,
    scoresByHoleId,
    shotCountByHoleScore,
    activeHole,
    activeHoleScore,
    effectivePin,
    persistedRoundPin,
    courseFallbackLat,
    courseFallbackLng,
    activeHoleGeo,
    missingHoleLayout,
    activeHoleShots,
    resolvedHoleByNumber,
    allRounds,
  } = data

  const actions = useRoundActions({
    roundId,
    user,
    profile,
    data,
    isLiveEntry,
    captureMode: (round.data?.capture_mode ?? 'track_patterns') as CaptureMode,
    pinOverride,
    teeOverride,
    placedAims,
    placedAimAuto,
    shotDragUndo,
    shareCardRef,
    sharing,
    shareTone,
    dispatchHoleView,
    setShotDragUndo,
    setSavingHole,
    setConfirmDelete,
    setCompleteError,
    setSharing,
    setAimPromptOpen,
  })
  const {
    ensureRealHole,
    placeHandlers,
    handleMoveExistingShot,
    handleMoveExistingShotAim,
    applyShotDragUndo,
    saveReviewedHole,
    handleDelete,
    handleComplete,
    handleShare,
    completeMutation,
    deleteMutation,
  } = actions

  // The round map's Remove and + Add shot (#1239). Failures show where the
  // hole save's do.
  const removeShot = useDeleteShot(roundId)
  const insertShot = useInsertShot(roundId)
  const shotError = (err: unknown) =>
    dispatchHoleView({ type: 'SAVE_ERROR', message: toUserMessage(err) })

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
        Error: {toUserMessage(round.error)}
      </div>
    )
  }
  if (!round.data) {
    return <div style={{ fontSize: 13 }}>Round not found.</div>
  }

  const holesPlayed = holeScores.length
  const holeCount = inferHoleCount(holes.map((h) => h.number))
  // Scored holes with their tee-resolved par: the header's running total,
  // the totals block and the best / worst line all read from these.
  const scored: ScoredHole[] = []
  for (const h of holes) {
    const hs = scoresByHoleId.get(h.id)
    if (hs?.score != null && hs.score > 0)
      scored.push({ number: h.number, score: hs.score, par: resolvedHoleByNumber.get(h.number)?.par ?? hs.par ?? h.par })
  }
  const runningScore = scored.reduce((t, h) => t + h.score, 0)
  const runningPar = scored.reduce((t, h) => t + h.par, 0)
  const finalized = isFinishedRound(round.data)
  // Save / Recalculate SG and Delete: under the card, and under the map so a
  // live round on a phone (which opens on the map) can still be finished.
  const roundKeys = (
    <div className="flex flex-wrap" style={{ gap: 12, marginTop: 28 }}>
      {finalized ? (
        <button
          type="button"
          onClick={handleComplete}
          disabled={completeMutation.isPending}
          className="key"
        >
          {completeMutation.isPending ? 'Saving…' : 'Recalculate SG'}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleComplete}
          disabled={completeMutation.isPending || holesPlayed === 0}
          className="key key-primary sm:hidden"
          style={{ width: '100%', minHeight: 50, fontSize: 16 }}
        >
          {completeMutation.isPending ? 'Saving…' : 'Save SG'}
        </button>
      )}
      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        disabled={deleteMutation.isPending}
        className="key"
        style={{ color: '#A33A2A' }}
      >
        {deleteMutation.isPending ? 'Deleting…' : 'Delete round'}
      </button>
    </div>
  )
  // The played tee (by id, then by colour) supplies rating/slope/yardage for
  // the share card — same match RoundHeader uses.
  const playedTee = resolveCourseTee(
    teesQuery.data ?? [],
    round.data.course_tee_id,
    round.data.tee_color,
  )
  const switchHole = (n: number) =>
    dispatchHoleView({ type: 'SWITCH_HOLE', holeNumber: n })

  return (
    <div>
      <RoundHeader
        round={round.data as unknown as RoundRow & { courses?: { name?: string | null } | null }}
        tees={teesQuery.data ?? []}
        holesPlayed={holesPlayed}
        holeCount={holeCount}
        score={runningScore}
        toPar={runningPar > 0 ? runningScore - runningPar : null}
        shareTone={shareTone}
        sharing={sharing}
        completePending={completeMutation.isPending}
        onBack={() => navigate('/rounds')}
        onShare={handleShare}
        onToggleShareTone={() =>
          setShareTone((t) => (t === 'light' ? 'dark' : 'light'))
        }
        onComplete={handleComplete}
      />

      <div style={{ borderBottom: '1px solid #1C211C', padding: '14px 0 18px', marginBottom: 28 }}>
        <Rocker tabs options={VIEWS} value={view} onChange={setView} label="Round view" className="sm:max-w-[420px]" />
      </div>

      {/* Off-screen render target for html-to-image. Position fixed
          left:-99999px keeps the rasteriser-visible DOM out of the
          user's view; pointerEvents none so it can never intercept
          clicks while the card is mounted. */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          left: -99999,
          top: 0,
          pointerEvents: 'none',
        }}
      >
        <div ref={shareCardRef}>
          <ShareableScorecardCard
            round={{
              ...round.data,
              course_rating: playedTee?.course_rating ?? null,
              slope_rating: playedTee?.slope_rating ?? null,
              total_yards: playedTee?.total_yards ?? null,
            }}
            holes={holes}
            scoresByHoleId={scoresByHoleId}
            tone={shareTone}
          />
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


      <ConfirmDialog
        open={aimPromptOpen}
        title="Set an aim point?"
        message="Put your aim point where you want the ball to finish. That’s what builds your shot pattern."
        confirmLabel="Set aim point →"
        cancelLabel="Skip"
        onConfirm={() => {
          dispatchHoleView({ type: 'AIM_MODE', on: true })
          setAimPromptOpen(false)
        }}
        onCancel={() => setAimPromptOpen(false)}
      />

      {aimHintVisible && (
        <button
          type="button"
          onClick={() => setAimHintVisible(false)}
          aria-label="Dismiss aim point hint"
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#1C211C',
            color: '#F2EEE5',
            borderRadius: 4,
            padding: '12px 18px',
            fontSize: 13,
            zIndex: 100,
            border: '1px solid #9F9580',
            cursor: 'pointer',
          }}
        >
          Aim where you want it to finish — drag to adjust.
        </button>
      )}

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

      {view === 'scorecard' ? (
        <div role="tabpanel" aria-label="Scorecard">
          <RoundTotals
            round={round.data as unknown as RoundRow}
            scored={scored}
            handicap={profile.data?.handicap_index ?? null}
          />
          <div
            className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
            style={{ columnGap: 56, rowGap: 36, marginTop: 40 }}
          >
            <ScorecardView
              holes={holes}
              scoresByHoleId={scoresByHoleId}
              shotCountByHoleScore={shotCountByHoleScore}
              resolvedHoleByNumber={resolvedHoleByNumber}
              roundId={round.data.id}
              ensureRealHole={ensureRealHole}
              onEditShots={(args) => setShotsModalFor(args)}
            />
            <div className="lg:sticky lg:top-6 lg:self-start lg:pt-[52px]">
              <RoundSide
                round={round.data as unknown as RoundRow}
                holesPlayed={holesPlayed}
                totalRoundsLogged={allRounds.data?.length ?? 0}
              >
                {roundKeys}
              </RoundSide>
            </div>
          </div>
        </div>
      ) : (
        <MapView
          holes={holes}
          userId={user?.id}
          handicap={profile.data?.handicap_index ?? DEFAULT_HANDICAP}
          activeHoleNumber={activeHoleNumber}
          onSwitchHole={switchHole}
          activeHoleGeo={activeHoleGeo}
          courseLat={courseFallbackLat}
          courseLng={courseFallbackLng}
          existingShots={activeHoleShots}
          placedPoints={placedPoints}
          placedAims={placedAims}
          aimMode={aimMode}
          missingHoleLayout={missingHoleLayout}
          isLiveEntry={isLiveEntry}
          pinOverride={pinOverride}
          roundPinSet={persistedRoundPin != null}
          teeOverride={teeOverride}
          placementMode={placementMode}
          handlers={placeHandlers}
          onMoveExistingShot={handleMoveExistingShot}
          onMoveExistingShotAim={handleMoveExistingShotAim}
          shotDragUndoLabel={shotDragUndo?.label ?? null}
          onApplyShotDragUndo={applyShotDragUndo}
          saveError={saveError}
          editingOnMap={editingOnMap}
          holeScore={activeHoleScore}
          shotBusy={removeShot.isPending || insertShot.isPending}
          onRemoveShot={(id) => removeShot.mutateAsync(id).catch(shotError)}
          onAddShot={async (afterShotId, start) => {
            const id = crypto.randomUUID()
            const { distanceToTarget } = projectShotMove({ newStart: start, pin: effectivePin, isPutt: false })
            try {
              await insertShot.mutateAsync({ id, afterShotId, start, distanceToTarget: distanceToTarget ?? null })
              return id
            } catch (err) {
              shotError(err)
              return null
            }
          }}
          onEditShot={(shotId) => {
            if (!activeHole || !activeHoleScore) return
            setShotsModalFor({
              holeScoreId: activeHoleScore.id,
              holeNumber: activeHole.number,
              holePar: resolvedHoleByNumber.get(activeHole.number)?.par ?? activeHole.par,
              shotId,
            })
          }}
          reviewSheet={
            activeHole ? (
              <>
                <HoleReviewSheet
                  open={reviewOpen}
                  holeNumber={activeHole.number}
                  // Tee-resolved par (round override, then tee override,
                  // then base — see resolveHole in @oga/core) for the
                  // active hole and the running total.
                  par={resolvedHoleByNumber.get(activeHole.number)?.par ?? activeHole.par}
                  totalPar={holes.reduce(
                    (s, h) => s + (resolvedHoleByNumber.get(h.number)?.par ?? h.par),
                    0,
                  )}
                  pinLat={effectivePin?.lat ?? null}
                  pinLng={effectivePin?.lng ?? null}
                  storedShots={activeHoleShots}
                  placedPoints={placedPoints}
                  saving={savingHole}
                  onEditOnMap={() => {
                    dispatchHoleView({ type: 'CLOSE_REVIEW' })
                    dispatchHoleView({ type: 'EDIT_ON_MAP', editing: true })
                  }}
                  onSave={saveReviewedHole}
                />
              </>
            ) : null
          }
        />
      )}
      {view === 'map' && roundKeys}

      {shotsModalFor && round.data && (() => {
        // Resolve pin for the modal's mini-map distance recalc. Per-round
        // override on hole_scores wins over the static holes-table pin,
        // matching the priority used by RoundMap and the live entry flow.
        const hsRow = (round.data.hole_scores as
          | Array<{
              id: string
              hole_id: string
              pin_lat: number | null
              pin_lng: number | null
            }>
          | undefined)?.find((h) => h.id === shotsModalFor.holeScoreId)
        const holeRow = holes.find((h) => h.id === hsRow?.hole_id)
        const pinLat = hsRow?.pin_lat ?? holeRow?.pin_lat ?? null
        const pinLng = hsRow?.pin_lng ?? holeRow?.pin_lng ?? null
        return (
          <ShotEntryModal
            roundId={round.data.id}
            holeScoreId={shotsModalFor.holeScoreId}
            holeNumber={shotsModalFor.holeNumber}
            holePar={shotsModalFor.holePar}
            pinLat={pinLat}
            pinLng={pinLng}
            liveEntry={isLiveEntry}
            editShotId={shotsModalFor.shotId}
            onClose={() => setShotsModalFor(null)}
          />
        )
      })()}
    </div>
  )
}

// Scorecard | Map as the paper rocker (mobile Paper.tsx Rocker, §19.1).
const VIEWS = [
  { value: 'scorecard', label: 'Scorecard' },
  { value: 'map', label: 'Map' },
] as const satisfies readonly { value: ViewMode; label: string }[]

// Re-export ScorecardView/MapView types for backwards compatibility if
// any caller imports from this file.
export type { RoundRow }
