import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Key, KeyText, PaperSurface } from '../components/paper/Paper'
import { FONT_CAP, P } from '../components/paper/tokens'
import { TYPE } from '../lib/typography'

// Any unknown route (a stale or mistyped oga:// link) — replaces expo-router's
// dark "Unmatched Route" default with the app's paper.
export default function NotFound() {
  const router = useRouter()
  return (
    <PaperSurface style={{ flex: 1, justifyContent: 'center', padding: 28 }}>
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { fontSize: 30, lineHeight: 36, color: P.ink }]}>
        Lost ball.
      </Text>
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 15, lineHeight: 22, color: P.inkDim, marginTop: 8, marginBottom: 24 }]}>
        That link doesn't go anywhere in OGA.
      </Text>
      <View>
        <Key accessibilityLabel="Back to Home" tone="primary" onPress={() => router.replace('/')} faceStyle={{ minHeight: 50 }}>
          <KeyText tone="primary" bold size={16}>
            Back to Home
          </KeyText>
        </Key>
      </View>
    </PaperSurface>
  )
}
