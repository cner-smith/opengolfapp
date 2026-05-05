import { Text, View } from 'react-native'

interface NumberedMarkerProps {
  color: string
  border: string
  size: number
  number: number
  opacity?: number
}

export function NumberedMarker({
  color,
  border,
  size,
  number,
  opacity = 1,
}: NumberedMarkerProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        borderWidth: 2,
        borderColor: border,
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
      }}
    >
      <Text
        style={{
          color: '#FBF8F1',
          fontSize: size * 0.55,
          fontWeight: '700',
          fontVariant: ['tabular-nums'],
          lineHeight: size,
          textAlign: 'center',
        }}
      >
        {number}
      </Text>
    </View>
  )
}
