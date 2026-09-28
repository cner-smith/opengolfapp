import { useEffect, useRef, useState } from 'react'
import { Modal, ScrollView, Text, View, useWindowDimensions, StatusBar } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TYPE } from '../../lib/typography'
import { PressableTouch } from '../ui/PressableTouch'
import { Key, KeyText, PaperSurface } from '../paper/Paper'
import { FONT_CAP, P } from '../paper/tokens'

interface IntroTourProps {
  visible: boolean
  onDismiss: () => void
  onStartRound: () => void
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
    body: 'Before the shot: aim, then drop your ball. Details like club and lie come later, in a quick end-of-hole summary — always optional.',
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

  // Cream tour over a dark-header screen. An Android Modal copies the
  // activity's status-bar style when it opens, and RN applies StatusBar
  // entries asynchronously — so push dark icons first, then open.
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!visible) {
      setShown(false)
      return
    }
    // After the screen underneath has pushed its own entry (Home's AppBar
    // focuses in the same tick), so ours is on top.
    let entry: ReturnType<typeof StatusBar.pushStackEntry> | null = null
    const t1 = setTimeout(() => {
      entry = StatusBar.pushStackEntry({ barStyle: 'dark-content' })
    }, 50)
    const t2 = setTimeout(() => setShown(true), 120)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      if (entry) StatusBar.popStackEntry(entry)
    }
  }, [visible])
  return (
    <>
    <Modal visible={shown} animationType="fade" onRequestClose={onDismiss}>
      <PaperSurface style={{ flex: 1 }}>
        {page < LAST_PAGE && (
          <PressableTouch
            accessibilityRole="button"
            accessibilityLabel="Skip intro tour"
            onPress={onDismiss}
            hitSlop={10}
            style={{ position: 'absolute', top: insets.top + 14, right: 18, zIndex: 1 }}
          >
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 14 }]}>Skip</Text>
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
                maxFontSizeMultiplier={FONT_CAP}
                style={[TYPE.serif, { color: P.ink, fontSize: 30, lineHeight: 36, marginBottom: 16 }]}
              >
                {card.title}
              </Text>
              <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 16, lineHeight: 24 }]}>
                {card.body}
              </Text>
            </View>
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: 28, paddingBottom: insets.bottom + 24 }}>
          {page < LAST_PAGE ? (
            <Key tone="primary" accessibilityLabel="Next card" onPress={goNext} faceStyle={{ minHeight: 52 }}>
              <KeyText tone="primary" bold size={15}>
                Next
              </KeyText>
            </Key>
          ) : (
            <>
              <Key
                tone="primary"
                accessibilityLabel="Start my first round"
                onPress={onStartRound}
                style={{ marginBottom: 12 }}
                faceStyle={{ minHeight: 52 }}
              >
                <KeyText tone="primary" bold size={15}>
                  Start my first round
                </KeyText>
              </Key>
              <Key accessibilityLabel="Skip — I'll explore first" onPress={onDismiss} faceStyle={{ minHeight: 46 }}>
                <KeyText size={14}>I'll explore first</KeyText>
              </Key>
            </>
          )}
        </View>
      </PaperSurface>
    </Modal>
    </>
  )
}
