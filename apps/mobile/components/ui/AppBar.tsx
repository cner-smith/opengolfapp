import { Text, View } from 'react-native'

interface AppBarProps {
  eyebrow?: string
  title: string
  right?: React.ReactNode
}

export function AppBar({ eyebrow, title, right }: AppBarProps) {
  return (
    <View
      className="bg-oga-black"
      style={{
        paddingTop: 48,
        paddingBottom: 10,
        paddingLeft: 14,
        paddingRight: 14,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
      }}
    >
      <View>
        {eyebrow && (
          <Text
            style={{
              color: 'rgba(255,255,255,0.45)',
              fontSize: 10,
              letterSpacing: 0.3,
              marginBottom: 2,
            }}
          >
            {eyebrow}
          </Text>
        )}
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 15,
            fontWeight: '500',
          }}
        >
          {title}
        </Text>
      </View>
      {right}
    </View>
  )
}
