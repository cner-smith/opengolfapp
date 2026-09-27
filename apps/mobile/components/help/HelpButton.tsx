import { useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { getHelpTopic, type HelpTopicId } from '@oga/core'
import { TYPE } from '../../lib/typography'
import { HardShadow, Key, KeyText, PaperSurface } from '../paper/Paper'
import { FONT_CAP, P, R } from '../paper/tokens'
import { PressableTouch } from '../ui/PressableTouch'

// Pull-only contextual help. A "?" pill opens a centered fade Modal with the
// topic body + optional Learn link. Never auto-opens; dismiss via backdrop or
// Close. topicId is the HelpTopicId union (compile-checked, not a bare string).
export function HelpButton({ topicId }: { topicId: HelpTopicId }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const topic = getHelpTopic(topicId)
  if (!topic) return null

  return (
    <>
      <PressableTouch
        accessibilityRole="button"
        accessibilityLabel={`Help: ${topic.title}`}
        onPress={() => setOpen(true)}
        style={{
          width: 30, height: 30, borderRadius: R, borderWidth: 1,
          borderColor: P.line, alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 15 }]}>?</Text>
      </PressableTouch>

      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: P.scrim, justifyContent: 'center', padding: 24 }}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <HardShadow>
              <PaperSurface
                fill={P.raised}
                style={{ borderWidth: 1, borderColor: P.ink, borderRadius: R, padding: 22, overflow: 'hidden' }}
              >
                <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { fontSize: 20, lineHeight: 26, color: P.ink, marginBottom: 10 }]}>
                  {topic.title}
                </Text>
                <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 14, lineHeight: 21, color: P.ink }]}>
                  {topic.body}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                  {topic.articleId && (
                    <Key
                      accessibilityLabel={`Read more: ${topic.title}`}
                      onPress={() => {
                        setOpen(false)
                        router.push({
                          pathname: '/(app)/learn/[article]',
                          params: { article: topic.articleId! },
                        })
                      }}
                      faceStyle={{ minHeight: 42, paddingHorizontal: 14 }}
                    >
                      <KeyText size={14} bold style={{ color: P.forest }}>Learn more →</KeyText>
                    </Key>
                  )}
                  <Key accessibilityLabel="Close" onPress={() => setOpen(false)} faceStyle={{ minHeight: 42, paddingHorizontal: 16 }}>
                    <KeyText size={14}>Close</KeyText>
                  </Key>
                </View>
              </PaperSurface>
            </HardShadow>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}
