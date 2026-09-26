import { useEffect, useMemo, useRef, useState } from 'react'
import Mapbox from '@rnmapbox/maps'
import { useReducedMotion } from 'react-native-reanimated'
import { arcGeoJSON, circleGeoJSON } from '@oga/core'
import type { LatLng } from '../HoleMap.types'
import { P } from '../../paper/tokens'

const TWEEN_MS = 150

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

// The ruler's aim overlay (§5): Tee → an arc across the aim line at the
// ruler's width; Appr → a circle on the aim at the ruler's diameter. A
// committed size eases in; a ruler drag is followed frame for frame.
export function AimOverlay({
  ball,
  aim,
  mode,
  arcWidthYards,
  circleRadiusYards,
  live,
  dimArc,
}: {
  ball: LatLng
  aim: LatLng
  mode: 'tee' | 'appr'
  arcWidthYards: number
  circleRadiusYards: number
  live: boolean
  /** The pattern's ring is up: the arc steps back to a hairline. */
  dimArc: boolean
}) {
  const width = useTween(arcWidthYards, live)
  const radius = useTween(circleRadiusYards, live)
  const arc = useMemo(() => (mode === 'tee' ? arcGeoJSON(ball, aim, width / 2) : null), [mode, ball, aim, width])
  const circle = useMemo(() => (mode === 'appr' ? circleGeoJSON(aim, radius) : null), [mode, aim, radius])

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
    </>
  )
}
