import { Text } from 'react-native'
import { PressableTouch } from '../ui/PressableTouch'
import { useRouter } from 'expo-router'
import { Key, KeyText } from '../paper/Paper'
import { FONT_CAP, P } from '../paper/tokens'
import { TYPE } from '../../lib/typography'
import { openWebImport } from '../../lib/webLinks'

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

// The no-rounds empty states (Home, All rounds) offer the import beside the
// start-round action. It opens the web import in the browser.
export function ImportHistoryLink() {
  return (
    <PressableTouch
      accessibilityRole="link"
      accessibilityLabel="Import your history on the web"
      accessibilityHint="Opens oga.golf in the browser"
      onPress={() => void openWebImport()}
      hitSlop={8}
      style={{ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' }}
    >
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.bodyBold, { color: P.forest, fontSize: 15 }]}>
        Import your history ↗
      </Text>
    </PressableTouch>
  )
}

export function LogPastRoundCTA() {
  const router = useRouter()
  return (
    // One primary action on Home; the past-round log is a quiet link under it.
    <PressableTouch
      accessibilityRole="button"
      accessibilityLabel="Log past round"
      onPress={() => router.push('/(app)/round/new?mode=past')}
      hitSlop={8}
      style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, marginBottom: 18 }}
    >
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.bodyBold, { color: P.forest, fontSize: 15 }]}>
        + Log past round
      </Text>
    </PressableTouch>
  )
}
