import { Text, View } from 'react-native'
import Mapbox from '@rnmapbox/maps'
import { PressableTouch } from '../../ui/PressableTouch'
import type { LatLng, OffscreenArrow } from '../HoleMap.types'
import { TYPE } from '../../../lib/typography'
import { KICKER } from '../hole/types'

function toCoord(l: LatLng): [number, number] {
  return [l.lng, l.lat]
}

// "Drag to adjust" (#901 H3) — hangs below the ball's 44pt grab disc while
// placing it. pointerEvents="none" keeps this MarkerView (which otherwise
// captures touches) off the ball drag; allowOverlapWithPuck because the
// GPS-tracked ball sits on the location puck, and MarkerViews near the puck
// are hidden by default.
export function DragHint({ ball }: { ball: LatLng }) {
  return (
    <Mapbox.MarkerView
      id="dragHint"
      coordinate={toCoord(ball)}
      anchor={{ x: 0.5, y: 0 }}
      allowOverlap
      allowOverlapWithPuck
      pointerEvents="none"
    >
      <View pointerEvents="none" style={{ paddingTop: 26, alignItems: 'center' }}>
        <View
          style={{
            backgroundColor: 'rgba(28,33,28,0.82)',
            borderRadius: 4,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}
        >
          <Text style={[TYPE.body, { color: '#F2EEE5', fontSize: 12 }]}>Drag to adjust</Text>
        </View>
      </View>
    </Mapbox.MarkerView>
  )
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

// "Went OB?" on the most recent shot's marker (#895 B2), shown while that
// marker is on-screen; MapBottomChrome's edge tab takes over when it isn't.
// The pill sits above the marker; box-none keeps the gap under it tappable
// for the map.
export function ObCallout({
  at,
  isOb,
  onPress,
  onWidth,
}: {
  at: LatLng
  isOb: boolean
  onPress: () => void
  onWidth: (width: number) => void
}) {
  const label = isOb ? '⚠ OB — tap to undo' : '⚠ Went OB?'
  return (
    <Mapbox.MarkerView
      id="obCallout"
      coordinate={toCoord(at)}
      anchor={{ x: 0.5, y: 1 }}
      allowOverlap
      allowOverlapWithPuck
      pointerEvents="box-none"
    >
      <View pointerEvents="box-none" style={{ paddingBottom: 16 }}>
        <PressableTouch
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onPress}
          onLayout={(e) => onWidth(e.nativeEvent.layout.width)}
          hitSlop={6}
          android_ripple={{ color: 'rgba(242,238,229,0.18)' }}
          style={{
            backgroundColor: 'rgba(28,33,28,0.92)',
            borderColor: 'rgba(163,58,42,0.9)',
            borderWidth: 1,
            borderRadius: 14,
            paddingVertical: 7,
            paddingHorizontal: 12,
          }}
        >
          <Text style={[TYPE.kicker, { ...KICKER, color: '#E6A99C' }]}>{label}</Text>
        </PressableTouch>
      </View>
    </Mapbox.MarkerView>
  )
}
