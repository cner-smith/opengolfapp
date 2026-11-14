import { Platform, Text, View } from 'react-native'
import Mapbox from '@rnmapbox/maps'
import Svg, { G, Path } from 'react-native-svg'
import type { Wayfinder } from '@oga/core'
import type { LatLng, OffscreenArrow } from '../HoleMap.types'
import { TYPE } from '../../../lib/typography'
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
// imagery. Not a control: touches go through.
/** Half the arrow's box, dp: what it keeps clear of the keys and the flag. */
export const WAYFINDER_ARROW = 20
/** dp the arrow's ellipse keeps in from the map's open edges. */
export const WAYFINDER_INSET = 24
const LABEL = { width: 84, height: 28 }
const HALO = { textShadowColor: P.raised, textShadowRadius: 4, textShadowOffset: { width: 0, height: 0 } }

export function WayfinderKey({ wf }: { wf: Wayfinder }) {
  // The label's centre: in from the arrow along the ellipse's inner side, far
  // enough that the two never touch whichever way the arrow sits.
  const [ix, iy] = wf.inward
  const reach = WAYFINDER_ARROW + 2 + (Math.abs(ix) * LABEL.width) / 2 + (Math.abs(iy) * LABEL.height) / 2
  // "46 yd" → a serif number and its unit; '—' has no unit.
  const cut = wf.distance.lastIndexOf(' ')
  const [num, unit] = cut < 0 ? [wf.distance, ''] : [wf.distance.slice(0, cut), wf.distance.slice(cut + 1)]
  return (
    <View
      pointerEvents="none"
      accessible
      accessibilityLabel={`Your ball, ${wf.distance} from the pin`}
      style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
    >
      <Svg
        width={48}
        height={48}
        viewBox="-24 -24 48 48"
        style={{ position: 'absolute', left: wf.x - 24, top: wf.y - 24 }}
      >
        <G rotation={wf.rotate} origin="0,0">
          <Path d="M0,-11 L16,11 L0,2 L-16,11 Z" fill={P.raised} stroke={P.raised} strokeWidth={5} strokeLinejoin="round" />
          <Path d="M0,-11 L16,11 L0,2 L-16,11 Z" fill={P.ink} />
        </G>
      </Svg>
      <View
        style={{
          position: 'absolute',
          left: wf.x + ix * reach - LABEL.width / 2,
          top: wf.y + iy * reach - LABEL.height / 2,
          width: LABEL.width,
          height: LABEL.height,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text allowFontScaling={false} style={[TYPE.serif, HALO, { fontSize: 22, lineHeight: 26, color: P.ink }]}>
          {num}
          {unit ? <Text style={[TYPE.body, HALO, { fontSize: 13 }]}> {unit}</Text> : null}
        </Text>
      </View>
    </View>
  )
}
