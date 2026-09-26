import { Text, View } from 'react-native'
import Mapbox from '@rnmapbox/maps'
import type { LatLng, OffscreenArrow } from '../HoleMap.types'
import { TYPE } from '../../../lib/typography'
import { Key } from '../../paper/Paper'
import { Icon } from '../../paper/icons'
import { P } from '../../paper/tokens'

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

// "Went OB?" on the most recent shot's marker (#895 B2, #611 §7): a raised
// key with a brick edge whose bottom sits 11 above the marker's grab disc.
// Shown while that marker is on-screen; the dock's voice line asks when it
// isn't. box-none keeps the gap under it tappable for the map.
export function ObCallout({
  at,
  onPress,
  onWidth,
}: {
  at: LatLng
  onPress: () => void
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
      <View pointerEvents="box-none" style={{ paddingBottom: 33 }} onLayout={(e) => onWidth(e.nativeEvent.layout.width)}>
        <Key
          accessibilityLabel="Did this shot go out of bounds?"
          onPress={onPress}
          edge={P.neg}
          borderWidth={1.5}
          hitSlop={6}
          faceStyle={{ minHeight: 44, flexDirection: 'row', gap: 8, paddingLeft: 12, paddingRight: 14 }}
        >
          <Icon.warn size={17} color={P.neg} />
          <Text style={[TYPE.bodyBold, { fontSize: 15, color: P.neg }]}>Went OB?</Text>
        </Key>
      </View>
    </Mapbox.MarkerView>
  )
}
