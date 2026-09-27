import { Text, View, type GestureResponderEvent } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { TYPE } from '../../lib/typography'
import { P, R } from '../paper/tokens'

// Ruler presets (#611 §5). Tee = arc TOTAL width in yards (half each side of
// the aim line); Appr = circle diameter in feet. Discrete golf-standard sizes,
// shown in their native unit on a meters profile too.
export const TEE_RULER_YARDS = [95, 85, 75, 65] as const
export const APPR_RULER_FEET = [60, 45, 30, 15] as const

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
  onSelect,
  lefty,
}: {
  mode: 'tee' | 'appr'
  index: number
  onSelect: (i: number) => void
  lefty: boolean
}) {
  const values = mode === 'tee' ? TEE_RULER_YARDS : APPR_RULER_FEET
  const pick = (e: GestureResponderEvent) => {
    const i = Math.round((e.nativeEvent.locationY - TOP0) / STEP)
    const clamped = Math.max(0, Math.min(values.length - 1, i))
    if (clamped !== index) onSelect(clamped)
  }
  const side = lefty ? 'left' : 'right'
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={mode === 'tee' ? 'Landing width, yards' : 'Circle diameter, feet'}
      accessibilityValue={{ text: String(values[index]) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) =>
        onSelect(
          Math.max(0, Math.min(values.length - 1, index + (e.nativeEvent.actionName === 'increment' ? -1 : 1))),
        )
      }
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={pick}
      onResponderMove={pick}
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
        style={[TYPE.bodyItalic, { position: 'absolute', [lefty ? 'right' : 'left']: 8, top: 7, fontSize: 12, color: P.ink }]}
      >
        {mode === 'tee' ? 'width, yd' : 'circle, ft'}
      </Text>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', [side]: 10, top: TOP0, width: 2, height: SPAN, backgroundColor: P.ink }}
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
        return i === index ? (
          <View
            key={v}
            pointerEvents="none"
            style={{
              position: 'absolute',
              [side]: 30,
              top: y - 14,
              height: 28,
              flexDirection: lefty ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Text style={[TYPE.serif, { fontSize: 26, lineHeight: 28, color: P.ink }]}>{v}</Text>
            <Svg width={10} height={14} viewBox="0 0 10 14" style={lefty ? { transform: [{ scaleX: -1 }] } : undefined}>
              <Path d="M0 0L10 7L0 14z" fill={P.ink} />
            </Svg>
          </View>
        ) : (
          <Text
            key={v}
            pointerEvents="none"
            style={[TYPE.kicker, { position: 'absolute', [side]: 34, top: y - 9, fontSize: 14, lineHeight: 18, color: P.ink }]}
          >
            {v}
          </Text>
        )
      })}
    </View>
  )
}
