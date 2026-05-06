import { View } from 'react-native'

export interface MarkerProps {
  color: string
  border: string
  size: number
}

export function Marker({ color, border, size }: MarkerProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        borderWidth: 2,
        borderColor: border,
      }}
    />
  )
}
