import { useEffect, useState, type ReactNode, type RefObject } from 'react'
import { Text, View } from 'react-native'
import Mapbox from '@rnmapbox/maps'
import Svg, { Path, Rect } from 'react-native-svg'
import type { LatLng } from '../HoleMap.types'
import { TYPE } from '../../../lib/typography'
import { HardShadow } from '../../paper/Paper'
import { FONT_CAP, P, R } from '../../paper/tokens'

function toCoord(l: LatLng): [number, number] {
  return [l.lng, l.lat]
}

// Fraunces figure height / em for the bundled font (see paper/HeroRow).
const FIG = 0.66
const TICK = 18
const GAP = 8

// Paper tag on an aim-line leg (#611 §7): an 18×3 ink tick across the line
// at the leg's midpoint, then a raised tag whose pointer notch touches it.
// Right of the line; the left-hand layout flips it (tag left, pointer right).
export type LegTagClamp = { map: RefObject<Mapbox.MapView | null>; maxY: number; idleTick: number }

function LegTag({
  id,
  at,
  lefty,
  padding,
  toward,
  clamp,
  children,
}: {
  id: string
  at: LatLng
  lefty: boolean
  padding: [number, number, number, number]
  /** Far end of the leg: where the tag slides to stay above `clamp.maxY`. */
  toward?: LatLng
  clamp?: LegTagClamp
  children: ReactNode
}) {
  // The MarkerView anchors a fraction of its own width; pin the tick's
  // centre on the coordinate once the width is known.
  const [w, setW] = useState(0)
  const [h, setH] = useState(0)
  // After each camera settle: if the tag's box dips below maxY (into the
  // dock's stacks), binary-search along the leg toward its far end for the
  // lowest spot that clears. Stays on the line, so the tick still marks it.
  const [pos, setPos] = useState(at)
  useEffect(() => {
    let live = true
    const map = clamp?.map.current
    if (!map || !clamp || !toward || !h) {
      setPos(at)
      return
    }
    const lerp = (t: number): LatLng => ({ lat: at.lat + (toward.lat - at.lat) * t, lng: at.lng + (toward.lng - at.lng) * t })
    const fits = async (p: LatLng) => {
      const [, y = -1] = await map.getPointInView([p.lng, p.lat])
      return y >= 0 && y + h / 2 <= clamp.maxY
    }
    void (async () => {
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
  }, [at.lat, at.lng, toward?.lat, toward?.lng, h, clamp?.maxY, clamp?.idleTick])
  const tickX = lefty ? w - TICK / 2 : TICK / 2
  const pointer = (
    <Svg
      width={10}
      height={14}
      viewBox="0 0 10 14"
      style={{ position: 'absolute', top: '50%', marginTop: -7, [lefty ? 'right' : 'left']: -9 }}
    >
      {lefty ? (
        <>
          <Path d="M0 0.5 9 7 0 13.5" fill={P.raised} stroke={P.ink} strokeWidth={1} />
          <Rect x={-1} y={1} width={2} height={12} fill={P.raised} />
        </>
      ) : (
        <>
          <Path d="M10 0.5 1 7l9 6.5" fill={P.raised} stroke={P.ink} strokeWidth={1} />
          <Rect x={9} y={1} width={2} height={12} fill={P.raised} />
        </>
      )}
    </Svg>
  )
  return (
    <Mapbox.MarkerView
      id={id}
      coordinate={toCoord(pos)}
      anchor={{ x: w > 0 ? tickX / w : 0, y: 0.5 }}
      allowOverlap
    >
      <View
        onLayout={(e) => {
          setW(e.nativeEvent.layout.width)
          setH(e.nativeEvent.layout.height)
        }}
        style={{
          flexDirection: lefty ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: GAP,
          opacity: w > 0 ? 1 : 0,
          // Room for the hard shadow so the MarkerView doesn't clip it.
          paddingRight: lefty ? 0 : 2,
          paddingLeft: lefty ? 2 : 0,
          paddingBottom: 2,
        }}
      >
        <View
          style={{
            width: TICK,
            height: 5,
            backgroundColor: P.raised,
            borderRadius: 1,
            padding: 1,
          }}
        >
          <View style={{ flex: 1, backgroundColor: P.ink, borderRadius: 1 }} />
        </View>
        <HardShadow dx={lefty ? -2 : 2}>
          <View
            style={{
              backgroundColor: P.raised,
              borderWidth: 1,
              borderColor: P.ink,
              borderRadius: R,
              paddingTop: padding[0],
              paddingRight: padding[1],
              paddingBottom: padding[2],
              paddingLeft: padding[3],
              alignItems: lefty ? 'flex-end' : 'flex-start',
            }}
          >
            {pointer}
            {children}
          </View>
        </HardShadow>
      </View>
    </Mapbox.MarkerView>
  )
}

function split(display: string): { whole: string; dec?: string; unit: string } {
  const [num = '', unit = ''] = display.split(' ')
  const [whole = '', dec] = num.split('.')
  return { whole, dec, unit }
}

// Aim (ball → aim), §3.2: number at 32 with the stacked [.4 / yd] column
// the height of its figures, then "fairway · −0.1".
export function AimTag({
  at,
  display,
  lie,
  sg,
  lefty,
  toward,
  clamp,
}: {
  at: LatLng
  toward?: LatLng
  clamp?: LegTagClamp
  /** e.g. "101.4 yd" */
  display: string
  lie: string | null
  sg: number | null
  lefty: boolean
}) {
  const { whole, dec, unit } = split(display)
  const colH = Math.round(32 * FIG)
  return (
    <LegTag id="aimDistance" at={at} lefty={lefty} padding={[3, 11, 5, 12]} toward={toward} clamp={clamp}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { fontSize: 32, lineHeight: 34, letterSpacing: -0.9, color: P.ink }]}>{whole}</Text>
        <View
          style={{
            height: colH,
            marginLeft: 2,
            marginBottom: 7,
            justifyContent: dec !== undefined ? 'space-between' : 'flex-end',
          }}
        >
          {dec !== undefined && (
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { fontSize: 15, lineHeight: 12, color: P.ink }]}>.{dec}</Text>
          )}
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.kicker, { fontSize: 11, lineHeight: 9, color: P.ink }]}>{unit}</Text>
        </View>
      </View>
      {lie != null && sg != null && (
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 12, lineHeight: 15, color: P.ink }]}>
          {lie} ·{' '}
          <Text maxFontSizeMultiplier={FONT_CAP} style={{ color: sg < 0 ? P.neg : P.ink }}>
            {sg < 0 ? '−' : '+'}
            {Math.abs(sg).toFixed(1)}
          </Text>
        </Text>
      )}
    </LegTag>
  )
}

// Remaining (aim → pin): 22 with an inline small decimal (the stacked column
// doesn't fit at 22).
export function RemainingTag({ at, display, lefty }: { at: LatLng; display: string; lefty: boolean }) {
  const { whole, dec, unit } = split(display)
  return (
    <LegTag id="remainingDistance" at={at} lefty={lefty} padding={[2, 10, 3, 11]}>
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { fontSize: 22, lineHeight: 26, letterSpacing: -0.5, color: P.ink }]}>
        {whole}
        {dec !== undefined && <Text maxFontSizeMultiplier={FONT_CAP} style={{ fontSize: 13, letterSpacing: 0 }}>.{dec}</Text>}
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.kicker, { fontSize: 14, letterSpacing: 0 }]}> {unit}</Text>
      </Text>
    </LegTag>
  )
}
