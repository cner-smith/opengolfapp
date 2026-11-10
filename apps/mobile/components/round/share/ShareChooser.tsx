import { useEffect, useRef, useState, type ComponentType } from 'react'
import { Alert, Modal, PixelRatio, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { ShareCardModel } from '@oga/core'
import { TYPE } from '../../../lib/typography'
import { Key, KeyText, PaperSurface, Rocker } from '../../paper/Paper'
import { Icon } from '../../paper/icons'
import { FONT_CAP, P, R } from '../../paper/tokens'
import { PressableTouch } from '../../ui/PressableTouch'
import { CARD_H, CARD_W, type ShareCardProps, type ShareTone } from './cardParts'
import { ShareCardScorecard } from './ShareCardScorecard'
import { ShareCardYardageBook } from './ShareCardYardageBook'
import { ShareCardAgainstPar } from './ShareCardAgainstPar'
import { ShareCardHeroNumber } from './ShareCardHeroNumber'
import { ShareCardStrokesGained } from './ShareCardStrokesGained'

type StyleId = 1 | 2 | 3 | 4 | 5

const STYLES: { id: StyleId; name: string; Card: ComponentType<ShareCardProps> }[] = [
  { id: 1, name: 'Scorecard', Card: ShareCardScorecard },
  { id: 2, name: 'Yardage book', Card: ShareCardYardageBook },
  { id: 3, name: 'Against par', Card: ShareCardAgainstPar },
  { id: 4, name: 'Big number', Card: ShareCardHeroNumber },
  { id: 5, name: 'Strokes gained', Card: ShareCardStrokesGained },
]

// The style and tone last shared, per device. First use: style 4, light.
const KEY = 'oga.share-card-v1'
const DEFAULT = { style: 4 as StyleId, tone: 'light' as ShareTone }

async function readChoice(): Promise<typeof DEFAULT> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    const [s, t] = (raw ?? '').split(':')
    const style = Number(s) as StyleId
    return {
      style: STYLES.some((x) => x.id === style) ? style : DEFAULT.style,
      tone: t === 'dark' ? 'dark' : 'light',
    }
  } catch {
    return DEFAULT
  }
}

function saveChoice(style: StyleId, tone: ShareTone) {
  AsyncStorage.setItem(KEY, `${style}:${tone}`).catch(() => {})
}

// The exported PNG is 1080 × 1350. Android sizes the capture in pixels, iOS in
// points (it renders at the screen scale).
const OUT_W = 1080

// Share opens this sheet (#1437): swipe or step through the card styles
// (strokes gained only when the round has SG), pick light or dark, Share.
// The chosen card is also drawn full size off screen: that's what is captured.
export function ShareChooser({ model, visible, onClose }: { model: ShareCardModel; visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets()
  const { height: winH } = useWindowDimensions()
  const styles = STYLES.filter((s) => s.id !== 5 || model.sg != null)
  const [style, setStyle] = useState<StyleId>(DEFAULT.style)
  const [tone, setTone] = useState<ShareTone>(DEFAULT.tone)
  const [pageW, setPageW] = useState(0)
  const [sharing, setSharing] = useState(false)
  // Share waits for the remembered choice, or it could capture the default.
  const [loaded, setLoaded] = useState(false)
  const scroller = useRef<ScrollView>(null)
  const captureTarget = useRef<View>(null)

  useEffect(() => {
    if (!visible) return
    let active = true
    setLoaded(false)
    readChoice().then((saved) => {
      if (!active) return
      setStyle(saved.style)
      setTone(saved.tone)
      setLoaded(true)
    })
    return () => {
      active = false
    }
  }, [visible])

  // A remembered style 5 on a round with no SG falls back to the default.
  const current = styles.find((s) => s.id === style) ?? styles.find((s) => s.id === DEFAULT.style)!
  const index = styles.indexOf(current)
  const scale = pageW > 0 ? Math.min(pageW / CARD_W, (winH * 0.52) / CARD_H) : 0

  useEffect(() => {
    if (pageW > 0) scroller.current?.scrollTo({ x: index * pageW, animated: false })
  }, [pageW, index])

  // Nothing changes the card while it's being captured.
  function choose(next: StyleId, nextTone: ShareTone = tone) {
    if (sharing) return
    setStyle(next)
    setTone(nextTone)
  }
  function close() {
    if (!sharing) onClose()
  }

  function step(by: number) {
    const next = styles[index + by]
    if (next) choose(next.id)
  }

  async function share() {
    if (sharing || !loaded || !captureTarget.current) return
    setSharing(true)
    try {
      const k = Platform.OS === 'ios' ? PixelRatio.get() : 1
      const uri = await captureRef(captureTarget, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        width: OUT_W / k,
        height: (OUT_W * CARD_H) / CARD_W / k,
      })
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing unavailable', 'This device cannot share files.')
        return
      }
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share round' })
      saveChoice(current.id, tone)
    } catch (err) {
      // console.error is what reaches logcat on a device build.
      // eslint-disable-next-line no-console
      console.error('[round/share]', err)
      Alert.alert('Share failed', (err as Error).message)
    } finally {
      setSharing(false)
    }
  }

  const Card = current.Card
  return (
    <>
      {visible && (
        // Off screen, full size, never seen: collapsable={false} keeps the
        // subtree the rasteriser reads.
        <View pointerEvents="none" collapsable={false} style={{ position: 'absolute', left: -10000, top: 0 }}>
          <View ref={captureTarget} collapsable={false}>
            <Card model={model} tone={tone} />
          </View>
        </View>
      )}
      <Modal
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType="slide"
        visible={visible}
        onRequestClose={close}
      >
        <View style={{ flex: 1, backgroundColor: P.scrim, justifyContent: 'flex-end' }}>
          <Pressable
            accessibilityLabel="Close"
            onPress={close}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <PaperSurface
            fill={P.raised}
            style={{
              borderTopWidth: 1,
              borderColor: P.ink,
              borderTopLeftRadius: R,
              borderTopRightRadius: R,
              paddingTop: 16,
              paddingHorizontal: 16,
              paddingBottom: insets.bottom + 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { fontSize: 22, lineHeight: 27, color: P.ink }]}>
                Share round
              </Text>
              <Key accessibilityLabel="Close" onPress={onClose} disabled={sharing} faceStyle={{ minHeight: 44, paddingHorizontal: 14 }}>
                <KeyText disabled={sharing}>Close</KeyText>
              </Key>
            </View>

            <View onLayout={(e) => setPageW(Math.round(e.nativeEvent.layout.width))} style={{ marginTop: 14 }}>
              {pageW > 0 && (
                <ScrollView
                  ref={scroller}
                  horizontal
                  pagingEnabled
                  scrollEnabled={!sharing}
                  showsHorizontalScrollIndicator={false}
                  contentOffset={{ x: index * pageW, y: 0 }}
                  onMomentumScrollEnd={(e) => {
                    const next = styles[Math.round(e.nativeEvent.contentOffset.x / pageW)]
                    if (next && next.id !== current.id) choose(next.id)
                  }}
                >
                  {styles.map(({ id, name, Card: Preview }) => (
                    <View key={id} style={{ width: pageW, alignItems: 'center' }}>
                      <View
                        accessible
                        accessibilityLabel={`${name} card, ${tone}`}
                        style={{ width: CARD_W * scale, height: CARD_H * scale, borderWidth: 1, borderColor: P.ink, overflow: 'hidden' }}
                      >
                        <View style={{ transform: [{ scale }], transformOrigin: 'left top' }}>
                          <Preview model={model} tone={tone} />
                        </View>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
              <Key accessibilityLabel="Previous style" onPress={() => step(-1)} disabled={sharing || index === 0} faceStyle={{ width: 44, minHeight: 44 }}>
                <Icon.prev size={22} color={index === 0 ? P.ink35 : P.ink} />
              </Key>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 15, color: P.ink }]}>
                  {current.name}
                </Text>
                <View style={{ flexDirection: 'row', gap: 2, marginTop: 2 }}>
                  {styles.map((s) => (
                    <PressableTouch
                      key={s.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${s.name} style`}
                      accessibilityState={{ selected: s.id === current.id }}
                      onPress={() => choose(s.id)}
                      disabled={sharing}
                      hitSlop={6}
                      style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          borderWidth: 1,
                          borderColor: P.ink,
                          backgroundColor: s.id === current.id ? P.ink : 'transparent',
                        }}
                      />
                    </PressableTouch>
                  ))}
                </View>
              </View>
              <Key
                accessibilityLabel="Next style"
                onPress={() => step(1)}
                disabled={sharing || index === styles.length - 1}
                faceStyle={{ width: 44, minHeight: 44 }}
              >
                <Icon.next size={22} color={index === styles.length - 1 ? P.ink35 : P.ink} />
              </Key>
            </View>

            <Rocker
              style={{ marginTop: 14 }}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
              value={tone}
              onChange={(t) => t && choose(current.id, t)}
            />

            <Key
              accessibilityLabel="Share"
              tone="primary"
              onPress={share}
              disabled={sharing || !loaded}
              style={{ marginTop: 14 }}
              faceStyle={{ minHeight: 50, paddingHorizontal: 12, flexDirection: 'row', gap: 8 }}
            >
              <Icon.share size={18} color={sharing || !loaded ? P.ink35 : P.raised} />
              <KeyText tone="primary" bold size={16} disabled={sharing || !loaded}>
                {sharing ? 'Rendering…' : 'Share'}
              </KeyText>
            </Key>
          </PaperSurface>
        </View>
      </Modal>
    </>
  )
}
