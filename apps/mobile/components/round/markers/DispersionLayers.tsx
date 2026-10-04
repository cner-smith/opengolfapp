import { useEffect, useMemo, useState, type RefObject } from 'react'
import { Text, View } from 'react-native'
import Mapbox from '@rnmapbox/maps'
import { useReducedMotion } from 'react-native-reanimated'
import { coneRingGeoJSON, dispersionRodsGeoJSON, scatterGeoJSON, type AimRelativeDispersion } from '@oga/core'
import type { LatLng } from '../HoleMap.types'
import { useUnits } from '../../../hooks/useUnits'
import { TYPE } from '../../../lib/typography'
import { HardShadow } from '../../paper/Paper'
import { FONT_CAP, P } from '../../paper/tokens'

// The ring, bias line and rods need this many shots to mean anything (§8).
export const RING_MIN_SHOTS = 10
const MAX_DOTS = 40
// Draw-in (§15): the ring draws in 280 ms; dots fade in 3 batches of 120 ms,
// inner → outer; the bias line, mean dot, rods and tags follow at 280 ms.
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

// Shot-pattern overlay "B" + checkered rods (#611 LOCKED-SPEC §8): the
// selected club's recent landings, its 68% ring on the mean, the aim→mean
// bias line, and two ground-space rods stating the true spread.
// `map` / `mapWidth` / `idleTick` let the rod tags stay on screen (RodTag).
// `lefty` puts the width tag on the side away from the aim-line tags.
type TagFrame = { map: RefObject<Mapbox.MapView | null>; mapWidth: number | null; idleTick: number; lefty: boolean }

export function DispersionLayers({
  ball,
  aim,
  pattern,
  frame,
}: {
  ball: LatLng
  aim: LatLng
  pattern: PatternOverlay
  frame: TagFrame
}) {
  const { toDisplay } = useUnits()
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
    // The width tag goes opposite the aim / remaining tags (right of the
    // line; left when lefty), which it collided with on short approaches.
    const rods = dispersionRodsGeoJSON(ball, aim, d, frame.lefty ? 1 : -1)
    if (!ring68 || !mean || !rods) return null
    const bias = {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: [[aim.lng, aim.lat], mean.geometry.coordinates] },
    }
    const [cLng = aim.lng, cLat = aim.lat] = mean.geometry.coordinates
    return { ring68, mean, bias, rods, centre: { lat: cLat, lng: cLng }, along68: d.along68, perp68: d.perp68 }
  }, [ball, aim, pattern.dispersion, frame.lefty])

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
          <Mapbox.ShapeSource id="patternRods" shape={ring.rods.lines}>
            <Mapbox.LineLayer
              id="patternRodCasing"
              filter={['==', ['get', 'k'], 'rod']}
              style={{ lineColor: P.ink, lineWidth: 6, lineOpacity: late ? 1 : 0, lineOpacityTransition: FADE }}
            />
            <Mapbox.LineLayer
              id="patternRodChecks"
              filter={['==', ['get', 'k'], 'check']}
              style={{
                lineColor: ['match', ['get', 'c'], 1, P.ink, P.raised],
                lineWidth: 4,
                lineOpacity: late ? 1 : 0,
                lineOpacityTransition: FADE,
              }}
            />
            <Mapbox.LineLayer
              id="patternRodTicks"
              filter={['==', ['get', 'k'], 'tick']}
              style={{ lineColor: P.ink, lineWidth: 3, lineOpacity: late ? 1 : 0, lineOpacityTransition: FADE }}
            />
          </Mapbox.ShapeSource>
          {late && <RodTag id="patternLengthTag" at={ring.rods.lengthTag} toward={ring.centre} display={toDisplay(ring.along68)} frame={frame} />}
          {late && <RodTag id="patternWidthTag" at={ring.rods.widthTag} toward={ring.centre} anchorX={frame.lefty ? 0 : 1} display={toDisplay(ring.perp68)} frame={frame} />}
        </>
      )}
    </>
  )
}

// "±21 yd", centred on its rod and screen-upright (§8). A wide ring puts the
// length rod past the map edge, so after each camera settle the tag slides
// back toward the ring's centre until it fits (a MarkerView can't clamp itself).
function RodTag({
  id,
  at,
  toward,
  anchorX = 0.5,
  display,
  frame,
}: {
  id: string
  at: LatLng
  /** The ring's centre: where the tag retreats to when `at` is off screen. */
  toward: LatLng
  /** 0.5 = centred on the rod; the width tag hangs off its inner edge (1 =
   *  right edge on the point) so it ends short of the aim line. */
  anchorX?: number
  display: string
  frame: TagFrame
}) {
  const [num = '', unit = ''] = display.split(' ')
  const [w, setW] = useState(0)
  const [pos, setPos] = useState(at)
  useEffect(() => {
    let live = true
    const map = frame.map.current
    const mapW = frame.mapWidth
    void (async () => {
      if (!map || !mapW || !w) return setPos(at)
      // Mapbox answers (-1, -1) for a point outside the view, so an off-screen
      // tag can't be projected and clamped directly: binary-search the line
      // toward the ring's centre for the outermost spot that fits instead.
      const fits = async (p: LatLng) => {
        const [x = -1, y = -1] = await map.getPointInView([p.lng, p.lat])
        return x - w * anchorX >= 4 && x + w * (1 - anchorX) <= mapW - 4 && y >= 0
      }
      const lerp = (t: number): LatLng => ({ lat: at.lat + (toward.lat - at.lat) * t, lng: at.lng + (toward.lng - at.lng) * t })
      if ((await fits(at)) || !(await fits(toward))) return live && setPos(at)
      let lo = 0
      let hi = 1
      for (let i = 0; i < 7; i++) {
        const mid = (lo + hi) / 2
        if (await fits(lerp(mid))) hi = mid
        else lo = mid
      }
      if (live) setPos(lerp(hi))
    })().catch(() => live && setPos(at))
    return () => {
      live = false
    }
  }, [at.lat, at.lng, toward.lat, toward.lng, anchorX, w, frame.mapWidth, frame.idleTick])
  return (
    <Mapbox.MarkerView id={id} coordinate={[pos.lng, pos.lat]} anchor={{ x: anchorX, y: 0.5 }} allowOverlap>
      {/* Room for the hard shadow so the MarkerView doesn't clip it. */}
      <View style={{ paddingRight: 2, paddingBottom: 2 }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        <HardShadow>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              backgroundColor: P.raised,
              borderWidth: 1,
              borderColor: P.ink,
              borderRadius: 2,
              paddingHorizontal: 5,
              paddingBottom: 1,
            }}
          >
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { fontSize: 15, lineHeight: 20, color: P.ink }]}>±{num}</Text>
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.kicker, { fontSize: 11, color: P.ink }]}> {unit}</Text>
          </View>
        </HardShadow>
      </View>
    </Mapbox.MarkerView>
  )
}
