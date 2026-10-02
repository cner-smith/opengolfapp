import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CAPTURE_MODES, CAPTURE_MODE_LABELS, type CaptureMode } from '@oga/core'
import { TYPE } from '../../../lib/typography'
import { TeePicker } from '../RoundTeeSelector'
import { Key, KeyText } from '../../paper/Paper'
import { SectionHead } from '../../paper/Section'
import { FONT_CAP, P } from '../../paper/tokens'
import { META } from './styles'

// Setup step shown after a course is resolved but before the round is
// created — mirrors web's NewRoundPage where the tee is an up-front field.
// Tee is optional so it never blocks pace of play; "Start round" works with
// no tee picked, and the scorecard can still set it later.
export function RoundSetupStep({
  courseId,
  courseName,
  mode,
  busy,
  onBack,
  onStart,
}: {
  courseId: string
  courseName: string
  mode: 'live' | 'past'
  busy: boolean
  onBack: () => void
  onStart: (
    courseTeeId: string | null,
    teeColor: string | null,
    captureMode: CaptureMode,
  ) => void
}) {
  const insets = useSafeAreaInsets()
  const [teeId, setTeeId] = useState<string | null>(null)
  const [teeColor, setTeeColor] = useState<string | null>(null)
  const [captureMode, setCaptureMode] = useState<CaptureMode>('track_patterns')

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: P.chrome,
        paddingTop: insets.top + 14,
        paddingHorizontal: 18,
      }}
    >
      <Text maxFontSizeMultiplier={FONT_CAP} style={{ ...META, marginBottom: 6 }}>
        {mode === 'past' ? 'Log past round' : 'Start live round'}
      </Text>
      <Text
        maxFontSizeMultiplier={FONT_CAP}
        style={[TYPE.serif, {
          color: P.ink,
          fontSize: 28,
          marginBottom: 18,
        }]}
      >
        {courseName}
      </Text>

      <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
        {mode === 'live' && (
          <View style={{ marginBottom: 22 }}>
            <SectionHead title="How do you want to track it?" />
            {CAPTURE_MODES.map((cm) => {
              const active = captureMode === cm
              return (
                <Key
                  key={cm}
                  accessibilityLabel={CAPTURE_MODE_LABELS[cm].title}
                  latched={active}
                  onPress={() => setCaptureMode(cm)}
                  style={{ marginBottom: 8 }}
                  faceStyle={{ alignItems: 'stretch', padding: 14 }}
                >
                  <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.bodyBold, { color: P.ink, fontSize: 15, marginBottom: 2 }]}>
                    {CAPTURE_MODE_LABELS[cm].title}
                  </Text>
                  <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12 }]}>
                    {CAPTURE_MODE_LABELS[cm].subtitle}
                  </Text>
                </Key>
              )
            })}
          </View>
        )}

        <SectionHead title="Tee played" style={{ marginBottom: 4 }} />
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12, marginBottom: 12 }]}>
          Optional — add the tee's rating and slope for a handicap differential.
          You can set it later from the scorecard.
        </Text>

        <TeePicker
          courseId={courseId}
          selectedTeeId={teeId}
          onSelect={(t) => {
            setTeeId(t.id)
            setTeeColor(t.tee_color)
          }}
          busy={busy}
        />
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          gap: 10,
          paddingVertical: 14,
          paddingBottom: insets.bottom + 14,
        }}
      >
        <Key accessibilityLabel="Back" onPress={onBack} disabled={busy} style={{ flex: 1 }} faceStyle={{ minHeight: 48 }}>
          <KeyText size={13} disabled={busy}>Back</KeyText>
        </Key>
        <Key
          tone="primary"
          accessibilityLabel={busy ? 'Starting…' : mode === 'past' ? 'Log round →' : 'Start round →'}
          onPress={() => onStart(teeId, teeColor, captureMode)}
          disabled={busy}
          style={{ flex: 2 }}
          faceStyle={{ minHeight: 48 }}
        >
          <KeyText tone="primary" bold disabled={busy}>
            {busy ? 'Starting…' : mode === 'past' ? 'Log round →' : 'Start round →'}
          </KeyText>
        </Key>
      </View>
    </View>
  )
}
