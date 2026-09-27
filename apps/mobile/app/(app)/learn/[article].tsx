import { Pressable, ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { findLearnArticle } from '@oga/core'
import { AppBar } from '../../../components/ui/AppBar'
import { BODY, C, KICKER, TITLE } from '../../../components/learn/primitives'
import { MOBILE_ARTICLES } from '../../../components/learn/articles'
import { PaperSurface } from '../../../components/paper/Paper'
import { PaperTile } from '../../../components/paper/Section'
import { FONT_CAP, P } from '../../../components/paper/tokens'
import { FONT, TYPE } from '../../../lib/typography'

// The dark AppBar keeps its mono-caps back link.
const BACK: import('react-native').TextStyle = {
  fontFamily: FONT.mono,
  color: 'rgba(242,238,229,0.6)',
  fontSize: 10,
  letterSpacing: 1.4,
  textTransform: 'uppercase',
  padding: 4,
}

export default function ArticleScreen() {
  const router = useRouter()
  const { article: slug } = useLocalSearchParams<{ article: string }>()
  const found = slug ? findLearnArticle(slug) : null

  return (
    <PaperSurface style={{ flex: 1 }}>
      <AppBar
        eyebrow={found?.section.title ?? 'Yardage book'}
        title={found?.article.title ?? 'Article'}
        right={
          <Pressable onPress={() => router.back()}>
            <Text maxFontSizeMultiplier={FONT_CAP} style={BACK}>
              ← Back
            </Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 64 }}>
        {!found ? (
          <NotFound />
        ) : found.article.status === 'soon' ? (
          <StubBody title={found.article.title} />
        ) : (
          <>
            {found.article.status === 'draft' && <DraftBanner />}
            <LiveArticle id={found.article.id} />
          </>
        )}
      </ScrollView>
    </PaperSurface>
  )
}

/** Render the per-article component registered for this catalog id. */
function LiveArticle({ id }: { id: string }) {
  const Article = MOBILE_ARTICLES[id]
  if (Article) return <Article />
  return <StubBody title="Article" />
}

function NotFound() {
  return (
    <View>
      <Text maxFontSizeMultiplier={FONT_CAP} style={TITLE}>Article not found.</Text>
      <Text maxFontSizeMultiplier={FONT_CAP} style={{ ...BODY, color: P.inkDim, fontFamily: FONT.bodyItalic }}>
        That guide does not exist yet.
      </Text>
    </View>
  )
}

function DraftBanner() {
  return (
    <PaperTile style={{ marginBottom: 20 }} innerStyle={{ borderLeftWidth: 4, borderLeftColor: P.warn }}>
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { color: P.warn, fontSize: 16, lineHeight: 22, marginBottom: 6 }]}>
        Work in progress
      </Text>
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.ink, fontSize: 13, lineHeight: 19 }]}>
        This guide is being reviewed for accuracy. Treat specific technique
        advice as provisional until the notice is removed.
      </Text>
    </PaperTile>
  )
}

function StubBody({ title }: { title: string }) {
  return (
    <View>
      <Text maxFontSizeMultiplier={FONT_CAP} style={{ ...KICKER, marginBottom: 10 }}>Coming soon</Text>
      <Text maxFontSizeMultiplier={FONT_CAP} style={TITLE}>{title}</Text>
      <Text maxFontSizeMultiplier={FONT_CAP} style={{ ...BODY, color: C.mute, fontFamily: FONT.bodyItalic }}>
        This guide is being written. Check back soon.
      </Text>
    </View>
  )
}
