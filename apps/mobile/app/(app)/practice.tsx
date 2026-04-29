import { Text, View } from 'react-native'
import { AppBar } from '../../components/ui/AppBar'

export default function Practice() {
  return (
    <View style={{ flex: 1, backgroundColor: '#F4F4F0' }}>
      <AppBar eyebrow="AI plan" title="Practice" />
      <View
        style={{
          margin: 14,
          backgroundColor: '#FFFFFF',
          borderWidth: 0.5,
          borderColor: '#E4E4E0',
          borderRadius: 10,
          padding: 24,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#111111', fontSize: 15, fontWeight: '500' }}>
          Plan generation arrives in Phase 5
        </Text>
        <Text
          style={{
            color: '#888880',
            fontSize: 13,
            marginTop: 6,
            textAlign: 'center',
          }}
        >
          Once enough rounds are logged, this tab will surface a drill plan
          calibrated to the categories where you're losing the most strokes.
        </Text>
      </View>
    </View>
  )
}
