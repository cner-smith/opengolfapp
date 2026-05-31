import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react'
import { haversineYards } from '@oga/core'
import type { Database } from '@oga/supabase'
import {
  RoundMapInstructionStrip,
  type ExistingShot,
  type HoleGeo,
  type PlacedPoint,
} from '../../../components/round/RoundMap'
import { useClubDispersion } from '../hooks/useClubDispersion'

// Lazy-load Mapbox GL JS only when the map tab is opened. Cuts ~2 MB off
// the initial bundle for users who never leave the scorecard.
const RoundMap = lazy(() =>
  import('../../../components/round/RoundMap').then((m) => ({
    default: m.RoundMap,
  })),
)

type HoleRow = Database['public']['Tables']['holes']['Row']

// Distance-rail presets, identical to the mobile shot-pattern rail. Tee = arc
// TOTAL width in yards (half each side of the aim line); Appr = circle DIAMETER
// in feet (greens are a feet game). Fixed golf-standard widths, not a club
// picker — shown in their native unit even on a meters profile (a metric preset
// set is a deferred follow-up, matching mobile).
const TEE_RAIL_YARDS = [95, 85, 75, 65] as const
const APPR_RAIL_FEET = [50, 36, 30, 24] as const
const FEET_PER_YARD = 3

interface MapViewProps {
  holes: HoleRow[]
  /** Current user id — feeds the dispersion-dots overlay's club history. */
  userId: string | undefined
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
  userId,
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

  // Shot-pattern overlay controls (Phase B). The toggle picks the SHAPE (tee
  // arc band / approach circle); the rail SIZES it. Kept per-mode so switching
  // modes preserves the other's pick. Map-scoped — resets to tee/widest if the
  // player bounces to the scorecard tab (negligible).
  const [overlayMode, setOverlayMode] = useState<'tee' | 'appr'>('tee')
  const [teeRailIdx, setTeeRailIdx] = useState(0)
  const [apprRailIdx, setApprRailIdx] = useState(0)
  const arcWidthYards = TEE_RAIL_YARDS[teeRailIdx] ?? TEE_RAIL_YARDS[0]
  const circleDiaFeet = APPR_RAIL_FEET[apprRailIdx] ?? APPR_RAIL_FEET[0]
  const circleRadiusYards = circleDiaFeet / 2 / FEET_PER_YARD
  const railLabels =
    overlayMode === 'tee'
      ? TEE_RAIL_YARDS.map((y) => `${y} yd`)
      : APPR_RAIL_FEET.map((f) => `${f} ft`)
  const railIndex = overlayMode === 'tee' ? teeRailIdx : apprRailIdx
  const selectRail = (i: number) =>
    overlayMode === 'tee' ? setTeeRailIdx(i) : setApprRailIdx(i)
  // Rail appears once an aim exists (placed or saved) and not during manual
  // tee/pin placement — mirrors the mobile gate.
  const overlayControlsVisible =
    placementMode == null &&
    (placedAims.some((a) => a != null) ||
      existingShots.some((s) => s.aimLat != null && s.aimLng != null))

  // Single-color dispersion-dots overlay (Phase C). One shot-history query per
  // session (memoized on userId); the dots only render once there's an active
  // aim and the matched club has enough samples. Left-edge toggle, always
  // present so the player can pre-arm it.
  const [dotsVisible, setDotsVisible] = useState(false)
  const { selectClub } = useClubDispersion(userId)
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
            overlayMode={overlayMode}
            arcWidthYards={arcWidthYards}
            circleRadiusYards={circleRadiusYards}
            dotsVisible={dotsVisible}
            selectClub={selectClub}
          />
        </Suspense>
        {reviewSheet}
        <DotsToggle
          active={dotsVisible}
          onToggle={() => setDotsVisible((v) => !v)}
        />
        {overlayControlsVisible && (
          <OverlayRail
            mode={overlayMode}
            onSetMode={setOverlayMode}
            railLabels={railLabels}
            railIndex={railIndex}
            onSelectRail={selectRail}
          />
        )}
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

// Right-edge shot-pattern controls (web parity of the mobile RightRail): a
// Tee/Appr shape toggle over a distance rail. Vertically centered on the
// windowed map and right-aligned, clear of Mapbox's bottom-right nav/zoom and
// attribution controls. Co-located (single caller).
function OverlayRail({
  mode,
  onSetMode,
  railLabels,
  railIndex,
  onSelectRail,
}: {
  mode: 'tee' | 'appr'
  onSetMode: (m: 'tee' | 'appr') => void
  railLabels: string[]
  railIndex: number
  onSelectRail: (i: number) => void
}) {
  const groupStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    padding: 3,
    borderRadius: 12,
    background: 'rgba(28,33,28,0.82)',
  }
  return (
    <div
      style={{
        position: 'absolute',
        right: 12,
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 10,
        zIndex: 5,
      }}
    >
      <div style={groupStyle}>
        <RailPill label="Tee" active={mode === 'tee'} onClick={() => onSetMode('tee')} />
        <RailPill label="Appr" active={mode === 'appr'} onClick={() => onSetMode('appr')} />
      </div>
      <div style={groupStyle}>
        {railLabels.map((label, i) => (
          <RailPill
            key={label}
            label={label}
            active={i === railIndex}
            onClick={() => onSelectRail(i)}
          />
        ))}
      </div>
    </div>
  )
}

// Left-edge dispersion-dots toggle (web parity of the mobile left-toolbar
// "grain" button). Always present so the player can pre-arm it; the dots only
// render once there's an active aim and the matched club has data. Vertically
// centered on the left, clear of the right-side rail.
function DotsToggle({
  active,
  onToggle,
}: {
  active: boolean
  onToggle: () => void
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 12,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 5,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={active}
        title="Toggle your shot-pattern dots"
        className="font-mono uppercase"
        style={{
          padding: '8px 12px',
          borderRadius: 12,
          border: 'none',
          cursor: 'pointer',
          background: active ? '#FBF8F1' : 'rgba(28,33,28,0.82)',
          color: active ? '#1C211C' : '#F2EEE5',
          fontSize: 10,
          fontWeight: active ? 700 : 500,
          letterSpacing: '0.12em',
        }}
      >
        Pattern
      </button>
    </div>
  )
}

function RailPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="font-mono tabular"
      style={{
        minWidth: 52,
        padding: '7px 12px',
        borderRadius: 9,
        border: 'none',
        cursor: 'pointer',
        background: active ? '#FBF8F1' : 'transparent',
        color: active ? '#1C211C' : '#F2EEE5',
        fontSize: 12,
        fontWeight: active ? 700 : 500,
        letterSpacing: '0.02em',
      }}
    >
      {label}
    </button>
  )
}
