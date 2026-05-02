import { useRef } from 'react'
import { Text, View } from 'react-native'
import Svg, { Circle, Ellipse, Line, Path } from 'react-native-svg'
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedProps,
  useSharedValue,
} from 'react-native-reanimated'
import type { BreakDirection } from '@oga/core'
import { useUnits } from '../../hooks/useUnits'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedPath = Animated.createAnimatedComponent(Path)

export type { BreakDirection }

export interface GreenDiagramProps {
  distanceFt: number
  aimOffsetInches: number
  breakDirection?: BreakDirection
  onAimChange: (offsetInches: number) => void
}

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

const SVG_WIDTH = 300
const SVG_HEIGHT = 240
const PX_PER_INCH = 3

// Editorial perspective view from behind the ball, mobile flavor.
// Drag the amber handle horizontally to bias aim left/right of the
// pin. Slope hint comes from breakDirection — keep it subtle, this
// is a yardage-book illustration, not a simulator.
export function GreenDiagram({
  distanceFt,
  aimOffsetInches,
  breakDirection = 'straight',
  onAimChange,
}: GreenDiagramProps) {
  const layoutRef = useRef<{ width: number } | null>(null)
  const { toDisplayFt } = useUnits()

  // Drag is driven entirely by Reanimated shared values so the SVG
  // handle + dotted curve can animate at 60fps on the UI thread.
  // Committing back to React state happens once on gesture end — no
  // setState per frame, no re-render of the whole diagram while dragging.
  const offsetX = useSharedValue(0)
  const startOffset = useSharedValue(aimOffsetInches)
  const layoutWidth = useSharedValue(SVG_WIDTH)

  const pinY = breakDirection === 'uphill' ? 56 : breakDirection === 'downhill' ? 80 : 68
  const ballX = 150
  const ballY = 200

  const tilt =
    breakDirection === 'left_to_right' ? -10 : breakDirection === 'right_to_left' ? 10 : 0
  const leftFrontY = 220 + tilt
  const rightFrontY = 220 - tilt
  const leftBackY = 100 + (breakDirection === 'uphill' ? -10 : 0)
  const rightBackY = 100 + (breakDirection === 'uphill' ? -10 : 0)
  const trapezoid = `M30 ${leftFrontY} L270 ${rightFrontY} L240 ${rightBackY} L60 ${leftBackY} Z`

  const handleY = 150
  const trajectoryEndY = pinY + 60

  function commitWithTranslation(translationX: number) {
    const w = layoutRef.current?.width ?? SVG_WIDTH
    const pxPerSvgX = w / SVG_WIDTH
    const offsetInchesDelta = translationX / pxPerSvgX / PX_PER_INCH
    const next = Math.round(
      clamp(aimOffsetInches + offsetInchesDelta, -50, 50),
    )
    if (next !== aimOffsetInches) onAimChange(next)
  }

  const pan = Gesture.Pan()
    .activeOffsetX([-2, 2])
    .onBegin(() => {
      'worklet'
      startOffset.value = aimOffsetInches
      offsetX.value = 0
    })
    .onUpdate((e) => {
      'worklet'
      offsetX.value = e.translationX
    })
    .onEnd((e) => {
      'worklet'
      runOnJS(commitWithTranslation)(e.translationX)
      offsetX.value = 0
    })

  // Worklet helpers — kept inline so each useAnimatedProps re-creates them
  // with the latest closure values on prop change (e.g. breakDirection).
  const handleProps = useAnimatedProps(() => {
    'worklet'
    const pxPerSvgX = layoutWidth.value / SVG_WIDTH
    const deltaInches = offsetX.value / pxPerSvgX / PX_PER_INCH
    const cx = clampWorklet(
      150 + (startOffset.value + deltaInches) * PX_PER_INCH,
      50,
      250,
    )
    return { cx }
  })
  const trajectoryProps = useAnimatedProps(() => {
    'worklet'
    const pxPerSvgX = layoutWidth.value / SVG_WIDTH
    const deltaInches = offsetX.value / pxPerSvgX / PX_PER_INCH
    const handleX = clampWorklet(
      150 + (startOffset.value + deltaInches) * PX_PER_INCH,
      50,
      250,
    )
    const curveControlX = handleX * 0.6 + 150 * 0.4
    return {
      d: `M${ballX} ${ballY} Q ${curveControlX} ${handleY} 150 ${trajectoryEndY}`,
    }
  })

  // Aim label only reflects committed values; intentional trade-off so
  // the React tree stays still during the drag. Updates on release.
  const aimLabel = formatAim(aimOffsetInches)

  return (
    <View
      style={{
        backgroundColor: '#FBF8F1',
        borderWidth: 1,
        borderColor: '#D9D2BF',
        borderRadius: 4,
        padding: 14,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: 8,
        }}
      >
        <View>
          <Text style={KICKER}>To pin</Text>
          <Text
            style={{
              color: '#1C211C',
              fontSize: 28,
              fontStyle: 'italic',
              fontWeight: '500',
              fontVariant: ['tabular-nums'],
              lineHeight: 30,
            }}
          >
            {toDisplayFt(distanceFt)}
          </Text>
        </View>
        <Text style={{ ...KICKER, color: '#8A8B7E' }}>
          {breakDirection === 'straight'
            ? 'Straight'
            : breakDirection.replace(/_/g, ' ')}
        </Text>
      </View>

      <GestureDetector gesture={pan}>
        <View
          onLayout={(e) => {
            layoutRef.current = { width: e.nativeEvent.layout.width }
            layoutWidth.value = e.nativeEvent.layout.width
          }}
          style={{ aspectRatio: SVG_WIDTH / SVG_HEIGHT, width: '100%' }}
        >
          <Svg
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            width="100%"
            height="100%"
          >
            <Path
              d={trapezoid}
              fill="#8db87a"
              stroke="#6a9960"
              strokeWidth={1.5}
            />
            <Path
              d={`M50 ${leftFrontY - 6} L250 ${rightFrontY - 6} L225 ${rightBackY + 6} L75 ${leftBackY + 6} Z`}
              fill="none"
              stroke="rgba(106,153,96,0.4)"
              strokeWidth={0.75}
              strokeDasharray="4 3"
            />
            <Line x1={150} y1={pinY} x2={150} y2={pinY + 60} stroke="#1C211C" strokeWidth={1.5} />
            <Path d={`M150 ${pinY} L168 ${pinY + 8} L150 ${pinY + 16} Z`} fill="#A33A2A" />
            <Ellipse cx={150} cy={pinY + 60} rx={6} ry={2} fill="#1C211C" opacity={0.75} />
            <AnimatedPath
              animatedProps={trajectoryProps}
              fill="none"
              stroke="#A66A1F"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              opacity={0.85}
            />
            <Ellipse cx={ballX} cy={ballY + 6} rx={8} ry={2.5} fill="rgba(28,33,28,0.35)" />
            <Circle cx={ballX} cy={ballY} r={6} fill="#FBF8F1" stroke="#1C211C" strokeWidth={1} />
            <AnimatedCircle
              animatedProps={handleProps}
              cy={handleY}
              r={12}
              fill="#A66A1F"
              stroke="#FBF8F1"
              strokeWidth={2}
            />
          </Svg>
        </View>
      </GestureDetector>

      <Text
        style={{
          color: '#1C211C',
          fontSize: 17,
          fontWeight: '500',
          textAlign: 'center',
          marginTop: 6,
        }}
      >
        {aimLabel}
      </Text>
    </View>
  )
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

// Same as clamp but flagged as a worklet so it can run on the UI thread.
function clampWorklet(n: number, min: number, max: number): number {
  'worklet'
  return Math.min(max, Math.max(min, n))
}

function formatAim(offsetInches: number): string {
  const rounded = Math.round(offsetInches)
  if (Math.abs(rounded) <= 2) return 'Straight'
  if (rounded < 0) return `${Math.abs(rounded)} in left`
  return `${rounded} in right`
}
