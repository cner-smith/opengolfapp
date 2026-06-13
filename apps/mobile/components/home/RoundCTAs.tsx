import { Pressable, Text } from 'react-native'
import { Link } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { TYPE } from '../../lib/typography'

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
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 6,
          }}
        >
          <MaterialCommunityIcons name="play" size={20} color="#F2EEE5" />
          <Text
            style={[
              TYPE.bodyBold,
              {
                color: '#F2EEE5',
                fontSize: 16,
                fontWeight: '700',
                letterSpacing: 0.4,
              },
            ]}
          >
            Start live round
          </Text>
        </Pressable>
      </Link>
      <Text
        style={[
          TYPE.body,
          {
            color: '#5C6356',
            fontSize: 12,
            textAlign: 'center',
            marginBottom: 14,
          },
        ]}
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
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          marginBottom: 22,
        }}
      >
        <MaterialCommunityIcons name="plus" size={18} color="#1F3D2C" />
        <Text
          style={[
            TYPE.bodyBold,
            {
              color: '#1F3D2C',
              fontSize: 14,
              fontWeight: '600',
              letterSpacing: 0.3,
            },
          ]}
        >
          Log past round
        </Text>
      </Pressable>
    </Link>
  )
}
