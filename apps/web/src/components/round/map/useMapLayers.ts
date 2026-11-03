import { useCallback, useEffect, useRef, type MutableRefObject } from 'react'
import { mapboxgl } from '../../../lib/mapbox'
import {
  arcGeoJSON,
  bearingDegrees,
  calculateShotSG,
  circleGeoJSON,
  destinationYards,
  fanPlates,
  formatClubLabel,
  getExpectedStrokes,
  placeCallout,
  plateBox,
  type PlateSide,
  startCategory,
  haversineYards,
  NEAR_GREEN_YARDS,
  scatterGeoJSON,
} from '@oga/core'
import { useUnits } from '../../../hooks/useUnits'
import type { ExistingShot, PlacedPoint } from '../RoundMap'
import {
  attachDragFx,
  type CalloutParts,
  makeAimMarker,
  makeCallout,
  makeSelectedMarker,
  makeDistancePill,
  makeFlagMarker,
  FLAG_CLOTH,
  FLAG_OFFSET,
  makeNumberedMarker,
  makePlateMarker,
  makeObRingMarker,
  makeTeeDotMarker,
  MARKER_COLORS,
} from './markerFactories'
import {
  buildLineCoords,
  upsertArcBand,
  upsertCircleFill,
  upsertDashedLines,
  upsertDottedLine,
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
  /** The round's own pin is set (strong flag) vs the course default (dim). */
  pinStrong: boolean
  holeNumber: number
  /** The active hole's par (tee-line SG for a par-4/5 tee shot, #998). */
  par: number | null
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
  /** Player handicap index for the live best-case-SG readout on the aim
   *  pill (expected strokes are calibrated to the bracket). */
  handicap: number
  onMovePoint: (idx: number, point: PlacedPoint) => void
  onMovePin: ((point: PlacedPoint) => void) | undefined
  onSetAim: ((index: number, point: PlacedPoint | null) => void) | undefined
  onMoveExistingShot: ((shotId: string, point: PlacedPoint) => void) | undefined
  onMoveExistingShotAim: ((shotId: string, point: PlacedPoint) => void) | undefined
  /** The saved shot drawn as the selected disc with its leg and callout (#1217). */
  selectedShotId: string | null
  onSelectShot: ((shotId: string) => void) | undefined
}

// "142.9 yd" → ["142.9", "yd"] for the callout's big number and small unit.
function splitDisplay(s: string): [string, string] {
  const i = s.lastIndexOf(' ')
  return i < 0 ? [s, ''] : [s.slice(0, i), s.slice(i + 1)]
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
// reference + aim/remaining pills); the rest render as a dashed
// start→aim line.
type AimSeg = { start: [number, number]; aim: [number, number]; first: boolean; id?: string }

export function useMapLayers({
  mapRef,
  userPlacedRef,
  existingShots,
  placedPoints,
  placedAims,
  effectivePin,
  pinStrong,
  holeNumber,
  par,
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
}: UseMapLayersInput): void {
  const { toDisplay, toDisplayFt } = useUnits()
  const markerRefs = useRef<mapboxgl.Marker[]>([])
  const calloutRef = useRef<HTMLElement | null>(null)
  // Re-fans the saved shots' plates for the current zoom/rotation (#1215).
  const layoutPlatesRef = useRef<(() => void) | null>(null)

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
    calloutRef.current?.remove()
    calloutRef.current = null

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
      const parts = makeFlagMarker({ hole: holeNumber, strong: pinStrong })
      const clothFill = parts.flag.getAttribute('fill') ?? FLAG_CLOTH
      const marker = new mapboxgl.Marker({
        element: parts.outer,
        anchor: 'top-left',
        offset: FLAG_OFFSET,
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
            parts.flag.setAttribute('fill', active ? '#A66A1F' : clothFill)
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

    // OB badge rings (#839) — added to the map BEFORE the numbered-marker
    // loop below so they paint underneath (see makeObRingMarker). Rendered
    // as a separate pass rather than inline in the main loop so every ring
    // for the hole lands ahead of every disc, even though an OB shot's
    // covering re-hit disc is a LATER entry in `existingValid`.
    for (const s of existingValid) {
      if (s.ob !== true) continue
      const lng = s.startLng ?? s.endLng!
      const lat = s.startLat ?? s.endLat!
      const ring = new mapboxgl.Marker({ element: makeObRingMarker() })
        .setLngLat([lng, lat])
        .addTo(map)
      markerRefs.current.push(ring)
    }

    // An OB shot and its stroke-and-distance re-hit are BY RULE at the same
    // coordinate, so their discs land on the same pixel and whichever Mapbox
    // adds last wins the stacking — in practice the re-hit, which left the OB
    // shot's own number completely invisible with only the ring to hint at it.
    // Count coincident starts so the OB disc can be nudged aside below. The
    // ring stays on the true origin, so the position is still told honestly;
    // only the label moves (#839).
    const coincidentCount = new Map<string, number>()
    for (const s of existingValid) {
      const k = `${s.startLng ?? s.endLng},${s.startLat ?? s.endLat}`
      coincidentCount.set(k, (coincidentCount.get(k) ?? 0) + 1)
    }

    const plates: { at: [number, number]; offset: [number, number]; setSide: (s: PlateSide) => void }[] = []
    const selIdx = existingValid.findIndex((s) => s.id === selectedShotId)
    const sel = existingValid[selIdx] ?? null
    // Review (§19.3/19.5): a saved hole with a selected shot. The map then
    // carries only the dotted path, the plates, the selected leg + callout
    // and the selected shot's aim; no planning pills.
    const review = sel != null && placedPoints.length === 0
    for (const s of existingValid) {
      // Paper plates (cream, ink ring); the shot that went OB stays brick,
      // as on mobile and the scorecard.
      const plate = s === sel ? null : makePlateMarker(s.shotNumber, s.ob === true)
      const parts = plate ?? makeSelectedMarker(s.shotNumber)
      const lng = s.startLng ?? s.endLng!
      const lat = s.startLat ?? s.endLat!
      // Drag is gated on the parent wiring a handler AND the row having a
      // real start coord — moving an end-only legacy fallback would
      // silently coerce it into a start coord on save.
      const draggable =
        !!onMoveExistingShot && s.startLat != null && s.startLng != null
      // Only the OB disc moves, and only when something else really is on top
      // of it — a lone OB shot stays dead centre in its ring.
      const shareCount = coincidentCount.get(`${lng},${lat}`) ?? 0
      const offset: [number, number] =
        s.ob === true && shareCount > 1 ? [-20, 0] : [0, 0]
      const marker = new mapboxgl.Marker({
        element: parts.outer,
        draggable,
        offset,
      })
        .setLngLat([lng, lat])
        .addTo(map)
      if (plate) plates.push({ at: [lng, lat], offset, setSide: plate.setSide })
      if (plate && onSelectShot) {
        // A drag ends in a click too; only a click without one selects.
        let dragged = false
        marker.on('dragstart', () => (dragged = true))
        parts.outer.style.cursor = 'pointer'
        parts.outer.addEventListener('click', (e) => {
          e.stopPropagation()
          if (!dragged) onSelectShot(s.id)
          dragged = false
        })
      }
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
      if (s.aimLat != null && s.aimLng != null && (!review || s === sel)) {
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
            first: s.shotNumber === 1,
            id: s.id,
          })
        }
      }
    }

    const pinAt: [number, number] | null = effectivePin ? [effectivePin.lng, effectivePin.lat] : null
    // The selected shot's leg (#1217) runs to the next start, or the pin.
    const llOf = (s: ExistingShot): [number, number] => [s.startLng ?? s.endLng!, s.startLat ?? s.endLat!]
    const selAt = sel ? llOf(sel) : null
    const next = existingValid[selIdx + 1]
    const legEnd = sel ? (next ? llOf(next) : pinAt) : null
    const legPrev = selIdx > 0 ? llOf(existingValid[selIdx - 1]!) : null
    const selAim: [number, number] | null = sel?.aimLat != null && sel.aimLng != null ? [sel.aimLng, sel.aimLat] : null
    upsertLine(map, 'selected-leg', selAt && legEnd ? [selAt, legEnd] : [], '#FBF8F1')
    let callout: CalloutParts | null = null
    if (selAt && legEnd) {
      const yards = haversineYards(selAt[1], selAt[0], legEnd[1], legEnd[0])
      const [value, unit] = splitDisplay(sel!.category === 'putt' ? toDisplayFt(yards * 3) : toDisplay(yards, 1))
      const to = next ? `to shot ${sel!.shotNumber + 1}` : 'to the pin'
      callout = makeCallout(value, unit, sel!.club ? `${formatClubLabel({ club_type: sel!.club })} · ${to}` : to)
      map.getContainer().appendChild(callout.el)
      calloutRef.current = callout.el
    }
    layoutPlatesRef.current = () => {
      const pt = (ll: [number, number], off: [number, number] = [0, 0]): [number, number] => {
        const q = map.project(ll)
        return [q.x + off[0], q.y + off[1]]
      }
      const dots = plates.map((p) => pt(p.at, p.offset))
      const others = [pinAt, selAim, sel ? legEnd : null].filter((p): p is [number, number] => p != null).map((p) => pt(p))
      const a = selAt ? pt(selAt) : undefined
      const sides = fanPlates(dots, others, a)
      plates.forEach((p, i) => p.setSide(sides[i]!))
      if (!callout || !a || !legEnd) return
      const c = map.getContainer()
      const onMap = a[0] >= 0 && a[1] >= 0 && a[0] <= c.clientWidth && a[1] <= c.clientHeight
      callout.el.style.display = onMap ? '' : 'none'
      if (!onMap) return
      const box = { w: callout.box.offsetWidth, h: callout.box.offsetHeight }
      const end = pt(legEnd)
      const place = placeCallout({
        anchor: a,
        end,
        prev: legPrev ? pt(legPrev) : null,
        dots: [a, end, ...dots, ...others],
        plates: dots.map((d, i) => plateBox(d, sides[i]!)),
        box,
        size: { w: c.clientWidth, h: c.clientHeight },
      })
      callout.box.style.left = `${place.bx}px`
      callout.box.style.top = `${place.by}px`
      callout.setStaff(place.foot[0], place.foot[1], place.head[0], place.head[1])
    }
    layoutPlatesRef.current()

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
    upsertDottedLine(map, lineSourceId, existingCoords)

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
    // Saved legs carry no pills: the callout reads the selected one.
    for (const coords of [placedCoords]) {
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
      placedAimSegs.push({ start: [p.lng, p.lat], aim: [aim.lng, aim.lat], first: idx === 0 && existingShots.length === 0 })
    })

    // ---- Aim lines + pills (placed + saved, unified) ----
    // The latest aimed shot — the placed flow while logging, otherwise the
    // last saved aim — gets the full planning treatment: solid start→aim→
    // pin bend, dotted start→pin reference, and aim + remaining pills.
    // Every other aimed shot renders as a plain dashed start→aim line so a
    // multi-shot hole doesn't clutter with overlapping bends.
    const pinLngLat: [number, number] | null = effectivePin
      ? [effectivePin.lng, effectivePin.lat]
      : null
    const activeFromPlaced = placedAimSegs.length > 0
    // With a selected shot, its own aim (or none) is the active one (#1217).
    const activeSeg: AimSeg | null = activeFromPlaced
      ? placedAimSegs[placedAimSegs.length - 1]!
      : sel
        ? savedAimSegs.find((x) => x.id === sel.id) ?? null
        : savedAimSegs[savedAimSegs.length - 1] ?? null

    // Fixed-geometry shot-pattern overlay anchored on the active aimed shot.
    // Tee → dispersion arc band across the aim line; Appr → approach circle
    // centered on the aim (matches the mobile overlay — the aim is the
    // target, not the pin). Rendered before the aim line below so it sits
    // underneath; always upserted (empty when no active aim / wrong mode) so
    // it clears on the next render.
    // In review the overlay waits for the Pattern key.
    const overlaySeg = review && !dotsVisible ? null : activeSeg
    const arcCoords: [number, number][] =
      overlaySeg && overlayMode === 'tee'
        ? arcGeoJSON(
            { lat: overlaySeg.start[1], lng: overlaySeg.start[0] },
            { lat: overlaySeg.aim[1], lng: overlaySeg.aim[0] },
            arcWidthYards / 2,
          )?.geometry.coordinates ?? []
        : []
    upsertArcBand(map, 'aim-arc', arcCoords, AIM_COLOR)
    const circleRing: [number, number][][] =
      overlaySeg && overlayMode === 'appr'
        ? circleGeoJSON(
            { lat: overlaySeg.aim[1], lng: overlaySeg.aim[0] },
            circleRadiusYards,
          )?.geometry.coordinates ?? []
        : []
    upsertCircleFill(map, 'aim-circle', circleRing, AIM_COLOR)

    // Single-color dispersion dots: the club whose median distance best matches
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
    const savedDashed = activeFromPlaced ? savedAimSegs : savedAimSegs.filter((x) => x !== activeSeg)
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
    // Review shows the selected shot's aim as its marker alone: an aim line
    // would run beside the selected leg as a second path.
    const planSeg = review ? null : activeSeg
    const activeSolid: [number, number][] = planSeg
      ? pinLngLat
        ? [planSeg.start, planSeg.aim, pinLngLat]
        : [planSeg.start, planSeg.aim]
      : []
    upsertLine(map, 'aim-active', activeSolid, AIM_COLOR)
    upsertDashedLines(
      map,
      'aim-reference',
      planSeg && pinLngLat ? [[planSeg.start, pinLngLat]] : [],
      AIM_COLOR,
    )
    if (planSeg) {
      // Best-case SG of advancing ball→aim toward the pin: expected(start→pin)
      // − expected(aim→pin) − 1 (calculateShotSG), as the aim pill's sublabel.
      // Distance-band category (no polygons): within NEAR_GREEN_YARDS →
      // around_green (GRN), else approach (FWY). HONEST: value of reaching the
      // aim if struck clean, not dispersion-weighted. Needs a pin + baseline.
      let sgSublabel: string | undefined
      let sgTone: 'pos' | 'neg' = 'pos'
      if (pinLngLat) {
        const startToPin = haversineYards(
          planSeg.start[1],
          planSeg.start[0],
          pinLngLat[1],
          pinLngLat[0],
        )
        const aimToPin = haversineYards(
          planSeg.aim[1],
          planSeg.aim[0],
          pinLngLat[1],
          pinLngLat[0],
        )
        // The tee shot of a par 4/5 starts from Broadie's tee line (#998).
        const startCat = startCategory(startToPin, planSeg.first && (par === 4 || par === 5))
        const targetCat = aimToPin <= NEAR_GREEN_YARDS ? 'around_green' : 'approach'
        const expected = getExpectedStrokes(startCat, startToPin, undefined, handicap)
        const targetExpected = getExpectedStrokes(targetCat, aimToPin, undefined, handicap)
        if (expected != null && targetExpected != null) {
          const sg = calculateShotSG(expected, targetExpected)
          sgTone = sg < 0 ? 'neg' : 'pos'
          sgSublabel = `${sg >= 0 ? '+' : '−'}${Math.abs(sg).toFixed(1)}`
        }
      }
      const toAim = Math.round(
        haversineYards(
          planSeg.start[1],
          planSeg.start[0],
          planSeg.aim[1],
          planSeg.aim[0],
        ),
      )
      if (toAim > 0) {
        const mid: [number, number] = [
          (planSeg.start[0] + planSeg.aim[0]) / 2,
          (planSeg.start[1] + planSeg.aim[1]) / 2,
        ]
        markerRefs.current.push(
          new mapboxgl.Marker({
            element: makeDistancePill(toDisplay(toAim), {
              sublabel: sgSublabel ? `to aim · ${sgSublabel}` : 'to aim',
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
            planSeg.aim[1],
            planSeg.aim[0],
            pinLngLat[1],
            pinLngLat[0],
          ),
        )
        if (remaining > 0) {
          const mid: [number, number] = [
            (planSeg.aim[0] + pinLngLat[0]) / 2,
            (planSeg.aim[1] + pinLngLat[1]) / 2,
          ]
          markerRefs.current.push(
            new mapboxgl.Marker({ element: makeDistancePill(toDisplay(remaining), { sublabel: 'left to the pin' }) })
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
    selectedShotId,
    onSelectShot,
    effectivePin,
    pinStrong,
    holeNumber,
    par,
    effectiveTee,
    overlayMode,
    arcWidthYards,
    circleRadiusYards,
    dotsVisible,
    selectClub,
    handicap,
    toDisplay,
    toDisplayFt,
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

  // Re-fan the plates and re-place the callout every camera frame, so the
  // callout follows a pan as mobile's does. ponytail: a handful of projections.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const relayout = () => layoutPlatesRef.current?.()
    map.on('move', relayout)
    return () => {
      map.off('move', relayout)
    }
  }, [mapRef])
}
