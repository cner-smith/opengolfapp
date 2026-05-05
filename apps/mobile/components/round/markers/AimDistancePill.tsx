import { Text, View } from 'react-native'
import Mapbox from '@rnmapbox/maps'
import type { LatLng } from '../HoleMap.types'

function toCoord(l: LatLng): [number, number] {
  return [l.lng, l.lat]
}

interface AimDistancePillProps {
  midpoint: LatLng
  display: string
}

// Sized + colored for outdoor readability — large white serif numerals
// on a dark, semi-opaque pill, anchored at the aim line midpoint.
export function AimDistancePill({ midpoint, display }: AimDistancePillProps) {
  return (
    <Mapbox.PointAnnotation id="aimDistance" coordinate={toCoord(midpoint)}>
      <View
        style={{
          backgroundColor: 'rgba(28,33,28,0.85)',
          borderRadius: 999,
          paddingHorizontal: 14,
          paddingVertical: 6,
        }}
      >
        <Text
          style={{
            color: '#F2EEE5',
            fontFamily: 'Fraunces-Medium',
            fontSize: 26,
            fontWeight: '600',
            fontVariant: ['tabular-nums'],
          }}
        >
          {display}
        </Text>
      </View>
    </Mapbox.PointAnnotation>
  )
}
