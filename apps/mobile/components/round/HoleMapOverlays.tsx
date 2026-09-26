import { useSyncExternalStore } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { TYPE } from '../../lib/typography'
import { P, R } from '../paper/tokens'

// Ruler presets (#611 §5). Tee = arc TOTAL width in yards (half each side of
// the aim line); Appr = circle diameter in feet. Discrete golf-standard sizes,
// shown in their native unit on a meters profile too.
export const TEE_RULER_YARDS = [95, 85, 75, 65] as const
export const APPR_RULER_FEET = [60, 45, 30, 15] as const

// A ruler value at a fractional position between presets (the presets are
// evenly spaced, so this is linear), and back.
export function rulerValueAt(values: readonly number[], pos: number): number {
  const i = Math.max(0, Math.min(values.length - 1, pos))
  const lo = Math.floor(i)
  const hi = Math.min(values.length - 1, lo + 1)
  return values[lo]! + (values[hi]! - values[lo]!) * (i - lo)
}
export function rulerPosOf(values: readonly number[], value: number): number {
  const step = values[1]! - values[0]!
  return Math.max(0, Math.min(values.length - 1, (value - values[0]!) / step))
}

// THROWAWAY (#611 PR4 mock): how the ruler feels, flipped at runtime from a
// chip over the ruler so each can be tried live. The owner picks one; the
// switch and the losers get deleted.
//   A = snap + tween: the ruler steps, the arc/circle eases to the new size.
//   B = sticky slider: the ruler scrubs continuously, snaps to a value on release.
//   C = on the map: drag handles on the arc ends / circle edge; the ruler follows.
export type RulerFeel = 'A' | 'B' | 'C'
let feel: RulerFeel = 'A'
const feelSubs = new Set<() => void>()
export function useRulerFeel(): RulerFeel {
  return useSyncExternalStore(
    (cb) => {
      feelSubs.add(cb)
      return () => feelSubs.delete(cb)
    },
    () => feel,
  )
}
export function RulerFeelChip() {
  const f = useRulerFeel()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ruler feel ${f}, tap to switch`}
      onPress={() => {
        feel = f === 'A' ? 'B' : f === 'B' ? 'C' : 'A'
        feelSubs.forEach((cb) => cb())
      }}
      style={{
        alignSelf: 'stretch',
        height: 28,
        borderRadius: R,
        borderWidth: 1,
        borderColor: P.warn,
        backgroundColor: P.raised,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={[TYPE.body, { fontSize: 12, color: P.ink }]}>
        feel {f} · {f === 'A' ? 'tween' : f === 'B' ? 'sticky' : 'on map'}
      </Text>
    </Pressable>
  )
}

export function TeeBadge() {
  return (
    <View
      style={{
        backgroundColor: P.raised,
        borderWidth: 1,
        borderColor: P.inkDim,
        borderRadius: 2,
        paddingHorizontal: 6,
        paddingVertical: 3,
      }}
    >
      <Text style={[TYPE.body, { color: P.inkDim, fontSize: 11 }]}>Tee</Text>
    </View>
  )
}

const RH = 166
const TOP0 = 38
const SPAN = RH - TOP0 - 16
const STEP = SPAN / 3

// Ruler card (§5): translucent glass plate, one pan target that snaps to the
// four values — a tap picks the nearest. Mirrors for the left-hand layout.
export function RulerCard({
  mode,
  index,
  pos,
  onSelect,
  onScrub,
  lefty,
}: {
  mode: 'tee' | 'appr'
  index: number
  /** Where the pointer sits: `index` at rest, fractional while scrubbing. */
  pos: number
  onSelect: (i: number) => void
  /** Continuous position while the finger is down (feel B); null on release. */
  onScrub: (pos: number | null) => void
  lefty: boolean
}) {
  const values = mode === 'tee' ? TEE_RULER_YARDS : APPR_RULER_FEET
  const sticky = useRulerFeel() === 'B'
  const at = (y: number) => Math.max(0, Math.min(values.length - 1, (y - TOP0) / STEP))
  const pick = (y: number) => {
    if (sticky) return onScrub(at(y))
    const clamped = Math.round(at(y))
    if (clamped !== index) onSelect(clamped)
  }
  const release = (y: number) => {
    if (!sticky) return
    onSelect(Math.round(at(y)))
    onScrub(null)
  }
  // Gesture-handler, not the JS responder: the map and the wheel run on it,
  // and a responder here lost taps to them. minDistance 0 = a tap is a pan.
  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => runOnJS(pick)(e.y))
    .onUpdate((e) => runOnJS(pick)(e.y))
    .onFinalize((e) => runOnJS(release)(e.y))
  const shown = Math.round(pos)
  const side = lefty ? 'left' : 'right'
  return (
    <GestureDetector gesture={pan}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={mode === 'tee' ? 'Landing width, yards' : 'Circle diameter, feet'}
        accessibilityValue={{ text: String(values[index]) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) =>
          onSelect(
            Math.max(
              0,
              Math.min(
                values.length - 1,
                index + (e.nativeEvent.actionName === 'increment' ? -1 : 1),
              ),
            ),
          )
        }
        style={{
          height: RH,
          backgroundColor: P.glass,
          borderWidth: 1,
          borderColor: P.ink,
          borderRadius: R,
        }}
      >
        <Text
          pointerEvents="none"
          style={[
            TYPE.bodyItalic,
            {
              position: 'absolute',
              [lefty ? 'right' : 'left']: 8,
              top: 7,
              fontSize: 12,
              color: P.ink,
            },
          ]}
        >
          {mode === 'tee' ? 'width, yd' : 'circle, ft'}
        </Text>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            [side]: 10,
            top: TOP0,
            width: 2,
            height: SPAN,
            backgroundColor: P.ink,
          }}
        />
        {Array.from({ length: 7 }, (_, k) => {
          const major = k % 2 === 0
          return (
            <View
              key={k}
              pointerEvents="none"
              style={{
                position: 'absolute',
                [side]: 10,
                top: TOP0 + (k * STEP) / 2 - (major ? 1 : 0.75),
                width: major ? 16 : 8,
                height: major ? 2 : 1.5,
                backgroundColor: P.ink,
              }}
            />
          )
        })}
        {values.map((v, i) => {
          const y = TOP0 + i * STEP
          return i === shown ? (
            // Own key: reusing the small Text at 26 sp keeps a stale Android layout.
            <Text
              key={`sel-${v}`}
              pointerEvents="none"
              style={[
                TYPE.serif,
                {
                  position: 'absolute',
                  [side]: 44,
                  top: y - 14,
                  fontSize: 26,
                  lineHeight: 28,
                  color: P.ink,
                },
              ]}
            >
              {v}
            </Text>
          ) : (
            <Text
              key={v}
              pointerEvents="none"
              style={[
                TYPE.kicker,
                {
                  position: 'absolute',
                  [side]: 34,
                  top: y - 9,
                  fontSize: 14,
                  lineHeight: 18,
                  color: P.ink,
                },
              ]}
            >
              {v}
            </Text>
          )
        })}
        <Svg
          pointerEvents="none"
          width={10}
          height={14}
          viewBox="0 0 10 14"
          style={{
            position: 'absolute',
            [side]: 30,
            top: TOP0 + pos * STEP - 7,
            transform: lefty ? [{ scaleX: -1 }] : undefined,
          }}
        >
          <Path d="M0 0L10 7L0 14z" fill={P.ink} />
        </Svg>
      </View>
    </GestureDetector>
  )
}
