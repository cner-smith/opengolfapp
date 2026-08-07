import { useState } from 'react'
import { Modal, Pressable, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { getHelpTopic, type HelpTopicId } from '@oga/core'
import { TYPE } from '../../lib/typography'
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
          width: 30, height: 30, borderRadius: 999, borderWidth: 1,
          borderColor: '#D9D2BF', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Text style={[TYPE.body, { color: '#5C6356', fontSize: 15 }]}>?</Text>
      </PressableTouch>

      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ backgroundColor: '#F7F3E9', borderRadius: 8, padding: 22 }}
          >
            <Text style={[TYPE.serif, { fontSize: 19, color: '#1C211C', marginBottom: 10 }]}>
              {topic.title}
            </Text>
            <Text style={[TYPE.body, { fontSize: 14, lineHeight: 21, color: '#3A3F36' }]}>
              {topic.body}
            </Text>
            {topic.articleId && (
              <PressableTouch
                accessibilityRole="button"
                accessibilityLabel={`Read more: ${topic.title}`}
                onPress={() => {
                  setOpen(false)
                  router.push({
                    pathname: '/(app)/learn/[article]',
                    params: { article: topic.articleId! },
                  })
                }}
                style={{ marginTop: 16 }}
              >
                <Text style={[TYPE.bodyBold, { color: '#1F3D2C', fontSize: 14 }]}>Learn more →</Text>
              </PressableTouch>
            )}
            <PressableTouch
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={() => setOpen(false)}
              style={{ marginTop: 18, alignSelf: 'flex-end' }}
            >
              <Text style={[TYPE.bodyBold, { color: '#5C6356', fontSize: 14 }]}>Close</Text>
            </PressableTouch>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}
