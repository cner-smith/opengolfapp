import { useEffect, useRef, useState } from 'react'
import { Modal, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TYPE } from '../../lib/typography'
import { PressableTouch } from '../ui/PressableTouch'

interface IntroTourProps {
  visible: boolean
  onDismiss: () => void
  onStartRound: () => void
}

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

const CARDS = [
  {
    title: "Here's the idea",
    body: "OGA turns every round you log into strokes-gained insight — where you're actually winning and losing shots.",
  },
  {
    title: 'Log a round two ways',
    body: 'Track live on the course with GPS, or enter a past round from the scorecard afterward. Your call, every time.',
  },
  {
    title: 'On the course, keep it light',
    body: 'Before the shot: set your aim and drop your ball. After (while walking): club, lie, slope — or skip it. Metadata is always optional.',
  },
  {
    title: "Then see where you're losing strokes",
    body: 'Stats, shot patterns, and a practice plan build up as you log. Start with one round.',
  },
] as const

const LAST_PAGE = CARDS.length - 1

export function IntroTour({ visible, onDismiss, onStartRound }: IntroTourProps) {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const scrollRef = useRef<ScrollView>(null)
  const [page, setPage] = useState(0)

  const goNext = () => {
    const next = Math.min(page + 1, LAST_PAGE)
    scrollRef.current?.scrollTo({ x: next * width, animated: true })
    setPage(next)
  }

  useEffect(() => {
    if (visible) {
      setPage(0)
      // Modal mounts async — the ScrollView may not be laid out yet on this tick,
      // so a synchronous scrollTo can no-op. Defer to the next frame.
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ x: 0, animated: false }))
    }
  }, [visible])

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onDismiss}>
      <View style={{ flex: 1, backgroundColor: '#F7F3E9' }}>
        {page < LAST_PAGE && (
          <PressableTouch
            onPress={onDismiss}
            hitSlop={10}
            style={{ position: 'absolute', top: insets.top + 14, right: 18, zIndex: 1 }}
          >
            <Text style={[TYPE.kicker, KICKER]}>Skip</Text>
          </PressableTouch>
        )}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            setPage(Math.round(e.nativeEvent.contentOffset.x / width))
          }}
        >
          {CARDS.map((card) => (
            <View
              key={card.title}
              style={{
                width,
                paddingTop: insets.top + 72,
                paddingBottom: insets.bottom + 32,
                paddingHorizontal: 28,
                justifyContent: 'center',
              }}
            >
              <Text
                style={[TYPE.serif, { color: '#1C211C', fontSize: 30, lineHeight: 36, marginBottom: 16 }]}
              >
                {card.title}
              </Text>
              <Text style={[TYPE.body, { color: '#5C6356', fontSize: 16, lineHeight: 24 }]}>
                {card.body}
              </Text>
            </View>
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: 28, paddingBottom: insets.bottom + 24 }}>
          {page < LAST_PAGE ? (
            <PressableTouch
              onPress={goNext}
              style={{ backgroundColor: '#1F3D2C', borderRadius: 2, paddingVertical: 16, alignItems: 'center' }}
            >
              <Text style={[TYPE.bodyBold, { color: '#F2EEE5', fontSize: 15, letterSpacing: 0.3 }]}>
                Next
              </Text>
            </PressableTouch>
          ) : (
            <>
              <PressableTouch
                onPress={onStartRound}
                style={{
                  backgroundColor: '#1F3D2C',
                  borderRadius: 2,
                  paddingVertical: 16,
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <Text style={[TYPE.bodyBold, { color: '#F2EEE5', fontSize: 15, letterSpacing: 0.3 }]}>
                  Start my first round
                </Text>
              </PressableTouch>
              <PressableTouch onPress={onDismiss} style={{ alignItems: 'center', paddingVertical: 10 }}>
                <Text style={[TYPE.body, { color: '#5C6356', fontSize: 14 }]}>I'll explore first</Text>
              </PressableTouch>
            </>
          )}
        </View>
      </View>
    </Modal>
  )
}
