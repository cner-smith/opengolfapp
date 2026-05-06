import { useCallback, useEffect, useRef, type MutableRefObject } from 'react'
import { mapboxgl } from '../../../lib/mapbox'
import { haversineYards } from '@oga/core'
import { useUnits } from '../../../hooks/useUnits'
import type { ExistingShot, PlacedPoint } from '../RoundMap'
import {
  attachDragFx,
  makeAimMarker,
  makeDistancePill,
  makeFlagMarker,
  makeIconMarker,
  makeNumberedMarker,
  MARKER_COLORS,
} from './markerFactories'
import {
  buildLineCoords,
  upsertDashedLines,
  upsertLine,
} from './lineHelpers'

interface UseMapLayersInput {
  mapRef: MutableRefObject<mapboxgl.Map | null>
  userPlacedRef: MutableRefObject<boolean>
  existingShots: ExistingShot[]
  placedPoints: PlacedPoint[]
  placedAims: (PlacedPoint | null)[] | undefined
  effectivePin: PlacedPoint | null
  effectiveTee: PlacedPoint | null
  onMovePoint: (idx: number, point: PlacedPoint) => void
  onMovePin: ((point: PlacedPoint) => void) | undefined
  onMoveTee: ((point: PlacedPoint) => void) | undefined
  onMoveExistingShot: ((shotId: string, point: PlacedPoint) => void) | undefined
  onMoveExistingShotAim: ((shotId: string, point: PlacedPoint) => void) | undefined
}

const lineSourceId = 'shot-line'
const placedLineSourceId = 'placed-line'

export function useMapLayers({
  mapRef,
  userPlacedRef,
  existingShots,
  placedPoints,
  placedAims,
  effectivePin,
  effectiveTee,
  onMovePoint,
  onMovePin,
  onMoveTee,
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

    // Tee marker — draggable when a parent handler is wired in.
    if (effectiveTee) {
      const parts = makeIconMarker('TEE', '#FBF8F1', '#5C6356')
      const marker = new mapboxgl.Marker({
        element: parts.outer,
        draggable: !!onMoveTee,
      })
        .setLngLat([effectiveTee.lng, effectiveTee.lat])
        .addTo(map)
      if (onMoveTee) {
        attachDragFx({
          outer: parts.outer,
          content: parts.content,
          marker,
          tooltip: 'Drag to move tee',
        })
        marker.on('dragend', () => {
          const ll = marker.getLngLat()
          userPlacedRef.current = true
          onMoveTee({ lat: ll.lat, lng: ll.lng })
        })
      } else {
        parts.outer.title = 'Tee box'
      }
      markerRefs.current.push(marker)
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
    const existingAimLines: [number, number][][] = []
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

      // Aim ghost for saved shots. Same warn palette as the placed-aim
      // marker so the visual vocabulary stays consistent across modes.
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

        // Dashed aim line + AIM distance pill, mirroring the placed-shot
        // version below. Uses the shot's start coord (with end fallback)
        // so the line origin matches the numbered marker on the map.
        const startLng = s.startLng ?? s.endLng
        const startLat = s.startLat ?? s.endLat
        if (startLat != null && startLng != null) {
          const aimYards = Math.round(
            haversineYards(startLat, startLng, s.aimLat, s.aimLng),
          )
          if (aimYards > 0) {
            const mid: [number, number] = [
              (startLng + s.aimLng) / 2,
              (startLat + s.aimLat) / 2,
            ]
            const pill = makeDistancePill(`AIM ${toDisplay(aimYards)}`)
            const pillMarker = new mapboxgl.Marker({ element: pill })
              .setLngLat(mid)
              .addTo(map)
            markerRefs.current.push(pillMarker)
          }
          existingAimLines.push([
            [startLng, startLat],
            [s.aimLng, s.aimLat],
          ])
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

    // Aim markers + dashed aim lines per placed shot. Aim color matches
    // the rest of the warn palette (#A66A1F) so it reads as "intent",
    // distinct from the accent ball/pin marker.
    const aimLineCoords: [number, number][][] = []
    placedPoints.forEach((p, idx) => {
      const aim = placedAims?.[idx] ?? null
      if (!aim) return
      const aimEl = makeAimMarker()
      const aimMarker = new mapboxgl.Marker({ element: aimEl })
        .setLngLat([aim.lng, aim.lat])
        .addTo(map)
      markerRefs.current.push(aimMarker)
      aimLineCoords.push([
        [p.lng, p.lat],
        [aim.lng, aim.lat],
      ])
      // Distance pill at midpoint of the aim line.
      const yards = Math.round(haversineYards(p.lat, p.lng, aim.lat, aim.lng))
      if (yards > 0) {
        const mid: [number, number] = [
          (p.lng + aim.lng) / 2,
          (p.lat + aim.lat) / 2,
        ]
        const el = makeDistancePill(`AIM ${toDisplay(yards)}`)
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat(mid)
          .addTo(map)
        markerRefs.current.push(marker)
      }
    })
    upsertDashedLines(map, 'aim-lines', aimLineCoords, '#A66A1F')
    upsertDashedLines(map, 'existing-aim-lines', existingAimLines, '#A66A1F')
  }, [
    mapRef,
    userPlacedRef,
    existingShots,
    placedPoints,
    placedAims,
    onMovePoint,
    onMovePin,
    onMoveTee,
    onMoveExistingShot,
    onMoveExistingShotAim,
    effectivePin,
    effectiveTee,
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
      map.once('styledata', () => renderLayers())
      return
    }
    renderLayers()
  }, [mapRef, renderLayers])
}
