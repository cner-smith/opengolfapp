import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react'
import { haversineYards } from '@oga/core'
import type { Database } from '@oga/supabase'
import {
  RoundMapInstructionStrip,
  type ExistingShot,
  type HoleGeo,
  type PlacedPoint,
} from '../../../components/round/RoundMap'

// Lazy-load Mapbox GL JS only when the map tab is opened. Cuts ~2 MB off
// the initial bundle for users who never leave the scorecard.
const RoundMap = lazy(() =>
  import('../../../components/round/RoundMap').then((m) => ({
    default: m.RoundMap,
  })),
)

type HoleRow = Database['public']['Tables']['holes']['Row']

interface MapViewProps {
  holes: HoleRow[]
  activeHoleNumber: number
  onSwitchHole: (n: number) => void
  activeHoleGeo: HoleGeo | null
  /** Course-level lat/lng — passed to RoundMap as a direct prop so the
   *  camera can fall back to the course centroid even when activeHoleGeo
   *  is null (course rows with no entries in the holes table). */
  courseLat: number | null
  courseLng: number | null
  existingShots: ExistingShot[]
  placedPoints: PlacedPoint[]
  placedAims: (PlacedPoint | null)[]
  aimMode: boolean
  /** True when the active hole has neither tee nor pin coordinates in
   *  the DB — drives the dismissable notice banner above the map. */
  missingHoleLayout: boolean
  /** True while the putting sheet is open — suppresses tap-to-place so
   *  taps that hit the map under the sheet don't drop new shots. */
  puttingOpen: boolean
  /** Bumped after a non-holed putt save so RoundMap zooms to the green
   *  for the next putt placement. */
  focusGreenSignal: number
  pinOverride: PlacedPoint | null
  teeOverride: PlacedPoint | null
  /** Active manual-placement mode for courses missing hole layout. */
  placementMode: 'tee' | 'pin' | null
  handlers: {
    onPlace: (p: PlacedPoint) => void
    onMovePoint: (idx: number, p: PlacedPoint) => void
    onMovePin: (p: PlacedPoint) => void
    onMoveTee: (p: PlacedPoint) => void
    onClearPoints: () => void
    onUndoPoint: () => void
    onSetAim: (idx: number, p: PlacedPoint | null) => void
    onToggleAimMode: (on: boolean) => void
    onStartPlaceTee: () => void
    onStartPlacePin: () => void
    onCancelPlacement: () => void
    onDoneWithHole: () => void
    onDoneEditing: () => void
  }
  saveError: string | null
  editingOnMap: boolean
  /** Drag-end on a saved shot's start marker. Forwarded to RoundMap. */
  onMoveExistingShot: (shotId: string, point: PlacedPoint) => void
  /** Drag-end on a saved shot's aim ghost. */
  onMoveExistingShotAim: (shotId: string, point: PlacedPoint) => void
  /** Label for the most recent saved-shot drag, or null when no recent
   *  edit exists. Drives the Undo affordance on the logged-hole strip. */
  shotDragUndoLabel: string | null
  onApplyShotDragUndo: () => void
  reviewSheet?: ReactNode
}

export function MapView({
  holes,
  activeHoleNumber,
  onSwitchHole,
  activeHoleGeo,
  courseLat,
  courseLng,
  existingShots,
  placedPoints,
  placedAims,
  aimMode,
  missingHoleLayout,
  puttingOpen,
  focusGreenSignal,
  pinOverride,
  teeOverride,
  placementMode,
  handlers,
  onMoveExistingShot,
  onMoveExistingShotAim,
  shotDragUndoLabel,
  onApplyShotDragUndo,
  saveError,
  editingOnMap,
  reviewSheet,
}: MapViewProps) {
  // Notice banner sits above the map when the active hole has no tee
  // or pin coords. Dismiss state resets on every hole switch so the
  // player isn't surprised by a missing-data hole later in the round.
  const [noticeDismissed, setNoticeDismissed] = useState(false)
  useEffect(() => {
    setNoticeDismissed(false)
  }, [activeHoleNumber])
  const hasExistingShots = existingShots.some(
    (s) => s.endLat != null && s.endLng != null,
  )
  const lastPoint = placedPoints[placedPoints.length - 1] ?? null
  const effectivePin =
    pinOverride ??
    (activeHoleGeo?.pinLat != null && activeHoleGeo?.pinLng != null
      ? { lat: activeHoleGeo.pinLat, lng: activeHoleGeo.pinLng }
      : null)
  const effectiveTee =
    teeOverride ??
    (activeHoleGeo?.teeLat != null && activeHoleGeo?.teeLng != null
      ? { lat: activeHoleGeo.teeLat, lng: activeHoleGeo.teeLng }
      : null)
  // Manual placement entry points only render when the active hole has
  // no coord for that target. Tee/pin both null = course w/o hole layout.
  const needsTee = activeHoleGeo != null && effectiveTee == null
  const needsPin = activeHoleGeo != null && effectivePin == null
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
      {missingHoleLayout && !noticeDismissed && (
        <div
          role="status"
          style={{
            marginTop: 14,
            padding: '10px 14px',
            background: '#FBF8F1',
            border: '1px solid #D9D2BF',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 14,
          }}
        >
          <div style={{ flex: 1 }}>
            <div className="kicker" style={{ marginBottom: 4 }}>
              No hole layout
            </div>
            <div
              className="text-caddie-ink-dim"
              style={{ fontSize: 13, lineHeight: 1.4 }}
            >
              No hole layout data for this course. You can still place
              shots manually.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setNoticeDismissed(true)}
            aria-label="Dismiss notice"
            className="font-mono uppercase text-caddie-ink-mute hover:text-caddie-ink"
            style={{
              fontSize: 10,
              letterSpacing: '0.14em',
              background: 'transparent',
              border: 'none',
              padding: 4,
            }}
          >
            Dismiss
          </button>
        </div>
      )}
      <div style={{ marginTop: 14 }}>
        <RoundMapInstructionStrip
          hasExistingShots={hasExistingShots}
          editing={editingOnMap}
          shotsPlaced={placedPoints.length}
          remainingToPin={remainingToPin}
          pinAvailable={effectivePin != null}
          aimMode={aimMode}
          aimsSet={placedAims.filter((a) => a != null).length}
          holeNumber={activeHoleNumber}
          needsTee={needsTee}
          needsPin={needsPin}
          placementMode={placementMode}
          shotDragUndoLabel={shotDragUndoLabel}
          onApplyShotDragUndo={onApplyShotDragUndo}
          onStartPlaceTee={handlers.onStartPlaceTee}
          onStartPlacePin={handlers.onStartPlacePin}
          onCancelPlacement={handlers.onCancelPlacement}
          onToggleAimMode={handlers.onToggleAimMode}
          onClearLastAim={() => {
            const idx = placedAims.length - 1
            if (idx >= 0) handlers.onSetAim(idx, null)
          }}
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
            courseLat={courseLat}
            courseLng={courseLng}
            existingShots={existingShots}
            placedPoints={placedPoints}
            placedAims={placedAims}
            aimMode={aimMode}
            focusGreenSignal={focusGreenSignal}
            pinOverride={pinOverride}
            teeOverride={teeOverride}
            tapToPlaceDisabled={editingOnMap || puttingOpen}
            placementMode={placementMode}
            onPlace={handlers.onPlace}
            onMovePoint={handlers.onMovePoint}
            onMovePin={handlers.onMovePin}
            onMoveTee={handlers.onMoveTee}
            onSetAim={handlers.onSetAim}
            onMoveExistingShot={onMoveExistingShot}
            onMoveExistingShotAim={onMoveExistingShotAim}
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
