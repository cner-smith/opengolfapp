import { useState, type ReactNode } from 'react'
import { Text, View } from 'react-native'
import Mapbox from '@rnmapbox/maps'
import Svg, { Path, Rect } from 'react-native-svg'
import type { LatLng } from '../HoleMap.types'
import { TYPE } from '../../../lib/typography'
import { HardShadow } from '../../paper/Paper'
import { P, R } from '../../paper/tokens'

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
function LegTag({
  id,
  at,
  lefty,
  padding,
  children,
}: {
  id: string
  at: LatLng
  lefty: boolean
  padding: [number, number, number, number]
  children: ReactNode
}) {
  // The MarkerView anchors a fraction of its own width; pin the tick's
  // centre on the coordinate once the width is known.
  const [w, setW] = useState(0)
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
      coordinate={toCoord(at)}
      anchor={{ x: w > 0 ? tickX / w : 0, y: 0.5 }}
      allowOverlap
    >
      <View
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
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

// Carry (ball → aim), §3.2: number at 32 with the stacked [.4 / yd] column
// the height of its figures, then "fairway · −0.1".
export function CarryTag({
  at,
  display,
  lie,
  sg,
  lefty,
}: {
  at: LatLng
  /** e.g. "101.4 yd" */
  display: string
  lie: string | null
  sg: number | null
  lefty: boolean
}) {
  const { whole, dec, unit } = split(display)
  const colH = Math.round(32 * FIG)
  return (
    <LegTag id="aimDistance" at={at} lefty={lefty} padding={[3, 11, 5, 12]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <Text style={[TYPE.serif, { fontSize: 32, lineHeight: 34, letterSpacing: -0.9, color: P.ink }]}>{whole}</Text>
        <View
          style={{
            height: colH,
            marginLeft: 2,
            marginBottom: 7,
            justifyContent: dec !== undefined ? 'space-between' : 'flex-end',
          }}
        >
          {dec !== undefined && (
            <Text style={[TYPE.serif, { fontSize: 15, lineHeight: 12, color: P.ink }]}>.{dec}</Text>
          )}
          <Text style={[TYPE.kicker, { fontSize: 11, lineHeight: 9, color: P.ink }]}>{unit}</Text>
        </View>
      </View>
      {lie != null && sg != null && (
        <Text style={[TYPE.body, { fontSize: 12, lineHeight: 15, color: P.ink }]}>
          {lie} ·{' '}
          <Text style={{ color: sg < 0 ? P.neg : P.ink }}>
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
      <Text style={[TYPE.serif, { fontSize: 22, lineHeight: 26, letterSpacing: -0.5, color: P.ink }]}>
        {whole}
        {dec !== undefined && <Text style={{ fontSize: 13, letterSpacing: 0 }}>.{dec}</Text>}
        <Text style={[TYPE.kicker, { fontSize: 14, letterSpacing: 0 }]}> {unit}</Text>
      </Text>
    </LegTag>
  )
}
