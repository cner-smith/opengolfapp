import { Text } from 'react-native'
import { useRouter } from 'expo-router'
import { Key, KeyText } from '../paper/Paper'
import { FONT_CAP, P } from '../paper/tokens'
import { TYPE } from '../../lib/typography'

export function StartLiveRoundCTA() {
  const router = useRouter()
  return (
    <>
      <Key
        accessibilityLabel="Start live round"
        tone="primary"
        onPress={() => router.push('/(app)/round/new?mode=live')}
        style={{ marginBottom: 6 }}
        faceStyle={{ minHeight: 54 }}
      >
        <KeyText tone="primary" bold size={16}>
          Start live round
        </KeyText>
      </Key>
      <Text
        maxFontSizeMultiplier={FONT_CAP}
        style={[
          TYPE.body,
          {
            color: P.inkDim,
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
  const router = useRouter()
  return (
    <Key
      accessibilityLabel="Log past round"
      onPress={() => router.push('/(app)/round/new?mode=past')}
      style={{ marginBottom: 22 }}
      faceStyle={{ minHeight: 50 }}
    >
      <KeyText size={15}>+ Log past round</KeyText>
    </Key>
  )
}
