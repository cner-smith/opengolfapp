import { Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  getExpectedStrokes,
  startCategory,
  haversineYards,
  type ShotMarkerCategory,
} from '@oga/core'
import type { Database } from '@oga/supabase'
import {
  MapBottomChrome,
  type ExistingShot,
  type HoleGeo,
  type PlacedPoint,
} from '../../../components/round/RoundMap'
import {
  chromeSurface,
  FooterKeys,
  HoleBlock,
  OverlayRail,
  P,
  PatternKey,
  StepperRow,
  type HoleResult,
} from '../../../components/round/map/PaperChrome'
import { useUnits } from '../../../hooks/useUnits'
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
  /** Player handicap index — calibrates the live expected-strokes / SG HUD. */
  handicap: number
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
  /** True when the session started in live mode. Gates the "Set pin"
   *  placement button off during live-aim (pin stays derived/dragged);
   *  it only appears while logging or editing a past round. */
  isLiveEntry: boolean
  pinOverride: PlacedPoint | null
  /** The round has its own pin here (hole_scores), so the flag draws strong. */
  roundPinSet: boolean
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
   *  edit exists. Drives the Undo affordance on the logged-hole chrome. */
  shotDragUndoLabel: string | null
  onApplyShotDragUndo: () => void
  reviewSheet?: ReactNode
  /** The active hole's hole_scores row, for the score corner. */
  holeScore: { score: number | null; putts: number | null } | null
  /** A Remove or Add shot is saving. */
  shotBusy: boolean
  onRemoveShot: (shotId: string) => void
  /** Resolves to the new shot's id, or null if the save failed. */
  onAddShot: (afterShotId: string, start: PlacedPoint) => Promise<string | null>
  onEditShot: (shotId: string) => void
}


// "142.9 yd" → { value: '142.9', unit: 'yd' }
function splitDisplay(s: string): { value: string; unit: string } {
  const i = s.lastIndexOf(' ')
  return i < 0 ? { value: s, unit: '' } : { value: s.slice(0, i), unit: s.slice(i + 1) }
}

export function MapView({
  holes,
  userId,
  handicap,
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
  isLiveEntry,
  pinOverride,
  roundPinSet,
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
  holeScore,
  shotBusy,
  onRemoveShot,
  onAddShot,
  onEditShot,
}: MapViewProps) {
  const { toDisplay, toDisplayFt } = useUnits()
  // Notice banner sits above the map when the active hole has no tee
  // or pin coords. Dismiss state resets on every hole switch so the
  // player isn't surprised by a missing-data hole later in the round.
  const [noticeDismissed, setNoticeDismissed] = useState(false)
  useEffect(() => {
    setNoticeDismissed(false)
  }, [activeHoleNumber])

  // The map is the whole screen on mobile; here the frame is sized to the
  // viewport, so bring it to the top when the Map tab opens.
  const frameRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    frameRef.current?.scrollIntoView({ block: 'start' })
  }, [])

  // Shot-pattern overlay controls (Phase B). The toggle picks the SHAPE (tee
  // arc band / approach circle); the rail SIZES it. Kept per-mode so switching
  // modes preserves the other's pick.
  const [overlayMode, setOverlayMode] = useState<'tee' | 'appr'>('tee')
  const [teeRailIdx, setTeeRailIdx] = useState(0)
  const [apprRailIdx, setApprRailIdx] = useState(0)
  const arcWidthYards = TEE_RAIL_YARDS[teeRailIdx] ?? TEE_RAIL_YARDS[0]
  const circleDiaFeet = APPR_RAIL_FEET[apprRailIdx] ?? APPR_RAIL_FEET[0]
  const circleRadiusYards = circleDiaFeet / 2 / FEET_PER_YARD
  const railIndex = overlayMode === 'tee' ? teeRailIdx : apprRailIdx
  const selectRail = (i: number) =>
    overlayMode === 'tee' ? setTeeRailIdx(i) : setApprRailIdx(i)

  // Pattern key (Phase C dots + the overlay). Off by default so a reviewed
  // hole reads as clean as mobile's; on, it shows the arc/circle and dots.
  const [dotsVisible, setDotsVisible] = useState(false)
  const { selectClub } = useClubDispersion(userId)
  const hasExistingShots = existingShots.some(
    (s) => s.endLat != null && s.endLng != null,
  )
  // The selected saved shot (#1217): the last one until the player picks
  // another, reset on every hole. None while placing new shots.
  const steps = existingShots
    .filter((s) => s.startLat != null && s.startLng != null)
    .sort((a, b) => a.shotNumber - b.shotNumber)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // "+ Add shot": the next map tap is the new shot's start.
  const [adding, setAdding] = useState(false)
  useEffect(() => {
    setSelectedId(null)
    setAdding(false)
  }, [activeHoleNumber])
  const found = steps.findIndex((s) => s.id === selectedId)
  const stepPos = found >= 0 ? found : steps.length - 1
  const selected = placedPoints.length === 0 ? steps[stepPos] ?? null : null
  const step = (d: number) => setSelectedId(steps[stepPos + d]?.id ?? null)
  // Review = a saved hole with a selected shot: the paper footer replaces
  // the logging chrome.
  const review = selected != null && !editingOnMap && placementMode == null
  const placeAdded = (p: PlacedPoint) => {
    const last = steps[steps.length - 1]
    setAdding(false)
    if (last) void onAddShot(last.id, p).then((id) => id && setSelectedId(id))
  }

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
  // The tee is derived from the first shot (not placed manually); this flag
  // is retained only for the existing chrome plumbing.
  const needsTee = activeHoleGeo != null && effectiveTee == null
  // "Set pin" is available while logging or editing a PAST round on a
  // geo-anchored hole — shown even when a pin coord already exists so the
  // player can override a wrong crawled pin. Hidden during live-aim.
  const showPinButton = !isLiveEntry && activeHoleGeo != null
  const remainingToPin =
    lastPoint && effectivePin
      ? Math.round(
          haversineYards(lastPoint.lat, lastPoint.lng, effectivePin.lat, effectivePin.lng),
        )
      : null

  // Hole block hero (§19.2): To the pin from the SELECTED shot's start (the
  // stepper's shot in review, the last placed ball while logging), and the
  // expected strokes to hole out from there. A putt reads in feet.
  const par = activeHoleGeo?.par ?? null
  const heroStart = selected
    ? { lat: selected.startLat!, lng: selected.startLng! }
    : lastPoint
  const heroYards =
    heroStart && effectivePin
      ? haversineYards(heroStart.lat, heroStart.lng, effectivePin.lat, effectivePin.lng)
      : null
  const heroTee =
    (par === 4 || par === 5) &&
    (selected ? selected.shotNumber === 1 : placedPoints.length === 1 && existingShots.length === 0)
  const heroFeet = selected?.category === 'putt' && heroYards != null ? heroYards * 3 : null
  const heroDistance =
    heroFeet != null
      ? splitDisplay(toDisplayFt(heroFeet))
      : heroYards == null
        ? null
        : splitDisplay(toDisplay(heroYards, 1))
  const expected =
    heroFeet != null
      ? getExpectedStrokes('putting', undefined, heroFeet, handicap)
      : heroYards == null
        ? null
        : getExpectedStrokes(startCategory(heroYards, heroTee), Math.round(heroYards), undefined, handicap)
  const score = holeScore?.score ?? 0
  const result: HoleResult =
    score > 0
      ? { scored: true, score, toPar: par != null ? score - par : null, putts: holeScore?.putts ?? null }
      : { scored: false, shots: placedPoints.length }

  // Leg length of each saved shot: its start to the next start, or the pin.
  const legOf = (i: number): string | null => {
    const s = steps[i]
    if (!s) return null
    const nx = steps[i + 1]
    const end = nx ? { lat: nx.startLat!, lng: nx.startLng! } : effectivePin
    if (!end) return null
    const yd = haversineYards(s.startLat!, s.startLng!, end.lat, end.lng)
    return s.category === 'putt' ? toDisplayFt(yd * 3) : toDisplay(yd, 1)
  }

  const overlayControlsVisible =
    placementMode == null &&
    (review
      ? dotsVisible && selected?.aimLat != null
      : placedAims.some((a) => a != null))
  const mapKeysBottom = review ? 34 : 128

  return (
    <div>
      {missingHoleLayout && !noticeDismissed && (
        <div
          role="status"
          className="paper-tile"
          style={{ marginBottom: 14, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 14 }}
        >
          <div style={{ flex: 1, fontSize: 14, lineHeight: 1.4 }}>
            <span className="font-serif" style={{ fontStyle: 'italic', fontSize: 17 }}>
              No hole layout here.
            </span>{' '}
            You can still place shots on the map.
          </div>
          <button type="button" className="key" onClick={() => setNoticeDismissed(true)} style={{ fontWeight: 400 }}>
            Dismiss
          </button>
        </div>
      )}
      <div
        ref={frameRef}
        className={[
          // Edge to edge on a phone, as the app; a framed panel on desktop.
          'grid -mx-4 lg:mx-0 border-y lg:border lg:rounded-[3px] border-caddie-ink scroll-mt-[52px] lg:scroll-mt-6',
          "[grid-template-areas:'hole'_'map'_'foot'] grid-rows-[auto_1fr_auto]",
          "lg:[grid-template-areas:'hole_map'_'list_map'_'foot_map'] lg:grid-cols-[400px_1fr]",
          'h-[calc(100dvh-112px)] min-h-[560px] lg:h-[calc(100vh-48px)] lg:min-h-[640px] lg:max-h-[980px]',
        ].join(' ')}
        style={{ overflow: 'hidden', background: P.chrome }}
      >
        <div
          className="lg:border-r border-caddie-ink"
          style={{ gridArea: 'hole', ...chromeSurface, borderBottom: `1px solid ${P.ink}` }}
        >
          <HoleBlock
            holeNumber={activeHoleNumber}
            holeCount={holes.length}
            par={par}
            yardsLabel={activeHoleGeo?.yards ? toDisplay(activeHoleGeo.yards) : null}
            result={result}
            distance={heroDistance}
            expected={expected}
            onPrev={() => onSwitchHole(activeHoleNumber - 1)}
            onNext={() => onSwitchHole(activeHoleNumber + 1)}
          />
        </div>
        <div
          className="hidden lg:flex flex-col lg:border-r border-caddie-ink min-h-0"
          style={{ gridArea: 'list', ...chromeSurface }}
        >
          <ShotList
            steps={steps}
            legOf={legOf}
            selectedId={review ? selected?.id ?? null : null}
            onSelect={setSelectedId}
          />
          <HolePicker holes={holes} activeNumber={activeHoleNumber} onSelect={onSwitchHole} />
          <div style={{ flex: 1 }} />
        </div>
        <div style={{ gridArea: 'map', position: 'relative', minHeight: 0 }}>
          <Suspense fallback={<MapLoading />}>
            <RoundMap
              hole={activeHoleGeo}
              courseLat={courseLat}
              courseLng={courseLng}
              existingShots={existingShots}
              placedPoints={placedPoints}
              placedAims={placedAims}
              aimMode={aimMode}
              pinOverride={pinOverride}
              roundPinSet={roundPinSet}
              teeOverride={teeOverride}
              tapToPlaceDisabled={editingOnMap}
              placementMode={placementMode}
              addingShot={adding}
              onPlace={adding ? placeAdded : handlers.onPlace}
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
              handicap={handicap}
              selectedShotId={selected?.id ?? null}
              onSelectShot={setSelectedId}
            />
          </Suspense>
          {reviewSheet}
          {placementMode == null && (
            <PatternKey active={dotsVisible} onToggle={() => setDotsVisible((v) => !v)} bottom={mapKeysBottom} />
          )}
          {overlayControlsVisible && (
            <OverlayRail
              mode={overlayMode}
              onSetMode={setOverlayMode}
              values={overlayMode === 'tee' ? TEE_RAIL_YARDS : APPR_RAIL_FEET}
              unit={overlayMode === 'tee' ? 'yd' : 'ft'}
              index={railIndex}
              onSelect={selectRail}
              bottom={mapKeysBottom}
            />
          )}
          {!review && (
            <MapBottomChrome
              hasExistingShots={hasExistingShots}
              editing={editingOnMap}
              shotsPlaced={placedPoints.length}
              remainingToPin={remainingToPin}
              pinAvailable={effectivePin != null}
              aimMode={aimMode}
              aimsSet={placedAims.filter((a) => a != null).length}
              holeNumber={activeHoleNumber}
              needsTee={needsTee}
              showPinButton={showPinButton}
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
          )}
        </div>
        <div
          className="lg:border-r border-caddie-ink"
          style={{ gridArea: 'foot', ...chromeSurface, borderTop: `1px solid ${P.ink}`, padding: '0 12px 10px' }}
        >
          {review && selected ? (
            <>
              <StepperRow
                pos={stepPos}
                count={steps.length}
                summary={selected.summary || 'No details yet. Tap Edit to add them.'}
                onPrev={() => step(-1)}
                onNext={() => step(1)}
              />
              {shotDragUndoLabel && (
                <div style={{ fontSize: 14, textAlign: 'center', paddingBottom: 8 }}>
                  {shotDragUndoLabel} moved.{' '}
                  <button
                    type="button"
                    onClick={onApplyShotDragUndo}
                    className="font-serif"
                    style={{ fontStyle: 'italic', fontSize: 17, textDecoration: 'underline', background: 'none', border: 'none', padding: 0 }}
                  >
                    Undo
                  </button>
                </div>
              )}
              {adding ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 3 }}>
                  <span style={{ flex: 1, fontSize: 14 }}>
                    <span className="font-serif" style={{ fontStyle: 'italic', fontSize: 17 }}>
                      Tap the map
                    </span>{' '}
                    where you hit shot {steps.length + 1} from.
                  </span>
                  <button type="button" className="key" onClick={() => setAdding(false)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <FooterKeys
                  n={stepPos + 1}
                  isLast={stepPos === steps.length - 1}
                  busy={shotBusy}
                  onRemove={() => onRemoveShot(selected.id)}
                  onAdd={() => setAdding(true)}
                  onEdit={() => onEditShot(selected.id)}
                />
              )}
            </>
          ) : (
            <div style={{ minHeight: 10 }} />
          )}
        </div>
      </div>
      {saveError && (
        <div
          className="text-caddie-neg"
          style={{ border: '1px solid #A33A2A', borderRadius: 3, padding: '12px 14px', fontSize: 13, marginTop: 14 }}
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

const CATEGORY_LABEL: Record<ShotMarkerCategory, string> = {
  tee: 'Tee shot',
  approach: 'Approach',
  'around-green': 'Around the green',
  putt: 'Putt',
}

// Desktop's printed column (MAP-09): the stepper's long form. Each row is the
// map's plate, what the shot was, and how far it went; the selected row sits
// pressed in.
function ShotList({
  steps,
  legOf,
  selectedId,
  onSelect,
}: {
  steps: ExistingShot[]
  legOf: (i: number) => string | null
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div style={{ flex: '0 1 auto', minHeight: 0, overflowY: 'auto', padding: '14px 0 8px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 16px 8px' }}>
        <span className="font-serif" style={{ fontStyle: 'italic', fontWeight: 500, fontSize: 18 }}>
          Your shots
        </span>
        {steps.length > 0 && (
          <span style={{ fontSize: 12, color: P.inkDim }}>tap one to see it on the map</span>
        )}
      </div>
      {steps.length === 0 ? (
        <div style={{ fontSize: 14, padding: '6px 16px', color: P.inkDim }}>No shots logged for this hole yet.</div>
      ) : (
        <div style={{ borderTop: `1px solid ${P.line}` }}>
          {steps.map((s, i) => {
            const on = s.id === selectedId
            const leg = legOf(i)
            const [v, u] = leg ? [leg.slice(0, leg.lastIndexOf(' ')), leg.slice(leg.lastIndexOf(' ') + 1)] : [null, null]
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelect(s.id)}
                aria-current={on}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  minHeight: 56,
                  padding: '6px 16px 6px 14px',
                  textAlign: 'left',
                  border: 'none',
                  borderBottom: `1px solid ${P.line}`,
                  borderLeft: `2px solid ${on ? P.ink : 'transparent'}`,
                  background: on ? P.well : 'transparent',
                  boxShadow: on ? 'inset 0 2px 0 rgba(28,33,28,.12)' : 'none',
                  cursor: 'pointer',
                  color: P.ink,
                }}
              >
                <span
                  style={{
                    minWidth: 24,
                    height: 24,
                    padding: '0 5px',
                    boxSizing: 'border-box',
                    borderRadius: 3,
                    border: `1px solid ${P.ink}`,
                    background: s.ob ? P.neg : on ? P.ink : P.raised,
                    color: s.ob || on ? P.raised : P.ink,
                    fontFamily: 'var(--caddie-serif)',
                    fontStyle: 'italic',
                    fontSize: 16,
                    lineHeight: '22px',
                    textAlign: 'center',
                    flexShrink: 0,
                  }}
                >
                  {s.shotNumber}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15, lineHeight: '19px', fontWeight: on ? 600 : 400 }}>
                    {CATEGORY_LABEL[s.category ?? 'approach']}
                    {s.ob === true && <span style={{ color: P.neg }}> · out of bounds</span>}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 12,
                      lineHeight: '16px',
                      color: P.inkDim,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {s.summary || 'No details yet'}
                  </span>
                </span>
                {v && (
                  <span style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                    <span className="font-serif" style={{ fontStyle: 'italic', fontWeight: 500, fontSize: 19 }}>
                      {v}
                    </span>
                    <span className="font-mono" style={{ fontSize: 12, marginLeft: 3 }}>
                      {u}
                    </span>
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Desktop jump-to-hole grid under the shot list (phones step with ‹ ›).
function HolePicker({
  holes,
  activeNumber,
  onSelect,
}: {
  holes: HoleRow[]
  activeNumber: number
  onSelect: (n: number) => void
}) {
  return (
    <div style={{ padding: '14px 16px' }}>
      <div className="font-serif" style={{ fontStyle: 'italic', fontWeight: 500, fontSize: 16, marginBottom: 8 }}>
        Holes
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 4 }}>
        {holes.map((h) => {
          const on = h.number === activeNumber
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => onSelect(h.number)}
              aria-pressed={on}
              title={`Hole ${h.number} · Par ${h.par}`}
              style={{
                height: 30,
                borderRadius: 3,
                border: on ? `2px solid ${P.ink}` : `1px solid ${P.line}`,
                background: on ? P.well : P.raised,
                fontSize: 13,
                fontWeight: on ? 600 : 400,
                color: P.ink,
                cursor: 'pointer',
              }}
            >
              {h.number}
            </button>
          )
        })}
      </div>
    </div>
  )
}
