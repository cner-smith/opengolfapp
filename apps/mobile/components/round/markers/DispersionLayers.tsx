import { useEffect, useMemo, useState } from 'react'
import Mapbox from '@rnmapbox/maps'
import { useReducedMotion } from 'react-native-reanimated'
import { coneRingGeoJSON, scatterGeoJSON, type AimRelativeDispersion } from '@oga/core'
import type { LatLng } from '../HoleMap.types'
import { P } from '../../paper/tokens'

// The ring and bias line need this many shots to mean anything (§8).
export const RING_MIN_SHOTS = 10
const MAX_DOTS = 40
// Draw-in (§15): the ring draws in 280 ms; dots fade in 3 batches of 120 ms,
// inner → outer; the bias line and mean dot follow at 280 ms.
const RING_DRAW_MS = 280
const DOT_BATCH_MS = 120
const LATE_MS = 280
const FADE = { duration: 120, delay: 0 }

export interface PatternOverlay {
  /** Aim-relative landings, most recent first. */
  points: { alongYards: number; perpYards: number }[]
  /** Null for a sparse club (< 5 usable shots): dots only, dimmed. */
  dispersion: AimRelativeDispersion | null
}

// Shot-pattern overlay "B" (#611 LOCKED-SPEC §8): the selected club's recent
// landings, its 68% ring on the mean and the aim→mean bias line. The spread's
// numbers ride on the aim plate (#1468), not on the map.
export function DispersionLayers({ ball, aim, pattern }: { ball: LatLng; aim: LatLng; pattern: PatternOverlay }) {
  const dots = useMemo(() => {
    const pts = pattern.points.slice(0, MAX_DOTS)
    const fc = scatterGeoJSON(ball, aim, pts)
    if (fc.features.length === 0) return null
    // Batch by distance from the pattern's centre, inner third first.
    const d = pattern.dispersion
    const r = pts.map((p) => Math.hypot(p.alongYards - (d?.alongMean ?? 0), p.perpYards - (d?.perpMean ?? 0)))
    const sorted = [...r].sort((a, b) => a - b)
    const cut1 = sorted[Math.floor(sorted.length / 3)] ?? 0
    const cut2 = sorted[Math.floor((2 * sorted.length) / 3)] ?? 0
    fc.features.forEach((f, i) => {
      f.properties.b = r[i]! < cut1 ? 1 : r[i]! < cut2 ? 2 : 3
    })
    return fc
  }, [ball, aim, pattern.points, pattern.dispersion])

  const ring = useMemo(() => {
    const d = pattern.dispersion
    if (!d || d.sampleSize < RING_MIN_SHOTS) return null
    const ring68 = coneRingGeoJSON(ball, aim, d.along68, d.perp68, {
      alongMeanYards: d.alongMean,
      perpMeanYards: d.perpMean,
    })
    const mean = scatterGeoJSON(ball, aim, [{ alongYards: d.alongMean, perpYards: d.perpMean }]).features[0]
    if (!ring68 || !mean) return null
    const bias = {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: [[aim.lng, aim.lat], mean.geometry.coordinates] },
    }
    return { ring68, mean, bias }
  }, [ball, aim, pattern.dispersion])

  // Elapsed ms since the overlay came up; a club change keeps it mounted, so
  // the new pattern swaps in at once. Reduce motion cuts to the end.
  const reduce = useReducedMotion()
  const [t, setT] = useState(reduce ? 1e9 : 0)
  useEffect(() => {
    if (reduce) return
    let raf = 0
    let t0 = 0
    const step = (now: number) => {
      if (!t0) t0 = now
      const e = now - t0
      setT(e)
      if (e < LATE_MS + 16) raf = requestAnimationFrame(step)
      else setT(1e9)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [reduce])

  // The ring line grows both ways from its far point (vertex 0) and meets at
  // the near side.
  const ringLine = useMemo(() => {
    if (!ring) return null
    const c = ring.ring68.geometry.coordinates[0]!
    const half = Math.floor((c.length - 1) / 2)
    const k = Math.round(Math.min(1, t / RING_DRAW_MS) * half)
    const coordinates = k >= half ? [c] : k < 1 ? [] : [c.slice(0, k + 1), c.slice(c.length - 1 - k)]
    return { type: 'Feature' as const, properties: {}, geometry: { type: 'MultiLineString' as const, coordinates } }
  }, [ring, t])

  const n = dots?.features.length ?? 0
  const dim = pattern.dispersion ? 1 : 0.5
  const dotOpacity = (n <= 20 ? 0.75 : 0.5) * dim
  const late = t >= LATE_MS
  return (
    <>
      {dots && (
        <Mapbox.ShapeSource id="patternDots" shape={dots}>
          {[1, 2, 3].map((b) => {
            const on = t >= (b - 1) * DOT_BATCH_MS
            return (
              <Mapbox.CircleLayer
                key={`b${b}`}
                id={`patternDots${b}`}
                filter={['==', ['get', 'b'], b]}
                style={{
                  circleRadius: n <= 20 ? 3.5 : 3,
                  circleColor: P.raised,
                  circleOpacity: on ? dotOpacity : 0,
                  circleOpacityTransition: FADE,
                  circleStrokeWidth: 1,
                  circleStrokeColor: P.tagShadow,
                  circleStrokeOpacity: on ? dim : 0,
                  circleStrokeOpacityTransition: FADE,
                }}
              />
            )
          })}
        </Mapbox.ShapeSource>
      )}
      {ring && (
        <>
          <Mapbox.ShapeSource id="patternRing" tolerance={0} shape={ring.ring68}>
            <Mapbox.FillLayer
              id="patternRingFill"
              style={{ fillColor: P.raised, fillOpacity: t > 0 ? 0.14 : 0, fillOpacityTransition: { duration: 200, delay: 0 } }}
            />
          </Mapbox.ShapeSource>
          {ringLine && (
            <Mapbox.ShapeSource id="patternRingLine" tolerance={0} shape={ringLine}>
              <Mapbox.LineLayer id="patternRingHalo" style={{ lineColor: P.ink, lineWidth: 4, lineOpacity: 0.35 }} />
              <Mapbox.LineLayer id="patternRingLine" style={{ lineColor: P.raised, lineWidth: 2, lineOpacity: 0.95 }} />
            </Mapbox.ShapeSource>
          )}
          <Mapbox.ShapeSource id="patternBias" shape={ring.bias}>
            <Mapbox.LineLayer
              id="patternBiasLine"
              style={{ lineColor: P.raised, lineWidth: 2, lineDasharray: [1, 1.5], lineOpacity: late ? 1 : 0, lineOpacityTransition: FADE }}
            />
          </Mapbox.ShapeSource>
          <Mapbox.ShapeSource id="patternMean" shape={ring.mean}>
            <Mapbox.CircleLayer
              id="patternMeanDot"
              style={{
                circleRadius: 4,
                circleColor: P.raised,
                circleStrokeWidth: 1.5,
                circleStrokeColor: P.ink,
                circleOpacity: late ? 1 : 0,
                circleStrokeOpacity: late ? 1 : 0,
                circleOpacityTransition: FADE,
                circleStrokeOpacityTransition: FADE,
              }}
            />
          </Mapbox.ShapeSource>
        </>
      )}
    </>
  )
}
