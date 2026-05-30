import { Text, View } from 'react-native'

// Shared pill chrome — dark translucent card on satellite, per DESIGN.md
// mobile map rules. The HUD readouts (To Hole / Exp / SG) all use it.
const PILL_BG = 'rgba(28,33,28,0.82)'
const HUD_KICKER = {
  color: 'rgba(242,238,229,0.65)',
  fontSize: 9,
  fontWeight: '600' as const,
  letterSpacing: 1.3,
  textTransform: 'uppercase' as const,
  marginBottom: 2,
}

interface TopHintProps {
  isPinMode: boolean
  isAimPhase: boolean
  isTeeMode: boolean
}

export function TopHint({ isPinMode, isAimPhase, isTeeMode }: TopHintProps) {
  return (
    <View
      style={{
        position: 'absolute',
        // Sits below the corner HUD pills (top:12, ~46 tall) so the
        // instructional line and the To Hole / Exp readouts don't collide.
        top: 64,
        left: 12,
        right: 12,
        backgroundColor: isPinMode
          ? 'rgba(166,106,31,0.92)'
          : 'rgba(28,33,28,0.78)',
        borderRadius: 2,
        paddingHorizontal: 10,
        paddingVertical: 6,
      }}
    >
      <Text
        style={{
          color: '#F2EEE5',
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 1.4,
          textTransform: 'uppercase',
        }}
      >
        {isPinMode
          ? 'Pin mode — tap to place flag'
          : isTeeMode
            ? 'Tee mode — tap to place tee box'
            : isAimPhase
              ? 'Long-press to set aim line — where you started the ball, not where it finishes'
              : 'Drag the ball to refine, then tap Mark ball here'}
      </Text>
    </View>
  )
}

export function MissingLayoutBanner() {
  return (
    <View
      style={{
        position: 'absolute',
        // Below TopHint (top:64) so the two stack rather than overlap.
        top: 108,
        left: 12,
        right: 12,
        backgroundColor: 'rgba(28,33,28,0.78)',
        borderWidth: 1,
        borderColor: 'rgba(217,210,191,0.4)',
        borderRadius: 2,
        paddingHorizontal: 10,
        paddingVertical: 6,
      }}
    >
      <Text style={{ color: '#F2EEE5', fontSize: 11, lineHeight: 14 }}>
        No hole layout for this course. Place shots manually — the distance
        pill and putting auto-switch stay off until tee / pin coords land.
      </Text>
    </View>
  )
}

// To Hole — distance from the current ball to the pin (top-left HUD pill).
// Replaces the old bottom-right "X to pin" pill; matches the Shot Pattern
// top-corner HUD layout.
export function ToHolePill({ display }: { display: string }) {
  return (
    <View
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        backgroundColor: PILL_BG,
        borderRadius: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        minWidth: 86,
      }}
    >
      <Text style={HUD_KICKER}>To Hole</Text>
      <Text
        style={{
          color: '#F2EEE5',
          fontFamily: 'Fraunces-Medium',
          fontSize: 20,
          fontVariant: ['tabular-nums'],
        }}
      >
        {display}
      </Text>
    </View>
  )
}

// Expected strokes to hole out from the current ball position (top-right
// HUD pill). Distance-band baseline, calibrated to the player's handicap.
// '—' until a pin exists and the baseline resolves.
export function ExpStrokesPill({ value }: { value: number | null }) {
  return (
    <View
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: PILL_BG,
        borderRadius: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        minWidth: 86,
        alignItems: 'flex-end',
      }}
    >
      <Text style={HUD_KICKER}>Exp · to hole</Text>
      <Text
        style={{
          color: '#F2EEE5',
          fontFamily: 'Fraunces-Medium',
          fontSize: 20,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value != null ? value.toFixed(1) : '—'}
      </Text>
    </View>
  )
}

// Shown when the hole has no pin yet — distances, expected strokes, and the
// dispersion overlay all need one, so prompt for it instead of silently
// rendering nothing (Task 7, pin-first UX).
export function PinFirstCta() {
  return (
    <View
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        right: 12,
        backgroundColor: 'rgba(166,106,31,0.92)',
        borderRadius: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <Text style={{ color: '#F2EEE5', fontSize: 12, fontWeight: '600', lineHeight: 16 }}>
        Set the pin (below) to see your To Hole distance, expected strokes, and shot pattern.
      </Text>
    </View>
  )
}

export function TeeBadge() {
  return (
    <View
      style={{
        backgroundColor: '#FBF8F1',
        borderWidth: 1,
        borderColor: '#5C6356',
        borderRadius: 2,
        paddingHorizontal: 6,
        paddingVertical: 3,
      }}
    >
      <Text
        style={{
          color: '#5C6356',
          fontSize: 9,
          fontWeight: '500',
          letterSpacing: 1.4,
        }}
      >
        TEE
      </Text>
    </View>
  )
}
