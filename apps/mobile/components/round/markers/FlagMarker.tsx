import Svg, { Circle, Rect } from 'react-native-svg'

// Flag glyph rendered as SVG so PointAnnotation has a single
// fixed-size native child to position. Earlier nested-flex versions
// collapsed to a small white blip on Android — Mapbox's annotation
// container measures only the outer view's bounds and the inner
// row sometimes resolved to zero width before the first frame.
//
// Layout: 28x38 viewbox.
//   Pole top (cream rect)  : x=3,  y=0,   w=3,  h=12
//   Cloth (red rect)        : x=6,  y=0,   w=15, h=11
//   Pole bottom             : x=3,  y=12,  w=3,  h=22
//   Base disk (cream pill)  : x=0,  y=34,  w=9,  h=3
export function FlagMarker({ tone }: { tone: 'dim' | 'strong' }) {
  const flagColor = tone === 'strong' ? '#A33A2A' : 'rgba(163,58,42,0.85)'
  const poleColor = '#FBF8F1'
  return (
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
      <Rect x={0} y={34} width={9} height={3} rx={1.5} ry={1.5} fill={poleColor} />
      <Circle cx={4.5} cy={35.5} r={1.5} fill={poleColor} />
    </Svg>
  )
}
