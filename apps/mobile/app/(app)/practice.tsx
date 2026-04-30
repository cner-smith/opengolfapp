import { ScrollView, Text, View } from 'react-native'
import { AppBar } from '../../components/ui/AppBar'

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

export default function Practice() {
  return (
    <View style={{ flex: 1, backgroundColor: '#F2EEE5' }}>
      <AppBar eyebrow="Today's focus" title="Practice" />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        <Text
          style={{
            color: '#1C211C',
            fontSize: 28,
            fontStyle: 'italic',
            fontWeight: '500',
            marginBottom: 8,
            lineHeight: 32,
          }}
        >
          A column, not a checklist.
        </Text>
        <Text
          style={{
            color: '#5C6356',
            fontSize: 14,
            lineHeight: 20,
            marginBottom: 22,
          }}
        >
          Once you've logged enough rounds, this tab will read like a coach's
          column — a short opinion on where the strokes are leaking and three
          drills sized to your facilities.
        </Text>

        <View
          style={{
            borderTopWidth: 1,
            borderColor: '#D9D2BF',
            paddingTop: 14,
          }}
        >
          <Text style={{ ...KICKER, marginBottom: 12 }}>Coming in phase 5</Text>
          <Text
            style={{
              color: '#1C211C',
              fontSize: 15,
              lineHeight: 22,
            }}
          >
            Drills are calibrated to skill level and goal. A handicap-22 player
            never sees a competitive tempo drill; a single-digit player never
            sees a learn-to-grip routine.
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}
