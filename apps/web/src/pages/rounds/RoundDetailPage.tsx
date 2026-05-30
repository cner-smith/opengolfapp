import {
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ShotEntryModal } from '../../components/rounds/ShotEntryModal'
import { RoundSummary } from '../../components/rounds/RoundSummary'
import { ShareableScorecardCard } from '../../components/round/ShareableScorecardCard'
import { HoleReviewSheet } from '../../components/round/HoleReviewSheet'
import { WebPuttingSheet } from '../../components/round/WebPuttingSheet'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { haversineYards } from '@oga/core'
import { useAuth } from '../../hooks/useAuth'
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

type ViewMode = 'scorecard' | 'map'

export function RoundDetailPage() {
  const { id: roundId } = useParams()
  const navigate = useNavigate()
  const profile = useProfile()
  const { user } = useAuth()

  const [confirmDelete, setConfirmDelete] = useState(false)
  // "On the green?" confirmation. Holds the placed point while the
  // dialog is open. Cleared on either response — Yes pushes with the
  // putting sheet, No pushes without it.
  const [onGreenPrompt, setOnGreenPrompt] = useState<PlacedPoint | null>(null)
  // "Set an aim point?" prompt — opens after every non-putt PUSH_POINT
  // so the player decides explicitly whether this shot has aim data.
  // Replaces the easy-to-miss "Set aim" button on the strip as the
  // primary aim-collection moment. Putt placements skip it (putts
  // capture aim through the putting sheet's break/aim-offset fields).
  const [aimPromptOpen, setAimPromptOpen] = useState(false)
  // First-use hint shown the first time the player ever places an aim
  // point — explains that aim = start line, not finish target. Gated by
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
  } | null>(null)
  const [completeError, setCompleteError] = useState<string | null>(null)
  const [searchParams] = useSearchParams()
  // Live-round entries land on the map view directly so the user can
  // start dropping shots; everything else opens on the scorecard.
  const [view, setView] = useState<ViewMode>(() =>
    searchParams.get('view') === 'map' ? 'map' : 'scorecard',
  )
  // Capture "session started in live mode" at mount. `view` is a
  // runtime ViewTabs toggle — past-round reviewers can switch to the
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
    placedPutts,
    aimMode,
    puttingSheetForIdx,
    focusGreenSignal,
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
    effectivePin,
    courseFallbackLat,
    courseFallbackLng,
    activeHoleGeo,
    missingHoleLayout,
    activeHoleShots,
    allRounds,
  } = data

  const actions = useRoundActions({
    roundId,
    user,
    profile,
    data,
    isLiveEntry,
    pinOverride,
    teeOverride,
    placedAims,
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
    setOnGreenPrompt,
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
  const totalRoundsLogged = allRounds.data?.length ?? 0
  const switchHole = (n: number) =>
    dispatchHoleView({ type: 'SWITCH_HOLE', holeNumber: n })

  return (
    <div>
      <RoundHeader
        round={round.data as unknown as RoundRow & { courses?: { name?: string | null } | null }}
        tees={teesQuery.data ?? []}
        holesPlayed={holesPlayed}
        shareTone={shareTone}
        sharing={sharing}
        completePending={completeMutation.isPending}
        deletePending={deleteMutation.isPending}
        onBack={() => navigate('/rounds')}
        onShare={handleShare}
        onToggleShareTone={() =>
          setShareTone((t) => (t === 'light' ? 'dark' : 'light'))
        }
        onComplete={handleComplete}
        onConfirmDelete={() => setConfirmDelete(true)}
      />

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
            round={round.data}
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
        open={onGreenPrompt != null}
        title="On the green?"
        message="Within 30 yd of the pin — were you putting, or chipping/in a bunker?"
        confirmLabel="Yes, I'm putting"
        cancelLabel="No"
        onConfirm={() => {
          if (onGreenPrompt) {
            dispatchHoleView({
              type: 'PUSH_POINT',
              point: onGreenPrompt,
              openPuttSheet: true,
            })
          }
          setOnGreenPrompt(null)
        }}
        onCancel={() => {
          if (onGreenPrompt) {
            // Not putting (chip / bunker / fringe) — push as a normal shot
            // through the shared path so live entry auto-spawns the aim and
            // past-round entry gets the explicit aim prompt.
            placeHandlers.onConfirmNonPutt(onGreenPrompt)
          }
          setOnGreenPrompt(null)
        }}
      />

      <ConfirmDialog
        open={aimPromptOpen}
        title="Set an aim point?"
        message="Your aim point is your start line — where you intend to start the ball, not where you want it to finish."
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
          Aim point = start line. Drag to adjust.
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
          ensureRealHole={ensureRealHole}
          onEditShots={(args) => setShotsModalFor(args)}
        />
      ) : (
        <MapView
          holes={holes}
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
          focusGreenSignal={focusGreenSignal}
          puttingOpen={puttingSheetForIdx != null}
          pinOverride={pinOverride}
          teeOverride={teeOverride}
          placementMode={placementMode}
          handlers={placeHandlers}
          onMoveExistingShot={handleMoveExistingShot}
          onMoveExistingShotAim={handleMoveExistingShotAim}
          shotDragUndoLabel={shotDragUndo?.label ?? null}
          onApplyShotDragUndo={applyShotDragUndo}
          saveError={saveError}
          editingOnMap={editingOnMap}
          reviewSheet={
            activeHole ? (
              <>
                <HoleReviewSheet
                  open={reviewOpen}
                  holeNumber={activeHole.number}
                  par={activeHole.par}
                  totalPar={holes.reduce((s, h) => s + h.par, 0)}
                  pinLat={effectivePin?.lat ?? null}
                  pinLng={effectivePin?.lng ?? null}
                  placedPoints={placedPoints}
                  placedPutts={placedPutts}
                  saving={savingHole}
                  onEditOnMap={() => {
                    dispatchHoleView({ type: 'CLOSE_REVIEW' })
                    dispatchHoleView({ type: 'EDIT_ON_MAP', editing: true })
                  }}
                  onSave={saveReviewedHole}
                />
                {puttingSheetForIdx != null &&
                  placedPoints[puttingSheetForIdx] &&
                  effectivePin && (
                    <WebPuttingSheet
                      open
                      shotNumber={puttingSheetForIdx + 1}
                      initialDistanceFt={Math.round(
                        haversineYards(
                          placedPoints[puttingSheetForIdx]!.lat,
                          placedPoints[puttingSheetForIdx]!.lng,
                          effectivePin.lat,
                          effectivePin.lng,
                        ) * 3,
                      )}
                      initial={placedPutts[puttingSheetForIdx] ?? null}
                      onSave={(data) =>
                        dispatchHoleView({
                          type: 'SET_PUTT',
                          index: puttingSheetForIdx,
                          data,
                        })
                      }
                      onClose={() =>
                        dispatchHoleView({ type: 'CLOSE_PUTT_SHEET' })
                      }
                    />
                  )}
              </>
            ) : null
          }
        />
      )}

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
            onClose={() => setShotsModalFor(null)}
          />
        )
      })()}
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

// Re-export ScorecardView/MapView types for backwards compatibility if
// any caller imports from this file.
export type { RoundRow }
