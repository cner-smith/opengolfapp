import { useRef, useState } from 'react'
import { Text, View } from 'react-native'
import Svg, { Circle, Ellipse, Line, Path } from 'react-native-svg'
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'

export type BreakDirection =
  | 'left_to_right'
  | 'right_to_left'
  | 'uphill'
  | 'downhill'
  | 'straight'

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
  const [aimDuringDrag, setAimDuringDrag] = useState<number | null>(null)
  const startOffsetRef = useRef(aimOffsetInches)

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

  const currentOffset = aimDuringDrag ?? aimOffsetInches
  const handleX = clamp(150 + currentOffset * PX_PER_INCH, 50, 250)
  const handleY = 150
  const curveControlX = handleX * 0.6 + 150 * 0.4

  function setOffsetFromTranslation(translationX: number) {
    const w = layoutRef.current?.width ?? SVG_WIDTH
    const pxPerSvgX = w / SVG_WIDTH
    const offsetInchesDelta = translationX / pxPerSvgX / PX_PER_INCH
    const next = Math.round(clamp(startOffsetRef.current + offsetInchesDelta, -50, 50))
    setAimDuringDrag(next)
  }

  function commit() {
    if (aimDuringDrag != null) onAimChange(aimDuringDrag)
    setAimDuringDrag(null)
  }

  const pan = Gesture.Pan()
    .activeOffsetX([-2, 2])
    .onBegin(() => {
      'worklet'
      runOnJS(rememberStart)(aimOffsetInches)
    })
    .onUpdate((e) => {
      'worklet'
      runOnJS(setOffsetFromTranslation)(e.translationX)
    })
    .onEnd(() => {
      'worklet'
      runOnJS(commit)()
    })

  function rememberStart(start: number) {
    startOffsetRef.current = start
  }

  const aimLabel = formatAim(currentOffset)

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
            {Math.round(distanceFt)} ft
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
            <Path
              d={`M${ballX} ${ballY} Q ${curveControlX} ${handleY} 150 ${pinY + 60}`}
              fill="none"
              stroke="#A66A1F"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              opacity={0.85}
            />
            <Ellipse cx={ballX} cy={ballY + 6} rx={8} ry={2.5} fill="rgba(28,33,28,0.35)" />
            <Circle cx={ballX} cy={ballY} r={6} fill="#FBF8F1" stroke="#1C211C" strokeWidth={1} />
            <Circle cx={handleX} cy={handleY} r={12} fill="#A66A1F" stroke="#FBF8F1" strokeWidth={2} />
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

function formatAim(offsetInches: number): string {
  const rounded = Math.round(offsetInches)
  if (Math.abs(rounded) <= 2) return 'Straight'
  if (rounded < 0) return `${Math.abs(rounded)} in left`
  return `${rounded} in right`
}
