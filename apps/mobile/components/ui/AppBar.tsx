import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface AppBarProps {
  eyebrow?: string
  title: string
  right?: React.ReactNode
}

export function AppBar({ eyebrow, title, right }: AppBarProps) {
  const insets = useSafeAreaInsets()
  return (
    <View
      style={{
        backgroundColor: '#1C211C',
        paddingTop: insets.top + 14,
        paddingBottom: 14,
        paddingHorizontal: 18,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
      }}
    >
      <View>
        {eyebrow && (
          <Text
            style={{
              color: 'rgba(242,238,229,0.45)',
              fontSize: 10,
              fontFamily: 'JetBrainsMono-Medium',
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            {eyebrow}
          </Text>
        )}
        <Text
          style={{
            color: '#F2EEE5',
            fontSize: 17,
            fontFamily: 'Fraunces-Medium',
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
