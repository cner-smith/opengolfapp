import { useCallback, useEffect } from 'react'
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
import { TYPE } from '../../lib/typography'

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
const CENTER_X = 150
// Handle visual range, in SVG units. Stays inside the green trapezoid
// (front edge 30→270). Both the worklet handle position and the
// committed offset clamp against this range so they can't disagree —
// the previous code clamped commit at ±50 in but pinned handle cx to
// [50, 250] (±33 in), so dragging past the visual edge silently kept
// updating the stored value while the handle stopped, producing drift.
const HANDLE_MIN_X = 50
const HANDLE_MAX_X = 250

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
  const { toDisplayFt } = useUnits()

  // Drag is driven entirely by Reanimated shared values so the SVG
  // handle + dotted curve can animate at 60fps on the UI thread.
  // Committing back to React state happens once on gesture end — no
  // setState per frame, no re-render of the whole diagram while dragging.
  const offsetX = useSharedValue(0)
  const startOffset = useSharedValue(aimOffsetInches)
  const layoutWidth = useSharedValue(SVG_WIDTH)
  // Tracks whether a Pan is currently active so the prop-mirror effect
  // below doesn't clobber `startOffset.value` mid-drag. Without this,
  // a parent re-render during an active gesture (e.g. ShotLogger
  // refreshing) would write the stale committed value back into the
  // shared value while `offsetX.value` is non-zero, snapping the
  // handle to a wrong position in the middle of a drag.
  const isGestureActive = useSharedValue(false)

  // Mirror the committed prop into the shared value so the handle stays
  // at its committed position after the gesture ends — useAnimatedProps
  // reads `startOffset.value`, not the React prop, so without this sync
  // the handle visually snapped back to its pre-drag position the moment
  // `offsetX.value` reset to 0 in onEnd. Skip while a gesture is active
  // so a parent re-render mid-drag can't clobber the live position.
  useEffect(() => {
    if (isGestureActive.value) return
    startOffset.value = aimOffsetInches
  }, [aimOffsetInches, startOffset, isGestureActive])

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

  // The committed offset is derived entirely inside the worklet from
  // `startOffset.value` (snapshotted at gesture begin) and the current
  // shared values, then handed to the parent via runOnJS. Computing the
  // final value in the worklet avoids a stale-closure pitfall: if the
  // parent re-renders mid-gesture, the prior JS-thread commit function
  // captured an outdated `aimOffsetInches` and the committed value
  // could disagree with the visible handle position. The worklet path
  // always reads the freshest shared values.
  const commitOffset = useCallback(
    (next: number) => {
      onAimChange(next)
    },
    [onAimChange],
  )

  const pan = Gesture.Pan()
    .activeOffsetX([-2, 2])
    // The diagram is rendered inside a ScrollView in PuttingSheet.
    // Without `failOffsetY`, RNGH races the parent ScrollView for the
    // initial touch and a slightly-diagonal drag can be claimed by the
    // ScrollView, never activating the handle. Yield to vertical scroll
    // only once the drag exceeds 5px vertical before 2px horizontal.
    .failOffsetY([-5, 5])
    .onBegin(() => {
      'worklet'
      isGestureActive.value = true
      startOffset.value = aimOffsetInches
      offsetX.value = 0
    })
    .onUpdate((e) => {
      'worklet'
      offsetX.value = e.translationX
    })
    .onEnd((e) => {
      'worklet'
      const pxPerSvgX = layoutWidth.value / SVG_WIDTH
      const svgDelta = e.translationX / pxPerSvgX
      const targetCx = clampWorklet(
        CENTER_X + startOffset.value * PX_PER_INCH + svgDelta,
        HANDLE_MIN_X,
        HANDLE_MAX_X,
      )
      const next = Math.round((targetCx - CENTER_X) / PX_PER_INCH)
      // Bake the committed offset into the shared value before zeroing
      // the live delta so the handle holds at its release position. The
      // prop-mirror useEffect lands at the same value after React re-
      // renders, but it runs a frame later — without this line the
      // handle briefly snaps back to its pre-drag position.
      startOffset.value = next
      offsetX.value = 0
      isGestureActive.value = false
      runOnJS(commitOffset)(next)
    })
    .onFinalize(() => {
      'worklet'
      // Covers gesture cancellation (touch leaves the screen, parent
      // takes over) — without this `isGestureActive` could stick true
      // and the prop-mirror effect would never re-arm.
      isGestureActive.value = false
    })

  // Worklet helpers — kept inline so each useAnimatedProps re-creates them
  // with the latest closure values on prop change (e.g. breakDirection).
  const handleProps = useAnimatedProps(() => {
    'worklet'
    const pxPerSvgX = layoutWidth.value / SVG_WIDTH
    const svgDelta = offsetX.value / pxPerSvgX
    const cx = clampWorklet(
      CENTER_X + startOffset.value * PX_PER_INCH + svgDelta,
      HANDLE_MIN_X,
      HANDLE_MAX_X,
    )
    return { cx }
  })
  const trajectoryProps = useAnimatedProps(() => {
    'worklet'
    const pxPerSvgX = layoutWidth.value / SVG_WIDTH
    const svgDelta = offsetX.value / pxPerSvgX
    const handleX = clampWorklet(
      CENTER_X + startOffset.value * PX_PER_INCH + svgDelta,
      HANDLE_MIN_X,
      HANDLE_MAX_X,
    )
    const curveControlX = handleX * 0.6 + CENTER_X * 0.4
    return {
      d: `M${ballX} ${ballY} Q ${curveControlX} ${handleY} ${CENTER_X} ${trajectoryEndY}`,
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
          <Text style={[TYPE.kicker, KICKER]}>To pin</Text>
          <Text
            style={[
              TYPE.serif,
              {
                color: '#1C211C',
                fontSize: 28,
                lineHeight: 30,
              },
            ]}
          >
            {toDisplayFt(distanceFt)}
          </Text>
        </View>
        <Text style={[TYPE.kicker, { ...KICKER, color: '#8A8B7E' }]}>
          {breakDirection === 'straight'
            ? 'Straight'
            : breakDirection.replace(/_/g, ' ')}
        </Text>
      </View>

      <GestureDetector gesture={pan}>
        <View
          onLayout={(e) => {
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
        style={[
          TYPE.body,
          {
            color: '#1C211C',
            fontSize: 17,
            fontWeight: '500',
            textAlign: 'center',
            marginTop: 6,
          },
        ]}
      >
        {aimLabel}
      </Text>
    </View>
  )
}

// Worklet-flagged clamp so the Pan onEnd / useAnimatedProps math can
// run on the UI thread without bouncing through JS.
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
