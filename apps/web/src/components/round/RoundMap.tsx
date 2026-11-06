import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { DEFAULT_HANDICAP, wayfinder, type ShotMarkerCategory, type Wayfinder } from '@oga/core'
import type mapboxgl from 'mapbox-gl'
import { useUnits } from '../../hooks/useUnits'
import { MAPBOX_TOKEN_PRESENT } from '../../lib/mapbox'
import { useMapSetup } from './map/useMapSetup'
import { useMapLayers, type ClubPick } from './map/useMapLayers'
import { useGreenLayers } from './map/useGreenLayers'
import type { GreenData, GreenViewMode } from './green/useGreenMap'

// Re-export the map bottom chrome so existing imports
// (`{ MapBottomChrome } from '.../RoundMap'`) keep working.
export { MapBottomChrome } from './map/MapBottomChrome'

// Stable no-op default for the optional `selectClub` prop. A module constant so
// the identity never changes — an inline `() => null` default would be a fresh
// function each render and, since selectClub is in useMapLayers' renderLayers
// dependency array, would tear down + rebuild every marker on each parent render.
const NO_CLUB_PICK: (distanceToTargetYards: number | null) => ClubPick | null =
  () => null

export interface HoleGeo {
  id: string
  number: number
  par: number
  yards: number | null
  teeLat: number | null
  teeLng: number | null
  pinLat: number | null
  pinLng: number | null
  /** Course-level fallback coordinates. Used as the camera target when
   *  the hole has no tee/pin coords (most courses pre-OSM-import). The
   *  map zooms out to ~15 in that case so the player sees the whole
   *  property and can still tap to place shots manually. */
  courseLat?: number | null
  courseLng?: number | null
}

export interface ExistingShot {
  id: string
  shotNumber: number
  endLat: number | null
  endLng: number | null
  startLat: number | null
  startLng: number | null
  aimLat?: number | null
  aimLng?: number | null
  category?: ShotMarkerCategory | null
  /** Out-of-bounds flag (#839) — recolors the map marker + draws the badge
   *  ring in useMapLayers. */
  ob?: boolean | null
  /** Penalty-stroke flag. Read (not re-derived) so saveReviewedHole's
   *  replace-all rewrite can preserve it — see useRoundActions. */
  penalty?: boolean | null
  /** Club type, for the selected shot's callout (#1217). */
  club?: string | null
  /** One-line summary for the shot stepper ("pw · fairway · 132 yd to the pin"). */
  summary?: string
}

export interface PlacedPoint {
  lat: number
  lng: number
}

interface RoundMapProps {
  hole: HoleGeo | null
  /** Course-level lat/lng — direct prop, independent of `hole`.
   *  Surfaces course centroid even when `hole` is null (e.g. courses
   *  with no rows in the holes table). HoleGeo.courseLat/courseLng
   *  is still honoured but only as a secondary read. */
  courseLat?: number | null
  courseLng?: number | null
  /** Pre-existing shots (live-tracked or previously saved). */
  existingShots: ExistingShot[]
  /** Tap-placed points for the active hole when no existing shots are
   *  logged. The parent owns this state so it can persist across
   *  re-renders and feed the review sheet. */
  placedPoints: PlacedPoint[]
  /** Aim point per placed shot, parallel to placedPoints. Null when the
   *  user hasn't set an aim for that shot. Required to feed dispersion
   *  analysis — captured rather than inferred. */
  placedAims?: (PlacedPoint | null)[]
  /** When true, the next map tap sets aim for the most recently placed
   *  shot instead of pushing a new shot start marker. */
  aimMode?: boolean
  /** Local override for the pin and tee positions while the user is
   *  reviewing a hole. When set, these win over the values inside
   *  `hole.pinLat/pinLng` / `hole.teeLat/teeLng`. */
  pinOverride?: PlacedPoint | null
  /** The round's own pin (hole_scores) — strong flag like mobile, not dim. */
  roundPinSet?: boolean
  teeOverride?: PlacedPoint | null
  /** Suppress tap-to-place. Used in "Edit on map" mode so the user can
   *  drag existing markers without accidentally dropping new ones. */
  tapToPlaceDisabled?: boolean
  /** "+ Add shot" on a saved hole: the next tap is the new shot's start. */
  addingShot?: boolean
  /** When set, the next map tap places either the tee box or pin for
   *  this hole instead of dropping a shot marker. Used for courses with
   *  no hole layout in the DB so the player can mark them manually. */
  placementMode?: 'tee' | 'pin' | null
  onPlace: (point: PlacedPoint) => void
  onMovePoint: (index: number, point: PlacedPoint) => void
  onMovePin?: (point: PlacedPoint) => void
  onMoveTee?: (point: PlacedPoint) => void
  onSetAim?: (index: number, point: PlacedPoint | null) => void
  /** Drag end on a saved shot's start marker. When wired, saved shot
   *  markers become draggable so the player can correct positions
   *  after a hole is logged. */
  onMoveExistingShot?: (shotId: string, point: PlacedPoint) => void
  /** Drag end on a saved shot's aim ghost. When wired (and the shot has
   *  aim coords), the aim marker becomes draggable. */
  onMoveExistingShotAim?: (shotId: string, point: PlacedPoint) => void
  /** Shot-pattern overlay (Phase B), anchored on the active aimed shot.
   *  Mode picks the shape (tee arc / approach circle); the rail-derived
   *  sizes feed the geometry. */
  overlayMode?: 'tee' | 'appr'
  arcWidthYards?: number
  circleRadiusYards?: number
  /** Single-color dispersion-dots overlay (Phase C). Toggle + club picker. */
  dotsVisible?: boolean
  selectClub?: (distanceToTargetYards: number | null) => ClubPick | null
  /** Player handicap index — feeds the live best-case-SG readout (Phase D). */
  handicap?: number
  /** The selected saved shot and a click on another one (#1217). */
  selectedShotId?: string | null
  onSelectShot?: (shotId: string) => void
  /** The green overlay (#1380): drawn while the Green key is on; pace lines whenever switched on. */
  green?: {
    data: GreenData | null
    mode: GreenViewMode
    show: boolean
    paceLines: PlacedPoint[][]
    approachDeg: number
    /** The green view's flag is held: only the outline stays (#1385). */
    held?: boolean
  }
  /** Bumped when the green view moves the pin, so the camera stays put as it does for a map drag. */
  pinMovedInView?: number
  /** The player's ball (the hero's start): the wayfinder points at it from the green (#1386). */
  ball?: PlacedPoint | null
}

const NO_GREEN: NonNullable<RoundMapProps['green']> = { data: null, mode: 'plain', show: false, paceLines: [], approachDeg: 0 }

export function RoundMap({
  hole,
  courseLat,
  courseLng,
  existingShots,
  placedPoints,
  placedAims,
  aimMode,
  pinOverride,
  roundPinSet = false,
  teeOverride,
  tapToPlaceDisabled,
  addingShot = false,
  placementMode,
  onPlace,
  onMovePoint,
  onMovePin,
  onMoveTee,
  onSetAim,
  onMoveExistingShot,
  onMoveExistingShotAim,
  overlayMode = 'tee',
  arcWidthYards = 0,
  circleRadiusYards = 0,
  dotsVisible = false,
  selectClub = NO_CLUB_PICK,
  handicap = DEFAULT_HANDICAP,
  selectedShotId = null,
  onSelectShot,
  green = NO_GREEN,
  pinMovedInView = 0,
  ball = null,
}: RoundMapProps) {
  // Memoized so downstream effects can dep on the object directly without
  // thrashing on every parent render — coords are the only meaningful
  // identity here.
  const effectivePin = useMemo<PlacedPoint | null>(() => {
    const lat = pinOverride?.lat ?? hole?.pinLat ?? null
    const lng = pinOverride?.lng ?? hole?.pinLng ?? null
    if (lat == null || lng == null) return null
    return { lat, lng }
  }, [pinOverride?.lat, pinOverride?.lng, hole?.pinLat, hole?.pinLng])
  const effectiveTee = useMemo<PlacedPoint | null>(() => {
    const lat = teeOverride?.lat ?? hole?.teeLat ?? null
    const lng = teeOverride?.lng ?? hole?.teeLng ?? null
    if (lat == null || lng == null) return null
    return { lat, lng }
  }, [teeOverride?.lat, teeOverride?.lng, hole?.teeLat, hole?.teeLng])
  const containerRef = useRef<HTMLDivElement>(null)

  // Gates tap-to-place: a saved hole ignores taps unless a shot is being added.
  const hasExistingShots =
    !addingShot && existingShots.some((s) => s.endLat != null && s.endLng != null)
  // Course centroid resolves from a direct prop first (so a course
  // with zero rows in the holes table — and therefore a null `hole`
  // — still drops the camera on the property), and only falls back
  // to the optional HoleGeo.courseLat/Lng for callers that haven't
  // adopted the direct props yet.
  const effectiveCourseLat = courseLat ?? hole?.courseLat ?? null
  const effectiveCourseLng = courseLng ?? hole?.courseLng ?? null

  // Single camera target with priority order: hole tee → hole pin →
  // course centroid → hard-coded OKC default. Course rows missing
  // lat/lng entirely fall to OKC zoom 11 so the player isn't stranded
  // at the world view if every tier comes back null. useMemo gives a
  // stable identity when the underlying coords don't change, so the
  // camera effect below only fires when something actually moved.
  const cameraTarget = useMemo<{
    center: [number, number]
    zoom: number
  }>(() => {
    if (effectiveTee) {
      return { center: [effectiveTee.lng, effectiveTee.lat], zoom: 17 }
    }
    if (effectivePin) {
      return { center: [effectivePin.lng, effectivePin.lat], zoom: 15 }
    }
    if (effectiveCourseLat != null && effectiveCourseLng != null) {
      return { center: [effectiveCourseLng, effectiveCourseLat], zoom: 15 }
    }
    return { center: [-97.5, 35.5], zoom: 11 }
  }, [
    effectiveTee?.lat,
    effectiveTee?.lng,
    effectivePin?.lat,
    effectivePin?.lng,
    effectiveCourseLat,
    effectiveCourseLng,
  ])

  const { mapRef, mapLoaded, userPlacedRef, mapFailed } = useMapSetup({
    containerRef,
    cameraTarget,
    effectivePin,
    effectiveTee,
    placementMode,
    hasExistingShots,
    tapToPlaceDisabled,
    aimMode,
    placedPointsCount: placedPoints.length,
    onPlace,
    onSetAim,
    onMovePin,
    onMoveTee,
  })

  // Runs before the camera effect sees the new pin.
  useLayoutEffect(() => {
    if (pinMovedInView) userPlacedRef.current = true
  }, [pinMovedInView, userPlacedRef])

  useMapLayers({
    mapRef,
    userPlacedRef,
    existingShots,
    placedPoints,
    placedAims,
    effectivePin,
    pinStrong: pinOverride != null || roundPinSet,
    holeNumber: hole?.number ?? 1,
    par: hole?.par ?? null,
    effectiveTee,
    overlayMode,
    arcWidthYards,
    circleRadiusYards,
    dotsVisible,
    selectClub,
    handicap,
    onMovePoint,
    onMovePin,
    onSetAim,
    onMoveExistingShot,
    onMoveExistingShotAim,
    selectedShotId,
    onSelectShot,
  })

  useGreenLayers({
    mapRef,
    mapLoaded,
    green: green.data,
    mode: green.mode,
    show: green.show,
    paceLines: green.paceLines,
    approachDeg: green.approachDeg,
    held: green.held ?? false,
    tee: effectiveTee,
    pin: effectivePin,
  })

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          inset: 0,
          background: '#1C211C',
        }}
      />
      {mapLoaded && <WayfinderKey mapRef={mapRef} ball={ball} pin={effectivePin} />}
      {(!MAPBOX_TOKEN_PRESENT || mapFailed) && (
        // One message for a missing token and a runtime failure (owner,
        // 2026-11-02). lib/mapbox logs both.
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-caddie-ink-dim"
          style={{ background: '#FBF8F1', fontSize: 14, padding: 22, gap: 14, textAlign: 'center' }}
        >
          The map didn&rsquo;t load. Check your connection and try again.
          <button type="button" className="key" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      )}
    </div>
  )
}

// The wayfinder (#1386): at green zoom with the ball off screen, a key at the
// map's edge pointing at the ball, with its distance to the pin. Not a
// control: taps go through to the map. Re-measured on map moves at most once
// a frame, in its own component so a pan re-renders only the key.
const WAYFINDER_KEY = { width: 96, height: 43 } // 40 + the 3 px ledge
const CHROME_GAP = 6

function WayfinderKey({
  mapRef,
  ball,
  pin,
}: {
  mapRef: MutableRefObject<mapboxgl.Map | null>
  ball: PlacedPoint | null
  pin: PlacedPoint | null
}) {
  const { unit } = useUnits()
  const [wf, setWf] = useState<Wayfinder | null>(null)
  const ballLat = ball?.lat
  const ballLng = ball?.lng
  const pinLat = pin?.lat
  const pinLng = pin?.lng
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    let frame = 0
    const measure = () => {
      frame = 0
      const el = map.getContainer()
      const box = el.getBoundingClientRect()
      // The keys and chrome over the map (MapView marks the area and them), and Mapbox's
      // own logo and attribution corners.
      const chrome = [
        ...(el.closest('[data-map-area]')?.querySelectorAll('[data-map-chrome]') ?? []),
        ...el.querySelectorAll('.mapboxgl-ctrl-bottom-left, .mapboxgl-ctrl-bottom-right'),
      ]
      const avoid = chrome.map((c) => {
        const r = c.getBoundingClientRect()
        return {
          left: r.left - box.left - CHROME_GAP,
          top: r.top - box.top - CHROME_GAP,
          right: r.right - box.left + CHROME_GAP,
          bottom: r.bottom - box.top + CHROME_GAP,
        }
      })
      const next = wayfinder({
        ball: ballLat != null && ballLng != null ? { lat: ballLat, lng: ballLng } : null,
        pin: pinLat != null && pinLng != null ? { lat: pinLat, lng: pinLng } : null,
        zoom: map.getZoom(),
        project: (p) => {
          const q = map.project([p.lng, p.lat])
          return [q.x, q.y]
        },
        area: { left: 8, top: 8, right: box.width - 8, bottom: box.height - 8 },
        key: WAYFINDER_KEY,
        avoid,
        unit,
      })
      setWf((cur) =>
        next && cur && Math.abs(next.x - cur.x) < 0.5 && Math.abs(next.y - cur.y) < 0.5 &&
        Math.abs(next.rotate - cur.rotate) < 0.5 && next.distance === cur.distance
          ? cur
          : next,
      )
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    schedule()
    map.on('move', schedule)
    map.on('resize', schedule)
    return () => {
      map.off('move', schedule)
      map.off('resize', schedule)
      cancelAnimationFrame(frame)
    }
  }, [mapRef, ballLat, ballLng, pinLat, pinLng, unit])

  if (!wf) return null
  // "150 yd" → a serif number and its unit; '—' has no unit.
  const cut = wf.distance.lastIndexOf(' ')
  const [num, unitLabel] = cut < 0 ? [wf.distance, ''] : [wf.distance.slice(0, cut), wf.distance.slice(cut + 1)]
  return (
    <div
      className="key"
      role="img"
      aria-label={`Your ball, ${wf.distance} from the pin`}
      data-testid="wayfinder"
      style={{
        position: 'absolute',
        left: wf.x,
        top: wf.y,
        transform: 'translate(-50%, -50%)',
        width: WAYFINDER_KEY.width,
        height: 40,
        minHeight: 40,
        padding: 0,
        gap: 6,
        zIndex: 4,
        pointerEvents: 'none',
        fontWeight: 400,
        fontSize: 13,
      }}
    >
      <svg width="22" height="22" viewBox="-11 -11 22 22" aria-hidden>
        <path d="M0,-6 L9,6 L0,3.5 L-9,6 Z" transform={`rotate(${wf.rotate.toFixed(1)})`} fill="#1C211C" />
      </svg>
      <span>
        <span className="font-serif" style={{ fontStyle: 'italic', fontWeight: 500, fontSize: 17 }}>
          {num}
        </span>{' '}
        {unitLabel}
      </span>
    </div>
  )
}
