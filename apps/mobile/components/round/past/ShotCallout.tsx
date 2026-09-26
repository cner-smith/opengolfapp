import { useCallback, useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import Svg, { Line } from 'react-native-svg'
import { FONT, TYPE } from '../../../lib/typography'
import { HardShadow } from '../../paper/Paper'
import { P, R } from '../../paper/tokens'
import type { LatLng } from '../HoleMap.types'

type Pt = [number, number]
export type Projector = { current: ((pts: LatLng[]) => Promise<Pt[] | null>) | null }
export type CameraListener = { current: (() => void) | null }

export interface ShotCalloutProps {
  projectRef: Projector
  cameraListenerRef: CameraListener
  /** The selected shot's start marker — the staff's foot. */
  anchor: LatLng
  /** End of the selected leg (next start / aim / pin). */
  end: LatLng | null
  /** Start of the leg before it, so the flag stays off that line too. */
  prev: LatLng | null
  /** Every other marker the flag must not cover (crumbs, the pin). */
  markers: LatLng[]
  /** Bottom-left corner of the map to keep clear (the logging mode rocker). */
  avoidCorner?: { w: number; h: number }
  value: string
  unit: string
  sub: string
}

const RING = 22
const CLEAR = 30
// Candidate order doubles as the tie-break (§19.9 C).
const CANDIDATES: Pt[] = [
  [1, -1],
  [-1, -1],
  [1, 1],
  [-1, 1],
  [1, 0],
  [-1, 0],
  [0, -1],
  [0, 1],
]

interface Placement {
  bx: number
  by: number
  foot: Pt
  head: Pt
}

// Flag-label callout on a staff from the selected shot's start marker (#611
// §19.9 C). Screen-space: the points are projected with getPointInView and the
// 8-candidate solver re-runs once per frame while the camera moves, and on any
// prop change. Never touchable — the map and markers stay live under it.
export function ShotCallout(p: ShotCalloutProps) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [box, setBox] = useState({ w: 116, h: 46 })
  const [place, setPlace] = useState<Placement | null>(null)
  const latest = useRef({ p, size, box })
  latest.current = { p, size, box }
  const seq = useRef(0)

  const solve = useCallback(async () => {
    const { p: q, size: sz, box: bb } = latest.current
    if (!sz) return
    const id = ++seq.current
    const pts: LatLng[] = [q.anchor, q.end ?? q.anchor, q.prev ?? q.anchor, ...q.markers]
    const scr = await q.projectRef.current?.(pts)
    if (id !== seq.current) return
    const a = scr?.[0]
    // (-1, -1) is Mapbox's "not on the map" sentinel.
    if (!scr || !a || a[0] < 0 || a[1] < 0 || a[0] > sz.w || a[1] > sz.h) {
      setPlace(null)
      return
    }
    const segs: [Pt, Pt][] = []
    if (q.end) segs.push([a, scr[1]!])
    if (q.prev) segs.push([scr[2]!, a])
    const dots: Pt[] = [a, ...(q.end ? [scr[1]!] : []), ...scr.slice(3)]
    const { w: BW, h: BH } = bb
    const hits = (bx: number, by: number) => {
      let n = 0
      for (const [s, e] of segs) {
        for (let t = 0; t <= 1; t += 0.02) {
          const x = s[0] + (e[0] - s[0]) * t
          const y = s[1] + (e[1] - s[1]) * t
          if (x > bx - 4 && x < bx + BW + 4 && y > by - 4 && y < by + BH + 4) n++
        }
      }
      for (const d of dots) {
        if (d[0] > bx - 24 && d[0] < bx + BW + 24 && d[1] > by - 24 && d[1] < by + BH + 24) n += 50
      }
      const c = q.avoidCorner
      if (c && bx < c.w && by + BH > sz.h - c.h) n += 50
      return n
    }
    let best: { sc: number; bx: number; by: number } | null = null
    for (const [ox, oy] of CANDIDATES) {
      let bx = ox > 0 ? a[0] + CLEAR : ox < 0 ? a[0] - CLEAR - BW : a[0] - BW / 2
      let by = oy > 0 ? a[1] + CLEAR : oy < 0 ? a[1] - CLEAR - BH : a[1] - BH / 2
      bx = Math.max(14, Math.min(sz.w - 14 - BW, bx))
      by = Math.max(11, Math.min(sz.h - 13 - BH, by))
      const sc = hits(bx, by)
      if (!best || sc < best.sc) best = { sc, bx, by }
    }
    if (!best) return
    const { bx, by } = best
    const head: Pt = [Math.max(bx, Math.min(bx + BW, a[0])), Math.max(by, Math.min(by + BH, a[1]))]
    const ang = Math.atan2(head[1] - a[1], head[0] - a[0])
    const foot: Pt = [a[0] + Math.cos(ang) * RING, a[1] + Math.sin(ang) * RING]
    setPlace({ bx, by, foot, head })
  }, [])

  // One solve per frame at most while the camera moves.
  const pending = useRef(false)
  useEffect(() => {
    const listener = () => {
      if (pending.current) return
      pending.current = true
      requestAnimationFrame(() => {
        pending.current = false
        void solve()
      })
    }
    p.cameraListenerRef.current = listener
    return () => {
      if (p.cameraListenerRef.current === listener) p.cameraListenerRef.current = null
    }
  }, [p.cameraListenerRef, solve])

  const markerKey = p.markers.map((m) => `${m.lat},${m.lng}`).join('|')
  useEffect(() => {
    void solve()
  }, [
    solve,
    size,
    box,
    p.anchor.lat,
    p.anchor.lng,
    p.end?.lat,
    p.end?.lng,
    p.prev?.lat,
    p.prev?.lng,
    markerKey,
  ])

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {place && size && (
        <Svg width={size.w} height={size.h} style={{ position: 'absolute', left: 0, top: 0 }}>
          <Line
            x1={place.foot[0]}
            y1={place.foot[1]}
            x2={place.head[0]}
            y2={place.head[1]}
            stroke={P.raised}
            strokeWidth={4}
            strokeLinecap="round"
          />
          <Line
            x1={place.foot[0]}
            y1={place.foot[1]}
            x2={place.head[0]}
            y2={place.head[1]}
            stroke={P.ink}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </Svg>
      )}
      <HardShadow
        style={{
          position: 'absolute',
          left: place?.bx ?? 0,
          top: place?.by ?? 0,
          opacity: place ? 1 : 0,
        }}
      >
        <View
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout
            if (Math.abs(width - box.w) > 0.5 || Math.abs(height - box.h) > 0.5) setBox({ w: width, h: height })
          }}
          style={{
            minWidth: 116,
            backgroundColor: P.raised,
            borderWidth: 1,
            borderColor: P.ink,
            borderRadius: R,
            paddingTop: 3,
            paddingRight: 10,
            paddingBottom: 4,
            paddingLeft: 10,
          }}
        >
          <Text numberOfLines={1} style={[TYPE.serif, { fontSize: 24, lineHeight: 26, color: P.ink }]}>
            {p.value}
            <Text style={{ fontFamily: FONT.mono, fontSize: 13 }}> {p.unit}</Text>
          </Text>
          <Text numberOfLines={1} style={[TYPE.body, { fontSize: 12, lineHeight: 15, color: P.ink }]}>
            {p.sub}
          </Text>
        </View>
      </HardShadow>
    </View>
  )
}
