import { useCallback, useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import Svg, { Line } from 'react-native-svg'
import { FONT, TYPE } from '../../../lib/typography'
import { HardShadow } from '../../paper/Paper'
import { FONT_CAP, P, R } from '../../paper/tokens'
import { fanPlates, placeCallout, plateBox, type CalloutPlacement, type PlateSide } from '@oga/core'
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
  /** Every other marker the flag must not cover (crumbs first, then the pin). */
  markers: LatLng[]
  /** How many of `markers` are crumbs with a number plate. */
  crumbCount: number
  /** The side each crumb's plate goes, fanned so plates stay clear of each other and of the dots. */
  onPlates: (sides: PlateSide[]) => void
  /** Bottom-left corner of the map to keep clear (the logging mode rocker). */
  avoidCorner?: { w: number; h: number }
  value: string
  unit: string
  sub: string
}

// Flag-label callout on a staff from the selected shot's start marker (#611
// §19.9 C). Screen-space: the points are projected with getPointInView and
// core's placeCallout re-runs once per frame while the camera moves, and on any
// prop change. Never touchable — the map and markers stay live under it.
export function ShotCallout(p: ShotCalloutProps) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [box, setBox] = useState({ w: 116, h: 46 })
  const [place, setPlace] = useState<CalloutPlacement | null>(null)
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
    const end = q.end ? scr[1]! : null
    // Plates first (#1208): core's fanPlates, clear of each other, the
    // selected disc, the leg's end, the pin and the aim.
    const crumbs = scr.slice(3, 3 + q.crumbCount)
    const sides = fanPlates(crumbs, [...(end ? [end] : []), ...scr.slice(3 + q.crumbCount)], a)
    q.onPlates(sides)
    setPlace(
      placeCallout({
        anchor: a,
        end,
        prev: q.prev ? scr[2]! : null,
        dots: [a, ...(end ? [end] : []), ...scr.slice(3)],
        plates: crumbs.map((d, i) => plateBox(d, sides[i]!)),
        box: bb,
        size: sz,
        avoidCorner: q.avoidCorner,
      }),
    )
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
          <Text maxFontSizeMultiplier={FONT_CAP} numberOfLines={1} style={[TYPE.serif, { fontSize: 24, lineHeight: 26, color: P.ink }]}>
            {p.value}
            <Text maxFontSizeMultiplier={FONT_CAP} style={{ fontFamily: FONT.mono, fontSize: 13 }}> {p.unit}</Text>
          </Text>
          <Text maxFontSizeMultiplier={FONT_CAP} numberOfLines={1} style={[TYPE.body, { fontSize: 12, lineHeight: 15, color: P.ink }]}>
            {p.sub}
          </Text>
        </View>
      </HardShadow>
    </View>
  )
}
