import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Dimensions, Pressable, Text, View } from 'react-native'
import Mapbox from '@rnmapbox/maps'
import { useReducedMotion } from 'react-native-reanimated'
import { coneRingGeoJSON, dispersionRodsGeoJSON, scatterGeoJSON, type AimRelativeDispersion } from '@oga/core'
import type { LatLng } from '../HoleMap.types'
import { useUnits } from '../../../hooks/useUnits'
import { TYPE } from '../../../lib/typography'
import { HardShadow } from '../../paper/Paper'
import { P, R } from '../../paper/tokens'

// The ring, bias line and rods need this many shots to mean anything (§8).
export const RING_MIN_SHOTS = 10
const MAX_DOTS = 40
// Draw-in (§15): the ring draws in 280 ms; dots fade in 3 batches of 120 ms,
// inner → outer; the bias line, mean dot, rods and tags follow at 280 ms.
const RING_DRAW_MS = 280
const DOT_BATCH_MS = 120
const LATE_MS = 280
const FADE = { duration: 120, delay: 0 }

// THROWAWAY (#611 PR4 declutter mock): how the rod tags keep clear of the
// carry / remaining tags, flipped from a chip over the map until the owner
// picks. '0' = as built. A: rod tags slide along / past their rods until
// they clear, else hide. B: a rod's tag hides when the rod is short on
// screen. C: one merged "±w × ±l" tag beside the ring, opposite the carry.
type TagMode = '0' | 'A' | 'B' | 'C'
let tagMode: TagMode = '0'
const tagSubs = new Set<() => void>()
function useTagMode(): TagMode {
  return useSyncExternalStore(
    (cb) => {
      tagSubs.add(cb)
      return () => tagSubs.delete(cb)
    },
    () => tagMode,
  )
}
export function TagModeChip() {
  const m = useTagMode()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Tag layout ${m}, tap to switch`}
      onPress={() => {
        tagMode = m === '0' ? 'A' : m === 'A' ? 'B' : m === 'B' ? 'C' : '0'
        tagSubs.forEach((cb) => cb())
      }}
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        height: 28,
        paddingHorizontal: 10,
        borderRadius: R,
        borderWidth: 1,
        borderColor: P.warn,
        backgroundColor: P.raised,
        justifyContent: 'center',
      }}
    >
      <Text style={[TYPE.kicker, { fontSize: 12, color: P.ink }]}>tags {m === '0' ? 'as built' : m}</Text>
    </Pressable>
  )
}

// Mirrors core's ROD_GAP_YARDS (rods sit this far outside the ring).
const ROD_GAP = 4
// On-screen boxes (dp) for the collision test — sizes of the rendered tags.
type Box = [number, number, number, number]
const hit = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]
const rodBox = (p: [number, number]): Box => [p[0] - 36, p[1] - 15, p[0] + 36, p[1] + 15]
const legBox = (p: [number, number], w: number, h: number, lefty: boolean): Box =>
  lefty ? [p[0] - 17 - w, p[1] - h / 2, p[0] + 9, p[1] + h / 2] : [p[0] - 9, p[1] - h / 2, p[0] + 17 + w, p[1] + h / 2]
const onMap = (p?: [number, number]) => !!p && p[0] >= 0 && p[1] >= 0
// A rod tag shows only when its rod is at least this long on screen (B) —
// about the tag's own width.
const MIN_ROD_DP = 60
const MERGED_W = 150
const MERGED_H = 30
const LINE_PAD = 14
const STACKS_DP = 403

export interface PatternOverlay {
  /** Aim-relative landings, most recent first. */
  points: { alongYards: number; perpYards: number }[]
  /** Null for a sparse club (< 5 usable shots): dots only, dimmed. */
  dispersion: AimRelativeDispersion | null
}

// Shot-pattern overlay "B" + checkered rods (#611 LOCKED-SPEC §8): the
// selected club's recent landings, its 68% ring on the mean, the aim→mean
// bias line, and two ground-space rods stating the true spread.
export function DispersionLayers({
  ball,
  aim,
  pattern,
  carryAt,
  remainingAt,
  lefty,
  projectRef,
  camKey,
  mapH,
}: {
  ball: LatLng
  aim: LatLng
  pattern: PatternOverlay
  carryAt: LatLng | null
  remainingAt: LatLng | null
  lefty: boolean
  projectRef: { current: ((pts: LatLng[]) => Promise<[number, number][] | null>) | null }
  camKey: number
  mapH: number
}) {
  const { toDisplay } = useUnits()
  const mode = useTagMode()
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
    const rods = dispersionRodsGeoJSON(ball, aim, d)
    if (!ring68 || !mean || !rods) return null
    const bias = {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: [[aim.lng, aim.lat], mean.geometry.coordinates] },
    }
    return { ring68, mean, bias, rods, along68: d.along68, perp68: d.perp68 }
  }, [ball, aim, pattern.dispersion])

  // Where the rod tags go in modes A / B (null = hidden); recomputed when the
  // camera settles.
  const [placed, setPlaced] = useState<{
    length: LatLng | null
    width: LatLng | null
    merged?: { at: LatLng; ax: number; ay: number; pad: number } | null
  } | null>(null)
  useEffect(() => {
    const d = pattern.dispersion
    if (mode === '0' || !ring || !d) {
      setPlaced(null)
      return
    }
    const geo = (along: number, perp: number): LatLng => {
      const c = scatterGeoJSON(ball, aim, [{ alongYards: along, perpYards: perp }]).features[0]!.geometry.coordinates
      return { lng: c[0]!, lat: c[1]! }
    }
    const a68 = Math.abs(d.along68)
    const p68 = Math.abs(d.perp68)
    const lengthPerp = d.perpMean + p68 + ROD_GAP
    const widthAlong = d.alongMean - a68 - ROD_GAP
    let live = true
    void (async () => {
      if (mode === 'B') {
        const ends = [
          geo(d.alongMean - a68, lengthPerp),
          geo(d.alongMean + a68, lengthPerp),
          geo(widthAlong, d.perpMean - p68),
          geo(widthAlong, d.perpMean + p68),
        ]
        const s = await projectRef.current?.(ends)
        if (!live || !s) return
        const len = (i: number) => Math.hypot(s[i + 1]![0] - s[i]![0], s[i + 1]![1] - s[i]![1])
        setPlaced({
          length: len(0) >= MIN_ROD_DP ? ring.rods.lengthTag : null,
          width: len(2) >= MIN_ROD_DP ? ring.rods.widthTag : null,
        })
        return
      }
      // A: try the built spot, then along the rod, then past its ends.
      // C: one merged tag beside the ring (away side, then carry side), then
      // beyond its far end (away side, then centred).
      const offsets = (half: number) =>
        [0.5, -0.5, 1, -1].map((f) => f * half).concat([6, 12, 18].flatMap((k) => [half + k, -(half + k)]))
      const sideGap = p68 + ROD_GAP
      const merged = [
        { at: geo(d.alongMean, d.perpMean + (lefty ? 1 : -1) * sideGap), ax: lefty ? 0 : 1, ay: 0.5, pad: 0 },
        { at: geo(d.alongMean, d.perpMean + (lefty ? -1 : 1) * sideGap), ax: lefty ? 1 : 0, ay: 0.5, pad: 0 },
        // On the aim line, padded clear of it (the remaining tag's tick).
        { at: geo(d.alongMean + a68 + ROD_GAP, 0), ax: lefty ? 0 : 1, ay: 1, pad: LINE_PAD },
        { at: geo(d.alongMean + a68 + ROD_GAP, d.perpMean), ax: 0.5, ay: 1, pad: 0 },
      ]
      const lenC = mode === 'A' ? [ring.rods.lengthTag, ...offsets(a68).map((o) => geo(d.alongMean + o, lengthPerp))] : []
      const widC = mode === 'A' ? [ring.rods.widthTag, ...offsets(p68).map((o) => geo(widthAlong, d.perpMean + o))] : []
      const mC = mode === 'C' ? merged : []
      const s = await projectRef.current?.([
        ball,
        carryAt ?? ball,
        remainingAt ?? ball,
        ...lenC,
        ...widC,
        ...mC.map((m) => m.at),
      ])
      if (!live || !s) return
      // The dock's side stacks (the map runs under them). ponytail: measured
      // once on the emulator; the wheel card grows with "Back to auto".
      const W = Dimensions.get('window').width
      const stackTop = mapH - STACKS_DP
      const taken: Box[] = [
        [0, stackTop, 140, 1e4],
        [W - 140, stackTop, W, 1e4],
      ]
      if (carryAt && onMap(s[1])) taken.push(legBox(s[1]!, 110, 58, lefty))
      if (remainingAt && onMap(s[2])) taken.push(legBox(s[2]!, 100, 34, lefty))
      const clear = (b: Box) => b[0] >= 0 && b[2] <= W && b[1] >= 0 && !taken.some((t) => hit(t, b))
      const pick = (from: number, cands: LatLng[]) => {
        for (let i = 0; i < cands.length; i++) {
          const p = s[from + i]
          if (!onMap(p)) continue
          const b = rodBox(p!)
          if (!clear(b)) continue
          taken.push(b)
          return cands[i]!
        }
        return null
      }
      const length = pick(3, lenC)
      const width = pick(3 + lenC.length, widC)
      let m: (typeof merged)[number] | null = null
      for (let i = 0; i < mC.length && !m; i++) {
        const p = s[3 + lenC.length + widC.length + i]
        if (!onMap(p)) continue
        const { ax, ay, pad } = mC[i]!
        const w = MERGED_W + pad
        const b: Box = [p![0] - ax * w, p![1] - ay * MERGED_H, p![0] + (1 - ax) * w, p![1] + (1 - ay) * MERGED_H]
        if (clear(b)) m = mC[i]!
      }
      setPlaced({ length, width, merged: m })
    })()
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, ring, ball, aim, camKey, mapH, carryAt?.lat, carryAt?.lng, remainingAt?.lat, remainingAt?.lng, lefty])

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
          <Mapbox.ShapeSource id="patternRing" shape={ring.ring68}>
            <Mapbox.FillLayer
              id="patternRingFill"
              style={{ fillColor: P.raised, fillOpacity: t > 0 ? 0.14 : 0, fillOpacityTransition: { duration: 200, delay: 0 } }}
            />
          </Mapbox.ShapeSource>
          {ringLine && (
            <Mapbox.ShapeSource id="patternRingLine" shape={ringLine}>
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
          {late && mode === '0' && (
            <>
              <RodTag id="patternLengthTag" at={ring.rods.lengthTag} display={toDisplay(ring.along68)} />
              <RodTag id="patternWidthTag" at={ring.rods.widthTag} display={toDisplay(ring.perp68)} />
            </>
          )}
          {late && placed?.length && (
            <RodTag id="patternLengthTag" at={placed.length} display={toDisplay(ring.along68)} />
          )}
          {late && placed?.width && <RodTag id="patternWidthTag" at={placed.width} display={toDisplay(ring.perp68)} />}
          {late && placed?.merged && (
            <MergedTag
              at={placed.merged.at}
              anchor={{ x: placed.merged.ax, y: placed.merged.ay }}
              pad={placed.merged.pad * (placed.merged.ax === 1 ? 1 : -1)}
              wide={toDisplay(ring.perp68)}
              long={toDisplay(ring.along68)}
            />
          )}
        </>
      )}
    </>
  )
}

// "±21 yd", centred on its rod and screen-upright (§8).
function RodTag({ id, at, display }: { id: string; at: LatLng; display: string }) {
  const [num = '', unit = ''] = display.split(' ')
  return (
    <Mapbox.MarkerView id={id} coordinate={[at.lng, at.lat]} anchor={{ x: 0.5, y: 0.5 }} allowOverlap>
      {/* Room for the hard shadow so the MarkerView doesn't clip it. */}
      <View style={{ paddingRight: 2, paddingBottom: 2 }}>
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
            <Text style={[TYPE.serif, { fontSize: 15, lineHeight: 20, color: P.ink }]}>±{num}</Text>
            <Text style={[TYPE.kicker, { fontSize: 11, color: P.ink }]}> {unit}</Text>
          </View>
        </HardShadow>
      </View>
    </Mapbox.MarkerView>
  )
}

// THROWAWAY (mode C): "±7 wide · ±13 long yd" in one Text (split Texts of
// italic Fraunces get under-measured on Android and wrap).
function MergedTag({
  at,
  anchor,
  pad,
  wide,
  long,
}: {
  at: LatLng
  anchor: { x: number; y: number }
  /** Clear space on the anchored side: + right, − left. */
  pad: number
  wide: string
  long: string
}) {
  const unit = wide.split(' ')[1] ?? ''
  const k = [TYPE.kicker, { fontSize: 11 }]
  return (
    <Mapbox.MarkerView id="patternMergedTag" coordinate={[at.lng, at.lat]} anchor={anchor} allowOverlap>
      <View style={{ paddingRight: 2 + Math.max(0, pad), paddingLeft: Math.max(0, -pad), paddingBottom: 2 }}>
        <HardShadow>
          <View
            style={{
              backgroundColor: P.raised,
              borderWidth: 1,
              borderColor: P.ink,
              borderRadius: 2,
              paddingHorizontal: 6,
              paddingBottom: 1,
            }}
          >
            <Text numberOfLines={1} style={[TYPE.serif, { fontSize: 15, lineHeight: 20, color: P.ink, paddingRight: 3 }]}>
              ±{wide.split(' ')[0]}
              <Text style={k}> wide · </Text>±{long.split(' ')[0]}
              <Text style={k}> long {unit}</Text>
            </Text>
          </View>
        </HardShadow>
      </View>
    </Mapbox.MarkerView>
  )
}
