import { View } from 'react-native'
import Svg, { Rect } from 'react-native-svg'

// Flag glyph wrapped in an explicit-size View so PointAnnotation has
// a plain native child to measure on Android. Earlier nested-flex
// versions collapsed to a white blip; an unwrapped <Svg> child can
// also measure as zero on older Android API levels because Mapbox's
// annotation calls measure() before the SVG native view reports its
// size. The 28x38 View is the load-bearing piece — the SVG is just
// the glyph painted inside it.
//
// Layout (28x38 viewbox):
//   Pole (cream rect)       : x=3,  y=0,  w=3,  h=34
//   Cloth (red rect)        : x=6,  y=0,  w=15, h=11
//   Base disk (cream pill)  : x=0,  y=34, w=9,  h=3
export function FlagMarker({ tone }: { tone: 'dim' | 'strong' }) {
  const flagColor = tone === 'strong' ? '#A33A2A' : 'rgba(163,58,42,0.85)'
  const poleColor = '#FBF8F1'
  return (
    <View style={{ width: 28, height: 38 }}>
      <Svg width={28} height={38} viewBox="0 0 28 38">
        <Rect x={3} y={0} width={3} height={34} fill={poleColor} />
        <Rect
          x={6}
          y={0}
          width={15}
          height={11}
          fill={flagColor}
          rx={1}
          ry={1}
        />
        <Rect
          x={0}
          y={34}
          width={9}
          height={3}
          rx={1.5}
          ry={1.5}
          fill={poleColor}
        />
      </Svg>
    </View>
  )
}
