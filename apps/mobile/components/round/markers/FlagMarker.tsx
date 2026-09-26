import { View } from 'react-native'
import Svg, { Ellipse, Path, Rect, Text as SvgText } from 'react-native-svg'
import { P } from '../../paper/tokens'

// G4 flag (#611 LOCKED-SPEC §9, #904): a numbered red flag over a cup drawn
// in perspective. viewBox 38×48 at 38 dp tall; the pin point (cup centre)
// is (9, 42). Wrapped in a 44×44 View — the hit box, with the pole 12 dp
// from its left and its bottom 6 dp below the pin point, so the
// PointAnnotation anchor is FLAG_ANCHOR. An explicit-size native View also
// keeps Android from measuring the SVG as zero before it paints.
const H = 38
const W = (38 * H) / 48
const S = H / 48
export const FLAG_ANCHOR = { x: 12 / 44, y: 38 / 44 }

const CLOTH = '#A33A2A'
const POLE_IN_CUP = '#6E7266'

/** Cup squash for a camera pitch: cos(pitch) in 0.45–0.8, in 0.05 steps. */
export function flagCupK(pitchDeg: number): number {
  // A NaN would reach the native path parser and crash the app.
  if (!Number.isFinite(pitchDeg)) return 0.8
  const k = Math.min(0.8, Math.max(0.45, Math.cos((pitchDeg * Math.PI) / 180)))
  return Math.round(k * 20) / 20
}

// The native path parser rejects long float tails — round what goes into `d`.
const f = (n: number) => Math.round(n * 100) / 100

export function FlagMarker({ tone, hole, k }: { tone: 'dim' | 'strong'; hole: number; k: number }) {
  const ry = f(7.2 * k)
  const wide = hole >= 10
  const clothEnd = wide ? 34.4 : 29.9
  const [c1, c2] = wide ? [15.52, 20.36] : [14.53, 18.47]
  const cloth = `M10.2 1.4 C${c1} 0.2 ${c2} 2.8 ${clothEnd} 1.4 L${clothEnd} 17.4 C${c2} 18.8 ${c1} 16.2 10.2 17.6 Z`
  const strong = tone === 'strong'
  return (
    <View style={{ width: 44, height: 44 }}>
      <Svg
        width={W}
        height={H}
        viewBox="0 0 38 48"
        style={{ position: 'absolute', left: 12 - 9 * S, top: 38 - 42 * S }}
      >
        <Ellipse cx={10.2} cy={42 + 2.52 * k} rx={9.8} ry={9.8 * k} fill={P.ink} opacity={strong ? 0.22 : 0.14} />
        {strong ? (
          <>
            <Ellipse cx={9} cy={42} rx={7.2} ry={ry} fill={P.ink} />
            <Path
              d={`M3.38 ${f(42 - 0.36 * k)} A5.76 ${f(5.184 * k)} 0 0 1 14.62 ${f(42 - 0.36 * k)} A5.76 ${f(3.24 * k)} 0 0 0 3.38 ${f(42 - 0.36 * k)} Z`}
              fill={P.raised}
              opacity={0.85}
            />
            <Path d={`M1.8 42 A7.2 ${ry} 0 0 1 16.2 42`} fill="none" stroke={P.raised} strokeWidth={1.6} />
          </>
        ) : (
          <>
            <Ellipse cx={9} cy={42} rx={7.2} ry={ry} fill={P.ink} opacity={0.28} />
            <Ellipse cx={9} cy={42} rx={7.2} ry={ry} fill="none" stroke={P.ink} strokeWidth={2.8} opacity={0.5} />
            <Ellipse cx={9} cy={42} rx={7.2} ry={ry} fill="none" stroke={P.raised} strokeWidth={1.6} strokeDasharray="3 2.2" />
          </>
        )}
        <Rect x={7} y={0.6} width={4} height={41.4} fill={P.ink} />
        {strong ? (
          <>
            <Rect x={7.8} y={1.4} width={2.4} height={40.6 - ry} fill={P.raised} />
            <Rect x={7.8} y={42 - ry} width={2.4} height={ry} fill={POLE_IN_CUP} />
            {/* The rim's front half, over the pole. */}
            <Path d={`M16.2 42 A7.2 ${ry} 0 0 1 1.8 42`} fill="none" stroke={P.raised} strokeWidth={1.6} />
            <Path d={cloth} fill={CLOTH} stroke={P.ink} strokeWidth={0.8} />
          </>
        ) : (
          <>
            <Rect x={7.8} y={1.4} width={2.4} height={40.6} fill={P.raised} />
            <Path d={cloth} fill="#F2EEE5" stroke={CLOTH} strokeWidth={1.5} />
          </>
        )}
        <SvgText
          x={(10.2 + clothEnd) / 2}
          y={14.6}
          textAnchor="middle"
          fontFamily="Fraunces-MediumItalic"
          fontSize={13.5}
          letterSpacing={wide ? -0.3 : 0}
          fill={strong ? P.raised : CLOTH}
        >
          {hole}
        </SvgText>
      </Svg>
    </View>
  )
}
