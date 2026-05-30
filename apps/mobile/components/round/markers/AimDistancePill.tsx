import { Text, View } from 'react-native'
import Mapbox from '@rnmapbox/maps'
import type { LatLng } from '../HoleMap.types'

function toCoord(l: LatLng): [number, number] {
  return [l.lng, l.lat]
}

interface AimDistancePillProps {
  midpoint: LatLng
  display: string
  /** Optional second line under the carry — the live strokes-gained readout
   *  (e.g. "+0.3 · FWY"). `sublabelTone` colors it pos/neg per DESIGN.md. */
  sublabel?: string | null
  sublabelTone?: 'pos' | 'neg'
}

// Sized + colored for outdoor readability — large white serif numerals
// on a dark, semi-opaque pill, anchored at the aim line midpoint. The
// optional sublabel renders the live SG under the carry (Task 6).
export function AimDistancePill({
  midpoint,
  display,
  sublabel,
  sublabelTone = 'pos',
}: AimDistancePillProps) {
  return (
    <Mapbox.PointAnnotation id="aimDistance" coordinate={toCoord(midpoint)}>
      <View
        style={{
          backgroundColor: 'rgba(28,33,28,0.85)',
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 6,
          alignItems: 'center',
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
        {sublabel ? (
          <Text
            style={{
              // caddie-pos / caddie-neg, brightened for satellite contrast.
              color: sublabelTone === 'neg' ? '#E8A08F' : '#9FD3B0',
              fontSize: 12,
              fontWeight: '600',
              letterSpacing: 0.4,
              fontVariant: ['tabular-nums'],
              marginTop: 1,
            }}
          >
            {sublabel}
          </Text>
        ) : null}
      </View>
    </Mapbox.PointAnnotation>
  )
}
