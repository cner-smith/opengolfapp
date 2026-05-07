import { View } from 'react-native'

// Simple flag glyph: vertical pole with a rectangular cloth at the top
// and a small base disk. PointAnnotation measures children via normal
// flex layout — an absolutely-positioned version sometimes rendered as
// a zero-size annotation on Android, leaving no visible flag at all.
// This explicit-size column always has positive bounds.
export function FlagMarker({ tone }: { tone: 'dim' | 'strong' }) {
  const flagColor = tone === 'strong' ? '#A33A2A' : 'rgba(163,58,42,0.85)'
  const poleColor = '#FBF8F1'
  return (
    <View
      style={{
        width: 28,
        height: 38,
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View
          style={{
            width: 3,
            height: 12,
            backgroundColor: poleColor,
          }}
        />
        <View
          style={{
            width: 15,
            height: 11,
            backgroundColor: flagColor,
            borderTopRightRadius: 1,
          }}
        />
      </View>
      <View
        style={{
          width: 3,
          height: 22,
          backgroundColor: poleColor,
        }}
      />
      <View
        style={{
          width: 9,
          height: 3,
          marginLeft: -3,
          borderRadius: 1.5,
          backgroundColor: poleColor,
        }}
      />
    </View>
  )
}
