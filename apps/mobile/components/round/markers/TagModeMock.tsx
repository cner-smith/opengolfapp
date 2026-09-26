import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Dimensions, Pressable, Text, View } from 'react-native'
import Svg, { Circle, Line } from 'react-native-svg'
import { dispersionRodsGeoJSON } from '@oga/core'
import type { LatLng } from '../HoleMap.types'
import type { PatternOverlay } from './DispersionLayers'
import { useUnits } from '../../../hooks/useUnits'
import { TYPE } from '../../../lib/typography'
import { HardShadow } from '../../paper/Paper'
import { P, R } from '../../paper/tokens'

// THROWAWAY (#611 PR4 declutter mock, round 2): four ways to stop the map
// tags crowding, flipped from a chip over the map until the owner picks.
//   0 as built
//   1 the ± numbers live in the wheel rows; the map keeps bare rods
//   2 carry + remaining merge into one tag near the ball
//   3 every tag in a callout lane beside the aim line, with leader lines
//   4 approach shots get the full-shot framing (ring clear of the dock)
export type TagMode = '0' | '1' | '2' | '3' | '4'
const LABEL: Record<TagMode, string> = {
  '0': 'as built',
  '1': '1 numbers in wheel',
  '2': '2 one leg tag',
  '3': '3 callout lane',
  '4': '4 reframe',
}
let tagMode: TagMode = '0'
const subs = new Set<() => void>()
export function useTagMode(): TagMode {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    () => tagMode,
  )
}
export function TagModeChip() {
  const m = useTagMode()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Tag layout ${LABEL[m]}, tap to switch`}
      onPress={() => {
        tagMode = String((Number(m) + 1) % 5) as TagMode
        subs.forEach((cb) => cb())
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
      <Text style={[TYPE.kicker, { fontSize: 12, color: P.ink }]}>tags {LABEL[m]}</Text>
    </Pressable>
  )
}

// The dock's side stacks stand this far above the map's bottom edge (the map
// runs under them). ponytail: measured once on the emulator.
const STACKS_DP = 403
const GAP = 6
const LANE_OFF = 26

interface Item {
  key: string
  at: LatLng
  h: number
  node: ReactNode
}

// Mode 3: tags stacked in on-course order in a column on the side away from
// the carry, each tied back to its point by a hairline. Re-laid out when the
// camera settles (it lags during a pan).
export function CalloutLane({
  ball,
  aim,
  pattern,
  carryAt,
  carryText,
  carrySub,
  remainingAt,
  remainingText,
  lefty,
  projectRef,
  camKey,
  mapH,
}: {
  ball: LatLng
  aim: LatLng
  pattern: PatternOverlay | null
  carryAt: LatLng | null
  carryText: string | null
  carrySub: string | null
  remainingAt: LatLng | null
  remainingText: string | null
  lefty: boolean
  projectRef: { current: ((pts: LatLng[]) => Promise<[number, number][] | null>) | null }
  camKey: number
  mapH: number
}) {
  const { toDisplay } = useUnits()
  const [laid, setLaid] = useState<{ items: Item[]; ys: number[]; pts: [number, number][]; edge: number } | null>(null)

  useEffect(() => {
    const items: Item[] = []
    if (remainingAt && remainingText) {
      items.push({ key: 'rem', at: remainingAt, h: 30, node: <Big text={remainingText} size={20} sub="to the pin" /> })
    }
    const d = pattern?.dispersion
    const rods = d && d.sampleSize >= 10 ? dispersionRodsGeoJSON(ball, aim, d) : null
    if (rods && d) {
      items.push({ key: 'len', at: rods.lengthTag, h: 30, node: <Big text={`±${toDisplay(d.along68)}`} size={15} sub="long" /> })
      items.push({ key: 'wid', at: rods.widthTag, h: 30, node: <Big text={`±${toDisplay(d.perp68)}`} size={15} sub="wide" /> })
    }
    if (carryAt && carryText) {
      items.push({ key: 'carry', at: carryAt, h: 44, node: <Big text={carryText} size={26} sub={carrySub ?? undefined} /> })
    }
    let live = true
    void (async () => {
      const s = await projectRef.current?.([aim, ...items.map((i) => i.at)])
      if (!live || !s) return
      const lineX = s[0]![0]
      const pts = s.slice(1)
      const order = items.map((_, i) => i).sort((a, b) => pts[a]![1] - pts[b]![1])
      const ys: number[] = []
      let bottom = 8
      for (const i of order) {
        const y = Math.max(pts[i]![1] - items[i]!.h / 2, bottom)
        ys[i] = y
        bottom = y + items[i]!.h + GAP
      }
      // Keep the lane above the dock stacks: shift the whole stack up.
      const over = bottom - GAP - (mapH - STACKS_DP - GAP)
      if (over > 0) order.forEach((i) => (ys[i] = Math.max(8, ys[i]! - over)))
      setLaid({ items, pts, ys, edge: lefty ? lineX + LANE_OFF : lineX - LANE_OFF })
    })()
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camKey, mapH, lefty, ball.lat, ball.lng, aim.lat, aim.lng, pattern, carryText, carrySub, remainingText, carryAt?.lat, remainingAt?.lat])

  if (!laid) return null
  const W = Dimensions.get('window').width
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
      <Svg width={W} height={mapH} style={{ position: 'absolute' }}>
        {laid.items.map((it, i) => (
          <Line
            key={it.key}
            x1={laid.edge}
            y1={laid.ys[i]! + it.h / 2}
            x2={laid.pts[i]![0]}
            y2={laid.pts[i]![1]}
            stroke={P.raised}
            strokeWidth={1.5}
            strokeOpacity={0.9}
          />
        ))}
        {laid.pts.map((p, i) => (
          <Circle key={i} cx={p[0]} cy={p[1]} r={3} fill={P.raised} stroke={P.ink} strokeWidth={1} />
        ))}
      </Svg>
      {laid.items.map((it, i) => (
        <View
          key={it.key}
          style={{
            position: 'absolute',
            top: laid.ys[i],
            height: it.h,
            justifyContent: 'center',
            ...(lefty ? { left: laid.edge } : { right: W - laid.edge }),
          }}
        >
          <HardShadow>
            <View style={{ backgroundColor: P.raised, borderWidth: 1, borderColor: P.ink, borderRadius: 2, paddingHorizontal: 7 }}>
              {it.node}
            </View>
          </HardShadow>
        </View>
      ))}
    </View>
  )
}

function Big({ text, size, sub }: { text: string; size: number; sub?: string }) {
  const i = text.lastIndexOf(' ')
  return (
    <Text numberOfLines={1} style={[TYPE.serif, { fontSize: size, lineHeight: size + 6, color: P.ink, paddingRight: 3 }]}>
      {text.slice(0, i)}
      <Text style={[TYPE.kicker, { fontSize: 11 }]}>
        {' '}
        {text.slice(i + 1)}
        {sub ? ` ${sub}` : ''}
      </Text>
    </Text>
  )
}
