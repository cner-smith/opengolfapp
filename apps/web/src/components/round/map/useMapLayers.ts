import { useCallback, useEffect, useRef, type MutableRefObject } from 'react'
import { mapboxgl } from '../../../lib/mapbox'
import {
  arcGeoJSON,
  bearingDegrees,
  calculateShotSG,
  circleGeoJSON,
  destinationYards,
  getExpectedStrokes,
  haversineYards,
  NEAR_GREEN_YARDS,
  scatterGeoJSON,
} from '@oga/core'
import { useUnits } from '../../../hooks/useUnits'
import type { ExistingShot, PlacedPoint } from '../RoundMap'
import {
  attachDragFx,
  makeAimMarker,
  makeDistancePill,
  makeFlagMarker,
  makeNumberedMarker,
  makeTeeDotMarker,
  MARKER_COLORS,
} from './markerFactories'
import {
  buildLineCoords,
  upsertArcBand,
  upsertCircleFill,
  upsertDashedLines,
  upsertLine,
  upsertScatter,
} from './lineHelpers'

// Minimal structural shape of the club dispersion picked by selectClub — kept
// local so this map hook doesn't import a page-level hook type. Structurally
// compatible with useClubDispersion's ClubDispersion.
export type ClubPick = {
  dispersion: { points: { alongYards: number; perpYards: number }[] }
}

interface UseMapLayersInput {
  mapRef: MutableRefObject<mapboxgl.Map | null>
  userPlacedRef: MutableRefObject<boolean>
  existingShots: ExistingShot[]
  placedPoints: PlacedPoint[]
  placedAims: (PlacedPoint | null)[] | undefined
  effectivePin: PlacedPoint | null
  effectiveTee: PlacedPoint | null
  /** Shot-pattern overlay (always-on while aiming), anchored on the active
   *  aimed shot. 'tee' → dispersion arc band of arcWidthYards total width;
   *  'appr' → approach circle of circleRadiusYards, centered on the aim. */
  overlayMode: 'tee' | 'appr'
  arcWidthYards: number
  circleRadiusYards: number
  /** Single-color dispersion-dots toggle + the club picker. When on and a club
   *  resolves for the active shot's distance, its history scatters around the
   *  aim. selectClub falls back to the longest club for a null distance. */
  dotsVisible: boolean
  selectClub: (distanceToTargetYards: number | null) => ClubPick | null
  /** Player handicap index for the live best-case-SG readout on the carry
   *  pill (expected strokes are calibrated to the bracket). */
  handicap: number
  onMovePoint: (idx: number, point: PlacedPoint) => void
  onMovePin: ((point: PlacedPoint) => void) | undefined
  onSetAim: ((index: number, point: PlacedPoint | null) => void) | undefined
  onMoveExistingShot: ((shotId: string, point: PlacedPoint) => void) | undefined
  onMoveExistingShotAim: ((shotId: string, point: PlacedPoint) => void) | undefined
}

const lineSourceId = 'shot-line'
const placedLineSourceId = 'placed-line'

// Aim overlays render white (#FBF8F1) — amber didn't read against fairway
// satellite tiles (mirrors the mobile redesign's amber→white switch). The
// shot trajectory lines stay amber so aim (intent) reads distinct from the
// path actually taken.
const AIM_COLOR = '#FBF8F1'

// Half-width of the tee box: each dot sits this far either side of the tee
// shot, perpendicular to the line of play. ~4 yd ≈ a real teeing ground.
// Mirrors the mobile redesign (PastRoundMap TEE_BOX_HALF_YARDS).
const TEE_BOX_HALF_YARDS = 4

// A single shot's aim: where the player stood (`start`) and where they
// aimed (`aim`), both as [lng, lat]. The latest aimed shot gets the full
// planning treatment (solid start→aim→pin bend + dotted start→pin
// reference + carry/remaining pills); the rest render as a dashed
// start→aim line.
type AimSeg = { start: [number, number]; aim: [number, number] }

export function useMapLayers({
  mapRef,
  userPlacedRef,
  existingShots,
  placedPoints,
  placedAims,
  effectivePin,
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
}: UseMapLayersInput): void {
  const { toDisplay } = useUnits()
  const markerRefs = useRef<mapboxgl.Marker[]>([])

  const renderLayers = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    // Markers, lines, distance pills, and aim ghosts render purely off
    // shot/placed-point coordinates. Tee/pin/aim sub-blocks already
    // null-check their own inputs (via effectiveTee, effectivePin) so
    // a course with no row in the holes table still draws shots when
    // their start/end coords are populated.

    // Clear old markers.
    for (const m of markerRefs.current) m.remove()
    markerRefs.current = []

    // Tee box — two understated dots flanking the tee shot, perpendicular to
    // the line of play (mirrors the mobile redesign; no draggable tee). Origin
    // is the first shot's start, falling back to the stored course tee; the
    // line of play points at that shot's aim, then the pin.
    const teeShot = [...existingShots]
      .filter((s) => s.startLat != null && s.startLng != null)
      .sort((a, b) => a.shotNumber - b.shotNumber)[0]
    const teeOrigin: PlacedPoint | null =
      placedPoints[0] ??
      (teeShot ? { lat: teeShot.startLat!, lng: teeShot.startLng! } : null) ??
      effectiveTee
    if (teeOrigin) {
      const teeToward: PlacedPoint | null =
        placedAims?.[0] ??
        (teeShot && teeShot.aimLat != null && teeShot.aimLng != null
          ? { lat: teeShot.aimLat, lng: teeShot.aimLng }
          : null) ??
        effectivePin
      const heading = teeToward
        ? bearingDegrees(teeOrigin.lat, teeOrigin.lng, teeToward.lat, teeToward.lng)
        : 0
      for (const sign of [-90, 90]) {
        const p = destinationYards(teeOrigin, heading + sign, TEE_BOX_HALF_YARDS)
        const marker = new mapboxgl.Marker({ element: makeTeeDotMarker() })
          .setLngLat([p.lng, p.lat])
          .addTo(map)
        markerRefs.current.push(marker)
      }
    }

    // Pin marker — draggable when a parent handler is wired in.
    if (effectivePin) {
      const parts = makeFlagMarker(MARKER_COLORS.pin)
      const marker = new mapboxgl.Marker({
        element: parts.outer,
        anchor: 'bottom',
        draggable: !!onMovePin,
      })
        .setLngLat([effectivePin.lng, effectivePin.lat])
        .addTo(map)
      if (onMovePin) {
        attachDragFx({
          outer: parts.outer,
          content: parts.content,
          marker,
          tooltip: 'Drag to move pin',
          // Pin tints to caddie-warn while dragging so the user can
          // tell "the flag is grabbed" from "the flag is just hovered."
          onDragColor: (active) => {
            parts.flag.style.background = active
              ? '#A66A1F'
              : MARKER_COLORS.pin
          },
        })
        marker.on('dragend', () => {
          const ll = marker.getLngLat()
          userPlacedRef.current = true
          onMovePin({ lat: ll.lat, lng: ll.lng })
        })
      } else {
        parts.outer.title = 'Pin'
      }
      markerRefs.current.push(marker)
    }

    // Existing shots: numbered markers + dashed trajectory.
    // Marker N renders at the START of shot N — that's "where the player
    // stood for shot N", matching the post-round tap flow. Falling back
    // to end coords for legacy rows that pre-date start_lat/lng.
    const savedAimSegs: AimSeg[] = []
    const existingValid = existingShots.filter(
      (s) =>
        (s.startLat != null && s.startLng != null) ||
        (s.endLat != null && s.endLng != null),
    )
    for (const s of existingValid) {
      const color =
        s.category === 'tee'
          ? MARKER_COLORS.tee
          : s.category === 'approach'
            ? MARKER_COLORS.approach
            : s.category === 'around-green'
              ? MARKER_COLORS.approach
              : MARKER_COLORS.green
      const parts = makeNumberedMarker(s.shotNumber, color, '#FBF8F1')
      const lng = s.startLng ?? s.endLng!
      const lat = s.startLat ?? s.endLat!
      // Drag is gated on the parent wiring a handler AND the row having a
      // real start coord — moving an end-only legacy fallback would
      // silently coerce it into a start coord on save.
      const draggable =
        !!onMoveExistingShot && s.startLat != null && s.startLng != null
      const marker = new mapboxgl.Marker({
        element: parts.outer,
        draggable,
      })
        .setLngLat([lng, lat])
        .addTo(map)
      if (draggable) {
        attachDragFx({
          outer: parts.outer,
          content: parts.content,
          marker,
          tooltip: `Shot ${s.shotNumber} — drag to adjust`,
        })
        marker.on('dragend', () => {
          const ll = marker.getLngLat()
          onMoveExistingShot!(s.id, { lat: ll.lat, lng: ll.lng })
        })
      } else {
        parts.outer.title = `Shot ${s.shotNumber}`
      }
      markerRefs.current.push(marker)

      // Aim ghost for saved shots. The line + pills are rendered
      // centrally below (latest aim = full planning treatment, the rest
      // dashed) so saved shots share the placed-flow vocabulary.
      if (s.aimLat != null && s.aimLng != null) {
        const aimEl = makeAimMarker()
        const aimDraggable = !!onMoveExistingShotAim
        const aimMarker = new mapboxgl.Marker({
          element: aimEl,
          draggable: aimDraggable,
        })
          .setLngLat([s.aimLng, s.aimLat])
          .addTo(map)
        if (aimDraggable) {
          aimEl.title = `Shot ${s.shotNumber} aim — drag to adjust`
          aimEl.style.cursor = 'grab'
          aimMarker.on('dragstart', () => {
            aimEl.style.cursor = 'grabbing'
          })
          aimMarker.on('dragend', () => {
            aimEl.style.cursor = 'grab'
            const ll = aimMarker.getLngLat()
            onMoveExistingShotAim!(s.id, { lat: ll.lat, lng: ll.lng })
          })
        }
        markerRefs.current.push(aimMarker)

        // Collect the start→aim segment. The origin uses the shot's start
        // coord (end fallback) so the line matches the numbered marker.
        const startLng = s.startLng ?? s.endLng
        const startLat = s.startLat ?? s.endLat
        if (startLat != null && startLng != null) {
          savedAimSegs.push({
            start: [startLng, startLat],
            aim: [s.aimLng, s.aimLat],
          })
        }
      }
    }

    // Placed points (tap-to-place mode).
    placedPoints.forEach((p, idx) => {
      const parts = makeNumberedMarker(
        idx + 1,
        MARKER_COLORS.ball,
        '#FBF8F1',
      )
      const marker = new mapboxgl.Marker({
        element: parts.outer,
        draggable: true,
      })
        .setLngLat([p.lng, p.lat])
        .addTo(map)
      attachDragFx({
        outer: parts.outer,
        content: parts.content,
        marker,
        tooltip: 'Drag to adjust position',
      })
      marker.on('dragend', () => {
        const ll = marker.getLngLat()
        onMovePoint(idx, { lat: ll.lat, lng: ll.lng })
      })
      markerRefs.current.push(marker)
    })

    // Trajectory line (existing shots): connect each shot's start
    // position in order, then close to the pin so the final segment
    // shows the last leg.
    const existingCoords = buildLineCoords(existingValid, effectivePin)
    upsertLine(map, lineSourceId, existingCoords, '#A66A1F')

    // Trajectory line (placed points): each marker is the START position
    // of a shot, so segment N→N+1 is the path of shot N. Closing to the
    // pin renders the final leg from the last marker through the cup.
    const placedCoords: [number, number][] =
      placedPoints.length === 0
        ? []
        : [
            ...placedPoints.map((p) => [p.lng, p.lat] as [number, number]),
            ...(effectivePin
              ? ([[effectivePin.lng, effectivePin.lat]] as [number, number][])
              : []),
          ]
    upsertLine(map, placedLineSourceId, placedCoords, '#A66A1F')

    // Per-segment distance pills. Renders midpoint label between every
    // pair of consecutive line coords for both existing and placed lines
    // so the player can see each shot's distance at a glance.
    for (const coords of [existingCoords, placedCoords]) {
      for (let i = 0; i < coords.length - 1; i++) {
        const a = coords[i]!
        const b = coords[i + 1]!
        const yards = Math.round(haversineYards(a[1], a[0], b[1], b[0]))
        if (yards <= 0) continue
        const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
        const el = makeDistancePill(toDisplay(yards))
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat(mid)
          .addTo(map)
        markerRefs.current.push(marker)
      }
    }

    // Aim markers per placed shot — draggable (via onSetAim) so the player
    // can adjust the auto-spawned start line. Lines + pills render
    // centrally below alongside the saved-shot aims.
    const placedAimSegs: AimSeg[] = []
    placedPoints.forEach((p, idx) => {
      const aim = placedAims?.[idx] ?? null
      if (!aim) return
      const aimEl = makeAimMarker()
      const aimDraggable = !!onSetAim
      const aimMarker = new mapboxgl.Marker({
        element: aimEl,
        draggable: aimDraggable,
      })
        .setLngLat([aim.lng, aim.lat])
        .addTo(map)
      if (aimDraggable) {
        aimEl.title = 'Aim point — drag to adjust'
        aimEl.style.cursor = 'grab'
        aimMarker.on('dragstart', () => {
          aimEl.style.cursor = 'grabbing'
        })
        aimMarker.on('dragend', () => {
          aimEl.style.cursor = 'grab'
          const ll = aimMarker.getLngLat()
          onSetAim!(idx, { lat: ll.lat, lng: ll.lng })
        })
      }
      markerRefs.current.push(aimMarker)
      placedAimSegs.push({ start: [p.lng, p.lat], aim: [aim.lng, aim.lat] })
    })

    // ---- Aim lines + pills (placed + saved, unified) ----
    // The latest aimed shot — the placed flow while logging, otherwise the
    // last saved aim — gets the full planning treatment: solid start→aim→
    // pin bend, dotted start→pin reference, and carry + remaining pills.
    // Every other aimed shot renders as a plain dashed start→aim line so a
    // multi-shot hole doesn't clutter with overlapping bends.
    const pinLngLat: [number, number] | null = effectivePin
      ? [effectivePin.lng, effectivePin.lat]
      : null
    const activeFromPlaced = placedAimSegs.length > 0
    const activeSeg: AimSeg | null = activeFromPlaced
      ? placedAimSegs[placedAimSegs.length - 1]!
      : savedAimSegs[savedAimSegs.length - 1] ?? null

    // Fixed-geometry shot-pattern overlay anchored on the active aimed shot.
    // Tee → dispersion arc band across the aim line; Appr → approach circle
    // centered on the aim (matches the mobile overlay — the aim is the
    // target, not the pin). Rendered before the aim line below so it sits
    // underneath; always upserted (empty when no active aim / wrong mode) so
    // it clears on the next render.
    const arcCoords: [number, number][] =
      activeSeg && overlayMode === 'tee'
        ? arcGeoJSON(
            { lat: activeSeg.start[1], lng: activeSeg.start[0] },
            { lat: activeSeg.aim[1], lng: activeSeg.aim[0] },
            arcWidthYards / 2,
          )?.geometry.coordinates ?? []
        : []
    upsertArcBand(map, 'aim-arc', arcCoords, AIM_COLOR)
    const circleRing: [number, number][][] =
      activeSeg && overlayMode === 'appr'
        ? circleGeoJSON(
            { lat: activeSeg.aim[1], lng: activeSeg.aim[0] },
            circleRadiusYards,
          )?.geometry.coordinates ?? []
        : []
    upsertCircleFill(map, 'aim-circle', circleRing, AIM_COLOR)

    // Single-color dispersion dots: the club whose median carry best matches
    // the active shot's ball→pin distance (longest club when no pin), scattered
    // aim-relative around the active aim. Sparse clubs resolve to null → no
    // dots (silent). Always upserted so toggling off / switching shots clears.
    let dotCoords: [number, number][] = []
    if (dotsVisible && activeSeg) {
      const ballToPin =
        effectivePin != null
          ? haversineYards(
              activeSeg.start[1],
              activeSeg.start[0],
              effectivePin.lat,
              effectivePin.lng,
            )
          : null
      const club = selectClub(ballToPin)
      if (club && club.dispersion.points.length > 0) {
        dotCoords = scatterGeoJSON(
          { lat: activeSeg.start[1], lng: activeSeg.start[0] },
          { lat: activeSeg.aim[1], lng: activeSeg.aim[0] },
          club.dispersion.points,
        ).features.map((f) => f.geometry.coordinates)
      }
    }
    upsertScatter(map, 'aim-dots', dotCoords, AIM_COLOR)

    // Non-active segments stay on their original source so switching flow
    // (placed ↔ saved) clears the other source cleanly. The active seg is
    // dropped from whichever set it belongs to.
    const placedDashed = activeFromPlaced
      ? placedAimSegs.slice(0, -1)
      : placedAimSegs
    const savedDashed =
      !activeFromPlaced && savedAimSegs.length > 0
        ? savedAimSegs.slice(0, -1)
        : savedAimSegs
    upsertDashedLines(
      map,
      'aim-lines',
      placedDashed.map((s) => [s.start, s.aim]),
      AIM_COLOR,
    )
    upsertDashedLines(
      map,
      'existing-aim-lines',
      savedDashed.map((s) => [s.start, s.aim]),
      AIM_COLOR,
    )

    // Active shot. Sources are always upserted (empty when there's no
    // active aim) so stale geometry clears on the next render.
    const activeSolid: [number, number][] = activeSeg
      ? pinLngLat
        ? [activeSeg.start, activeSeg.aim, pinLngLat]
        : [activeSeg.start, activeSeg.aim]
      : []
    upsertLine(map, 'aim-active', activeSolid, AIM_COLOR)
    upsertDashedLines(
      map,
      'aim-reference',
      activeSeg && pinLngLat ? [[activeSeg.start, pinLngLat]] : [],
      AIM_COLOR,
    )
    if (activeSeg) {
      // Best-case SG of advancing ball→aim toward the pin: expected(start→pin)
      // − expected(aim→pin) − 1 (calculateShotSG), as the carry pill's sublabel.
      // Distance-band category (no polygons): within NEAR_GREEN_YARDS →
      // around_green (GRN), else approach (FWY). HONEST: value of reaching the
      // aim if struck clean, not dispersion-weighted. Needs a pin + baseline.
      let sgSublabel: string | undefined
      let sgTone: 'pos' | 'neg' = 'pos'
      if (pinLngLat) {
        const startToPin = haversineYards(
          activeSeg.start[1],
          activeSeg.start[0],
          pinLngLat[1],
          pinLngLat[0],
        )
        const aimToPin = haversineYards(
          activeSeg.aim[1],
          activeSeg.aim[0],
          pinLngLat[1],
          pinLngLat[0],
        )
        const startCat = startToPin <= NEAR_GREEN_YARDS ? 'around_green' : 'approach'
        const targetCat = aimToPin <= NEAR_GREEN_YARDS ? 'around_green' : 'approach'
        const expected = getExpectedStrokes(startCat, startToPin, undefined, handicap)
        const targetExpected = getExpectedStrokes(targetCat, aimToPin, undefined, handicap)
        if (expected != null && targetExpected != null) {
          const sg = calculateShotSG(expected, targetExpected)
          sgTone = sg < 0 ? 'neg' : 'pos'
          sgSublabel = `${sg >= 0 ? '+' : ''}${sg.toFixed(1)} · ${
            targetCat === 'around_green' ? 'GRN' : 'FWY'
          }`
        }
      }
      const carry = Math.round(
        haversineYards(
          activeSeg.start[1],
          activeSeg.start[0],
          activeSeg.aim[1],
          activeSeg.aim[0],
        ),
      )
      if (carry > 0) {
        const mid: [number, number] = [
          (activeSeg.start[0] + activeSeg.aim[0]) / 2,
          (activeSeg.start[1] + activeSeg.aim[1]) / 2,
        ]
        markerRefs.current.push(
          new mapboxgl.Marker({
            element: makeDistancePill(`CARRY ${toDisplay(carry)}`, {
              sublabel: sgSublabel,
              tone: sgTone,
            }),
          })
            .setLngLat(mid)
            .addTo(map),
        )
      }
      if (pinLngLat) {
        const remaining = Math.round(
          haversineYards(
            activeSeg.aim[1],
            activeSeg.aim[0],
            pinLngLat[1],
            pinLngLat[0],
          ),
        )
        if (remaining > 0) {
          const mid: [number, number] = [
            (activeSeg.aim[0] + pinLngLat[0]) / 2,
            (activeSeg.aim[1] + pinLngLat[1]) / 2,
          ]
          markerRefs.current.push(
            new mapboxgl.Marker({ element: makeDistancePill(`REMAINING ${toDisplay(remaining)}`) })
              .setLngLat(mid)
              .addTo(map),
          )
        }
      }
    }
  }, [
    mapRef,
    userPlacedRef,
    existingShots,
    placedPoints,
    placedAims,
    onMovePoint,
    onMovePin,
    onSetAim,
    onMoveExistingShot,
    onMoveExistingShotAim,
    effectivePin,
    effectiveTee,
    overlayMode,
    arcWidthYards,
    circleRadiusYards,
    dotsVisible,
    selectClub,
    handicap,
    toDisplay,
  ])

  // Render markers + connecting line for either existing shots or placed points.
  // renderLayers is memoized; its identity tracks the inputs that determine
  // what's drawn, so deping on it is the correct trigger.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    // Wait for style.
    if (!map.isStyleLoaded()) {
      const handler = () => renderLayers()
      map.once('styledata', handler)
      // Replace, don't stack (#719) — without this teardown, each effect
      // re-run during the load window queues another once-listener with a
      // stale renderLayers closure that fires after the fresh render.
      return () => {
        map.off('styledata', handler)
      }
    }
    renderLayers()
  }, [mapRef, renderLayers])
}
