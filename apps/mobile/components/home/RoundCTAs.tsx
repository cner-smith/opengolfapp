import { Pressable, Text } from 'react-native'
import { Link } from 'expo-router'

export function StartLiveRoundCTA() {
  return (
    <>
      <Link href="/(app)/round/new?mode=live" asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start live round"
          style={{
            backgroundColor: '#1F3D2C',
            borderRadius: 2,
            paddingVertical: 18,
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <Text
            style={{
              color: '#F2EEE5',
              fontSize: 16,
              fontWeight: '700',
              letterSpacing: 0.4,
            }}
          >
            ▶  Start live round
          </Text>
        </Pressable>
      </Link>
      <Text
        style={{
          color: '#5C6356',
          fontSize: 12,
          textAlign: 'center',
          marginBottom: 14,
        }}
      >
        Track shots in real time with GPS
      </Text>
    </>
  )
}

export function LogPastRoundCTA() {
  return (
    <Link href="/(app)/round/new?mode=past" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Log past round"
        style={{
          borderWidth: 1,
          borderColor: '#1F3D2C',
          backgroundColor: 'transparent',
          borderRadius: 2,
          paddingVertical: 14,
          alignItems: 'center',
          marginBottom: 22,
        }}
      >
        <Text
          style={{
            color: '#1F3D2C',
            fontSize: 14,
            fontWeight: '600',
            letterSpacing: 0.3,
          }}
        >
          +  Log past round
        </Text>
      </Pressable>
    </Link>
  )
}
