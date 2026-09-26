import { View } from 'react-native'
import Svg, { Circle, Rect } from 'react-native-svg'
import { P } from './tokens'

// Scorecard golf marks around a score (#611 §10), static final form: birdie
// circle, eagle-or-better double circle, bogey square, double-bogey-or-worse
// double square. 1.3 ink stroke. Centred on its parent — nudged up, since
// Fraunces figures sit above the middle of their line box. Nothing at par.
export function GolfMark({ toPar }: { toPar: number }) {
  if (toPar === 0) return null
  const box = toPar <= -2 ? 34 : toPar === -1 ? 30 : toPar === 1 ? 26 : 32
  const c = box / 2
  const ink = { fill: 'none', stroke: P.ink, strokeWidth: 1.3 }
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -c, marginTop: -c - 3 }}
    >
      <Svg width={box} height={box}>
        {toPar <= -2 && (
          <>
            <Circle cx={c} cy={c} r={15} {...ink} />
            <Circle cx={c} cy={c} r={11.5} {...ink} />
          </>
        )}
        {toPar === -1 && <Circle cx={c} cy={c} r={12.5} {...ink} />}
        {toPar === 1 && <Rect x={2} y={2} width={22} height={22} {...ink} />}
        {toPar >= 2 && (
          <>
            <Rect x={1.5} y={1.5} width={29} height={29} {...ink} />
            <Rect x={5} y={5} width={22} height={22} {...ink} />
          </>
        )}
      </Svg>
    </View>
  )
}
