import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View } from 'react-native'
import Mapbox from '@rnmapbox/maps'
import { useReducedMotion } from 'react-native-reanimated'
import { arcGeoJSON, bearingDegrees, circleGeoJSON, destinationYards, haversineYards } from '@oga/core'
import type { LatLng } from '../HoleMap.types'
import { P } from '../../paper/tokens'

const TWEEN_MS = 150
// Same throttle as the aim handle: each drag frame re-serializes the source.
const DRAG_THROTTLE_MS = 40

// Eases a number to a new target over 150 ms (out-cubic). `live` follows the
// target frame for frame (a finger is on it); reduce motion cuts.
function useTween(target: number, live: boolean): number {
  const reduce = useReducedMotion()
  const [v, setV] = useState(target)
  const vRef = useRef(v)
  vRef.current = v
  useEffect(() => {
    if (live || reduce || vRef.current === target) {
      setV(target)
      return
    }
    const from = vRef.current
    const t0 = Date.now()
    let raf = 0
    const step = () => {
      const k = Math.min(1, (Date.now() - t0) / TWEEN_MS)
      setV(from + (target - from) * (1 - (1 - k) ** 3))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, live, reduce])
  return v
}

export interface OverlayHandles {
  /** New size while dragging: Tee = total width, Appr = radius (yards). */
  onDrag: (sizeYards: number) => void
  onDragEnd: (sizeYards: number) => void
}

// The ruler's aim overlay (§5): Tee → an arc across the aim line at the
// ruler's width; Appr → a circle on the aim at the ruler's diameter. Size
// changes ease in; with `handles` (feel C) the arc ends / circle edge drag.
export function AimOverlay({
  ball,
  aim,
  mode,
  arcWidthYards,
  circleRadiusYards,
  live,
  dimArc,
  handles,
}: {
  ball: LatLng
  aim: LatLng
  mode: 'tee' | 'appr'
  arcWidthYards: number
  circleRadiusYards: number
  live: boolean
  /** The pattern's ring is up: the arc steps back to a hairline. */
  dimArc: boolean
  handles: OverlayHandles | null
}) {
  const width = useTween(arcWidthYards, live)
  const radius = useTween(circleRadiusYards, live)
  const arc = useMemo(() => (mode === 'tee' ? arcGeoJSON(ball, aim, width / 2) : null), [mode, ball, aim, width])
  const circle = useMemo(() => (mode === 'appr' ? circleGeoJSON(aim, radius) : null), [mode, aim, radius])

  const carry = haversineYards(ball.lat, ball.lng, aim.lat, aim.lng)
  const bearing = bearingDegrees(ball.lat, ball.lng, aim.lat, aim.lng)
  const hasHandles = handles != null
  const ends = useMemo(() => {
    if (!hasHandles) return []
    if (mode === 'appr') return [destinationYards(aim, bearing + 90, radius)]
    const half = (Math.atan2(width / 2, carry) * 180) / Math.PI
    return [destinationYards(ball, bearing - half, carry), destinationYards(ball, bearing + half, carry)]
  }, [hasHandles, mode, ball, aim, bearing, carry, width, radius])

  // Latest geometry for the (stable) drag callbacks.
  const geo = useRef({ ball, aim, mode, carry, bearing })
  geo.current = { ball, aim, mode, carry, bearing }
  const sizeAt = useCallback((c: LatLng) => {
    const g = geo.current
    if (g.mode === 'appr') return haversineYards(g.aim.lat, g.aim.lng, c.lat, c.lng)
    const d = ((bearingDegrees(g.ball.lat, g.ball.lng, c.lat, c.lng) - g.bearing + 540) % 360) - 180
    return 2 * Math.abs(g.carry * Math.tan((Math.min(80, Math.abs(d)) * Math.PI) / 180))
  }, [])
  const cb = useRef(handles)
  cb.current = handles
  const last = useRef(0)
  const onDrag = useCallback(
    (e: unknown) => {
      const now = Date.now()
      if (now - last.current < DRAG_THROTTLE_MS) return
      last.current = now
      const c = coordOf(e)
      if (c) cb.current?.onDrag(sizeAt(c))
    },
    [sizeAt],
  )
  // Mapbox leaves a dropped annotation where the finger let go unless its
  // coordinate changes; a drop past the clamp (or on the value it snaps to)
  // wouldn't. Remount the knobs on every drop so they re-seat on the edge.
  const [seat, setSeat] = useState(0)
  const onDragEnd = useCallback(
    (e: unknown) => {
      last.current = 0
      setSeat((n) => n + 1)
      const c = coordOf(e)
      if (c) cb.current?.onDragEnd(sizeAt(c))
    },
    [sizeAt],
  )
  const knob = useMemo(() => <Knob />, [])

  return (
    <>
      {/* Arc band = a wide translucent stroke (the "fill") + a thin crisp core. */}
      {arc && (
        <Mapbox.ShapeSource id="overlayArc" shape={arc}>
          <Mapbox.LineLayer
            id="overlayArcFill"
            style={{ lineColor: P.raised, lineWidth: 14, lineOpacity: dimArc ? 0 : 0.15, lineCap: 'round', lineJoin: 'round' }}
          />
          <Mapbox.LineLayer
            id="overlayArcCore"
            style={{ lineColor: P.raised, lineWidth: 2, lineOpacity: dimArc ? 0.5 : 0.9, lineCap: 'round', lineJoin: 'round' }}
          />
        </Mapbox.ShapeSource>
      )}
      {circle && (
        <Mapbox.ShapeSource id="overlayCircle" shape={circle}>
          <Mapbox.FillLayer id="overlayCircleFill" style={{ fillColor: P.raised, fillOpacity: 0.12 }} />
          <Mapbox.LineLayer id="overlayCircleBorder" style={{ lineColor: P.raised, lineWidth: 2, lineOpacity: 0.9 }} />
        </Mapbox.ShapeSource>
      )}
      {ends.map((p, i) => (
        <Mapbox.PointAnnotation
          key={`${mode}${i}-${seat}`}
          id={`overlayHandle-${mode}-${i}`}
          coordinate={[p.lng, p.lat]}
          draggable
          onDrag={onDrag}
          onDragEnd={onDragEnd}
        >
          {knob}
        </Mapbox.PointAnnotation>
      ))}
    </>
  )
}

// A grab knob on the overlay's edge. PointAnnotation hit-tests opaque
// pixels, so the 44 pad is faintly filled (same trick as the aim handle).
function Knob() {
  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(251,248,241,0.18)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: P.raised, borderWidth: 1.5, borderColor: P.ink }} />
    </View>
  )
}

function coordOf(e: unknown): LatLng | null {
  const c = (e as { geometry?: { coordinates?: unknown } } | null)?.geometry?.coordinates
  if (!Array.isArray(c) || c.length < 2) return null
  const [lng, lat] = c as number[]
  // Android fires NaN when dragged off the map (see HoleMap extractCoord).
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat: lat!, lng: lng! } : null
}
