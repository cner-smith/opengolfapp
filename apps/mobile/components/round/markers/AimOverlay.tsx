import { useEffect, useMemo, useRef, useState } from 'react'
import { View } from 'react-native'
import Mapbox from '@rnmapbox/maps'
import Svg, { Circle, Path } from 'react-native-svg'
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
        <Mapbox.ShapeSource id="overlayArc" tolerance={0} shape={arc}>
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
        <Mapbox.ShapeSource id="overlayCircle" tolerance={0} shape={circle}>
          <Mapbox.FillLayer id="overlayCircleFill" style={{ fillColor: P.raised, fillOpacity: 0.12 }} />
          <Mapbox.LineLayer id="overlayCircleBorder" style={{ lineColor: P.raised, lineWidth: 2, lineOpacity: 0.9 }} />
        </Mapbox.ShapeSource>
      )}
    </>
  )
}

// The aim handle's box and its four grip arrows (N/E/S/W): tips 37 out from
// the centre, bases just outside the ring's halo.
const AIM_BOX = 84
const AIM_C = AIM_BOX / 2
const AIM_GRIPS = [0, 90, 180, 270].map((deg) => {
  const pt = (along: number, across: number) => {
    const a = (deg * Math.PI) / 180
    const x = AIM_C + along * Math.sin(a) + across * Math.cos(a)
    const y = AIM_C - along * Math.cos(a) + across * Math.sin(a)
    return `${Math.round(x * 100) / 100} ${Math.round(y * 100) / 100}`
  }
  return `M${pt(37, 0)} L${pt(29, 5.5)} L${pt(29, -5.5)} Z`
})

// The draggable aim handle (#950): a tinted gold disc with an ink halo and
// four grip arrows.
export function AimReticle() {
  return (
    <View style={{ width: AIM_BOX, height: AIM_BOX }}>
      <Svg width={AIM_BOX} height={AIM_BOX} viewBox={`0 0 ${AIM_BOX} ${AIM_BOX}`}>
        <Circle cx={AIM_C} cy={AIM_C} r={24} fill="none" stroke={P.ink} strokeOpacity={0.55} strokeWidth={7} />
        <Circle cx={AIM_C} cy={AIM_C} r={24} fill="rgba(166,106,31,0.30)" stroke={P.warn} strokeWidth={4} />
        <Circle cx={AIM_C} cy={AIM_C} r={24} fill="none" stroke={P.raised} strokeWidth={1.2} />
        {AIM_GRIPS.map((d) => (
          <Path key={d} d={d} fill={P.raised} stroke={P.ink} strokeWidth={1.2} strokeLinejoin="round" />
        ))}
        <Circle cx={AIM_C} cy={AIM_C} r={4.5} fill={P.warn} stroke={P.raised} strokeWidth={2} />
      </Svg>
    </View>
  )
}

const CROSS = `M${AIM_C - 11} ${AIM_C}h7M${AIM_C + 4} ${AIM_C}h7M${AIM_C} ${AIM_C - 11}v7M${AIM_C} ${AIM_C + 4}v7`

// The aim handle while the pattern is on (#1468): a small crosshair with a
// gold dot, so the pattern's ring reads as the target. The grab area stays
// the reticle's size: PointAnnotation hit-tests opaque pixels, so a
// near-transparent pad fills it.
export function AimCrosshair() {
  return (
    <View style={{ width: AIM_BOX, height: AIM_BOX }}>
      <Svg width={AIM_BOX} height={AIM_BOX} viewBox={`0 0 ${AIM_BOX} ${AIM_BOX}`}>
        <Path d={CROSS} stroke={P.ink} strokeOpacity={0.6} strokeWidth={4} strokeLinecap="round" />
        <Path d={CROSS} stroke={P.raised} strokeWidth={1.8} strokeLinecap="round" />
        <Circle cx={AIM_C} cy={AIM_C} r={3.6} fill={P.warn} stroke={P.raised} strokeWidth={1.6} />
        <Circle cx={AIM_C} cy={AIM_C} r={24} fill="rgba(251,248,241,0.02)" />
      </Svg>
    </View>
  )
}
