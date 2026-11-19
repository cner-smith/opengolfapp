import { useEffect, useRef, useState } from 'react'
import { Platform, Text, View } from 'react-native'
import Mapbox from '@rnmapbox/maps'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import Svg, { Path, Text as SvgText, TSpan } from 'react-native-svg'
import { nearestTurn, type Wayfinder, type WayfinderEllipse } from '@oga/core'
import { useWayfinder, WAYFINDER_ARROW } from '../hooks/useWayfinder'
import type { LatLng, OffscreenArrow } from '../HoleMap.types'
import { FONT, TYPE } from '../../../lib/typography'
import { Key } from '../../paper/Paper'
import { FONT_CAP, P } from '../../paper/tokens'

function toCoord(l: LatLng): [number, number] {
  return [l.lng, l.lat]
}

// Where a map point sits relative to the usable map area, or null when it's
// comfortably in view. x/y come from getPointInView, which answers Mapbox's
// (-1, -1) px sentinel for a point outside the map entirely — then only
// `relBearing` (bearing from the map centre to the point, minus the camera
// heading) can say which way it is. The margins keep a point under the corner
// HUD pills or the bottom chrome counting as off-screen: its callout would be
// covered. `sideMargin` is half the callout's measured width — it centres on
// the point, so any closer to a side edge and it clips.
// Buttons inside a MarkerView: on iOS the press rect is measured from the
// React layout, where the marker sits at the map's corner, so any finger roll
// cancelled the tap (rnmapbox fixes this for Android only). Keep it generous.
export const MARKER_PRESS_RETENTION = Platform.OS === 'ios' ? 10000 : undefined

export function offscreenArrow(
  x: number,
  y: number,
  w: number,
  h: number,
  relBearing: number,
  sideMargin: number,
): OffscreenArrow | null {
  if (x < 0 || y < 0) {
    const b = ((relBearing % 360) + 360) % 360
    return b < 45 || b >= 315 ? '↑' : b < 135 ? '→' : b < 225 ? '↓' : '←'
  }
  if (y > h - 190) return '↓'
  if (y < 70) return '↑'
  if (x < sideMargin) return '←'
  if (x > w - sideMargin) return '→'
  return null
}

// "OB?" on the most recent shot's marker (#895 B2, #611 §7): a small raised
// key, brick text on the ink edge, whose bottom sits 11 above the marker's
// grab disc. Kept small so it asks without shouting. Android ignores touches
// outside a parent's bounds, so the wrapper's padding is what makes room for
// the hitSlop: the touch area stays about 55 × 64 dp.
// Shown while that marker is on-screen; the dock's voice line asks when it
// isn't. box-none keeps the gap under it tappable for the map.
export function ObCallout({
  at,
  onPress,
  busy,
  onWidth,
}: {
  at: LatLng
  onPress: () => void
  /** The OB request is in flight (#1112). */
  busy?: boolean
  onWidth: (width: number) => void
}) {
  return (
    <Mapbox.MarkerView
      id="obCallout"
      coordinate={toCoord(at)}
      anchor={{ x: 0.5, y: 1 }}
      allowOverlap
      allowOverlapWithPuck
      pointerEvents="box-none"
    >
      <View
        pointerEvents="box-none"
        style={{ paddingTop: 10, paddingHorizontal: 10, paddingBottom: 33 }}
        onLayout={(e) => onWidth(e.nativeEvent.layout.width)}
      >
        <Key
          accessibilityLabel="Did this shot go out of bounds?"
          onPress={onPress}
          disabled={busy}
          hitSlop={10}
          pressRetentionOffset={MARKER_PRESS_RETENTION}
          faceStyle={{ minHeight: 32, paddingHorizontal: 9 }}
        >
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 13, color: P.neg }]}>{busy ? 'Saving…' : 'OB?'}</Text>
        </Key>
      </View>
    </Mapbox.MarkerView>
  )
}

// The wayfinder (#1386): a compass rose. The wide, flat chevron rides an
// ellipse inside the map, turned toward the ball, with the ball's distance to
// the pin on its inner side. No backdrop: ink with a paper halo reads over the
// imagery. Not a control: touches go through. Its own component, so a camera
// frame re-renders only the arrow, never the map.
export function WayfinderLayer(props: Parameters<typeof useWayfinder>[0]) {
  return <WayfinderKey wf={useWayfinder(props)} />
}

const LABEL = { width: 80, height: 26 }
const TURN = { duration: 200 }
const FADE = { duration: 150 }

// Core's ellipsePoint, as a worklet: the UI thread can't call into core.
function onEllipse(t: number, e: WayfinderEllipse): [number, number] {
  'worklet'
  const c = Math.cos(t)
  const s = Math.sin(t)
  const k = 1 / Math.sqrt((c / e.rx) * (c / e.rx) + (s / e.ry) * (s / e.ry))
  return [e.cx + c * k, e.cy + s * k]
}

function WayfinderKey({ wf }: { wf: Wayfinder | null }) {
  // The arrow travels the curve: its angle on the ellipse is tweened, never
  // its x/y, and the label rides the same angle. It fades in and out rather
  // than popping; a new showing starts where it lands, without a sweep.
  const [shown, setShown] = useState(wf)
  const theta = useSharedValue(wf?.theta ?? 0)
  const turn = useSharedValue(wf?.rotate ?? 0)
  const ellipse = useSharedValue<WayfinderEllipse>(wf?.ellipse ?? { cx: 0, cy: 0, rx: 1, ry: 1 })
  const opacity = useSharedValue(0)
  const showing = useRef(false)
  useEffect(() => {
    if (!wf) {
      showing.current = false
      opacity.value = withTiming(0, FADE)
      return
    }
    setShown(wf)
    ellipse.value = wf.ellipse
    if (!showing.current) {
      showing.current = true
      theta.value = wf.theta
      turn.value = wf.rotate
      opacity.value = withTiming(1, FADE)
      return
    }
    theta.value = withTiming(nearestTurn(theta.value, wf.theta, 2 * Math.PI), TURN)
    turn.value = withTiming(nearestTurn(turn.value, wf.rotate, 360), TURN)
  }, [wf?.theta, wf?.rotate, wf?.ellipse.cx, wf?.ellipse.cy, wf?.ellipse.rx, wf?.ellipse.ry, wf == null])
  const arrowStyle = useAnimatedStyle(() => {
    const [x, y] = onEllipse(theta.value, ellipse.value)
    return {
      opacity: opacity.value,
      transform: [{ translateX: x - 24 }, { translateY: y - 24 }, { rotate: `${turn.value}deg` }],
    }
  })
  const labelStyle = useAnimatedStyle(() => {
    const e = ellipse.value
    const [x, y] = onEllipse(theta.value, e)
    // In from the arrow along the ellipse's inner side, far enough that the
    // two never touch whichever way the arrow sits.
    const d = Math.hypot(e.cx - x, e.cy - y) || 1
    const ix = (e.cx - x) / d
    const iy = (e.cy - y) / d
    const reach = WAYFINDER_ARROW + 2 + (Math.abs(ix) * LABEL.width) / 2 + (Math.abs(iy) * LABEL.height) / 2
    return {
      opacity: opacity.value,
      transform: [{ translateX: x + ix * reach - LABEL.width / 2 }, { translateY: y + iy * reach - LABEL.height / 2 }],
    }
  })
  if (!shown) return null
  // "46 yd" → a serif number and its unit; '—' has no unit.
  const cut = shown.distance.lastIndexOf(' ')
  const [num, unit] = cut < 0 ? [shown.distance, ''] : [shown.distance.slice(0, cut), shown.distance.slice(cut + 1)]
  return (
    <View
      pointerEvents="none"
      accessible={wf != null}
      accessibilityLabel={`Your ball, ${shown.distance} from the pin`}
      style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
    >
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: 48, height: 48 }, arrowStyle]}>
        <Svg width={48} height={48} viewBox="-24 -24 48 48">
          <Path d="M0,-11 L16,11 L0,2 L-16,11 Z" fill={P.raised} stroke={P.raised} strokeWidth={5} strokeLinejoin="round" />
          <Path d="M0,-11 L16,11 L0,2 L-16,11 Z" fill={P.ink} />
        </Svg>
      </Animated.View>
      {/* SVG text: a 5 dp paper stroke under the ink draws a solid outline. */}
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: LABEL.width, height: LABEL.height }, labelStyle]}>
        <Svg width={LABEL.width} height={LABEL.height}>
          {[true, false].map((outline) => (
            <SvgText
              key={String(outline)}
              // The anchor centres the number alone: shift by about half the unit.
              x={LABEL.width / 2 - (unit ? 3 * unit.length + 3 : 0)}
              y={19}
              textAnchor="middle"
              fontFamily={FONT.serifItalic}
              fontSize={18}
              fill={outline ? P.raised : P.ink}
              stroke={outline ? P.raised : undefined}
              strokeWidth={outline ? 5 : undefined}
              strokeLinejoin="round"
            >
              {num}
              {unit ? (
                <TSpan fontFamily={FONT.body} fontSize={11}>
                  {' ' + unit}
                </TSpan>
              ) : null}
            </SvgText>
          ))}
        </Svg>
      </Animated.View>
    </View>
  )
}
