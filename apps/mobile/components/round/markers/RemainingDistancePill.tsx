import { Text, View } from 'react-native'
import Mapbox from '@rnmapbox/maps'
import type { LatLng } from '../HoleMap.types'
import { TYPE } from '../../../lib/typography'

function toCoord(l: LatLng): [number, number] {
  return [l.lng, l.lat]
}

// Remaining (aim→pin) distance — subordinate to AimDistancePill's hero carry:
// a smaller, dimmer label anchored at the aim→pin leg's midpoint.
export function RemainingDistancePill({ midpoint, display }: { midpoint: LatLng; display: string }) {
  return (
    <Mapbox.MarkerView id="remainingDistance" coordinate={toCoord(midpoint)} allowOverlap>
      <View
        style={{
          backgroundColor: 'rgba(28,33,28,0.92)',
          borderRadius: 9,
          paddingHorizontal: 9,
          paddingVertical: 3,
        }}
      >
        <Text
          style={[
            TYPE.serifUpright,
            {
              color: '#E8E2D4',
              fontSize: 14,
              fontWeight: '600',
              fontVariant: ['tabular-nums'],
            },
          ]}
        >
          {display}
        </Text>
      </View>
    </Mapbox.MarkerView>
  )
}
